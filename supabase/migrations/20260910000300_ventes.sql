-- ============================================================================
-- Tapora S.E.N.C. — 03 · Ventes (Stripe, comptant, autres canaux)
-- ============================================================================
-- Pourquoi une table `ventes` distincte de `transactions` ?
--   `transactions` répond « combien d'argent ». `ventes` répond « combien de
--   cartes ». La marge unitaire et le seuil de rentabilité ont besoin de
--   QUANTITÉS, qu'un simple montant ne porte pas. Chaque vente engendre
--   automatiquement UNE ligne de revenu HT dans `transactions`.
-- ============================================================================

create sequence seq_numero_vente start 1;

create table ventes (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null unique
                 default ('V-' || to_char(now() at time zone 'America/Toronto', 'YYYY')
                          || '-' || lpad(nextval('seq_numero_vente')::text, 5, '0')),
  date           date not null default current_date,
  client_id      uuid references clients (id) on delete set null,
  client_nom     text,                       -- vente au comptant sans fiche client
  canal          canal_vente not null default 'comptant',
  mode_paiement  mode_paiement not null default 'comptant',
  statut         statut_vente not null default 'payee',

  -- Totaux recalculés par trigger depuis `vente_lignes` (jamais saisis à la main).
  montant_ht     numeric(12,2) not null default 0,
  tps            numeric(12,2) not null default 0,
  tvq            numeric(12,2) not null default 0,
  montant_ttc    numeric(12,2) generated always as (montant_ht + tps + tvq) stored,

  -- Encaissement comptant : ce qui a réellement été reçu et rendu.
  montant_encaisse numeric(12,2),
  monnaie_rendue   numeric(12,2) not null default 0 check (monnaie_rendue >= 0),

  -- Vrai : les taxes sont imposées par la source (montant Stripe au cent près)
  -- et ne doivent pas être recalculées depuis les lignes.
  taxes_manuelles boolean not null default false,
  -- Catégorie de revenu portée par la ligne de `transactions` engendrée.
  categorie_revenu categorie_transaction not null default 'ventes_cartes'
                   check (categorie_revenu in
                     ('ventes_cartes', 'ventes_accessoires', 'ventes_services')),

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

comment on column ventes.montant_encaisse is
  'Vente comptant : espèces reçues. Sert à contrôler la monnaie rendue et le solde de caisse.';

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

comment on column vente_lignes.quantite is
  'Négative pour une ligne de retour (remboursement partiel), positive sinon.';
