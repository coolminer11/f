-- ============================================================================
-- Tapora S.E.N.C. — 09 · Fonctions et déclencheurs
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 9.1 Taxes
-- ---------------------------------------------------------------------------

-- Taux en vigueur à une date donnée.
create or replace function taux_en_vigueur(p_date date default current_date)
returns table (taux_tps numeric, taux_tvq numeric)
language sql stable as $$
  select t.taux_tps, t.taux_tvq
  from taux_taxes t
  where p_date >= t.date_debut
    and (t.date_fin is null or p_date < t.date_fin)
  limit 1;
$$;

-- HT -> taxes. TVQ calculée sur le HT SEUL, jamais sur HT + TPS.
create or replace function calculer_taxes(p_montant_ht numeric, p_date date default current_date)
returns table (montant_tps numeric, montant_tvq numeric)
language plpgsql stable as $$
declare v_tps numeric; v_tvq numeric;
begin
  select taux_tps, taux_tvq into v_tps, v_tvq from taux_en_vigueur(p_date);
  if v_tps is null then
    raise exception 'Aucun taux de taxes défini pour la date %', p_date;
  end if;
  return query select round(p_montant_ht * v_tps, 2), round(p_montant_ht * v_tvq, 2);
end;
$$;

-- TTC -> HT + taxes (Stripe et frais bancaires arrivent taxes incluses).
-- Le résidu d'arrondi est versé sur la TVQ pour que HT + TPS + TVQ = TTC au cent.
create or replace function ventiler_ttc(p_montant_ttc numeric, p_date date default current_date)
returns table (montant_ht numeric, montant_tps numeric, montant_tvq numeric)
language plpgsql stable as $$
declare v_tps numeric; v_tvq numeric; v_ht numeric; v_mtps numeric;
begin
  select taux_tps, taux_tvq into v_tps, v_tvq from taux_en_vigueur(p_date);
  if v_tps is null then
    raise exception 'Aucun taux de taxes défini pour la date %', p_date;
  end if;
  v_ht   := round(p_montant_ttc / (1 + v_tps + v_tvq), 2);
  v_mtps := round(v_ht * v_tps, 2);
  return query select v_ht, v_mtps, p_montant_ttc - v_ht - v_mtps;
end;
$$;

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
create trigger t_maj_le before update on declarations_taxes for each row execute function trg_maj_le();

-- ---------------------------------------------------------------------------
-- 9.2 bis  Valeurs par défaut d'une transaction, tirées de la catégorie.
-- Applique notamment la limite fiscale de 50 % du CTI/RTI sur les repas et
-- frais de représentation, sans dépendre de la vigilance de la saisie.
-- ---------------------------------------------------------------------------
create or replace function trg_defauts_transaction() returns trigger
language plpgsql as $$
declare d categories_defauts%rowtype;
begin
  select * into d from categories_defauts where categorie = new.categorie;

  if new.nature is null and new.type = 'depense' then
    new.nature := coalesce(d.nature_defaut, 'fixe');
  end if;
  if new.pct_cti is null then new.pct_cti := coalesce(d.pct_cti, 1); end if;
  if new.pct_rti is null then new.pct_rti := coalesce(d.pct_rti, 1); end if;

  return new;
end;
$$;

create trigger t_defauts_transaction before insert or update on transactions
  for each row execute function trg_defauts_transaction();

-- ---------------------------------------------------------------------------
-- 9.3 Verrou d'exercice : rien ne bouge dans une année close.
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
    -- Ouverture automatique de l'exercice à la première écriture de l'année.
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
-- 9.4 Intégrité des parts d'associés (somme des actifs = 100 %).
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
-- 9.5 Ventes -> totaux, revenu, caisse, stock
-- ---------------------------------------------------------------------------

-- Recalcule les totaux d'une vente à partir de ses lignes.
create or replace function recalculer_totaux_vente(p_vente_id uuid)
returns void language plpgsql as $$
declare
  v_vente ventes%rowtype;
  v_ht numeric; v_base_taxable numeric; v_tps numeric; v_tvq numeric;
