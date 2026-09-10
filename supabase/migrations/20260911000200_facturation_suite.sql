-- ============================================================================
-- Tapora S.E.N.C. — 14 · Facturation (tables, numérotation, paiements)
-- ============================================================================
-- Fichier distinct du précédent : PostgreSQL refuse d'utiliser une valeur
-- d'énumération ajoutée dans la même transaction que son ALTER TYPE.
-- ============================================================================

create type type_document as enum ('facture', 'devis', 'recu');

-- ---------------------------------------------------------------------------
-- Coordonnées et mentions légales de l'émetteur.
-- Au Québec, une facture de 30 $ ou plus doit porter les numéros d'inscription
-- TPS et TVQ pour que le client puisse réclamer ses propres crédits.
-- ---------------------------------------------------------------------------
alter table parametres
  add column if not exists telephone text,
  add column if not exists site_web text,
  add column if not exists ville text,
  add column if not exists code_postal text,
  add column if not exists pied_facture text
    default 'Merci de faire affaire avec Tapora.',
  add column if not exists conditions_generales_defaut text,
  add column if not exists delai_paiement_jours smallint not null default 30;

alter table clients
  add column if not exists adresse text,
  add column if not exists ville text,
  add column if not exists code_postal text;

-- ---------------------------------------------------------------------------
-- Documents de vente
-- ---------------------------------------------------------------------------
alter table ventes
  add column if not exists type_document type_document not null default 'facture',
  add column if not exists conditions_paiement text,
  add column if not exists date_echeance date,
  add column if not exists notes_facture text,
  add column if not exists conditions_generales text,
  add column if not exists adresse_facturation text,
  add column if not exists courriel_facturation text,
  add column if not exists bon_de_commande text,
  -- Remise appliquée au total, après les lignes et avant les taxes.
  add column if not exists remise_globale numeric(12,2) not null default 0,
  -- Entretenu par déclencheur depuis `paiements_vente`.
  add column if not exists montant_paye numeric(12,2) not null default 0,
  add column if not exists statut_paiement text not null default 'impayee'
    check (statut_paiement in ('impayee', 'partielle', 'payee', 'remboursee')),
  add column if not exists devis_origine_id uuid references ventes (id) on delete set null;

alter table ventes
  add constraint chk_remise_globale check (remise_globale >= 0);

create index if not exists idx_ventes_type on ventes (type_document, date desc);
create index if not exists idx_ventes_echeance on ventes (date_echeance)
  where statut_paiement <> 'payee';

comment on column ventes.remise_globale is
  'Remise en dollars sur le total HT. Réduit la base taxable : la taxe suit le prix réellement payé.';
comment on column ventes.devis_origine_id is
  'Facture issue d''un devis accepté : garde le lien vers le devis d''origine.';

-- ---------------------------------------------------------------------------
-- Numérotation : une séquence par type de document, remise à zéro chaque année.
-- Un numéro de facture ne se réutilise jamais et ne saute pas d'année.
-- ---------------------------------------------------------------------------
create table compteurs_documents (
  type_document type_document not null,
  annee         smallint not null,
  dernier       integer not null default 0,
  primary key (type_document, annee)
);

create or replace function prochain_numero(p_type type_document, p_date date)
returns text
language plpgsql as $$
declare v_annee smallint := extract(year from p_date)::smallint; v_suite integer; v_prefixe text;
begin
  insert into compteurs_documents (type_document, annee, dernier)
  values (p_type, v_annee, 1)
  on conflict (type_document, annee)
  do update set dernier = compteurs_documents.dernier + 1
  returning dernier into v_suite;

  v_prefixe := case p_type when 'facture' then 'F' when 'devis' then 'D' else 'R' end;
  return v_prefixe || '-' || v_annee || '-' || lpad(v_suite::text, 5, '0');
end;
$$;

alter table ventes alter column numero drop default;

create or replace function trg_numeroter_vente() returns trigger
language plpgsql as $$
begin
  if new.numero is null or new.numero = '' then
    new.numero := prochain_numero(new.type_document, new.date);
  end if;
  -- Sur une facture, `date_echeance` est la date d'exigibilité du paiement ;
  -- sur un devis, la date jusqu'à laquelle le prix est garanti.
  if new.date_echeance is null then
    new.date_echeance := case new.type_document
      when 'facture' then new.date + (select delai_paiement_jours from parametres where id)
      when 'devis'   then new.date + 30
      else null end;
  end if;
  return new;
end;
$$;

create trigger t_numeroter_vente before insert on ventes
  for each row execute function trg_numeroter_vente();

