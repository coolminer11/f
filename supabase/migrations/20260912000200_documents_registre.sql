-- ============================================================================
-- Tapora S.E.N.C. — 16 · Registre des types de documents et régimes de taxe
-- ============================================================================
-- Trois choses ici :
--
--   1. UN SEUL ENDROIT décrit ce que fait chaque type de document. Jusqu'ici,
--      « un devis ne comptabilise pas de revenu » était écrit en dur dans trois
--      déclencheurs et deux vues. Ajouter un type obligeait à retrouver chaque
--      condition. Désormais la table `types_document` porte ces règles et les
--      déclencheurs les lisent.
--
--   2. Le RÉGIME DE TAXE. Toutes les ventes ne portent pas de taxe : une
--      exportation hors du Canada est détaxée, une livraison sur réserve est
--      exonérée. Ce n'est pas un interrupteur « pas de taxes » : le motif est
--      obligatoire, le numéro de certificat est conservé, et les deux
--      s'impriment sur le document — c'est ce que la vérification exigera.
--
--   3. Le PRIX TAXES INCLUSES, pour la vente au comptoir où l'on affiche
--      45 $ tout rond. Le hors-taxes est alors déduit du prix affiché.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 16.1 Registre des types de documents
-- ---------------------------------------------------------------------------
create table types_document (
  code                type_document primary key,
  libelle             text not null,
  libelle_pluriel     text not null,
  prefixe             text not null unique,
  -- Produit-il une écriture de revenu ?
  comptabilise_revenu boolean not null,
  -- Fait-il bouger le stock ?
  affecte_stock       boolean not null,
  -- Montre-t-il des prix ? (un bon de livraison n'en montre pas)
  affiche_prix        boolean not null default true,
  -- Sens des montants : −1 pour une note de crédit.
  signe               smallint not null default 1 check (signe in (1, -1)),
  -- Attend-il un paiement ?
  attend_paiement     boolean not null default true,
  aide                text,
  ordre               smallint not null default 100
);

insert into types_document
  (code, libelle, libelle_pluriel, prefixe, comptabilise_revenu, affecte_stock,
   affiche_prix, signe, attend_paiement, aide, ordre) values
  ('facture', 'Facture', 'Factures', 'F', true, true, true, 1, true,
   'Reconnaît le revenu à l''émission, même impayée.', 10),
  ('recu', 'Reçu de vente', 'Reçus de vente', 'R', true, true, true, 1, true,
   'Vente réglée sur place, au comptoir.', 20),
  ('facture_acompte', 'Facture d''acompte', 'Factures d''acompte', 'A', true, false, true, 1, true,
   'Avance demandée avant la livraison. La taxe est due dès l''émission.', 30),
  ('note_credit', 'Note de crédit', 'Notes de crédit', 'NC', true, true, true, -1, false,
   'Annule ou corrige une facture déjà émise. Remet la marchandise en stock.', 40),
  ('devis', 'Devis', 'Devis', 'D', false, false, true, 1, false,
   'N''engage rien : aucun revenu, aucune sortie de stock.', 50),
  ('proforma', 'Facture proforma', 'Factures proforma', 'P', false, false, true, 1, false,
   'Document d''information, sans effet comptable.', 60),
  ('bon_livraison', 'Bon de livraison', 'Bons de livraison', 'BL', false, false, false, 1, false,
   'Accompagne le colis. Ne montre aucun prix.', 70);

comment on table types_document is
  'Ce que fait chaque type de document. Les déclencheurs lisent cette table plutôt que de coder les règles en dur.';

-- ---------------------------------------------------------------------------
-- 16.2 Régimes de taxe
-- ---------------------------------------------------------------------------
create type regime_taxe as enum ('taxable', 'detaxe', 'exonere', 'hors_champ');

create table regimes_taxe (
  code            regime_taxe primary key,
  libelle         text not null,
  applique_taxes  boolean not null,
  motif_requis    boolean not null default false,
  certificat_requis boolean not null default false,
  mention_document text,
  ordre           smallint not null default 100
);

insert into regimes_taxe
  (code, libelle, applique_taxes, motif_requis, certificat_requis, mention_document, ordre) values
  ('taxable', 'Taxable', true, false, false, null, 10),
  ('detaxe', 'Détaxée (0 %)', false, true, false,
   'Fourniture détaxée — aucune taxe applicable.', 20),
  ('exonere', 'Exonérée', false, true, true,
   'Fourniture exonérée — aucune taxe applicable.', 30),
  ('hors_champ', 'Hors du champ des taxes', false, true, false,
   'Opération hors du champ d''application des taxes de vente.', 40);

comment on table regimes_taxe is
  'Une vente sans taxe doit toujours dire POURQUOI : le motif s''imprime sur le document.';

-- ---------------------------------------------------------------------------
-- 16.3 Colonnes de document
-- ---------------------------------------------------------------------------
alter table ventes
  add column if not exists regime_taxe regime_taxe not null default 'taxable',
  add column if not exists motif_exemption text,
  add column if not exists numero_certificat_exemption text,
  -- Vrai : les prix des lignes sont taxes incluses (vente au comptoir).
  add column if not exists prix_avec_taxes boolean not null default false,
  -- Base taxable hors taxes, calculée une seule fois et relue par les
  -- déclencheurs plutôt que recalculée dans chacun.
  add column if not exists base_taxable numeric(12,2) not null default 0,
  add column if not exists date_envoi date,
  add column if not exists transporteur text,
  add column if not exists numero_suivi text;

-- Un document sans taxe doit porter son motif.
alter table ventes add constraint chk_motif_exemption check (
  regime_taxe = 'taxable' or coalesce(nullif(trim(motif_exemption), ''), null) is not null
);

-- Le lien vers le document d'origine n'est plus réservé aux devis : une note
-- de crédit vise une facture, un bon de livraison aussi.
alter table ventes rename column devis_origine_id to document_origine_id;
comment on column ventes.document_origine_id is
  'Document dont celui-ci découle : devis accepté, facture créditée, facture livrée.';

create index if not exists idx_ventes_origine on ventes (document_origine_id)
  where document_origine_id is not null;

-- Un crédit appliqué sur une facture n'est pas de l'argent reçu : il doit se
-- distinguer d'un encaissement.
alter table paiements_vente
  add column if not exists note_credit_id uuid references ventes (id) on delete set null;
comment on column paiements_vente.note_credit_id is
  'Renseigné quand la ligne est l''application d''une note de crédit, pas un encaissement.';

-- ---------------------------------------------------------------------------
-- 16.4 Numérotation depuis le registre
-- ---------------------------------------------------------------------------
create or replace function prochain_numero(p_type type_document, p_date date)
returns text
language plpgsql as $$
declare v_annee smallint := extract(year from p_date)::smallint; v_suite integer; v_prefixe text;
begin
  select prefixe into v_prefixe from types_document where code = p_type;
  if v_prefixe is null then
    raise exception 'Type de document % inconnu du registre.', p_type;
  end if;

  insert into compteurs_documents (type_document, annee, dernier)
  values (p_type, v_annee, 1)
  on conflict (type_document, annee)
  do update set dernier = compteurs_documents.dernier + 1
  returning dernier into v_suite;

  return v_prefixe || '-' || v_annee || '-' || lpad(v_suite::text, 5, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- 16.5 Totaux : un seul endroit calcule la base taxable
--
-- Avant, la base taxable était recalculée dans le déclencheur des lignes ET
-- dans celui de la vente, avec deux formules qu'il fallait garder identiques.
-- Elle est maintenant calculée une fois et rangée dans `base_taxable`.
-- ---------------------------------------------------------------------------
create or replace function recalculer_totaux_vente(p_vente_id uuid)
returns void language plpgsql as $$
declare
  v ventes%rowtype;
  t types_document%rowtype;
  r regimes_taxe%rowtype;
  v_lignes numeric; v_taxables numeric; v_non_taxables numeric; v_remise numeric;
  v_ht numeric; v_base numeric; v_taxes numeric; v_ttc numeric; v_ht_taxable numeric;
begin
  select * into v from ventes where id = p_vente_id;
  if not found then return; end if;
  select * into t from types_document where code = v.type_document;
  select * into r from regimes_taxe where code = v.regime_taxe;

  select coalesce(sum(montant_ht), 0),
         coalesce(sum(montant_ht) filter (where taxable), 0),
         coalesce(sum(montant_ht) filter (where not taxable), 0)
    into v_lignes, v_taxables, v_non_taxables
  from vente_lignes where vente_id = p_vente_id;

  -- Une remise ne peut pas dépasser ce qu'elle remise.
  v_remise := least(v.remise_globale, greatest(v_lignes, 0));

  if not r.applique_taxes then
    v_ht := v_lignes - v_remise;
    v_base := 0;
    v_taxes := 0;

  elsif v.prix_avec_taxes then
    -- Prix affichés taxes incluses : le hors-taxes se déduit du prix payé.
    v_ttc := greatest(v_taxables - v_remise, 0);
    select montant_ht, montant_taxes into v_ht_taxable, v_taxes
      from ventiler_ttc(v_ttc, v.province, v.date);
    v_base := v_ht_taxable;
    v_ht := v_ht_taxable + v_non_taxables;

  else
    v_base := greatest(v_taxables - v_remise, 0);
    v_ht := v_lignes - v_remise;
    v_taxes := total_taxes(v_base, v.province, v.date);
  end if;

  -- Montant imposé de l'extérieur (Stripe) : on ne recalcule pas la taxe.
  if v.taxes_manuelles then
    v_taxes := v.total_taxes * t.signe;
    v_base := v_ht;
  end if;

  update ventes
     set montant_ht   = round(v_ht * t.signe, 2),
         base_taxable = round(v_base * t.signe, 2),
         total_taxes  = round(v_taxes * t.signe, 2)
   where id = p_vente_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 16.6 Écritures : les règles viennent du registre, plus du code en dur
-- ---------------------------------------------------------------------------
create or replace function trg_synchroniser_vente() returns trigger
language plpgsql as $$
declare v_transaction_id uuid; t types_document%rowtype;
begin
  select * into t from types_document where code = new.type_document;

  if not t.comptabilise_revenu
     or new.statut in ('annulee', 'brouillon', 'refusee')
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
      t.libelle || ' ' || new.numero || coalesce(' — ' || nullif(new.client_nom, ''), ''),
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

  perform poser_lignes_taxe(v_transaction_id, new.base_taxable, new.total_taxes);
  return new;
end;
$$;

-- Un document peut sortir la marchandise du stock ou l'y remettre.
drop index if exists uq_inventaire_vente;
create unique index uq_inventaire_document on inventaire_mouvements (vente_id, produit_id)
  where vente_id is not null and type in ('vente', 'retour');

create or replace function recalculer_cogs(p_vente_id uuid)
returns void language plpgsql as $$
declare v ventes%rowtype; t types_document%rowtype; v_cogs numeric; v_id uuid;
begin
  select * into v from ventes where id = p_vente_id;
  if not found then return; end if;
  select * into t from types_document where code = v.type_document;

  select id into v_id from transactions
    where vente_id = p_vente_id and categorie = 'cout_marchandises_vendues';

  if not t.affecte_stock or v.statut in ('annulee', 'brouillon', 'refusee') then
    delete from transactions where id = v_id;
    return;
  end if;

  select coalesce(sum(l.quantite * cout_moyen(l.produit_id, v.date)), 0) * t.signe
    into v_cogs
  from vente_lignes l
  join produits p on p.id = l.produit_id
  where l.vente_id = p_vente_id and p.suivi_stock;

  v_cogs := round(v_cogs, 2);
  if v_cogs = 0 then
    delete from transactions where id = v_id;
    return;
  end if;

  if v_id is null then
    insert into transactions (date, description, montant_ht, type, categorie, nature,
                              source, mode_paiement, province, vente_id, est_remboursement)
    values (v.date, 'Coût des cartes — ' || v.numero, v_cogs, 'depense',
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
declare v_vente_id uuid; t types_document%rowtype;
begin
  v_vente_id := coalesce(new.vente_id, old.vente_id);
  select td.* into t
    from ventes v join types_document td on td.code = v.type_document
   where v.id = v_vente_id;

  perform recalculer_totaux_vente(v_vente_id);

  if not coalesce(t.affecte_stock, false) then
    delete from inventaire_mouvements where vente_id = v_vente_id;
    delete from transactions
      where vente_id = v_vente_id and categorie = 'cout_marchandises_vendues';
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op <> 'DELETE' and new.produit_id is not null then
    if exists (select 1 from produits where id = new.produit_id and suivi_stock) then
      insert into inventaire_mouvements (date, produit_id, type, quantite, cout_unitaire, vente_id, note)
      select v.date, new.produit_id,
             case when t.signe = -1 then 'retour' else 'vente' end,
             -t.signe * new.quantite,
             cout_moyen(new.produit_id, v.date), new.vente_id,
             t.libelle || ' ' || v.numero
      from ventes v where v.id = new.vente_id and new.quantite <> 0
      on conflict (vente_id, produit_id) where vente_id is not null and type in ('vente', 'retour')
      do update set quantite = excluded.quantite, cout_unitaire = excluded.cout_unitaire,
                    type = excluded.type;
    end if;
  elsif tg_op = 'DELETE' and old.produit_id is not null then
    delete from inventaire_mouvements
      where vente_id = old.vente_id and produit_id = old.produit_id;
  end if;

  perform recalculer_cogs(v_vente_id);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Le régime et le mode d'affichage des prix changent les totaux : il faut les
-- recalculer quand ils changent, pas seulement quand une ligne bouge.
create or replace function trg_recalcul_si_regime_change() returns trigger
language plpgsql as $$
begin
  if (old.regime_taxe, old.prix_avec_taxes, old.remise_globale, old.province, old.date)
     is distinct from
     (new.regime_taxe, new.prix_avec_taxes, new.remise_globale, new.province, new.date) then
    perform recalculer_totaux_vente(new.id);
  end if;
  return new;
end;
$$;

create trigger t_recalcul_regime after update on ventes
  for each row execute function trg_recalcul_si_regime_change();

-- ---------------------------------------------------------------------------
-- 16.7 Conversion et notes de crédit
-- ---------------------------------------------------------------------------
create or replace function convertir_devis_en_facture(p_devis_id uuid, p_date date default current_date)
returns uuid
language plpgsql as $$
declare d ventes%rowtype; v_facture_id uuid;
begin
  select * into d from ventes where id = p_devis_id;
  if not found then raise exception 'Document introuvable.'; end if;
  if d.type_document not in ('devis', 'proforma') then
    raise exception 'Seul un devis ou une proforma se convertit en facture.';
  end if;
  if exists (select 1 from ventes where document_origine_id = p_devis_id
                                    and type_document = 'facture') then
    raise exception 'Ce document a déjà été facturé.';
  end if;

  insert into ventes (
    date, client_id, client_nom, province, canal, mode_paiement, statut,
    type_document, categorie_revenu, remise_globale, conditions_paiement,
    adresse_facturation, courriel_facturation, bon_de_commande,
    notes_facture, conditions_generales, note, document_origine_id,
    regime_taxe, motif_exemption, numero_certificat_exemption, prix_avec_taxes)
  values (
    p_date, d.client_id, d.client_nom, d.province, d.canal, d.mode_paiement, 'ferme',
    'facture', d.categorie_revenu, d.remise_globale, d.conditions_paiement,
    d.adresse_facturation, d.courriel_facturation, d.bon_de_commande,
    d.notes_facture, d.conditions_generales, d.note, p_devis_id,
    d.regime_taxe, d.motif_exemption, d.numero_certificat_exemption, d.prix_avec_taxes)
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

-- Applique une note de crédit sur la facture qu'elle corrige : le solde dû
-- diminue sans qu'un sou n'ait été encaissé. La ligne porte `note_credit_id`,
-- pour ne jamais confondre un crédit accordé avec de l'argent reçu.
create or replace function appliquer_note_credit(p_note_id uuid, p_facture_id uuid)
returns uuid
language plpgsql as $$
declare n ventes%rowtype; f ventes%rowtype; v_id uuid;
begin
  select * into n from ventes where id = p_note_id;
  select * into f from ventes where id = p_facture_id;
  if n.type_document <> 'note_credit' then
    raise exception 'Ce document n''est pas une note de crédit.';
  end if;
  if f.id is null or f.type_document not in ('facture', 'facture_acompte', 'recu') then
    raise exception 'Une note de crédit s''applique à une facture ou à un reçu.';
  end if;
  if exists (select 1 from paiements_vente where note_credit_id = p_note_id) then
    raise exception 'Cette note de crédit est déjà appliquée.';
  end if;

  insert into paiements_vente (vente_id, date, montant, mode_paiement, note_credit_id, reference, note)
  values (p_facture_id, n.date, abs(n.montant_ttc), 'autre', p_note_id,
          n.numero, 'Application de la note de crédit ' || n.numero)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 16.8 Vues : le filtre « ce n'est pas un devis » vient du registre
-- ---------------------------------------------------------------------------
create or replace view v_ventes_mensuelles with (security_invoker = true) as
select date_trunc('month', v.date::timestamp)::date as mois,
       v.canal,
       count(*)                                as nb_ventes,
       coalesce(sum(q.cartes), 0)::bigint      as cartes_vendues,
       coalesce(sum(v.montant_ht), 0)          as revenus_ht
from ventes v
join types_document t on t.code = v.type_document
cross join lateral (
  select coalesce(sum(l.quantite) filter (where coalesce(p.est_carte, true)), 0) * t.signe as cartes
  from vente_lignes l
  left join produits p on p.id = l.produit_id
  where l.vente_id = v.id
) q
where t.comptabilise_revenu
  and v.statut not in ('annulee', 'brouillon', 'refusee')
group by 1, 2;

create or replace view v_ventes_par_province with (security_invoker = true) as
select v.province,
       count(*) as nb_ventes,
       coalesce(sum(q.cartes), 0)::bigint as cartes,
       coalesce(sum(v.montant_ht), 0) as revenus_ht
from ventes v
join types_document t on t.code = v.type_document
cross join lateral (
  select coalesce(sum(l.quantite), 0) * t.signe as cartes
  from vente_lignes l where l.vente_id = v.id
) q
where t.comptabilise_revenu
  and v.statut not in ('annulee', 'brouillon', 'refusee')
group by v.province;

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
  join types_document t on t.code = v.type_document
  cross join lateral (
    select coalesce(sum(l.quantite) filter (where coalesce(p.est_carte, true)), 0) * t.signe as cartes
    from vente_lignes l
    left join produits p on p.id = l.produit_id
    where l.vente_id = v.id
  ) q
  cross join fenetre f
  where t.comptabilise_revenu
    and v.statut not in ('annulee', 'brouillon', 'refusee')
    and v.date >= f.debut and q.cartes <> 0
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

drop view if exists v_documents_vente;
create view v_documents_vente with (security_invoker = true) as
select v.id, v.numero, v.type_document, t.libelle as type_libelle, t.affiche_prix,
       t.attend_paiement, t.signe,
       v.date, v.date_echeance, v.date_envoi,
       v.client_id, coalesce(c.nom, v.client_nom) as client,
       v.province, v.canal, v.mode_paiement, v.statut, v.statut_paiement,
       v.regime_taxe, v.motif_exemption, v.prix_avec_taxes,
       v.montant_ht, v.base_taxable, v.total_taxes, v.montant_ttc, v.montant_paye,
       v.montant_ttc - v.montant_paye as solde,
       v.remise_globale, v.document_origine_id,
       (select numero from ventes o where o.id = v.document_origine_id) as numero_origine,
       (select count(*) from vente_lignes l where l.vente_id = v.id)  as nb_lignes,
       (select coalesce(sum(l.quantite), 0) from vente_lignes l where l.vente_id = v.id) as quantite,
       t.attend_paiement
         and v.statut_paiement <> 'payee'
         and v.statut not in ('annulee', 'brouillon')
         and v.date_echeance is not null
         and v.date_echeance < current_date                          as en_retard,
       exists (select 1 from ventes s where s.document_origine_id = v.id) as a_un_suivi,
       (select s.numero from ventes s where s.document_origine_id = v.id order by s.cree_le limit 1)
         as numero_suivi_document,
       v.cree_le
from ventes v
join types_document t on t.code = v.type_document
left join clients c on c.id = v.client_id;

-- ---------------------------------------------------------------------------
-- 16.9 Sécurité : les tables ajoutées depuis la migration 12 n'avaient pas
-- encore le RLS. Sans politique, seul le rôle propriétaire y accède.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select tablename from pg_tables
            where schemaname = 'public' and not rowsecurity loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end;
$$;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables    in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('revoke all on all functions in schema public from %I', r);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 16.10 État de paiement : un devis ou une note de crédit n'est pas « impayé »
-- ---------------------------------------------------------------------------
alter table ventes drop constraint if exists ventes_statut_paiement_check;
alter table ventes add constraint ventes_statut_paiement_check
  check (statut_paiement in ('impayee', 'partielle', 'payee', 'remboursee', 'sans_objet'));

create or replace function recalculer_paiements_vente(p_vente_id uuid)
returns void language plpgsql as $$
declare v_paye numeric; v_ttc numeric; v_statut text; v_attend boolean;
begin
  select coalesce(sum(montant), 0) into v_paye
    from paiements_vente where vente_id = p_vente_id;

  select v.montant_ttc, t.attend_paiement into v_ttc, v_attend
    from ventes v join types_document t on t.code = v.type_document
   where v.id = p_vente_id;
  if v_ttc is null then return; end if;

  v_statut := case
    when not v_attend            then 'sans_objet'
    when v_paye <= 0             then 'impayee'
    when v_paye >= v_ttc         then 'payee'
    else 'partielle'
  end;

  update ventes set montant_paye = v_paye, statut_paiement = v_statut
   where id = p_vente_id
     and (montant_paye, statut_paiement) is distinct from (v_paye, v_statut);
end;
$$;

-- Le statut dépend du type : il doit être recalculé si le document change.
create or replace function trg_statut_paiement_vente() returns trigger
language plpgsql as $$
begin
  if old.type_document is distinct from new.type_document
     or old.montant_ttc is distinct from new.montant_ttc then
    perform recalculer_paiements_vente(new.id);
  end if;
  return new;
end;
$$;

create trigger t_statut_paiement after update on ventes
  for each row execute function trg_statut_paiement_vente();

-- Reprise des documents déjà saisis.
do $$
declare v record;
begin
  for v in select id from ventes loop
    perform recalculer_paiements_vente(v.id);
  end loop;
end;
$$;
