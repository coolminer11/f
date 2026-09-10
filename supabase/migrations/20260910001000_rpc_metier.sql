-- ============================================================================
-- Tapora S.E.N.C. — 10 · Procédures métier (webhook Stripe, taxes, clôture)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 10.1 charge.succeeded
-- Crée en une seule transaction : la vente, la ligne de REVENU (HT) et la
-- ligne de DÉPENSE distincte pour les frais Stripe.
-- Stripe dépose le NET ; sans cette dépense séparée, les frais disparaîtraient
-- du résultat et le chiffre d'affaires serait sous-évalué.
-- Idempotent sur stripe_charge_id : rejouer le webhook ne duplique rien.
-- ---------------------------------------------------------------------------
create or replace function enregistrer_charge_stripe(
  p_charge_id     text,
  p_date          date,
  p_montant_ttc   numeric,          -- montant réglé par le client, taxes incluses
  p_frais_ttc     numeric,          -- frais Stripe prélevés (balance_transaction.fee)
  p_description   text default null,
  p_client_nom    text default null,
  p_produit_sku   text default null,
  p_quantite      integer default 1,
  p_payment_intent text default null,
  p_recu_url      text default null
) returns uuid
language plpgsql as $$
declare
  v_vente_id uuid;
  v_produit  produits%rowtype;
  v_ht numeric; v_tps numeric; v_tvq numeric;
  v_frais_ht numeric; v_frais_tps numeric; v_frais_tvq numeric;
  v_taxables boolean;
begin
  select id into v_vente_id from ventes where stripe_charge_id = p_charge_id;
  if v_vente_id is not null then
    return v_vente_id;                                   -- déjà traité
  end if;

  select * into v_produit from produits where sku = p_produit_sku;
  select montant_ht, montant_tps, montant_tvq into v_ht, v_tps, v_tvq
    from ventiler_ttc(p_montant_ttc, p_date);

  insert into ventes (
    date, client_nom, canal, mode_paiement, statut,
    montant_ht, tps, tvq, taxes_manuelles, categorie_revenu,
    stripe_charge_id, stripe_payment_intent_id, recu_url)
  values (
    p_date, p_client_nom, 'stripe', 'stripe', 'payee',
    v_ht, v_tps, v_tvq, true,
    case when coalesce(v_produit.est_carte, true) then 'ventes_cartes'
         else 'ventes_accessoires' end::categorie_transaction,
    p_charge_id, p_payment_intent, p_recu_url)
  returning id into v_vente_id;

  insert into vente_lignes (vente_id, produit_id, description, quantite, prix_unitaire_ht)
  values (v_vente_id, v_produit.id,
          coalesce(p_description, v_produit.nom, 'Vente Stripe'),
          greatest(coalesce(p_quantite, 1), 1),
          round(v_ht / greatest(coalesce(p_quantite, 1), 1), 4));

  -- Le trigger sur vente_lignes a recalculé le HT ; les taxes restent celles de
  -- Stripe (taxes_manuelles) pour coller au cent près au montant encaissé.
  update ventes set montant_ht = v_ht where id = v_vente_id;

  -- Ligne de dépense distincte pour les frais Stripe.
  if coalesce(p_frais_ttc, 0) > 0 then
    select frais_stripe_taxables into v_taxables from parametres where id;
    if coalesce(v_taxables, true) then
      select montant_ht, montant_tps, montant_tvq into v_frais_ht, v_frais_tps, v_frais_tvq
        from ventiler_ttc(p_frais_ttc, p_date);
    else
      v_frais_ht := p_frais_ttc; v_frais_tps := 0; v_frais_tvq := 0;
    end if;

    insert into transactions (
      date, description, montant_ht, tps, tvq, type, categorie, nature,
      source, mode_paiement, vente_id, transaction_liee_id, reference_externe)
    select p_date, 'Frais Stripe — vente ' || v.numero,
           v_frais_ht, v_frais_tps, v_frais_tvq,
           'depense', 'frais_stripe', 'variable',
           'stripe', 'stripe', v_vente_id, t.id, p_charge_id || ':fee'
    from ventes v
    left join transactions t on t.vente_id = v.id and t.type = 'revenu'
    where v.id = v_vente_id
    on conflict (source, reference_externe) where reference_externe is not null do nothing;
  end if;

  return v_vente_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.2 charge.refunded