-- ---------------------------------------------------------------------------
-- Paiements reçus. Une facture peut en recevoir plusieurs.
-- ---------------------------------------------------------------------------
create table paiements_vente (
  id            uuid primary key default gen_random_uuid(),
  vente_id      uuid not null references ventes (id) on delete cascade,
  date          date not null default current_date,
  montant       numeric(12,2) not null check (montant <> 0),
  mode_paiement mode_paiement not null default 'comptant',
  reference     text,
  note          text,
  cree_le       timestamptz not null default now()
);
create index idx_paiements_vente on paiements_vente (vente_id, date);

comment on table paiements_vente is
  'Encaissements réels. Un montant négatif enregistre un remboursement au client.';

-- ---------------------------------------------------------------------------
-- Un paiement comptant entre en caisse ; il n'y entre qu'à ce moment-là.
-- ---------------------------------------------------------------------------
alter table mouvements_caisse
  add column if not exists paiement_id uuid references paiements_vente (id) on delete cascade;

create unique index uq_caisse_paiement on mouvements_caisse (paiement_id)
  where paiement_id is not null;

create or replace function recalculer_paiements_vente(p_vente_id uuid)
returns void language plpgsql as $$
declare v_paye numeric; v_ttc numeric; v_statut text;
begin
  select coalesce(sum(montant), 0) into v_paye
    from paiements_vente where vente_id = p_vente_id;
  select montant_ttc into v_ttc from ventes where id = p_vente_id;
  if v_ttc is null then return; end if;

  v_statut := case
    when v_paye <= 0 and v_ttc > 0 then 'impayee'
    when v_ttc >= 0 and v_paye >= v_ttc then 'payee'
    when v_paye > 0 then 'partielle'
    else 'impayee'
  end;

  update ventes set montant_paye = v_paye, statut_paiement = v_statut
   where id = p_vente_id
     and (montant_paye, statut_paiement) is distinct from (v_paye, v_statut);
end;
$$;

create or replace function trg_paiement_vente() returns trigger
language plpgsql as $$
declare v_vente_id uuid; v_numero text; v_date date;
begin
  v_vente_id := coalesce(new.vente_id, old.vente_id);

  if tg_op <> 'DELETE' then
    select numero into v_numero from ventes where id = v_vente_id;
    if new.mode_paiement = 'comptant' then
      insert into mouvements_caisse (date, type, montant, vente_id, paiement_id, description)
      values (new.date,
              case when new.montant >= 0 then 'encaissement_vente' else 'ajustement' end,
              new.montant, v_vente_id, new.id,
              case when new.montant >= 0 then 'Paiement comptant ' else 'Remboursement comptant ' end
                || coalesce(v_numero, ''))
      on conflict (paiement_id) where paiement_id is not null
      do update set montant = excluded.montant, date = excluded.date;
    else
      delete from mouvements_caisse where paiement_id = new.id;
    end if;
  end if;

  perform recalculer_paiements_vente(v_vente_id);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger t_paiement_vente after insert or update or delete on paiements_vente
  for each row execute function trg_paiement_vente();

-- ---------------------------------------------------------------------------
-- La vente ne crée plus l'encaissement : c'est le paiement qui le fait.
-- Un devis ne produit ni revenu, ni taxes, ni sortie de stock.
-- ---------------------------------------------------------------------------
create or replace function trg_synchroniser_vente() returns trigger
language plpgsql as $$
declare v_transaction_id uuid; v_base numeric;
begin
  -- Un devis n'est pas une vente : aucune écriture tant qu'il n'est pas accepté.
  if new.type_document = 'devis' or new.statut in ('annulee', 'brouillon', 'refusee')
     or new.montant_ht = 0 then
    delete from transactions where vente_id = new.id and type = 'revenu';
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

  select coalesce(sum(montant_ht) filter (where taxable), 0) into v_base
    from vente_lignes where vente_id = new.id;
  -- La remise globale réduit la base taxable : la taxe porte sur le prix payé.
  v_base := greatest(v_base - new.remise_globale, 0);
  perform poser_lignes_taxe(v_transaction_id, v_base, new.total_taxes);

  return new;
end;
$$;

-- Les totaux tiennent compte de la remise globale.
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

  v_ht := v_ht - v.remise_globale;
  v_base := greatest(v_base - v.remise_globale, 0);

  if v.taxes_manuelles then
    update ventes set montant_ht = v_ht where id = p_vente_id;
  else
    v_taxes := total_taxes(v_base, v.province, v.date);
    update ventes set montant_ht = v_ht, total_taxes = v_taxes where id = p_vente_id;
  end if;
end;
$$;

