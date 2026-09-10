-- ============================================================================
-- Tapora S.E.N.C. — 10 · Procédures métier
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 10.1 Idempotence des webhooks Stripe.
--
-- Protocole : le gestionnaire appelle d'abord reserver_evenement_stripe().
--   true  -> l'insertion a réussi, cet appel est le seul à traiter l'événement
--   false -> l'événement était déjà connu : répondre 200 et NE RIEN FAIRE
-- Sans cela, un réessai de Stripe comptabiliserait la vente deux fois.
-- ---------------------------------------------------------------------------
create or replace function reserver_evenement_stripe(
  p_stripe_event_id text, p_type text, p_payload jsonb default null)
returns boolean
language plpgsql as $$
begin
  insert into evenements_stripe (stripe_event_id, type, payload)
  values (p_stripe_event_id, p_type, p_payload);
  return true;
exception when unique_violation then
  return false;
end;
$$;

create or replace function marquer_evenement_traite(p_stripe_event_id text)
returns void language sql as $$
  update evenements_stripe set statut = 'traite', traite_le = now(), erreur = null
   where stripe_event_id = p_stripe_event_id;
$$;

-- En cas d'échec, on efface la réservation : Stripe réessaiera et le prochain
-- appel pourra traiter l'événement. Le détail de l'erreur est conservé à part.
create or replace function liberer_evenement_stripe(p_stripe_event_id text, p_erreur text)
returns void language plpgsql as $$
begin
  update evenements_stripe
     set statut = 'erreur', erreur = p_erreur, stripe_event_id = p_stripe_event_id || ':echec:' || gen_random_uuid()
   where stripe_event_id = p_stripe_event_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.2 charge.succeeded
-- Crée la vente, la ligne de REVENU (HT), ses lignes de taxe selon la province
-- de destination, la ligne de DÉPENSE distincte des frais Stripe, et le coût
-- des marchandises vendues. Stripe dépose le net : sans la dépense séparée,
-- les frais disparaîtraient du résultat.
-- ---------------------------------------------------------------------------
create or replace function enregistrer_charge_stripe(
  p_charge_id     text,
  p_date          date,
  p_montant_ttc   numeric,
  p_frais_ttc     numeric,
  p_province      province_canada default 'QC',
  p_description   text default null,
  p_client_nom    text default null,
  p_produit_sku   text default null,
  p_quantite      integer default 1,
  p_payment_intent text default null,
  p_recu_url      text default null
) returns uuid
language plpgsql as $$
declare
  v_vente_id uuid; v_produit produits%rowtype;
  v_ht numeric; v_taxes numeric; v_frais_ht numeric; v_frais_taxes numeric;
  v_taxables boolean; v_province_frais province_canada; v_frais_id uuid; v_revenu_id uuid;
begin
  select id into v_vente_id from ventes where stripe_charge_id = p_charge_id;
  if v_vente_id is not null then
    return v_vente_id;
  end if;

  select * into v_produit from produits where sku = p_produit_sku;
  select montant_ht, montant_taxes into v_ht, v_taxes
    from ventiler_ttc(p_montant_ttc, p_province, p_date);

  insert into ventes (
    date, client_nom, province, canal, mode_paiement, statut,
    montant_ht, total_taxes, taxes_manuelles, categorie_revenu,
    stripe_charge_id, stripe_payment_intent_id, recu_url)
  values (
    p_date, p_client_nom, p_province, 'stripe', 'stripe', 'payee',
    v_ht, v_taxes, true,
    case when coalesce(v_produit.est_carte, true) then 'ventes_cartes'
         else 'ventes_accessoires' end::categorie_transaction,
    p_charge_id, p_payment_intent, p_recu_url)
  returning id into v_vente_id;

  insert into vente_lignes (vente_id, produit_id, description, quantite, prix_unitaire_ht)
  values (v_vente_id, v_produit.id,
          coalesce(p_description, v_produit.nom, 'Vente Stripe'),
          greatest(coalesce(p_quantite, 1), 1),
          round(v_ht / greatest(coalesce(p_quantite, 1), 1), 4));

  -- Les taxes restent celles encaissées par Stripe (taxes_manuelles), le HT
  -- reste celui de la ventilation : on colle au cent près au paiement réel.
  update ventes set montant_ht = v_ht where id = v_vente_id;

  -- Frais Stripe : dépense distincte. Ils sont facturés au lieu d'affaires de
  -- la société, pas à la province de destination du colis.
  if coalesce(p_frais_ttc, 0) > 0 then
    select frais_stripe_taxables, province_etablissement
      into v_taxables, v_province_frais from parametres where id;

    if coalesce(v_taxables, true) then
      select montant_ht, montant_taxes into v_frais_ht, v_frais_taxes
        from ventiler_ttc(p_frais_ttc, coalesce(v_province_frais, 'QC'), p_date);
    else
      v_frais_ht := p_frais_ttc; v_frais_taxes := 0;
    end if;

    select id into v_revenu_id from transactions
      where vente_id = v_vente_id and type = 'revenu';

    insert into transactions (
      date, description, montant_ht, type, categorie, nature,
      source, mode_paiement, province, vente_id, transaction_liee_id, reference_externe)
    select p_date, 'Frais Stripe — vente ' || v.numero, v_frais_ht,
           'depense', 'frais_stripe', 'variable',
           'stripe', 'stripe', coalesce(v_province_frais, 'QC'),
           v_vente_id, v_revenu_id, p_charge_id || ':fee'
    from ventes v where v.id = v_vente_id
    on conflict (source, reference_externe) where reference_externe is not null do nothing
    returning id into v_frais_id;

    if v_frais_id is not null and v_frais_taxes > 0 then
      perform poser_lignes_taxe(v_frais_id, v_frais_ht, v_frais_taxes);
    end if;
  end if;

  return v_vente_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.3 charge.refunded — contre-écriture négative.
