-- ============================================================================
-- Tapora S.E.N.C. — 04 · Transactions et lignes de taxe
-- ============================================================================
-- Règles gravées dans le schéma :
--   * `montant_ht` est LE revenu ou LA dépense. Les taxes sont dans une table
--     séparée : aucune requête de résultat ne peut les ramasser par accident.
--   * Une écriture porte autant de lignes de taxe que la province l'exige :
--     une seule (TVH en Ontario), deux (TPS + TVQ au Québec), ou zéro.
--   * Un achat de marchandise suivie en stock est un ACTIF (`est_stock`), pas
--     une charge : il ne touche le résultat qu'à la vente, via le COGS.
--   * Aucune colonne monétaire n'est en virgule flottante : numeric(12,2)
--     partout, numeric(12,4) pour les coûts unitaires.
-- ============================================================================

create table transactions (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  description   text not null,

  montant_ht    numeric(12,2) not null,
  -- Totaux dénormalisés, entretenus par déclencheur depuis `lignes_taxe`.
  -- Ils existent pour l'affichage des listes, jamais comme source de vérité.
  total_taxes             numeric(12,2) not null default 0,
  total_taxes_recuperables numeric(12,2) not null default 0,
  montant_ttc   numeric(12,2) generated always as (montant_ht + total_taxes) stored,
  -- Coût réellement supporté : la taxe NON récupérable est une charge réelle
  -- (moitié de la TPS/TVQ sur les repas, totalité de la TVP hors Québec).
  -- L'ignorer sous-estimerait les dépenses. Sur un revenu, c'est le HT seul.
  cout_reel     numeric(12,2) generated always as (
                  case when type = 'depense'
                       then montant_ht + total_taxes - total_taxes_recuperables
                       else montant_ht end) stored,

  type          type_transaction not null,
  categorie     categorie_transaction not null,
  nature        nature_cout,
  source        source_transaction not null default 'manuel',
  mode_paiement mode_paiement not null default 'autre',
  -- Province de destination (vente) ou du lieu d'achat (dépense).
  province      province_canada not null default 'QC',
  piece_jointe_url text,

  -- Part récupérable appliquée aux lignes de taxe (50 % pour les repas).
  -- Sans valeur par défaut : un déclencheur la tire de `categories_defauts`.
  pct_recuperable numeric(5,4) not null check (pct_recuperable between 0 and 1),

  -- Vrai : achat porté au stock. Exclu du résultat, mais les taxes restent
  -- récupérables dès l'achat — le crédit sur intrants ne dépend pas de la vente.
  est_stock boolean not null default false,

  vente_id            uuid references ventes (id) on delete cascade,
  transaction_liee_id uuid references transactions (id) on delete set null,
  associe_id          uuid references associes (id) on delete set null,
  est_remboursement   boolean not null default false,

  reference_externe text,

  annee smallint generated always as (extract(year from date)::smallint) stored,
  note  text,
  cree_le timestamptz not null default now(),
  maj_le  timestamptz not null default now(),

  constraint chk_nature check (
    (type = 'depense' and nature is not null)
    or (type = 'revenu' and nature is null)
  ),
  constraint chk_categorie_type check (
    (type = 'revenu'  and categorie in
       ('ventes_cartes', 'ventes_accessoires', 'ventes_services', 'autre'))
    or (type = 'depense' and categorie not in
       ('ventes_cartes', 'ventes_accessoires', 'ventes_services'))
  ),
  constraint chk_montant_signe check (
    montant_ht >= 0 or est_remboursement
    or categorie in ('perte_inventaire', 'cout_marchandises_vendues')),
  -- Seul un achat de marchandise peut être porté au stock.
  constraint chk_est_stock check (
    not est_stock or (type = 'depense' and categorie = 'cartes_achat')
  )
);

create index idx_transactions_date       on transactions (date desc);
create index idx_transactions_type_date  on transactions (type, date desc);
create index idx_transactions_categorie  on transactions (categorie, date desc);
create index idx_transactions_mois       on transactions (date_trunc('month', date::timestamp));
create index idx_transactions_vente      on transactions (vente_id) where vente_id is not null;
create index idx_transactions_associe    on transactions (associe_id) where associe_id is not null;
create index idx_transactions_resultat   on transactions (date) where not est_stock;

-- Idempotence des webhooks et des imports.
create unique index uq_transactions_reference
  on transactions (source, reference_externe) where reference_externe is not null;

-- Une vente n'a qu'une ligne de revenu, qu'une ligne de frais Stripe et
-- qu'une ligne de coût des marchandises vendues.
create unique index uq_transactions_vente_revenu
  on transactions (vente_id) where vente_id is not null and type = 'revenu';
create unique index uq_transactions_vente_frais
  on transactions (vente_id) where vente_id is not null and categorie = 'frais_stripe';
create unique index uq_transactions_vente_cogs
  on transactions (vente_id) where vente_id is not null
                              and categorie = 'cout_marchandises_vendues';

comment on table transactions is
  'Journal unique. Revenu = montant_ht. Les taxes perçues ne sont jamais du revenu.';
comment on column transactions.transaction_liee_id is
  'Relie la dépense « frais Stripe » à sa ligne de revenu : le net déposé ne masque jamais les frais.';

-- ---------------------------------------------------------------------------
-- Lignes de taxe : une par taxe applicable à l'écriture.
--
-- ARRONDI : chaque taxe est calculée sur le montant HT de l'écriture entière
-- (jamais unité par unité) puis arrondie au cent le plus proche, les demis
-- s'éloignant de zéro — c'est le comportement de round(numeric, 2) de
-- PostgreSQL et la règle admise par l'ARC et Revenu Québec.
-- Exemple : 39,00 $ × 9,975 % = 3,89025 $ -> 3,89 $.
-- Quand le montant encaissé est imposé de l'extérieur (Stripe), le résidu
-- d'arrondi est porté sur la DERNIÈRE ligne de taxe pour que la somme
-- reconcilie au cent près avec ce que le client a réellement payé.
-- ---------------------------------------------------------------------------
create table lignes_taxe (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions (id) on delete cascade,
  code           text not null references taxes (code) on delete restrict,
  autorite       text not null check (autorite in ('ARC', 'RQ', 'BC', 'SK', 'MB')),
  taux           numeric(7,5) not null,
  montant        numeric(12,2) not null,
  -- Part récupérable en crédit sur intrants. Toujours 0 sur une écriture de
  -- revenu : une taxe PERÇUE se remet, elle ne se récupère pas.
  recuperable_pct numeric(5,4) not null default 1 check (recuperable_pct between 0 and 1),
  montant_recuperable numeric(12,2) generated always as
                        (round(montant * recuperable_pct, 2)) stored,
  unique (transaction_id, code)
);
create index idx_lignes_taxe_transaction on lignes_taxe (transaction_id);
create index idx_lignes_taxe_autorite on lignes_taxe (autorite, code);

comment on table lignes_taxe is
  'Une ligne par taxe applicable. Permet TVH seule, TPS+TVQ, TPS+TVP, ou aucune taxe.';