-- Pas de sortie de stock ni de coût des marchandises pour un devis.
create or replace function trg_lignes_vente() returns trigger
language plpgsql as $$
declare v_vente_id uuid; v_devis boolean;
begin
  v_vente_id := coalesce(new.vente_id, old.vente_id);
  select type_document = 'devis' into v_devis from ventes where id = v_vente_id;
  perform recalculer_totaux_vente(v_vente_id);

  if coalesce(v_devis, false) then
    delete from inventaire_mouvements where vente_id = v_vente_id and type = 'vente';
    delete from transactions
      where vente_id = v_vente_id and categorie = 'cout_marchandises_vendues';
    return case when tg_op = 'DELETE' then old else new end;
  end if;

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

  if v_cogs = 0 or v.type_document = 'devis'
     or v.statut in ('annulee', 'brouillon', 'refusee') then
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

-- ---------------------------------------------------------------------------
-- Accepter un devis : il devient une facture, avec son propre numéro.
-- Le devis reste tel quel dans le registre ; la facture garde le lien.
-- ---------------------------------------------------------------------------
create or replace function convertir_devis_en_facture(p_devis_id uuid, p_date date default current_date)
returns uuid
language plpgsql as $$
declare d ventes%rowtype; v_facture_id uuid;
begin
  select * into d from ventes where id = p_devis_id;
  if not found then raise exception 'Devis introuvable.'; end if;
  if d.type_document <> 'devis' then raise exception 'Ce document n''est pas un devis.'; end if;
  if exists (select 1 from ventes where devis_origine_id = p_devis_id) then
    raise exception 'Ce devis a déjà été facturé.';
  end if;

  insert into ventes (
    date, client_id, client_nom, province, canal, mode_paiement, statut,
    type_document, categorie_revenu, remise_globale, conditions_paiement,
    adresse_facturation, courriel_facturation, bon_de_commande,
    notes_facture, conditions_generales, note, devis_origine_id)
  values (
    p_date, d.client_id, d.client_nom, d.province, d.canal, d.mode_paiement, 'payee',
    'facture', d.categorie_revenu, d.remise_globale, d.conditions_paiement,
    d.adresse_facturation, d.courriel_facturation, d.bon_de_commande,
    d.notes_facture, d.conditions_generales, d.note, p_devis_id)
  returning id into v_facture_id;

  insert into vente_lignes (vente_id, produit_id, description, quantite,
                            prix_unitaire_ht, remise_ht, taxable, ordre)
  select v_facture_id, produit_id, description, quantite,
         prix_unitaire_ht, remise_ht, taxable, ordre
  from vente_lignes where vente_id = p_devis_id order by ordre;

  update ventes set statut = 'acceptee' where id = p_devis_id;
  return v_facture_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reprise des ventes comptant déjà saisies : leur encaissement devient un
-- paiement en bonne et due forme, pour que la caisse ait une seule origine.
-- ---------------------------------------------------------------------------
do $$
declare v record;
begin
  for v in select id, date, montant_ttc from ventes
            where mode_paiement = 'comptant' and statut = 'payee'
              and not exists (select 1 from paiements_vente p where p.vente_id = ventes.id)
  loop
    delete from mouvements_caisse
      where vente_id = v.id and type = 'encaissement_vente' and paiement_id is null;
    insert into paiements_vente (vente_id, date, montant, mode_paiement, note)
    values (v.id, v.date, v.montant_ttc, 'comptant', 'Repris de la saisie initiale');
  end loop;
end;
$$;

-- Les devis ne doivent apparaître dans aucune statistique de vente.
-- Les quantités viennent des lignes, mais le REVENU vient de `ventes.montant_ht` :
-- la somme des lignes ignore la remise globale et surévaluerait le chiffre
-- d'affaires par rapport au journal.
create or replace view v_ventes_mensuelles with (security_invoker = true) as
select date_trunc('month', v.date::timestamp)::date as mois,
       v.canal,
       count(*)                                as nb_ventes,
       coalesce(sum(q.cartes), 0)::bigint      as cartes_vendues,
       coalesce(sum(v.montant_ht), 0)          as revenus_ht
from ventes v
cross join lateral (
  select coalesce(sum(l.quantite) filter (where coalesce(p.est_carte, true)), 0) as cartes
  from vente_lignes l
  left join produits p on p.id = l.produit_id
  where l.vente_id = v.id
) q
where v.type_document <> 'devis'
  and v.statut not in ('annulee', 'brouillon', 'refusee')
group by 1, 2;

create or replace view v_ventes_par_province with (security_invoker = true) as
select v.province,
       count(*) as nb_ventes,
       coalesce(sum(q.cartes), 0)::bigint as cartes,
       coalesce(sum(v.montant_ht), 0) as revenus_ht
from ventes v
cross join lateral (
  select coalesce(sum(l.quantite), 0) as cartes
  from vente_lignes l where l.vente_id = v.id
) q
where v.type_document <> 'devis'
  and v.statut not in ('annulee', 'brouillon', 'refusee')
group by v.province;