-- ---------------------------------------------------------------------------
create or replace function enregistrer_remboursement_stripe(
  p_charge_id text, p_date date, p_montant_ttc numeric, p_reference text default null)
returns uuid
language plpgsql as $$
declare
  v ventes%rowtype; v_ht numeric; v_taxes numeric; v_id uuid;
  v_ref text := coalesce(p_reference, p_charge_id || ':refund:' || to_char(p_date, 'YYYYMMDD'));
begin
  select * into v from ventes where stripe_charge_id = p_charge_id;
  select montant_ht, montant_taxes into v_ht, v_taxes
    from ventiler_ttc(p_montant_ttc, coalesce(v.province, 'QC'), p_date);

  insert into transactions (
    date, description, montant_ht, type, categorie, nature,
    source, mode_paiement, province, est_remboursement, reference_externe)
  values (
    p_date, 'Remboursement Stripe ' || coalesce(v.numero, p_charge_id),
    -v_ht, 'revenu', coalesce(v.categorie_revenu, 'ventes_cartes'), null,
    'stripe', 'stripe', coalesce(v.province, 'QC'), true, v_ref)
  on conflict (source, reference_externe) where reference_externe is not null do nothing
  returning id into v_id;

  if v_id is not null then
    perform poser_lignes_taxe(v_id, -v_ht, -v_taxes);
  end if;

  if v.id is not null then
    update ventes
       set statut = case when p_montant_ttc >= v.montant_ttc
                         then 'remboursee' else 'partiellement_remboursee' end::statut_vente
     where id = v.id;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.4 payout.paid — transfert Stripe -> banque, aucun impact sur le résultat.
-- ---------------------------------------------------------------------------
create or replace function enregistrer_versement_stripe(
  p_payout_id text, p_date date, p_montant numeric, p_payload jsonb default null)
returns text
language sql as $$
  insert into versements_stripe (id, date_arrivee, montant, payload)
  values (p_payout_id, p_date, p_montant, p_payload)
  on conflict (id) do update
    set date_arrivee = excluded.date_arrivee, montant = excluded.montant,
        payload = coalesce(excluded.payload, versements_stripe.payload)
  returning id;
$$;