begin
  select * into v_vente from ventes where id = p_vente_id;
  if not found then return; end if;

  select coalesce(sum(montant_ht), 0),
         coalesce(sum(montant_ht) filter (where taxable), 0)
    into v_ht, v_base_taxable
  from vente_lignes where vente_id = p_vente_id;

  if v_vente.taxes_manuelles then
    update ventes set montant_ht = v_ht where id = p_vente_id;
  else
    select montant_tps, montant_tvq into v_tps, v_tvq
      from calculer_taxes(v_base_taxable, v_vente.date);
    update ventes set montant_ht = v_ht, tps = v_tps, tvq = v_tvq where id = p_vente_id;
  end if;
end;
$$;

create or replace function trg_lignes_vente() returns trigger
language plpgsql as $$
begin
  perform recalculer_totaux_vente(coalesce(new.vente_id, old.vente_id));

  -- Sortie de stock miroir de la ligne vendue.
  if tg_op <> 'DELETE' and new.produit_id is not null then
    if exists (select 1 from produits where id = new.produit_id and suivi_stock) then
      insert into inventaire_mouvements (date, produit_id, type, quantite, vente_id, note)
      select v.date, new.produit_id, 'vente', -new.quantite, new.vente_id, 'Vente ' || v.numero
      from ventes v where v.id = new.vente_id and new.quantite <> 0
      on conflict (vente_id, produit_id) where vente_id is not null and type = 'vente'
      do update set quantite = excluded.quantite;
    end if;
  elsif tg_op = 'DELETE' and old.produit_id is not null then
    delete from inventaire_mouvements
      where vente_id = old.vente_id and produit_id = old.produit_id and type = 'vente';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger t_lignes_vente after insert or update or delete on vente_lignes
  for each row execute function trg_lignes_vente();

-- Une vente engendre exactement une ligne de revenu au montant HT,
-- et, si elle est payée comptant, un encaissement de caisse au montant TTC.
create or replace function trg_synchroniser_vente() returns trigger
language plpgsql as $$
declare v_transaction_id uuid;
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
      date, description, montant_ht, tps, tvq, type, categorie, nature,
      source, mode_paiement, vente_id, reference_externe, est_remboursement)
    values (
      new.date,
      'Vente ' || new.numero || coalesce(' — ' || nullif(new.client_nom, ''), ''),
      new.montant_ht, new.tps, new.tvq, 'revenu', new.categorie_revenu, null,
      case when new.canal = 'stripe' then 'stripe'::source_transaction
           else 'manuel'::source_transaction end,
      new.mode_paiement, new.id, new.stripe_charge_id, new.montant_ht < 0);
  else
    update transactions
       set date = new.date,
           montant_ht = new.montant_ht, tps = new.tps, tvq = new.tvq,
           categorie = new.categorie_revenu, mode_paiement = new.mode_paiement,
           est_remboursement = new.montant_ht < 0
     where id = v_transaction_id;
  end if;

  -- Encaissement comptant : l'argent entre en caisse, pas à la banque.
  if new.mode_paiement = 'comptant' then
    insert into mouvements_caisse (date, type, montant, vente_id, description)
    values (new.date, 'encaissement_vente', new.montant_ht + new.tps + new.tvq,
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

-- Une dépense payée en argent comptant sort de la caisse.
create or replace function trg_depense_comptant() returns trigger
language plpgsql as $$
begin
  if new.type = 'depense' and new.mode_paiement = 'comptant' then
    insert into mouvements_caisse (date, type, montant, transaction_id, description)
    values (new.date, 'depense_comptant', -(new.montant_ht + new.tps + new.tvq),
            new.id, new.description)
    on conflict (transaction_id) where transaction_id is not null and type = 'depense_comptant'
    do update set montant = excluded.montant, date = excluded.date;
  else
    delete from mouvements_caisse
      where transaction_id = new.id and type = 'depense_comptant';
  end if;
  return new;
end;
$$;

create trigger t_depense_comptant after insert or update on transactions
  for each row execute function trg_depense_comptant();

-- ---------------------------------------------------------------------------
-- 9.6 Décisions : une case d'approbation par associé, créée d'office.
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