-- La marge réelle ne doit pas non plus compter les devis.
create or replace view v_marge_unitaire_reelle with (security_invoker = true) as
with fenetre as (
  select (current_date - make_interval(days => jours_fenetre_marge))::date as debut,
         jours_fenetre_marge as jours
  from parametres
),
ventes_cartes as (
  select v.canal,
         count(*)              as nb_ventes,
         sum(q.cartes)::bigint as cartes,
         sum(v.montant_ht)     as revenus_ht
  from ventes v
  cross join lateral (
    select coalesce(sum(l.quantite) filter (where coalesce(p.est_carte, true)), 0) as cartes
    from vente_lignes l
    left join produits p on p.id = l.produit_id
    where l.vente_id = v.id
  ) q
  cross join fenetre f
  where v.type_document <> 'devis'
    and v.statut not in ('annulee', 'brouillon', 'refusee')
    and v.date >= f.debut and q.cartes > 0
  group by v.canal
),
total_cartes as (select coalesce(sum(cartes), 0) as cartes from ventes_cartes),
cogs as (
  select coalesce(sum(t.cout_reel), 0) as montant
  from transactions t cross join fenetre f
  where t.categorie = 'cout_marchandises_vendues' and t.date >= f.debut
),
autres_couts as (
  select coalesce(sum(t.cout_reel), 0) as montant
  from transactions t cross join fenetre f
  where t.type = 'depense' and t.nature = 'variable'
    and t.categorie in ('impression', 'expedition', 'emballage')
    and t.date >= f.debut
),
frais_par_canal as (
  select coalesce(v.canal, 'stripe'::canal_vente) as canal,
         coalesce(sum(t.cout_reel), 0) as frais
  from transactions t
  left join ventes v on v.id = t.vente_id
  cross join fenetre f
  where t.type = 'depense' and t.categorie in ('frais_stripe', 'frais_litige', 'frais_bancaires')
    and t.date >= f.debut
  group by 1
)
select vc.canal, f.jours as fenetre_jours, vc.nb_ventes, vc.cartes, vc.revenus_ht,
       round(vc.revenus_ht / nullif(vc.cartes, 0), 2)              as prix_moyen_ht,
       round(cg.montant / nullif(tc.cartes, 0), 2)                 as cout_carte_moyen,
       round(ac.montant / nullif(tc.cartes, 0), 2)                 as autres_couts_variables,
       round(coalesce(fpc.frais, 0) / nullif(vc.cartes, 0), 2)     as frais_transaction_moyen,
       round(vc.revenus_ht / nullif(vc.cartes, 0)
             - cg.montant / nullif(tc.cartes, 0)
             - ac.montant / nullif(tc.cartes, 0)
             - coalesce(fpc.frais, 0) / nullif(vc.cartes, 0), 2)   as marge_unitaire
from ventes_cartes vc
cross join fenetre f cross join total_cartes tc cross join cogs cg cross join autres_couts ac
left join frais_par_canal fpc on fpc.canal = vc.canal;

-- ---------------------------------------------------------------------------
-- Liste des documents de vente, avec leur état de paiement.
-- « en retard » se déduit de la date, il ne se stocke pas : une facture devient
-- en retard toute seule au passage de minuit.
-- ---------------------------------------------------------------------------
create or replace view v_documents_vente with (security_invoker = true) as
select v.id, v.numero, v.type_document, v.date, v.date_echeance,
       v.client_id, coalesce(c.nom, v.client_nom) as client,
       v.province, v.canal, v.mode_paiement, v.statut, v.statut_paiement,
       v.montant_ht, v.total_taxes, v.montant_ttc, v.montant_paye,
       v.montant_ttc - v.montant_paye as solde,
       v.remise_globale, v.devis_origine_id,
       (select count(*) from vente_lignes l where l.vente_id = v.id)  as nb_lignes,
       (select coalesce(sum(l.quantite), 0) from vente_lignes l where l.vente_id = v.id) as quantite,
       v.type_document = 'facture'
         and v.statut_paiement <> 'payee'
         and v.date_echeance is not null
         and v.date_echeance < current_date                          as en_retard,
       exists (select 1 from ventes f where f.devis_origine_id = v.id) as devis_facture,
       v.cree_le
from ventes v
left join clients c on c.id = v.client_id;

-- Un document manuel est « ferme » par défaut ; un devis part en brouillon.
alter table ventes alter column statut set default 'ferme';

comment on column ventes.statut is
  'État commercial du document (brouillon, envoyée, ferme, acceptée, annulée…). L''encaissement, lui, est dans statut_paiement.';
comment on column ventes.statut_paiement is
  'Déduit des lignes de paiements_vente. Une facture reste impayée tant qu''aucun paiement n''est enregistré.';
comment on column ventes.date_echeance is
  'Facture : date d''exigibilité. Devis : date jusqu''à laquelle le prix est garanti.';