-- Contre-écriture négative : le revenu et les taxes perçues sont réduits,
-- ce qui corrige automatiquement le rapport TPS/TVQ de la période.
-- ---------------------------------------------------------------------------
create or replace function enregistrer_remboursement_stripe(
  p_charge_id      text,
  p_date           date,
  p_montant_ttc    numeric,          -- montant remboursé, taxes incluses (positif)
  p_frais_rendus   numeric default 0 -- frais Stripe restitués (rare)
) returns uuid
language plpgsql as $$
declare
  v_vente ventes%rowtype;
  v_ht numeric; v_tps numeric; v_tvq numeric;
  v_ref text := p_charge_id || ':refund:' || to_char(p_date, 'YYYYMMDD');
  v_transaction_id uuid;
begin
  select * into v_vente from ventes where stripe_charge_id = p_charge_id;
  select montant_ht, montant_tps, montant_tvq into v_ht, v_tps, v_tvq
    from ventiler_ttc(p_montant_ttc, p_date);

  insert into transactions (
    date, description, montant_ht, tps, tvq, type, categorie, nature,
    source, mode_paiement, vente_id, est_remboursement, reference_externe)
  values (
    p_date, 'Remboursement Stripe ' || coalesce(v_vente.numero, p_charge_id),
    -v_ht, -v_tps, -v_tvq, 'revenu',
    coalesce(v_vente.categorie_revenu, 'ventes_cartes'), null,
    'stripe', 'stripe', null, true, v_ref)
  on conflict (source, reference_externe) where reference_externe is not null do nothing
  returning id into v_transaction_id;

  if v_vente.id is not null then
    update ventes
       set statut = case when p_montant_ttc >= v_vente.montant_ttc
                         then 'remboursee'
                         else 'partiellement_remboursee' end::statut_vente
     where id = v_vente.id;
  end if;

  return v_transaction_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.3 payout.paid — transfert Stripe -> banque, AUCUN impact sur le résultat.
-- ---------------------------------------------------------------------------
create or replace function enregistrer_versement_stripe(
  p_payout_id text,
  p_date      date,
  p_montant   numeric,
  p_payload   jsonb default null
) returns text
language plpgsql as $$
begin
  insert into versements_stripe (id, date_arrivee, montant, payload)
  values (p_payout_id, p_date, p_montant, p_payload)
  on conflict (id) do update
    set date_arrivee = excluded.date_arrivee,
        montant      = excluded.montant,
        payload      = coalesce(excluded.payload, versements_stripe.payload);
  return p_payout_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.4 Rapport TPS/TVQ pour une période libre.
-- ---------------------------------------------------------------------------
create or replace function rapport_taxes(p_debut date, p_fin date)
returns table (
  periode_debut  date,
  periode_fin    date,
  ventes_ht      numeric,
  tps_percue     numeric,
  tvq_percue     numeric,
  achats_ht      numeric,
  tps_payee      numeric,
  tvq_payee      numeric,
  cti            numeric,
  rti            numeric,
  net_tps        numeric,
  net_tvq        numeric,
  net_a_remettre numeric
)
language sql stable as $$
  with t as (
    select * from transactions where date between p_debut and p_fin
  )
  select
    p_debut, p_fin,
    coalesce(sum(montant_ht) filter (where type = 'revenu'), 0),
    coalesce(sum(tps)        filter (where type = 'revenu'), 0),
    coalesce(sum(tvq)        filter (where type = 'revenu'), 0),
    coalesce(sum(montant_ht) filter (where type = 'depense'), 0),
    coalesce(sum(tps)        filter (where type = 'depense'), 0),
    coalesce(sum(tvq)        filter (where type = 'depense'), 0),
    coalesce(sum(t.cti), 0),
    coalesce(sum(t.rti), 0),
    coalesce(sum(tps) filter (where type = 'revenu'), 0) - coalesce(sum(t.cti), 0),
    coalesce(sum(tvq) filter (where type = 'revenu'), 0) - coalesce(sum(t.rti), 0),
    (coalesce(sum(tps) filter (where type = 'revenu'), 0) - coalesce(sum(t.cti), 0))
    + (coalesce(sum(tvq) filter (where type = 'revenu'), 0) - coalesce(sum(t.rti), 0))
  from t;
