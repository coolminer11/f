-- ============================================================================
-- Tapora S.E.N.C. — 06 · Stripe et import bancaire
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Journal des événements Stripe : idempotence + rejouabilité.
-- Stripe re-livre un webhook en cas de timeout ; la clé primaire evt_... garantit
-- qu'un même événement ne crée jamais deux écritures.
-- ---------------------------------------------------------------------------
create table stripe_evenements (
  id         text primary key,             -- evt_...
  type       text not null,                -- charge.succeeded, charge.refunded, payout.paid
  recu_le    timestamptz not null default now(),
  traite_le  timestamptz,
  statut     text not null default 'recu'
             check (statut in ('recu', 'traite', 'ignore', 'erreur')),
  erreur     text,
  payload    jsonb not null
);
create index idx_stripe_evenements_statut on stripe_evenements (statut, recu_le desc);

-- ---------------------------------------------------------------------------
-- Versements Stripe (payout.paid).
-- IMPORTANT : un payout n'est NI un revenu NI une dépense. C'est un simple
-- virement Stripe -> banque d'argent déjà comptabilisé au moment de la vente.
-- L'enregistrer comme revenu doublerait le chiffre d'affaires ; c'est pour cela
-- qu'il vit dans sa propre table et non dans `transactions`.
-- ---------------------------------------------------------------------------
create table versements_stripe (
  id            text primary key,          -- po_...
  date_arrivee  date not null,
  montant       numeric(12,2) not null,     -- net déposé au compte bancaire
  devise        char(3) not null default 'CAD',
  statut        text not null default 'paid',
  rapproche     boolean not null default false,
  payload       jsonb,
  cree_le       timestamptz not null default now()
);
create index idx_versements_date on versements_stripe (date_arrivee desc);

comment on table versements_stripe is
  'Virements Stripe -> banque. Sert uniquement au rapprochement du relevé, aucun impact sur le profit.';

-- ---------------------------------------------------------------------------
-- Import CSV de relevé bancaire.
-- ---------------------------------------------------------------------------
create table imports_bancaires (
  id           uuid primary key default gen_random_uuid(),
  nom_fichier  text not null,
  compte       text,                        -- ex. « Desjardins entreprise »
  date_import  timestamptz not null default now(),
  nb_lignes    integer not null default 0,
  nb_traitees  integer not null default 0,
  statut       text not null default 'en_cours' check (statut in ('en_cours', 'termine')),
  note         text
);

create table lignes_import_bancaire (
  id            uuid primary key default gen_random_uuid(),
  import_id     uuid not null references imports_bancaires (id) on delete cascade,
  date          date not null,
  description   text not null,
  -- Signé selon le relevé : négatif = débit (dépense), positif = crédit.
  montant       numeric(12,2) not null,
  solde         numeric(12,2),
  -- Empreinte de déduplication : rejouer deux fois le même CSV ne duplique rien.
  empreinte     text not null unique,
  statut        text not null default 'a_categoriser' check (statut in (
                  'a_categoriser',
                  'categorisee',        -- a produit une transaction
                  'depot_caisse',       -- dépôt d'argent comptant déjà comptabilisé
                  'virement_stripe',    -- versement Stripe déjà comptabilisé
                  'mouvement_associe',  -- apport / prélèvement, hors résultat
                  'ignoree',
                  'doublon'
                )),
  transaction_id       uuid references transactions (id) on delete set null,
  versement_stripe_id  text references versements_stripe (id) on delete set null,
  categorie_suggeree   categorie_transaction,
  brut          jsonb,
  cree_le       timestamptz not null default now()
);
create index idx_lignes_import_statut on lignes_import_bancaire (statut, date desc);
create index idx_lignes_import_import on lignes_import_bancaire (import_id);

comment on column lignes_import_bancaire.statut is
  'Les statuts depot_caisse / virement_stripe / mouvement_associe existent pour rapprocher une ligne sans créer de double comptabilisation.';

-- ---------------------------------------------------------------------------
-- Règles de catégorisation : l'écran de catégorisation apprend de vos choix.
-- ---------------------------------------------------------------------------
create table regles_categorisation (
  id        uuid primary key default gen_random_uuid(),
  motif     text not null,                 -- comparé en ILIKE '%motif%'
  type      type_transaction not null default 'depense',
  categorie categorie_transaction not null,
  nature    nature_cout,
  pct_cti   numeric(5,4),
  pct_rti   numeric(5,4),
  priorite  smallint not null default 100, -- plus petit = appliqué en premier
  actif     boolean not null default true,
  cree_le   timestamptz not null default now()
);
create index idx_regles_priorite on regles_categorisation (priorite) where actif;
