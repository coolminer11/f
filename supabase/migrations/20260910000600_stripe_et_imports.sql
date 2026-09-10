-- ============================================================================
-- Tapora S.E.N.C. — 06 · Stripe (événements, litiges, versements) et import CSV
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Journal des événements Stripe.
--
-- Stripe réessaie un webhook tant qu'il ne reçoit pas de 2xx : un timeout, un
-- redéploiement pendant le traitement, et la même vente est comptabilisée deux
-- fois. Protocole imposé par le schéma : on INSÈRE d'abord dans cette table
-- (contrainte unique sur stripe_event_id), et on ne traite que si l'insertion
-- a réussi. Voir la fonction `reserver_evenement_stripe()`.
-- ---------------------------------------------------------------------------
create table evenements_stripe (
  id              uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,          -- evt_...
  type            text not null,                 -- charge.succeeded, charge.dispute.created, ...
  recu_le         timestamptz not null default now(),
  traite_le       timestamptz,
  statut          text not null default 'recu'
                  check (statut in ('recu', 'traite', 'ignore', 'erreur')),
  erreur          text,
  payload         jsonb
);
create index idx_evenements_stripe_statut on evenements_stripe (statut, recu_le desc);
create index idx_evenements_stripe_type on evenements_stripe (type, recu_le desc);

comment on column evenements_stripe.stripe_event_id is
  'Clé d''idempotence. Une insertion refusée signifie « déjà traité » : ne rien faire de plus.';

-- ---------------------------------------------------------------------------
-- Versements Stripe (payout.paid).
-- Ni revenu ni dépense : simple virement Stripe -> banque d'argent déjà
-- comptabilisé à la vente. Sert au rapprochement du relevé bancaire.
-- ---------------------------------------------------------------------------
create table versements_stripe (
  id            text primary key,          -- po_...
  date_arrivee  date not null,
  montant       numeric(12,2) not null,
  devise        char(3) not null default 'CAD',
  statut        text not null default 'paid',
  rapproche     boolean not null default false,
  payload       jsonb,
  cree_le       timestamptz not null default now()
);
create index idx_versements_date on versements_stripe (date_arrivee desc);

-- ---------------------------------------------------------------------------
-- Rétrofacturations (contestations de paiement).
--
-- Une contestation coûte deux fois : le revenu est repris ET Stripe facture des
-- frais d'environ 15 $, non remboursés même si la contestation est gagnée dans
-- certains cas. Sur une carte à 30 $, c'est une perte nette — elle doit être
-- visible, pas noyée dans les frais Stripe.
-- ---------------------------------------------------------------------------
create table litiges (
  id                 text primary key,      -- dp_...
  stripe_charge_id   text,
  vente_id           uuid references ventes (id) on delete set null,
  date_ouverture     date not null,
  date_cloture       date,
  montant_conteste   numeric(12,2) not null check (montant_conteste >= 0),
  frais              numeric(12,2) not null default 0 check (frais >= 0),
  motif              text,
  statut             text not null default 'ouvert'
                     check (statut in ('ouvert', 'gagne', 'perdu', 'annule')),
  -- Écritures produites : reprise du revenu, frais, et reprise à la clôture.
  transaction_reprise_id uuid references transactions (id) on delete set null,
  transaction_frais_id   uuid references transactions (id) on delete set null,
  transaction_reversal_id uuid references transactions (id) on delete set null,
  payload            jsonb,
  cree_le            timestamptz not null default now(),
  maj_le             timestamptz not null default now()
);
create index idx_litiges_statut on litiges (statut, date_ouverture desc);
create index idx_litiges_vente on litiges (vente_id);

comment on table litiges is
  'Rétrofacturations Stripe. Une contestation ouverte reprend le revenu immédiatement ; une contestation gagnée le rétablit.';

-- ---------------------------------------------------------------------------
-- Import CSV de relevé bancaire.
-- Deux niveaux de déduplication : l'empreinte du FICHIER empêche de réimporter
-- le même relevé, l'empreinte de la LIGNE empêche de recréer une écriture déjà
-- saisie même si elle arrive dans un autre fichier (relevés qui se chevauchent).
-- ---------------------------------------------------------------------------
create table imports_bancaires (
  id               uuid primary key default gen_random_uuid(),
  nom_fichier      text not null,
  empreinte_fichier text not null unique,
  compte           text,
  date_import      timestamptz not null default now(),
  nb_lignes        integer not null default 0,
  nb_traitees      integer not null default 0,
  statut           text not null default 'en_cours' check (statut in ('en_cours', 'termine')),
  note             text
);

create table lignes_import_bancaire (
  id            uuid primary key default gen_random_uuid(),
  import_id     uuid not null references imports_bancaires (id) on delete cascade,
  date          date not null,
  description   text not null,
  -- Signé selon le relevé : négatif = débit (dépense), positif = crédit.
  montant       numeric(12,2) not null,
  solde         numeric(12,2),
  empreinte     text not null unique,
  statut        text not null default 'a_categoriser' check (statut in (
                  'a_categoriser', 'categorisee', 'depot_caisse', 'virement_stripe',
                  'mouvement_associe', 'ignoree', 'doublon')),
  transaction_id       uuid references transactions (id) on delete set null,
  versement_stripe_id  text references versements_stripe (id) on delete set null,
  categorie_suggeree   categorie_transaction,
  brut          jsonb,
  cree_le       timestamptz not null default now()
);
create index idx_lignes_import_statut on lignes_import_bancaire (statut, date desc);
create index idx_lignes_import_import on lignes_import_bancaire (import_id);

comment on column lignes_import_bancaire.statut is
  'depot_caisse / virement_stripe / mouvement_associe : ligne rapprochée d''argent DÉJÀ comptabilisé, pas un revenu.';

create table regles_categorisation (
  id        uuid primary key default gen_random_uuid(),
  motif     text not null,
  type      type_transaction not null default 'depense',
  categorie categorie_transaction not null,
  nature    nature_cout,
  priorite  smallint not null default 100,
  actif     boolean not null default true,
  cree_le   timestamptz not null default now()
);
create index idx_regles_priorite on regles_categorisation (priorite) where actif;