-- ---------------------------------------------------------------------------
-- 10.5 charge.dispute.created — rétrofacturation.
-- Deux écritures : reprise du revenu (et des taxes perçues, qui n'ont plus
-- lieu d'être remises) et frais de contestation. Sur une carte à 30 $, des
-- frais de 15 $ transforment la vente en perte nette : elle doit se voir.
-- ---------------------------------------------------------------------------
create or replace function enregistrer_litige_stripe(
  p_dispute_id text, p_charge_id text, p_date date,
  p_montant_conteste numeric, p_frais numeric default null,
  p_motif text default null, p_payload jsonb default null
) returns text
language plpgsql as $$
declare
  v ventes%rowtype; v_ht numeric; v_taxes numeric;
  v_reprise uuid; v_frais_id uuid; v_frais numeric; v_province province_canada;
  v_frais_ht numeric; v_frais_taxes numeric; v_frais_taxables boolean;
begin
  if exists (select 1 from litiges where id = p_dispute_id) then
    return p_dispute_id;
  end if;

  select * into v from ventes where stripe_charge_id = p_charge_id;
  select coalesce(p_frais, frais_litige_stripe), province_etablissement, frais_stripe_taxables
    into v_frais, v_province, v_frais_taxables from parametres where id;

  select montant_ht, montant_taxes into v_ht, v_taxes
    from ventiler_ttc(p_montant_conteste, coalesce(v.province, 'QC'), p_date);

  -- Reprise du revenu contesté.
  insert into transactions (
    date, description, montant_ht, type, categorie, nature,
    source, mode_paiement, province, est_remboursement, reference_externe)
  values (
    p_date, 'Rétrofacturation — ' || coalesce(v.numero, p_charge_id),
    -v_ht, 'revenu', coalesce(v.categorie_revenu, 'ventes_cartes'), null,
    'stripe', 'stripe', coalesce(v.province, 'QC'), true, p_dispute_id || ':reprise')
  on conflict (source, reference_externe) where reference_externe is not null do nothing
  returning id into v_reprise;
  if v_reprise is not null then
    perform poser_lignes_taxe(v_reprise, -v_ht, -v_taxes);
  end if;

  -- Frais de contestation. Stripe les taxe comme ses autres frais : le montant
  -- facturé est un TTC, la taxe qu'il porte reste récupérable.
  if coalesce(v_frais, 0) > 0 then
    if v_frais_taxables then
      select montant_ht, montant_taxes into v_frais_ht, v_frais_taxes
        from ventiler_ttc(v_frais, coalesce(v_province, 'QC'), p_date);
    else
      v_frais_ht := v_frais; v_frais_taxes := 0;
    end if;

    insert into transactions (
      date, description, montant_ht, type, categorie, nature,
      source, mode_paiement, province, reference_externe)
    values (
      p_date, 'Frais de rétrofacturation — ' || coalesce(v.numero, p_charge_id),
      v_frais_ht, 'depense', 'frais_litige', 'variable',
      'stripe', 'stripe', coalesce(v_province, 'QC'), p_dispute_id || ':frais')
    on conflict (source, reference_externe) where reference_externe is not null do nothing
    returning id into v_frais_id;

    if v_frais_id is not null and v_frais_taxes > 0 then
      perform poser_lignes_taxe(v_frais_id, v_frais_ht, v_frais_taxes);
    end if;
  end if;

  insert into litiges (id, stripe_charge_id, vente_id, date_ouverture, montant_conteste,
                       frais, motif, statut, transaction_reprise_id, transaction_frais_id, payload)
  values (p_dispute_id, p_charge_id, v.id, p_date, p_montant_conteste,
          coalesce(v_frais, 0), p_motif, 'ouvert', v_reprise, v_frais_id, p_payload);

  if v.id is not null then
    update ventes set statut = 'contestee' where id = v.id;
  end if;

  return p_dispute_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.6 charge.dispute.closed
--   gagne -> le revenu est rétabli (les frais, eux, restent acquis à Stripe)
--   perdu -> rien de plus : la reprise du revenu tient
-- ---------------------------------------------------------------------------
create or replace function cloturer_litige_stripe(
  p_dispute_id text, p_statut text, p_date date, p_frais_rembourses numeric default 0)
returns text
language plpgsql as $$
declare
  l litiges%rowtype; v ventes%rowtype; v_ht numeric; v_taxes numeric; v_id uuid;
begin
  select * into l from litiges where id = p_dispute_id;
  if not found then
    raise exception 'Litige % inconnu', p_dispute_id;
  end if;
  if l.statut <> 'ouvert' then
    return p_dispute_id;
  end if;

  if p_statut = 'gagne' then
    select * into v from ventes where id = l.vente_id;
    select montant_ht, montant_taxes into v_ht, v_taxes
      from ventiler_ttc(l.montant_conteste, coalesce(v.province, 'QC'), p_date);

    insert into transactions (
      date, description, montant_ht, type, categorie, nature,
      source, mode_paiement, province, reference_externe)
    values (
      p_date, 'Rétrofacturation gagnée — ' || coalesce(v.numero, l.stripe_charge_id),
      v_ht, 'revenu', coalesce(v.categorie_revenu, 'ventes_cartes'), null,
      'stripe', 'stripe', coalesce(v.province, 'QC'), p_dispute_id || ':retablissement')
    on conflict (source, reference_externe) where reference_externe is not null do nothing
    returning id into v_id;
    if v_id is not null then
      perform poser_lignes_taxe(v_id, v_ht, v_taxes);
    end if;

    if l.vente_id is not null then
      update ventes set statut = 'payee' where id = l.vente_id;
    end if;
  end if;

  update litiges
     set statut = p_statut, date_cloture = p_date, transaction_reversal_id = v_id
   where id = p_dispute_id;

  return p_dispute_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.7 Saisie manuelle d'une dépense : écriture + lignes de taxe en un appel.
-- ---------------------------------------------------------------------------
create or replace function enregistrer_depense(
  p_date date, p_description text, p_montant_ht numeric,
  p_categorie categorie_transaction,
  p_province province_canada default 'QC',
  p_mode_paiement mode_paiement default 'autre',
  p_nature nature_cout default null,
  p_piece_jointe_url text default null,
  p_total_taxes numeric default null,   -- montant réel du reçu, s'il diffère du calcul
  p_note text default null
) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into transactions (date, description, montant_ht, type, categorie, nature,
                            source, mode_paiement, province, piece_jointe_url, note)
  values (p_date, p_description, p_montant_ht, 'depense', p_categorie, p_nature,
          'manuel', p_mode_paiement, p_province, p_piece_jointe_url, p_note)
  returning id into v_id;

  perform poser_lignes_taxe(v_id, p_montant_ht, p_total_taxes);
  return v_id;
end;
$$;

-- Achat de marchandise : porté au STOCK, pas au résultat. Les taxes restent
-- récupérables dès l'achat.
create or replace function enregistrer_achat_stock(
  p_date date, p_description text, p_produit_id uuid,
  p_quantite integer, p_montant_ht numeric,
  p_province province_canada default 'QC',
  p_mode_paiement mode_paiement default 'autre',
  p_piece_jointe_url text default null,
  p_total_taxes numeric default null
) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  if p_quantite <= 0 then
    raise exception 'La quantité achetée doit être positive.';
  end if;

  insert into transactions (date, description, montant_ht, type, categorie, nature,
                            source, mode_paiement, province, piece_jointe_url, est_stock)
  values (p_date, p_description, p_montant_ht, 'depense', 'cartes_achat', 'variable',
          'manuel', p_mode_paiement, p_province, p_piece_jointe_url, true)
  returning id into v_id;

  perform poser_lignes_taxe(v_id, p_montant_ht, p_total_taxes);

  insert into inventaire_mouvements (date, produit_id, type, quantite, cout_unitaire, transaction_id)
  values (p_date, p_produit_id, 'achat', p_quantite,
          round(p_montant_ht / p_quantite, 4), v_id);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.8 Rapport de taxes, ventilé par juridiction.
-- La TVQ se remet à Revenu Québec, la TPS et la TVH à l'ARC : un seul total
-- fusionné ne correspondrait à aucun formulaire.
-- ---------------------------------------------------------------------------
create or replace function rapport_taxes(p_debut date, p_fin date)
returns table (
  autorite text, code text,
  taxes_percues numeric, taxes_payees numeric, credits numeric,
  net_a_remettre numeric
)
language sql stable as $$
  select l.autorite, l.code,
         coalesce(sum(l.montant) filter (where t.type = 'revenu'), 0),
         coalesce(sum(l.montant) filter (where t.type = 'depense'), 0),
         coalesce(sum(l.montant_recuperable) filter (where t.type = 'depense'), 0),
         coalesce(sum(l.montant) filter (where t.type = 'revenu'), 0)
         - coalesce(sum(l.montant_recuperable) filter (where t.type = 'depense'), 0)
  from lignes_taxe l
  join transactions t on t.id = l.transaction_id
  where t.date between p_debut and p_fin
  group by l.autorite, l.code
  order by l.autorite, l.code;
$$;

create or replace function rapport_taxes_par_autorite(p_debut date, p_fin date)
returns table (autorite text, taxes_percues numeric, credits numeric, net_a_remettre numeric)
language sql stable as $$
  select autorite, sum(taxes_percues), sum(credits), sum(net_a_remettre)
  from rapport_taxes(p_debut, p_fin)
  group by autorite order by autorite;
$$;

-- Fige une déclaration à partir du calcul de la période.
create or replace function produire_declaration(
  p_autorite text, p_debut date, p_fin date)
returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into declarations_taxes (autorite, periode_debut, periode_fin, taxes_percues, credits)
  select p_autorite, p_debut, p_fin,
         coalesce(sum(taxes_percues), 0), coalesce(sum(credits), 0)
  from rapport_taxes(p_debut, p_fin) where autorite = p_autorite
  returning id into v_id;

  insert into declaration_lignes (declaration_id, code, taxes_percues, credits)
  select v_id, code, taxes_percues, credits
  from rapport_taxes(p_debut, p_fin) where autorite = p_autorite;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.9 Import bancaire
-- ---------------------------------------------------------------------------
create or replace function suggerer_categorie(p_description text, p_montant numeric)
returns table (type type_transaction, categorie categorie_transaction,
               nature nature_cout, pct_recuperable numeric)
language sql stable as $$
  select r.type, r.categorie, coalesce(r.nature, d.nature_defaut), d.pct_recuperable
  from regles_categorisation r
  join categories_defauts d on d.categorie = r.categorie
  where r.actif
    and p_description ilike '%' || r.motif || '%'
    and r.type = case when p_montant < 0 then 'depense' else 'revenu' end::type_transaction
  order by r.priorite, length(r.motif) desc
  limit 1;
$$;

-- Un crédit au relevé est le plus souvent de l'argent DÉJÀ comptabilisé.
create or replace function suggerer_rapprochement(p_date date, p_montant numeric)
returns table (statut_suggere text, versement_stripe_id text, libelle text)
language sql stable as $$
  select 'virement_stripe', v.id,
         'Versement Stripe du ' || v.date_arrivee || ' (' || v.montant || ' $)'
  from versements_stripe v
  where p_montant > 0 and abs(v.montant - p_montant) <= 0.02
    and v.date_arrivee between p_date - 5 and p_date + 5
  order by abs(v.date_arrivee - p_date)
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 10.10 Dénombrement d'inventaire
-- ---------------------------------------------------------------------------
create or replace function preparer_denombrement(
  p_date date default current_date, p_titre text default null)
returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into denombrements (date, titre)
  values (p_date, coalesce(p_titre, 'Dénombrement du ' || p_date))
  returning id into v_id;

  insert into denombrement_lignes (denombrement_id, produit_id, quantite_theorique,
                                   quantite_comptee, cout_unitaire)
  select v_id, p.id,
         coalesce((select sum(m.quantite) from inventaire_mouvements m
                    where m.produit_id = p.id and m.date <= p_date), 0),
         coalesce((select sum(m.quantite) from inventaire_mouvements m
                    where m.produit_id = p.id and m.date <= p_date), 0),
         cout_moyen(p.id, p_date)
  from produits p where p.actif and p.suivi_stock;

  return v_id;
end;
$$;

comment on function preparer_denombrement is
  'Ouvre un dénombrement en figeant la quantité théorique. Les écarts se saisissent ensuite.';

create or replace function appliquer_denombrement(p_denombrement_id uuid)
returns numeric
language plpgsql as $$
declare d denombrements%rowtype; v_valeur numeric; v_transaction_id uuid;
begin
  select * into d from denombrements where id = p_denombrement_id;
  if not found then raise exception 'Dénombrement introuvable'; end if;
  if d.statut = 'applique' then raise exception 'Dénombrement déjà appliqué.'; end if;

  -- Ajustements de stock, un par écart constaté.
  insert into inventaire_mouvements (date, produit_id, type, quantite, cout_unitaire,
                                     denombrement_id, note)
  select d.date, l.produit_id, 'ajustement', l.ecart, l.cout_unitaire, d.id,
         coalesce(l.motif, 'ajustement') || coalesce(' — ' || l.note, '')
  from denombrement_lignes l
  where l.denombrement_id = p_denombrement_id and l.ecart <> 0;

  select coalesce(sum(valeur_ecart), 0) into v_valeur
    from denombrement_lignes where denombrement_id = p_denombrement_id;

  -- Un écart négatif est une perte : elle charge le résultat de l'exercice.
  if v_valeur <> 0 then
    insert into transactions (date, description, montant_ht, type, categorie, nature,
                              source, mode_paiement, note)
    values (d.date, 'Écart d''inventaire — ' || d.titre, -v_valeur, 'depense',
            'perte_inventaire', 'variable', 'manuel', 'autre',
            'Produit par le dénombrement ' || d.id)
    returning id into v_transaction_id;
  end if;

  update denombrements
     set statut = 'applique', applique_le = now(), transaction_id = v_transaction_id
   where id = p_denombrement_id;

  return -v_valeur;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.11 Clôture d'exercice
-- ---------------------------------------------------------------------------
create or replace function cloturer_exercice(p_annee integer)
returns numeric
language plpgsql as $$
declare v_profit numeric; v_associe record;
begin
  if exists (select 1 from exercices where annee = p_annee and statut = 'clos') then
    raise exception 'Exercice % déjà clos.', p_annee;
  end if;

  -- Les achats portés au stock sont un actif : ils ne comptent pas ici.
  select coalesce(sum(case when type = 'revenu' then montant_ht else -cout_reel end), 0)
    into v_profit
  from transactions where annee = p_annee and not est_stock;

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
