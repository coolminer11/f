-- ============================================================================
-- Tapora S.E.N.C. — 03 · Ventes (Stripe, comptant, autres canaux)
-- ============================================================================
-- `transactions` répond « combien d'argent », `ventes` répond « combien de
-- cartes ». La marge unitaire et le seuil de rentabilité ont besoin de
-- quantités. Chaque vente engendre automatiquement une ligne de revenu HT,
-- ses lignes de taxe, et son coût des marchandises vendues.
-- ============================================================================

create sequence seq_numero_vente start 1;

create table ventes (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null unique
                 default ('V-' || to_char(now() at time zone 'America/Toronto', 'YYYY')
                          || '-' || lpad(nextval('seq_numero_vente')::text, 5, '0')),
  date           date not null default current_date,
  client_id      uuid references clients (id) on delete set null,
  client_nom     text,
  -- Province de DESTINATION : c'est elle qui détermine la taxe applicable.
  province       province_canada not null default 'QC',
  canal          canal_vente not null default 'comptant',
  mode_paiement  mode_paiement not null default 'comptant',
  statut         statut_vente not null default 'payee',

  -- Totaux recalculés par déclencheur depuis `vente_lignes`.
  montant_ht     numeric(12,2) not null default 0,
  total_taxes    numeric(12,2) not null default 0,
  montant_ttc    numeric(12,2) generated always as (montant_ht + total_taxes) stored,

  -- Vrai : le total des taxes est imposé par la source (montant Stripe au cent
  -- près) et ne doit pas être recalculé depuis les lignes.
  taxes_manuelles boolean not null default false,
  categorie_revenu categorie_transaction not null default 'ventes_cartes'
                   check (categorie_revenu in
                     ('ventes_cartes', 'ventes_accessoires', 'ventes_services')),

  montant_encaisse numeric(12,2),
  monnaie_rendue   numeric(12,2) not null default 0 check (monnaie_rendue >= 0),

  stripe_charge_id text unique,
  stripe_payment_intent_id text,
  recu_url       text,
  note           text,
  cree_le        timestamptz not null default now(),
  maj_le         timestamptz not null default now(),

  constraint chk_vente_canal_mode check (
    (canal = 'stripe'   and mode_paiement = 'stripe')
    or (canal = 'comptant' and mode_paiement = 'comptant')
    or canal in ('en_ligne', 'autre')
  ),
  constraint chk_vente_stripe_id check (canal <> 'stripe' or stripe_charge_id is not null)
);
create index idx_ventes_date on ventes (date desc);
create index idx_ventes_canal on ventes (canal, date desc);
create index idx_ventes_province on ventes (province);

create table vente_lignes (
  id              uuid primary key default gen_random_uuid(),
  vente_id        uuid not null references ventes (id) on delete cascade,
  produit_id      uuid references produits (id) on delete restrict,
  description     text not null,
  quantite        integer not null check (quantite <> 0),
  prix_unitaire_ht numeric(12,4) not null check (prix_unitaire_ht >= 0),
  remise_ht       numeric(12,2) not null default 0 check (remise_ht >= 0),
  taxable         boolean not null default true,
  montant_ht      numeric(12,2) generated always as
                    (round(quantite * prix_unitaire_ht - remise_ht, 2)) stored,
  ordre           smallint not null default 1
);
create index idx_vente_lignes_vente on vente_lignes (vente_id);
create index idx_vente_lignes_produit on vente_lignes (produit_id);