$$;

comment on function rapport_taxes is
  'Taxes perçues sur ventes, CTI/RTI sur achats, net à remettre à Revenu Québec.';

-- ---------------------------------------------------------------------------
-- 10.5 Suggestion de catégorie pour l'écran d'import bancaire.
-- ---------------------------------------------------------------------------
create or replace function suggerer_categorie(p_description text, p_montant numeric)
returns table (
  type      type_transaction,
  categorie categorie_transaction,
  nature    nature_cout,
  pct_cti   numeric,
  pct_rti   numeric
)
language sql stable as $$
  select r.type, r.categorie,
         coalesce(r.nature, d.nature_defaut),
         coalesce(r.pct_cti, d.pct_cti),
         coalesce(r.pct_rti, d.pct_rti)
  from regles_categorisation r
  join categories_defauts d on d.categorie = r.categorie
  where r.actif
    and p_description ilike '%' || r.motif || '%'
    and r.type = case when p_montant < 0 then 'depense' else 'revenu' end::type_transaction
  order by r.priorite, length(r.motif) desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 10.6 Clôture d'exercice : attribution du profit au capital de chaque associé.
-- Une perte se répartit de la même façon (montant négatif).
-- ---------------------------------------------------------------------------
create or replace function cloturer_exercice(p_annee integer)
returns numeric
language plpgsql as $$
declare v_profit numeric; v_associe record;
begin
  if exists (select 1 from exercices where annee = p_annee and statut = 'clos') then
    raise exception 'Exercice % déjà clos.', p_annee;
  end if;

  select coalesce(sum(case when type = 'revenu' then montant_ht else -montant_ht end), 0)
    into v_profit
  from transactions where annee = p_annee;

  for v_associe in select id, part from associes where actif loop
    insert into mouvements_associes (associe_id, date, compte, type, montant, description)
    values (v_associe.id, make_date(p_annee, 12, 31), 'capital', 'part_profit',
            round(v_profit * v_associe.part, 2),
            'Part du résultat de l''exercice ' || p_annee)
    on conflict (associe_id, annee) where type = 'part_profit'
    do update set montant = excluded.montant;
  end loop;

  update exercices set statut = 'clos', date_cloture = now() where annee = p_annee;
  return v_profit;
end;
$$;

create or replace function rouvrir_exercice(p_annee integer)
returns void language sql as $$
  update exercices set statut = 'ouvert', date_cloture = null where annee = p_annee;
$$;

-- ---------------------------------------------------------------------------
-- 10.7 Rapprochement d'une ligne bancaire encaissante.
-- Un crédit au relevé est le plus souvent de l'argent DÉJÀ comptabilisé :
-- un versement Stripe ou un dépôt de la caisse. Le catégoriser comme un revenu
-- doublerait le chiffre d'affaires ; cette fonction propose le rapprochement.
-- ---------------------------------------------------------------------------
create or replace function suggerer_rapprochement(p_date date, p_montant numeric)
returns table (statut_suggere text, versement_stripe_id text, libelle text)
language sql stable as $$
  select 'virement_stripe', v.id,
         'Versement Stripe du ' || v.date_arrivee || ' (' || v.montant || ' $)'
  from versements_stripe v
  where p_montant > 0
    and abs(v.montant - p_montant) <= 0.02
    and v.date_arrivee between p_date - 5 and p_date + 5
  order by abs(v.date_arrivee - p_date)
  limit 1;
$$;
