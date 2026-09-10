-- ============================================================================
-- Tapora S.E.N.C. — 05 · Caisse, inventaire et dénombrement
-- ============================================================================

create table mouvements_caisse (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  type        text not null check (type in (
                'fond_de_caisse', 'encaissement_vente', 'depense_comptant',
                'depot_bancaire', 'retrait_associe', 'ajustement')),
  -- Signé : positif = entrée de caisse, négatif = sortie.
  montant     numeric(12,2) not null check (montant <> 0),
  vente_id       uuid references ventes (id) on delete cascade,
  transaction_id uuid references transactions (id) on delete cascade,
  associe_id     uuid references associes (id) on delete set null,
  description text,
  cree_le     timestamptz not null default now(),
  constraint chk_caisse_signe check (
    (type in ('encaissement_vente', 'fond_de_caisse') and montant > 0)
    or (type in ('depense_comptant', 'depot_bancaire', 'retrait_associe') and montant < 0)
    or type = 'ajustement'
  )
);
create index idx_caisse_date on mouvements_caisse (date desc);
create unique index uq_caisse_vente on mouvements_caisse (vente_id)
  where vente_id is not null and type = 'encaissement_vente';
create unique index uq_caisse_transaction on mouvements_caisse (transaction_id)
  where transaction_id is not null and type = 'depense_comptant';

comment on table mouvements_caisse is
  'Grand livre de la petite caisse. Le dépôt bancaire est un transfert, jamais une dépense.';

-- ---------------------------------------------------------------------------
-- Inventaire.
-- Les cartes achetées et non encore vendues sont un ACTIF. Passer un lot de
-- 200 cartes en charge à l'achat surévalue la perte de l'exercice en cours et
-- gonfle le profit du suivant. L'achat entre donc au stock, et c'est la SORTIE
-- de stock à la vente qui charge le résultat (`cout_marchandises_vendues`).
--
-- Méthode de coût : coût moyen pondéré des achats à la date de la sortie.
-- ---------------------------------------------------------------------------
create table inventaire_mouvements (
  id             uuid primary key default gen_random_uuid(),
  date           date not null default current_date,
  produit_id     uuid not null references produits (id) on delete cascade,
  type           text not null check (type in ('achat', 'vente', 'retour', 'perte', 'ajustement')),
  -- Signé : positif = entrée en stock, négatif = sortie.
  quantite       integer not null check (quantite <> 0),
  cout_unitaire  numeric(12,4) check (cout_unitaire >= 0),
  transaction_id uuid references transactions (id) on delete set null,
  vente_id       uuid references ventes (id) on delete cascade,
  denombrement_id uuid,
  note           text,
  cree_le        timestamptz not null default now(),
  constraint chk_stock_signe check (
    (type in ('achat', 'retour') and quantite > 0)
    or (type in ('vente', 'perte') and quantite < 0)
    or type = 'ajustement'
  )
);
create index idx_inventaire_produit on inventaire_mouvements (produit_id, date);
create unique index uq_inventaire_vente on inventaire_mouvements (vente_id, produit_id)
  where vente_id is not null and type = 'vente';

-- ---------------------------------------------------------------------------
-- Dénombrement de fin d'exercice.
-- On compte les cartes réellement présentes, on compare au stock théorique et
-- on écrit l'ajustement. Les écarts (bris, vol, cartes ratées à l'encodage)
-- deviennent une charge `perte_inventaire` de l'exercice.
-- ---------------------------------------------------------------------------
create table denombrements (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  annee       smallint generated always as (extract(year from date)::smallint) stored,
  titre       text not null default 'Dénombrement de fin d''exercice',
  statut      text not null default 'brouillon' check (statut in ('brouillon', 'applique')),
  note        text,
  compte_par  text,
  cree_le     timestamptz not null default now(),
  applique_le timestamptz,
  -- Écriture d'ajustement produite à l'application.
  transaction_id uuid references transactions (id) on delete set null
);
create index idx_denombrements_date on denombrements (date desc);

create table denombrement_lignes (
  id                uuid primary key default gen_random_uuid(),
  denombrement_id   uuid not null references denombrements (id) on delete cascade,
  produit_id        uuid not null references produits (id) on delete restrict,
  quantite_theorique integer not null,
  quantite_comptee   integer not null check (quantite_comptee >= 0),
  cout_unitaire      numeric(12,4) not null default 0 check (cout_unitaire >= 0),
  ecart             integer generated always as (quantite_comptee - quantite_theorique) stored,
  valeur_ecart      numeric(12,2) generated always as
                      (round((quantite_comptee - quantite_theorique) * cout_unitaire, 2)) stored,
  motif             text check (motif in
                      ('bris', 'perte', 'vol', 'erreur_encodage', 'erreur_saisie', 'autre')),
  note              text,
  unique (denombrement_id, produit_id)
);

comment on table denombrements is
  'Comptage physique du stock. Fige la quantité théorique au moment du comptage et écrit l''écart.';

alter table inventaire_mouvements
  add constraint fk_inventaire_denombrement
  foreign key (denombrement_id) references denombrements (id) on delete set null;
