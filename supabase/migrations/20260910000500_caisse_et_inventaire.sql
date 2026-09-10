-- ============================================================================
-- Tapora S.E.N.C. — 05 · Caisse (ventes comptant) et inventaire
-- ============================================================================
-- Vendre en argent comptant crée deux problèmes que le journal ne règle pas :
--   1. l'argent dort dans une boîte avant d'être déposé -> il faut un solde de
--      caisse et une trace du dépôt, sinon le relevé bancaire ne balance jamais;
--   2. le dépôt bancaire réapparaît dans l'import CSV -> sans marquage, la
--      vente serait comptée deux fois.
-- ============================================================================

create table mouvements_caisse (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  type        text not null check (type in (
                'fond_de_caisse',        -- mise en place initiale
                'encaissement_vente',    -- + argent reçu d'une vente comptant
                'depense_comptant',      -- - dépense payée en argent
                'depot_bancaire',        -- - argent porté à la banque
                'retrait_associe',       -- - prélèvement pris dans la caisse
                'ajustement'             -- +/- écart de comptage
              )),
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
-- Une vente comptant ne peut être encaissée qu'une fois.
create unique index uq_caisse_vente on mouvements_caisse (vente_id)
  where vente_id is not null and type = 'encaissement_vente';
create unique index uq_caisse_transaction on mouvements_caisse (transaction_id)
  where transaction_id is not null and type = 'depense_comptant';

comment on table mouvements_caisse is
  'Grand livre de la petite caisse. Le dépôt bancaire est un transfert, jamais une dépense.';

-- ---------------------------------------------------------------------------
-- Inventaire des cartes.
-- Convention retenue : l'achat de cartes vierges est passé en charge à l'achat
-- (catégorie cartes_achat). Cette table sert aux QUANTITÉS et au coût unitaire
-- réel ; un ajustement de stock de fin d'exercice reste possible.
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
  note           text,
  cree_le        timestamptz not null default now(),

  constraint chk_stock_signe check (
    (type in ('achat', 'retour') and quantite > 0)
    or (type in ('vente', 'perte') and quantite < 0)
    or type = 'ajustement'
  )
);
create index idx_inventaire_produit on inventaire_mouvements (produit_id, date desc);
-- Une vente ne sort un produit du stock qu'une seule fois.
create unique index uq_inventaire_vente on inventaire_mouvements (vente_id, produit_id)
  where vente_id is not null and type = 'vente';
