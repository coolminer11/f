-- ============================================================================
-- Tapora S.E.N.C. — 09 · Fonctions et déclencheurs
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 9.1 Taxes multi-juridictions
-- ---------------------------------------------------------------------------

-- Taxes applicables à une province de destination, à une date donnée.
create or replace function taxes_applicables(p_province province_canada, p_date date)
returns table (code text, taux numeric, autorite text, recuperable_pct_defaut numeric, ordre smallint)
language sql stable as $$
  select r.code_taxe, r.taux, r.autorite, t.recuperable_pct_defaut, t.ordre
  from regles_taxes_province r
  join taxes t on t.code = r.code_taxe
  where r.province = p_province
    and p_date >= r.date_debut
    and (r.date_fin is null or p_date < r.date_fin)
  order by t.ordre;
$$;

-- Montant de chaque taxe pour une base HT.
-- Chaque taxe porte sur le HT seul : aucune province ne calcule plus une taxe
-- sur une autre (le Québec l'a abandonné en 2013).
create or replace function calculer_taxes(
  p_base numeric, p_province province_canada, p_date date default current_date)
returns table (code text, taux numeric, autorite text, montant numeric, recuperable_pct_defaut numeric)
language sql stable as $$
  select a.code, a.taux, a.autorite, round(p_base * a.taux, 2), a.recuperable_pct_defaut
  from taxes_applicables(p_province, p_date) a;
$$;

-- Total des taxes pour une base HT (raccourci de lecture).
create or replace function total_taxes(
  p_base numeric, p_province province_canada, p_date date default current_date)
returns numeric
language sql stable as $$
  select coalesce(sum(montant), 0) from calculer_taxes(p_base, p_province, p_date);
$$;

-- TTC -> HT. Stripe encaisse taxes incluses.
create or replace function ventiler_ttc(
  p_montant_ttc numeric, p_province province_canada, p_date date default current_date)
returns table (montant_ht numeric, montant_taxes numeric)
language plpgsql stable as $$
declare v_somme_taux numeric; v_ht numeric;
begin
  select coalesce(sum(taux), 0) into v_somme_taux from taxes_applicables(p_province, p_date);
  v_ht := round(p_montant_ttc / (1 + v_somme_taux), 2);
  return query select v_ht, p_montant_ttc - v_ht;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pose les lignes de taxe d'une écriture.
--   p_base         : base taxable (par défaut le montant HT complet)
--   p_total_impose : total des taxes imposé de l'extérieur (montant Stripe).
--                    Le résidu d'arrondi est porté sur la dernière taxe pour
--                    que la somme reconcilie au cent près avec l'encaissement.
-- Une écriture de REVENU a toujours recuperable_pct = 0 : une taxe perçue se
-- remet, elle ne se récupère pas.
-- ---------------------------------------------------------------------------
create or replace function poser_lignes_taxe(
  p_transaction_id uuid,
  p_base numeric default null,
  p_total_impose numeric default null
) returns numeric
language plpgsql as $$
declare
  t transactions%rowtype;
  v_base numeric; v_pct numeric; v_total numeric; v_ecart numeric; v_derniere uuid;
begin
  select * into t from transactions where id = p_transaction_id;
  if not found then
    raise exception 'Transaction % introuvable', p_transaction_id;
  end if;

  v_base := coalesce(p_base, t.montant_ht);
  v_pct  := case when t.type = 'revenu' then 0 else t.pct_recuperable end;

  delete from lignes_taxe where transaction_id = p_transaction_id;

  if v_base = 0 and coalesce(p_total_impose, 0) = 0 then
    return 0;
  end if;

  insert into lignes_taxe (transaction_id, code, autorite, taux, montant, recuperable_pct)
  select p_transaction_id, c.code, c.autorite, c.taux, c.montant,
         v_pct * c.recuperable_pct_defaut
  from calculer_taxes(v_base, t.province, t.date) c
  where c.montant <> 0;

  if p_total_impose is not null then
    select coalesce(sum(montant), 0) into v_total
      from lignes_taxe where transaction_id = p_transaction_id;
    v_ecart := p_total_impose - v_total;
    if v_ecart <> 0 then
      select l.id into v_derniere
        from lignes_taxe l join taxes tx on tx.code = l.code
       where l.transaction_id = p_transaction_id
       order by tx.ordre desc, l.code desc limit 1;
      if v_derniere is not null then
        update lignes_taxe set montant = montant + v_ecart where id = v_derniere;
      end if;
    end if;
  end if;

  select coalesce(sum(montant), 0) into v_total
    from lignes_taxe where transaction_id = p_transaction_id;
  return v_total;
end;
$$;

-- Totaux dénormalisés de l'écriture, entretenus depuis les lignes de taxe.
create or replace function recalculer_totaux_taxes(p_transaction_id uuid)
returns void language plpgsql as $$
declare v_total numeric; v_recup numeric;
begin
  select coalesce(sum(montant), 0), coalesce(sum(montant_recuperable), 0)
    into v_total, v_recup
  from lignes_taxe where transaction_id = p_transaction_id;

  update transactions
     set total_taxes = v_total, total_taxes_recuperables = v_recup
   where id = p_transaction_id
     and (total_taxes, total_taxes_recuperables) is distinct from (v_total, v_recup);
end;
$$;

create or replace function trg_lignes_taxe() returns trigger
language plpgsql as $$
begin
  perform recalculer_totaux_taxes(coalesce(new.transaction_id, old.transaction_id));
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger t_lignes_taxe after insert or update or delete on lignes_taxe
  for each row execute function trg_lignes_taxe();

-- ---------------------------------------------------------------------------
-- 9.2 Utilitaires génériques
-- ---------------------------------------------------------------------------
create or replace function trg_maj_le() returns trigger
language plpgsql as $$
begin
  new.maj_le := now();
  return new;
end;
$$;

create trigger t_maj_le before update on parametres    for each row execute function trg_maj_le();
create trigger t_maj_le before update on produits      for each row execute function trg_maj_le();
create trigger t_maj_le before update on ventes        for each row execute function trg_maj_le();
create trigger t_maj_le before update on transactions  for each row execute function trg_maj_le();
create trigger t_maj_le before update on decisions     for each row execute function trg_maj_le();
create trigger t_maj_le before update on litiges       for each row execute function trg_maj_le();
create trigger t_maj_le before update on declarations_taxes for each row execute function trg_maj_le();

-- Valeurs par défaut d'une écriture, tirées de la catégorie : applique d'office
-- la limite de 50 % sur les repas et la nature du coût.
create or replace function trg_defauts_transaction() returns trigger
language plpgsql as $$
declare d categories_defauts%rowtype;
begin
  select * into d from categories_defauts where categorie = new.categorie;
  if new.nature is null and new.type = 'depense' then
    new.nature := coalesce(d.nature_defaut, 'fixe');
  end if;
  if new.pct_recuperable is null then
    new.pct_recuperable := coalesce(d.pct_recuperable, 1);
  end if;
  return new;
end;
$$;

create trigger t_defauts_transaction before insert or update on transactions
  for each row execute function trg_defauts_transaction();

-- ---------------------------------------------------------------------------
-- 9.3 Verrou d'exercice
-- ---------------------------------------------------------------------------
create or replace function trg_verifier_exercice() returns trigger
language plpgsql as $$
declare v_date date; v_annee integer; v_statut text;
begin
  v_date := coalesce(
    case when tg_op = 'DELETE' then (to_jsonb(old) ->> 'date')::date
         else (to_jsonb(new) ->> 'date')::date end,
    current_date);
  v_annee := extract(year from v_date)::integer;

  select statut into v_statut from exercices where annee = v_annee;
  if v_statut is null then
    insert into exercices (annee, date_debut, date_fin)
    values (v_annee, make_date(v_annee, 1, 1), make_date(v_annee, 12, 31))
    on conflict (annee) do nothing;
  elsif v_statut = 'clos' then
    raise exception 'Exercice % clos : écriture au % refusée. Rouvrez l''exercice pour corriger.',
      v_annee, v_date;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger t_exercice before insert or update or delete on transactions
  for each row execute function trg_verifier_exercice();
create trigger t_exercice before insert or update or delete on ventes
  for each row execute function trg_verifier_exercice();
create trigger t_exercice before insert or update or delete on mouvements_associes
  for each row execute function trg_verifier_exercice();

-- ---------------------------------------------------------------------------
-- 9.4 Parts des associés : la somme des actifs doit valoir 100 %.
-- ---------------------------------------------------------------------------
create or replace function trg_verifier_parts() returns trigger
language plpgsql as $$
declare v_total numeric;
begin
  select coalesce(sum(part), 0) into v_total from associes where actif;
  if v_total <> 1 then
    raise exception 'La somme des parts des associés actifs vaut % au lieu de 1.', v_total;
  end if;
  return null;
end;
$$;

create constraint trigger t_parts_associes
  after insert or update or delete on associes
  deferrable initially deferred
  for each row execute function trg_verifier_parts();

-- ---------------------------------------------------------------------------
-- 9.5 Caisse
-- ---------------------------------------------------------------------------
-- Appelée à la fois par le déclencheur sur `transactions` et par celui sur
-- `lignes_taxe` : le montant qui sort de la caisse est le TTC, il n'est connu
-- qu'une fois les taxes posées.
create or replace function synchroniser_caisse_transaction(p_transaction_id uuid)
returns void language plpgsql as $$
declare t transactions%rowtype;
begin
  select * into t from transactions where id = p_transaction_id;
  if not found then return; end if;

  if t.type = 'depense' and t.mode_paiement = 'comptant' then
    insert into mouvements_caisse (date, type, montant, transaction_id, description)
    values (t.date, 'depense_comptant', -(t.montant_ht + t.total_taxes), t.id, t.description)
    on conflict (transaction_id) where transaction_id is not null and type = 'depense_comptant'
    do update set montant = excluded.montant, date = excluded.date;
  else
    delete from mouvements_caisse
      where transaction_id = p_transaction_id and type = 'depense_comptant';
  end if;
end;
$$;

create or replace function trg_caisse_transaction() returns trigger
language plpgsql as $$
begin
  perform synchroniser_caisse_transaction(new.id);
  return new;
end;
$$;

create trigger t_caisse_transaction after insert or update on transactions
  for each row execute function trg_caisse_transaction();

-- Le montant en caisse doit suivre les taxes, connues après coup.
create or replace function trg_caisse_apres_taxes() returns trigger
language plpgsql as $$
begin
  perform synchroniser_caisse_transaction(coalesce(new.transaction_id, old.transaction_id));
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger t_caisse_apres_taxes after insert or update or delete on lignes_taxe
  for each row execute function trg_caisse_apres_taxes();

-- ---------------------------------------------------------------------------
-- 9.6 Inventaire : coût moyen pondéré des achats à une date donnée.
-- ---------------------------------------------------------------------------
create or replace function cout_moyen(p_produit_id uuid, p_date date default current_date)
returns numeric
language sql stable as $$
  select coalesce(
    (select sum(m.quantite * m.cout_unitaire) / nullif(sum(m.quantite), 0)
       from inventaire_mouvements m
      where m.produit_id = p_produit_id and m.type = 'achat'
        and m.date <= p_date and m.cout_unitaire is not null),
    (select cu.montant_ht
       from couts_unitaires cu
      where cu.composante = 'carte_vierge' and cu.date_effet <= p_date
        and (cu.produit_id = p_produit_id or cu.produit_id is null)
      order by (cu.produit_id is not null) desc, cu.date_effet desc
      limit 1),
    0)::numeric;
$$;

comment on function cout_moyen is
  'Coût moyen pondéré des achats jusqu''à la date. Base du coût des marchandises vendues.';

-- ---------------------------------------------------------------------------
-- 9.7 Ventes : totaux, revenu, taxes, COGS, caisse, stock
-- ---------------------------------------------------------------------------
create or replace function recalculer_totaux_vente(p_vente_id uuid)
returns void language plpgsql as $$
declare v ventes%rowtype; v_ht numeric; v_base numeric; v_taxes numeric;
begin
  select * into v from ventes where id = p_vente_id;
  if not found then return; end if;

  select coalesce(sum(montant_ht), 0),
         coalesce(sum(montant_ht) filter (where taxable), 0)
    into v_ht, v_base
  from vente_lignes where vente_id = p_vente_id;

  if v.taxes_manuelles then
    update ventes set montant_ht = v_ht where id = p_vente_id;
  else
    v_taxes := total_taxes(v_base, v.province, v.date);
    update ventes set montant_ht = v_ht, total_taxes = v_taxes where id = p_vente_id;
  end if;
end;
$$;

-- Coût des marchandises vendues : la sortie de stock charge le résultat.
create or replace function recalculer_cogs(p_vente_id uuid)
returns void language plpgsql as $$
declare v ventes%rowtype; v_cogs numeric; v_id uuid;
begin
  select * into v from ventes where id = p_vente_id;
  if not found then return; end if;

  select coalesce(sum(l.quantite * cout_moyen(l.produit_id, v.date)), 0)
    into v_cogs
  from vente_lignes l
  join produits p on p.id = l.produit_id
  where l.vente_id = p_vente_id and p.suivi_stock;

  v_cogs := round(v_cogs, 2);
  select id into v_id from transactions
    where vente_id = p_vente_id and categorie = 'cout_marchandises_vendues';

  if v_cogs = 0 or v.statut = 'annulee' then
    delete from transactions where id = v_id;
    return;
  end if;

  if v_id is null then
    insert into transactions (date, description, montant_ht, type, categorie, nature,
                              source, mode_paiement, province, vente_id, est_remboursement)
    values (v.date, 'Coût des cartes vendues — ' || v.numero, v_cogs, 'depense',
            'cout_marchandises_vendues', 'variable', 'manuel', 'autre', v.province,
            p_vente_id, v_cogs < 0);
  else
    update transactions set date = v.date, montant_ht = v_cogs, est_remboursement = v_cogs < 0
     where id = v_id;
  end if;
end;
$$;

create or replace function trg_lignes_vente() returns trigger
language plpgsql as $$
declare v_vente_id uuid;
begin
  v_vente_id := coalesce(new.vente_id, old.vente_id);
  perform recalculer_totaux_vente(v_vente_id);

  if tg_op <> 'DELETE' and new.produit_id is not null then
    if exists (select 1 from produits where id = new.produit_id and suivi_stock) then
      insert into inventaire_mouvements (date, produit_id, type, quantite, cout_unitaire, vente_id, note)
      select v.date, new.produit_id, 'vente', -new.quantite,
             cout_moyen(new.produit_id, v.date), new.vente_id, 'Vente ' || v.numero
      from ventes v where v.id = new.vente_id and new.quantite <> 0
      on conflict (vente_id, produit_id) where vente_id is not null and type = 'vente'
      do update set quantite = excluded.quantite, cout_unitaire = excluded.cout_unitaire;
    end if;
  elsif tg_op = 'DELETE' and old.produit_id is not null then
    delete from inventaire_mouvements
      where vente_id = old.vente_id and produit_id = old.produit_id and type = 'vente';
  end if;

  perform recalculer_cogs(v_vente_id);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger t_lignes_vente after insert or update or delete on vente_lignes
  for each row execute function trg_lignes_vente();

-- Une vente engendre une ligne de revenu au HT, ses lignes de taxe, et un
-- encaissement de caisse si elle est payée comptant.
create or replace function trg_synchroniser_vente() returns trigger
language plpgsql as $$
declare v_transaction_id uuid; v_base numeric;
begin
  if new.statut = 'annulee' or new.montant_ht = 0 then
    delete from transactions where vente_id = new.id and type = 'revenu';
    delete from mouvements_caisse where vente_id = new.id and type = 'encaissement_vente';
    return new;
  end if;

  select id into v_transaction_id
    from transactions where vente_id = new.id and type = 'revenu';

  if v_transaction_id is null then
    insert into transactions (
      date, description, montant_ht, type, categorie, nature,
      source, mode_paiement, province, vente_id, reference_externe, est_remboursement)
    values (
      new.date,
      'Vente ' || new.numero || coalesce(' — ' || nullif(new.client_nom, ''), ''),
      new.montant_ht, 'revenu', new.categorie_revenu, null,
      case when new.canal = 'stripe' then 'stripe'::source_transaction
           else 'manuel'::source_transaction end,
      new.mode_paiement, new.province, new.id, new.stripe_charge_id, new.montant_ht < 0)
    returning id into v_transaction_id;
  else
    update transactions
       set date = new.date, montant_ht = new.montant_ht, province = new.province,
           categorie = new.categorie_revenu, mode_paiement = new.mode_paiement,
           est_remboursement = new.montant_ht < 0
     where id = v_transaction_id;
  end if;

  -- Base taxable = lignes taxables seulement ; le total des taxes de la vente
  -- fait foi (il vient de Stripe pour une vente en ligne).
  select coalesce(sum(montant_ht) filter (where taxable), 0) into v_base
    from vente_lignes where vente_id = new.id;
  perform poser_lignes_taxe(v_transaction_id, v_base, new.total_taxes);

  if new.mode_paiement = 'comptant' then
    insert into mouvements_caisse (date, type, montant, vente_id, description)
    values (new.date, 'encaissement_vente', new.montant_ht + new.total_taxes,
            new.id, 'Vente comptant ' || new.numero)
    on conflict (vente_id) where vente_id is not null and type = 'encaissement_vente'
    do update set montant = excluded.montant, date = excluded.date;
  else
    delete from mouvements_caisse where vente_id = new.id and type = 'encaissement_vente';
  end if;

  return new;
end;
$$;

create trigger t_synchroniser_vente after insert or update on ventes
  for each row execute function trg_synchroniser_vente();

-- ---------------------------------------------------------------------------
-- 9.8 Décisions
-- ---------------------------------------------------------------------------
create or replace function trg_creer_approbations() returns trigger
language plpgsql as $$
begin
  insert into decisions_approbations (decision_id, associe_id)
  select new.id, a.id from associes a where a.actif
  on conflict do nothing;
  return new;
end;
$$;

create trigger t_creer_approbations after insert on decisions
  for each row execute function trg_creer_approbations();

create or replace function trg_date_approbation() returns trigger
language plpgsql as $$
begin
  if new.approuve and not coalesce(old.approuve, false) then
    new.date_approbation := now();
  elsif not new.approuve then
    new.date_approbation := null;
  end if;
  return new;
end;
$$;

create trigger t_date_approbation before insert or update on decisions_approbations
  for each row execute function trg_date_approbation();
