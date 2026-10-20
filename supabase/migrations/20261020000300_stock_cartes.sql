-- ============================================================================
-- Stock de cartes : réceptions, coût réel à la vente, annulations
-- ============================================================================
-- Une réception de cartes = « on a reçu N cartes pour X $ ». L'achat va au
-- STOCK (un actif, pas une dépense) ; chaque vente en sort une carte à son
-- coût moyen. Les cartes ne sont plus jamais comptées deux fois.
--
-- Tout se recalcule tout seul :
--   - une réception (même datée dans le passé) recalcule le coût des ventes
--     qui suivent ;
--   - annuler un document remet ses cartes en stock et retire leur coût
--     (avant, seul le revenu disparaissait) ;
--   - supprimer une réception recalcule aussi le coût des ventes.
-- ============================================================================

set local lock_timeout = '5s';

-- Sous ce nombre de cartes en stock, l'app prévient (écran Cartes, courriel du lundi).
alter table parametres add column if not exists seuil_stock_cartes integer not null default 10
  check (seuil_stock_cartes between 0 and 100000);

-- ---------------------------------------------------------------------------
-- Coût moyen pondéré PERPÉTUEL : à chaque réception, la moyenne se refait sur
-- les cartes encore en stock (les cartes déjà vendues n'y comptent plus).
-- Ce qui a été payé = coût des cartes vendues + valeur du stock, toujours.
-- Sans aucune réception, repli sur le coût unitaire saisi (écran Marge).
-- ---------------------------------------------------------------------------
create or replace function cout_moyen(p_produit_id uuid, p_date date default current_date)
returns numeric
language plpgsql stable as $$
declare m record; v_qte numeric := 0; v_val numeric := 0; v_moy numeric := null;
begin
  for m in
    select type, quantite, cout_unitaire
      from inventaire_mouvements
     where produit_id = p_produit_id and date <= p_date
     order by date, case when type = 'achat' then 0 else 1 end, cree_le, id
  loop
    if m.type = 'achat' and m.cout_unitaire is not null then
      -- Stock négatif (vendu avant d'être reçu) : la réception repart de zéro.
      if v_qte <= 0 then v_qte := 0; v_val := 0; end if;
      v_qte := v_qte + m.quantite;
      v_val := v_val + m.quantite * m.cout_unitaire;
      v_moy := v_val / v_qte;
    elsif v_moy is not null then
      v_qte := v_qte + m.quantite;
      v_val := v_val + m.quantite * v_moy;
      if v_qte <= 0 then v_val := 0; end if;
    end if;
  end loop;
  if v_moy is not null then return v_moy; end if;
  return coalesce(
    (select cu.montant_ht
       from couts_unitaires cu
      where cu.composante = 'carte_vierge' and cu.date_effet <= p_date
        and (cu.produit_id = p_produit_id or cu.produit_id is null)
      order by (cu.produit_id is not null) desc, cu.date_effet desc
      limit 1),
    0)::numeric;
end;
$$;

-- ---------------------------------------------------------------------------
-- Le stock d'un document suit ses lignes ET son statut
-- ---------------------------------------------------------------------------
create or replace function synchroniser_stock_vente(p_vente_id uuid)
returns void language plpgsql as $$
declare v ventes%rowtype; t types_document%rowtype;
begin
  select * into v from ventes where id = p_vente_id;
  if not found then return; end if;
  select * into t from types_document where code = v.type_document;

  delete from inventaire_mouvements where vente_id = p_vente_id;
  if coalesce(t.affecte_stock, false) and v.statut not in ('annulee', 'brouillon', 'refusee') then
    insert into inventaire_mouvements (date, produit_id, type, quantite, cout_unitaire, vente_id, note)
    select v.date, l.produit_id,
           case when t.signe = -1 then 'retour' else 'vente' end,
           -t.signe * sum(l.quantite),
           cout_moyen(l.produit_id, v.date), v.id, t.libelle || ' ' || v.numero
      from vente_lignes l
      join produits p on p.id = l.produit_id
     where l.vente_id = v.id and p.suivi_stock
     group by l.produit_id
    having sum(l.quantite) > 0;
  end if;
  perform recalculer_cogs(p_vente_id);
end;
$$;

create or replace function trg_lignes_vente() returns trigger
language plpgsql as $$
declare v_vente_id uuid;
begin
  v_vente_id := coalesce(new.vente_id, old.vente_id);
  perform recalculer_totaux_vente(v_vente_id);
  perform synchroniser_stock_vente(v_vente_id);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function trg_stock_document() returns trigger
language plpgsql as $$
begin
  if (old.statut, old.date, old.type_document) is distinct from (new.statut, new.date, new.type_document) then
    perform synchroniser_stock_vente(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists t_stock_document on ventes;
create trigger t_stock_document after update on ventes
  for each row execute function trg_stock_document();

-- Le coût des ventes d'un produit, recalculé à partir d'une date (après une
-- réception, une correction ou une suppression).
create or replace function recalculer_couts_produit(p_produit_id uuid, p_depuis date)
returns void language plpgsql as $$
declare v record;
begin
  for v in
    select distinct l.vente_id
      from vente_lignes l join ventes s on s.id = l.vente_id
     where l.produit_id = p_produit_id and s.date >= p_depuis
  loop
    perform synchroniser_stock_vente(v.vente_id);
  end loop;
end;
$$;

-- Le produit « carte » suivi au stock (le premier, s'il y en a plusieurs).
create or replace function produit_carte() returns uuid
language sql stable as $$
  select id from produits where actif and suivi_stock and est_carte order by nom limit 1
$$;

-- ---------------------------------------------------------------------------
-- Réceptions
-- ---------------------------------------------------------------------------
-- p_total : ce qui a été payé. Société non inscrite aux taxes : c'est le coût.
-- Société inscrite : p_taxes sépare la TPS et la TVQ récupérables.
create or replace function recevoir_cartes(
  p_date date, p_quantite integer, p_total numeric,
  p_description text default null, p_produit_id uuid default null,
  p_mode_paiement mode_paiement default 'autre', p_piece_jointe_url text default null,
  p_taxes numeric default 0
) returns uuid
language plpgsql as $$
declare v_id uuid; v_produit uuid; v_cout numeric;
begin
  v_produit := coalesce(p_produit_id, produit_carte());
  if v_produit is null then raise exception 'Aucun produit « carte » suivi au stock.'; end if;
  if p_quantite is null or p_quantite <= 0 then raise exception 'Le nombre de cartes reçues doit être plus grand que zéro.'; end if;
  if p_total is null or p_total <= 0 then raise exception 'Le montant payé doit être plus grand que zéro.'; end if;
  if coalesce(p_taxes, 0) < 0 or coalesce(p_taxes, 0) >= p_total then raise exception 'Les taxes doivent être plus petites que le total.'; end if;

  insert into transactions (date, description, montant_ht, type, categorie, nature,
                            source, mode_paiement, province, piece_jointe_url, est_stock)
  values (p_date, coalesce(nullif(btrim(p_description), ''), 'Réception de ' || p_quantite || ' cartes'),
          p_total - coalesce(p_taxes, 0), 'depense', 'cartes_achat', 'variable',
          'manuel', p_mode_paiement, (select province_etablissement from parametres where id),
          p_piece_jointe_url, true)
  returning id into v_id;
  if coalesce(p_taxes, 0) > 0 then
    perform poser_lignes_taxe(v_id, p_total - p_taxes, p_taxes);
  end if;

  -- Le coût réel : ce qui n'est pas récupéré en crédits de taxe.
  select cout_reel into v_cout from transactions where id = v_id;
  insert into inventaire_mouvements (date, produit_id, type, quantite, cout_unitaire, transaction_id, note)
  values (p_date, v_produit, 'achat', p_quantite, round(v_cout / p_quantite, 4), v_id, 'Réception de cartes');

  perform recalculer_couts_produit(v_produit, p_date);
  return v_id;
end;
$$;

-- Une dépense déjà inscrite était un achat de cartes : sa part « cartes » va
-- au stock ; le reste (frais, stickers…) reste une dépense à part.
create or replace function convertir_en_reception(p_transaction_id uuid, p_quantite integer, p_montant_cartes numeric)
returns uuid
language plpgsql as $$
declare t transactions%rowtype; v_stock uuid; v_produit uuid; v_cout numeric;
begin
  select * into t from transactions where id = p_transaction_id for update;
  if not found then raise exception 'Dépense introuvable.'; end if;
  if t.type <> 'depense' or t.est_stock or t.vente_id is not null
     or t.categorie in ('cout_marchandises_vendues', 'perte_inventaire') then
    raise exception 'Seule une dépense saisie à la main peut devenir une réception de cartes.';
  end if;
  v_produit := produit_carte();
  if v_produit is null then raise exception 'Aucun produit « carte » suivi au stock.'; end if;
  if p_quantite is null or p_quantite <= 0 then raise exception 'Le nombre de cartes reçues doit être plus grand que zéro.'; end if;
  if p_montant_cartes is null or p_montant_cartes <= 0 or p_montant_cartes > t.montant_ht then
    raise exception 'Le montant des cartes doit être entre 0 et le montant de la dépense (% $).', t.montant_ht;
  end if;
  if p_montant_cartes < t.montant_ht and t.total_taxes <> 0 then
    raise exception 'Une dépense avec des taxes se convertit en entier.';
  end if;

  if p_montant_cartes = t.montant_ht then
    update transactions set est_stock = true, categorie = 'cartes_achat', nature = 'variable'
     where id = t.id;
    v_stock := t.id;
  else
    insert into transactions (date, description, montant_ht, type, categorie, nature, source,
                              mode_paiement, province, piece_jointe_url, est_stock, transaction_liee_id, note)
    values (t.date, 'Cartes — ' || t.description, p_montant_cartes, 'depense', 'cartes_achat', 'variable',
            t.source, t.mode_paiement, t.province, t.piece_jointe_url, true, t.id,
            'Partie « cartes » de la dépense du ' || to_char(t.date, 'YYYY-MM-DD'))
    returning id into v_stock;
    update transactions set montant_ht = montant_ht - p_montant_cartes,
           description = description || ' (hors cartes)'
     where id = t.id;
  end if;

  select cout_reel into v_cout from transactions where id = v_stock;
  insert into inventaire_mouvements (date, produit_id, type, quantite, cout_unitaire, transaction_id, note)
  values (t.date, v_produit, 'achat', p_quantite, round(v_cout / p_quantite, 4), v_stock, 'Réception de cartes');

  perform recalculer_couts_produit(v_produit, t.date);
  return v_stock;
end;
$$;

-- Corriger une réception : nombre de cartes, total payé, et la part de ce
-- total qui était pour les cartes. Le reste (frais, stickers…) devient une
-- dépense à part, liée à la réception ; rien ne disparaît des comptes.
create or replace function modifier_reception(p_transaction_id uuid, p_quantite integer, p_total numeric, p_montant_cartes numeric)
returns void
language plpgsql as $$
declare s transactions%rowtype; m inventaire_mouvements%rowtype; v_reste numeric; v_cout numeric; v_reste_id uuid;
begin
  select * into s from transactions where id = p_transaction_id and est_stock for update;
  if not found then raise exception 'Réception introuvable.'; end if;
  select * into m from inventaire_mouvements where transaction_id = s.id and type = 'achat' limit 1;
  if not found then raise exception 'Cette réception n''a pas de cartes au stock.'; end if;
  if p_quantite is null or p_quantite <= 0 then raise exception 'Le nombre de cartes reçues doit être plus grand que zéro.'; end if;
  if p_total is null or p_total <= 0 then raise exception 'Le total payé doit être plus grand que zéro.'; end if;
  if p_montant_cartes is null or p_montant_cartes <= 0 or p_montant_cartes > p_total then
    raise exception 'La part des cartes doit être plus grande que zéro et au plus égale au total payé.';
  end if;
  if s.total_taxes <> 0 and (p_montant_cartes <> p_total or p_total <> s.montant_ht + s.total_taxes) then
    raise exception 'Une réception avec des taxes ne change que de nombre de cartes.';
  end if;

  if s.total_taxes = 0 then
    update transactions set montant_ht = p_montant_cartes where id = s.id;
    v_reste := p_total - p_montant_cartes;
    if v_reste > 0 then
      if s.transaction_liee_id is not null and exists (select 1 from transactions where id = s.transaction_liee_id) then
        update transactions set montant_ht = v_reste where id = s.transaction_liee_id;
      else
        insert into transactions (date, description, montant_ht, type, categorie, nature, source,
                                  mode_paiement, province, piece_jointe_url, note)
        values (s.date, regexp_replace(s.description, '^Cartes — ', '') || ' (hors cartes)', v_reste, 'depense', 'autre', 'fixe',
                s.source, s.mode_paiement, s.province, s.piece_jointe_url,
                'Partie hors cartes de la réception du ' || to_char(s.date, 'YYYY-MM-DD'))
        returning id into v_reste_id;
        update transactions set transaction_liee_id = v_reste_id where id = s.id;
      end if;
    elsif s.transaction_liee_id is not null then
      update transactions set transaction_liee_id = null where id = s.id;
      delete from transactions where id = s.transaction_liee_id;
    end if;
  end if;

  select cout_reel into v_cout from transactions where id = s.id;
  update inventaire_mouvements set quantite = p_quantite, cout_unitaire = round(v_cout / p_quantite, 4)
   where id = m.id;
  perform recalculer_couts_produit(m.produit_id, s.date);
end;
$$;

-- Supprimer une écriture : comme avant, plus le recalcul du coût des ventes
-- quand c'était une réception de cartes.
create or replace function supprimer_transaction(
  p_id    uuid,
  p_motif text default null,
  p_par   text default null
) returns void
language plpgsql as $$
declare
  v_tx        transactions%rowtype;
  v_numero    text;
  v_bloquants text;
  v_produits  uuid[];
begin
  select * into v_tx from transactions where id = p_id;
  if not found then
    raise exception 'Écriture introuvable.';
  end if;

  if v_tx.vente_id is not null then
    select numero into v_numero from ventes where id = v_tx.vente_id;
    raise exception 'Cette écriture appartient au document %. Supprimez le document.', v_numero;
  end if;

  select string_agg(coalesce(stripe_charge_id, id::text), ', ') into v_bloquants
    from litiges
   where transaction_frais_id = p_id or transaction_reprise_id = p_id or transaction_reversal_id = p_id;
  if v_bloquants is not null then
    raise exception 'Un litige Stripe (%) s''appuie sur cette écriture.', v_bloquants;
  end if;

  if exists (select 1 from denombrements where transaction_id = p_id) then
    raise exception 'Cette écriture est l''ajustement d''un dénombrement d''inventaire.';
  end if;

  insert into suppressions (objet, numero, description, montant, date_piece, motif, supprime_par, contenu)
  values (
    'transaction',
    v_tx.reference_externe,
    v_tx.description,
    v_tx.montant_ttc,
    v_tx.date,
    nullif(trim(coalesce(p_motif, '')), ''),
    p_par,
    jsonb_build_object(
      'transaction', to_jsonb(v_tx),
      'stock', coalesce((select jsonb_agg(to_jsonb(m)) from inventaire_mouvements m where m.transaction_id = p_id), '[]'::jsonb)
    )
  );

  select array_agg(distinct produit_id) into v_produits from inventaire_mouvements where transaction_id = p_id;
  -- Le mouvement de stock ne cascade pas (sa clé est « set null ») : sans ce
  -- retrait, l'achat disparaîtrait de la comptabilité mais les cartes
  -- resteraient en stock, et la marge unitaire deviendrait fausse.
  delete from inventaire_mouvements where transaction_id = p_id;
  update transactions set transaction_liee_id = null where transaction_liee_id = p_id;
  delete from transactions where id = p_id;

  if v_produits is not null then
    perform recalculer_couts_produit(x, v_tx.date) from unnest(v_produits) x;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Marge : le coût de la carte vient des réceptions, dès qu'il y en a une.
-- ---------------------------------------------------------------------------
create or replace view v_couts_unitaires_courants with (security_invoker = true) as
select p.id as produit_id, p.sku, p.nom, c.composante,
       case when c.composante = 'carte_vierge'
                 and exists (select 1 from inventaire_mouvements m
                              where m.produit_id = p.id and m.type = 'achat' and m.cout_unitaire is not null)
            then round(cout_moyen(p.id), 2)
            else c.montant_ht
       end::numeric(12,4) as montant_ht
from produits p
cross join lateral (
  select distinct on (cu.composante) cu.composante, cu.montant_ht
  from couts_unitaires cu
  where cu.date_effet <= current_date
    and (cu.produit_id = p.id or cu.produit_id is null)
  order by cu.composante, (cu.produit_id is not null) desc, cu.date_effet desc
) c
where p.actif;

-- ---------------------------------------------------------------------------
-- Remise en ordre des documents existants (stock et coût selon leur statut)
-- ---------------------------------------------------------------------------
do $$
declare v record;
begin
  for v in select id from ventes loop
    perform synchroniser_stock_vente(v.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Correction ponctuelle des données de Tapora (production seulement : sans
-- effet ailleurs, les identifiants n'existent pas). Décidée par les associés
-- le 20 octobre 2026 :
--   - la dépense du 29 septembre (357,95 $ : cartes Alibaba, stickers,
--     immatriculation) était l'achat de 50 cartes : elle va au stock ;
--   - le reçu R-2026-00009 (client « Test », 0 $) était un essai : annulé.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from transactions
              where id = '4aaa260d-45cc-405f-85ff-ffe151fe5f5d' and not est_stock
                and montant_ht = 357.95 and type = 'depense')
     and produit_carte() is not null then
    perform convertir_en_reception('4aaa260d-45cc-405f-85ff-ffe151fe5f5d', 50, 357.95);
  end if;
  update ventes set statut = 'annulee'
   where id = 'f9f3ac8d-7c1c-4991-9c0e-30a7c9f6310b' and numero = 'R-2026-00009'
     and client_nom = 'Test' and montant_ttc = 0 and statut <> 'annulee';
end;
$$;

-- ---------------------------------------------------------------------------
revoke execute on function cout_moyen(uuid, date), synchroniser_stock_vente(uuid), trg_stock_document(), recalculer_couts_produit(uuid, date),
  produit_carte(), recevoir_cartes(date, integer, numeric, text, uuid, mode_paiement, text, numeric),
  convertir_en_reception(uuid, integer, numeric), modifier_reception(uuid, integer, numeric, numeric),
  supprimer_transaction(uuid, text, text) from public;
