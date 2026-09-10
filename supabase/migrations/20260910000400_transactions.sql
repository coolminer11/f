-- ============================================================================
-- Tapora S.E.N.C. — 04 · Transactions (table centrale)
-- ============================================================================
-- Règles gravées dans le schéma :
--   * `montant_ht` est LE revenu ou LA dépense. Les taxes sont à côté.
--   * Sur une dépense, `cti` / `rti` sont calculés automatiquement et
--     représentent la portion récupérable auprès de Revenu Québec.
--   * Une ligne de revenu ne porte jamais de nature (fixe/variable).
-- ============================================================================

create table transactions (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  description   text not null,

  montant_ht    numeric(12,2) not null,
  tps           numeric(12,2) not null default 0,
  tvq           numeric(12,2) not null default 0,
  montant_ttc   numeric(12,2) generated always as (montant_ht + tps + tvq) stored,

  type          type_transaction not null,
  categorie     categorie_transaction not null,
  nature        nature_cout,
  source        source_transaction not null default 'manuel',
  mode_paiement mode_paiement not null default 'autre',
  piece_jointe_url text,

  -- Récupération des taxes sur les achats (CTI = TPS, RTI = TVQ).
  -- Volontairement SANS valeur par défaut : un trigger les renseigne depuis
  -- `categories_defauts`, ce qui applique d'office la limite à 50 % des repas
  -- et représentation sans que la saisie ait à y penser.
  pct_cti numeric(5,4) not null check (pct_cti between 0 and 1),
  pct_rti numeric(5,4) not null check (pct_rti between 0 and 1),
  cti numeric(12,2) generated always as
        (case when type = 'depense' then round(tps * pct_cti, 2) else 0 end) stored,
  rti numeric(12,2) generated always as
        (case when type = 'depense' then round(tvq * pct_rti, 2) else 0 end) stored,

  -- Rattachements
  vente_id            uuid references ventes (id) on delete cascade,
  transaction_liee_id uuid references transactions (id) on delete set null,
  associe_id          uuid references associes (id) on delete set null,
  est_remboursement   boolean not null default false,

  -- Idempotence : id Stripe, ou empreinte de ligne bancaire.
  reference_externe text,

  annee smallint generated always as (extract(year from date)::smallint) stored,
  note  text,
  cree_le timestamptz not null default now(),
  maj_le  timestamptz not null default now(),

  -- Une dépense a toujours une nature, un revenu n'en a jamais.
  constraint chk_nature check (
    (type = 'depense' and nature is not null)
    or (type = 'revenu' and nature is null)
  ),
  -- Cohérence catégorie / sens.
  constraint chk_categorie_type check (
    (type = 'revenu'  and categorie in
       ('ventes_cartes', 'ventes_accessoires', 'ventes_services', 'autre'))
    or (type = 'depense' and categorie not in
       ('ventes_cartes', 'ventes_accessoires', 'ventes_services'))
  ),
  -- Seuls un remboursement ou un ajustement peuvent être négatifs.
  constraint chk_montant_signe check (montant_ht >= 0 or est_remboursement),
  -- Les taxes suivent le signe du montant HT.
  constraint chk_taxes_signe check (
    (montant_ht >= 0 and tps >= 0 and tvq >= 0)
    or (montant_ht < 0 and tps <= 0 and tvq <= 0)
  )
);

create index idx_transactions_date       on transactions (date desc);
create index idx_transactions_type_date  on transactions (type, date desc);
create index idx_transactions_categorie  on transactions (categorie, date desc);
create index idx_transactions_mois       on transactions (date_trunc('month', date::timestamp));
create index idx_transactions_vente      on transactions (vente_id) where vente_id is not null;
create index idx_transactions_associe    on transactions (associe_id) where associe_id is not null;

-- Idempotence des webhooks et des imports : deux fois le même événement
-- Stripe ou la même ligne bancaire ne peuvent pas créer deux écritures.
create unique index uq_transactions_reference
  on transactions (source, reference_externe) where reference_externe is not null;

-- Une vente n'a qu'une ligne de revenu et qu'une ligne de frais Stripe.
create unique index uq_transactions_vente_revenu
  on transactions (vente_id) where vente_id is not null and type = 'revenu';
create unique index uq_transactions_vente_frais
  on transactions (vente_id) where vente_id is not null and categorie = 'frais_stripe';

comment on table transactions is
  'Journal unique. Revenu = montant_ht. Les taxes perçues ne sont jamais du revenu.';
comment on column transactions.transaction_liee_id is
  'Relie la dépense « frais Stripe » à sa ligne de revenu : le net déposé ne masque jamais les frais.';
