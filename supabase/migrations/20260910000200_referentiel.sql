-- ============================================================================
-- Tapora S.E.N.C. — 02 · Référentiel (paramètres, taxes, exercices, produits)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Paramètres de la société : une seule ligne (contrainte id = true).
-- ---------------------------------------------------------------------------
create table parametres (
  id                        boolean primary key default true check (id),
  nom_entreprise            text    not null default 'Tapora S.E.N.C.',
  neq                       text,
  numero_tps                text,        -- 123456789 RT0001
  numero_tvq                text,        -- 1234567890 TQ0001
  adresse                   text,
  courriel_contact          text,
  devise                    char(3) not null default 'CAD',

  -- Hypothèses Stripe utilisées pour la marge théorique et le contrôle des
  -- frais reçus par webhook (le montant réel du webhook fait toujours foi).
  frais_stripe_pct          numeric(6,4) not null default 0.0290,
  frais_stripe_fixe         numeric(8,2) not null default 0.30,
  frais_stripe_taxables     boolean not null default true,

  -- Nombre de mois utilisés pour lisser les coûts fixes du seuil de rentabilité
  mois_lissage_couts_fixes  smallint not null default 3 check (mois_lissage_couts_fixes between 1 and 12),
  -- Écart de prélèvements (en $) au-delà duquel l'écran associés alerte.
  seuil_alerte_prelevement  numeric(12,2) not null default 500.00,
  -- Fond de caisse théorique conservé pour les ventes comptant.
  fond_de_caisse            numeric(12,2) not null default 0.00,

  maj_le                    timestamptz not null default now()
);
comment on table parametres is 'Configuration unique de la société (ligne singleton).';

-- ---------------------------------------------------------------------------
-- Taux de taxes historisés : les taux changent (TVQ 9,5 % -> 9,975 % en 2013).
-- Une déclaration rouverte sur une vieille période doit retrouver SON taux.
-- ---------------------------------------------------------------------------
create table taux_taxes (
  id          bigserial primary key,
  date_debut  date not null,
  date_fin    date,                       -- borne exclusive, null = en vigueur
  taux_tps    numeric(7,5) not null check (taux_tps    >= 0 and taux_tps    < 1),
  taux_tvq    numeric(7,5) not null check (taux_tvq    >= 0 and taux_tvq    < 1),
  note        text,
  constraint chk_taux_periode check (date_fin is null or date_fin > date_debut),
  -- Aucune période ne peut se chevaucher : garantit un taux unique par date.
  constraint ex_taux_sans_chevauchement exclude using gist (
    daterange(date_debut, coalesce(date_fin, 'infinity'::date), '[)') with &&
  )
);
comment on table taux_taxes is
  'TPS/TVQ par période. TVQ calculée sur le HT seul (pas sur HT+TPS) depuis 2013.';

-- ---------------------------------------------------------------------------
-- Exercices financiers : 1er janvier au 31 décembre.
-- Un exercice « clos » gèle les écritures (trigger en migration 09).
-- ---------------------------------------------------------------------------
create table exercices (
  annee        integer primary key check (annee between 2020 and 2100),
  date_debut   date not null,
  date_fin     date not null,
  statut       text not null default 'ouvert' check (statut in ('ouvert', 'clos')),
  date_cloture timestamptz,
  note         text,
  constraint chk_exercice_bornes check (
    date_debut = make_date(annee, 1, 1) and date_fin = make_date(annee, 12, 31)
  )
);

-- ---------------------------------------------------------------------------
-- Valeurs par défaut par catégorie : pilote les formulaires (nature suggérée)
-- et les règles fiscales de récupération. Table plutôt que code en dur pour
-- que vous puissiez ajuster sans redéploiement.
-- ---------------------------------------------------------------------------
create table categories_defauts (
  categorie     categorie_transaction primary key,
  libelle       text not null,
  type_defaut   type_transaction not null,
  nature_defaut nature_cout,             -- null pour les catégories de revenu
  pct_cti       numeric(5,4) not null default 1 check (pct_cti between 0 and 1),
  pct_rti       numeric(5,4) not null default 1 check (pct_rti between 0 and 1),
  ordre         smallint not null default 100,
  actif         boolean not null default true,
  constraint chk_nature_selon_type check (
    (type_defaut = 'depense' and nature_defaut is not null)
    or (type_defaut = 'revenu' and nature_defaut is null)
  )
);
comment on column categories_defauts.pct_cti is
  'Part de la TPS payée récupérable en CTI (0,5 pour repas et représentation).';

-- ---------------------------------------------------------------------------
-- Associés : deux lignes fixes, parts 50/50.
-- ---------------------------------------------------------------------------
create table associes (
  id        uuid primary key default gen_random_uuid(),
  nom       text not null unique,
  courriel  text,
  part      numeric(5,4) not null default 0.5 check (part > 0 and part <= 1),
  actif     boolean not null default true,
  ordre     smallint not null default 1,
  cree_le   timestamptz not null default now()
);
comment on column associes.part is
  'Quote-part des profits. La somme des parts des associés actifs doit valoir 1 (trigger).';

-- ---------------------------------------------------------------------------
-- Clients (facultatif mais utile pour les ventes comptant B2B).
-- ---------------------------------------------------------------------------
create table clients (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null,
  entreprise text,
  courriel   text,
  telephone  text,
  notes      text,
  cree_le    timestamptz not null default now()
);
create index idx_clients_nom on clients (lower(nom));

-- ---------------------------------------------------------------------------
-- Produits physiques (cartes NFC, présentoirs, etc.).
-- ---------------------------------------------------------------------------
create table produits (
  id             uuid primary key default gen_random_uuid(),
  sku            text not null unique,
  nom            text not null,
  description    text,
  prix_vente_ht  numeric(12,2) not null default 0 check (prix_vente_ht >= 0),
  taxable        boolean not null default true,
  suivi_stock    boolean not null default true,
  est_carte      boolean not null default true,   -- compte dans le seuil de rentabilité
  actif          boolean not null default true,
  cree_le        timestamptz not null default now(),
  maj_le         timestamptz not null default now()
);
comment on column produits.est_carte is
  'Vrai si l''unité vendue est une carte : base du calcul « cartes à vendre par mois ».';

-- ---------------------------------------------------------------------------
-- Coûts unitaires historisés, décomposés par composante.
-- produit_id null = coût de référence applicable à tous les produits.
-- ---------------------------------------------------------------------------
create table couts_unitaires (
  id          uuid primary key default gen_random_uuid(),
  produit_id  uuid references produits (id) on delete cascade,
  composante  text not null check (composante in
                 ('carte_vierge', 'impression', 'expedition', 'emballage', 'autre')),
  montant_ht  numeric(12,4) not null check (montant_ht >= 0),
  date_effet  date not null default current_date,
  note        text,
  cree_le     timestamptz not null default now()
);
-- Un seul coût par (produit, composante, date d'effet).
create unique index uq_couts_unitaires_produit
  on couts_unitaires (produit_id, composante, date_effet) where produit_id is not null;
create unique index uq_couts_unitaires_global
  on couts_unitaires (composante, date_effet) where produit_id is null;
comment on table couts_unitaires is
  'Coûts HT par carte. Les frais Stripe n''y figurent pas : ils dépendent du canal de vente.';
