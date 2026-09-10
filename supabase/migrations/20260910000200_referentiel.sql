-- ============================================================================
-- Tapora S.E.N.C. — 02 · Référentiel (paramètres, taxes, exercices, produits)
-- ============================================================================

create table parametres (
  id                        boolean primary key default true check (id),
  nom_entreprise            text    not null default 'Tapora S.E.N.C.',
  neq                       text,
  numero_tps                text,        -- couvre aussi la TVH (même inscription ARC)
  numero_tvq                text,
  province_etablissement    province_canada not null default 'QC',
  adresse                   text,
  courriel_contact          text,
  devise                    char(3) not null default 'CAD',

  frais_stripe_pct          numeric(6,4) not null default 0.0290,
  frais_stripe_fixe         numeric(8,2) not null default 0.30,
  frais_stripe_taxables     boolean not null default true,
  frais_litige_stripe       numeric(8,2) not null default 15.00,

  mois_lissage_couts_fixes  smallint not null default 3
                            check (mois_lissage_couts_fixes between 1 and 12),
  -- Fenêtre glissante des indicateurs unitaires : les coûts d'il y a un an ne
  -- doivent pas polluer la marge d'aujourd'hui.
  jours_fenetre_marge       smallint not null default 90
                            check (jours_fenetre_marge between 30 and 730),
  seuil_alerte_prelevement  numeric(12,2) not null default 500.00,
  fond_de_caisse            numeric(12,2) not null default 0.00,

  maj_le                    timestamptz not null default now()
);
comment on table parametres is 'Configuration unique de la société (ligne singleton).';

-- ---------------------------------------------------------------------------
-- Taxes de vente canadiennes.
-- Deux colonnes fixes (tps, tvq) ne suffisent pas : une carte expédiée en
-- Ontario porte 13 % de TVH sur UNE seule ligne, la Colombie-Britannique
-- porte TPS + TVP. Le modèle est donc générique : un référentiel de taxes,
-- des règles par province de destination, et des lignes de taxe par écriture.
-- ---------------------------------------------------------------------------
create table taxes (
  code                   text primary key check (code in ('TPS', 'TVQ', 'TVH', 'TVP')),
  nom                    text not null,
  -- Récupérable par défaut à l'achat : la TVP (PST/RST) ne l'est PAS, il n'existe
  -- pas de crédit sur intrants provincial hors Québec.
  recuperable_pct_defaut numeric(5,4) not null default 1
                         check (recuperable_pct_defaut between 0 and 1),
  ordre                  smallint not null default 1
);

-- Règles par province de destination, historisées.
-- `autorite` porte le destinataire de la remise : la TVQ se déclare à Revenu
-- Québec, la TPS et la TVH à l'ARC, la TVP à la province qui la perçoit.
create table regles_taxes_province (
  id         bigserial primary key,
  province   province_canada not null,
  code_taxe  text not null references taxes (code) on delete restrict,
  taux       numeric(7,5) not null check (taux >= 0 and taux < 1),
  autorite   text not null check (autorite in ('ARC', 'RQ', 'BC', 'SK', 'MB')),
  date_debut date not null,
  date_fin   date,
  note       text,
  constraint chk_regle_periode check (date_fin is null or date_fin > date_debut),
  -- Un seul taux par (province, taxe) à une date donnée.
  constraint ex_regles_sans_chevauchement exclude using gist (
    province  with =,
    code_taxe with =,
    daterange(date_debut, coalesce(date_fin, 'infinity'::date), '[)') with &&
  )
);
create index idx_regles_province on regles_taxes_province (province, date_debut desc);

comment on table regles_taxes_province is
  'Taxe applicable selon la province de DESTINATION du bien expédié (règles sur le lieu de fourniture).';

-- ---------------------------------------------------------------------------
-- Exercices financiers : 1er janvier au 31 décembre.
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
-- Valeurs par défaut par catégorie.
-- `pct_recuperable` s'applique à TOUTES les taxes de la ligne : la limite de
-- 50 % sur les repas vaut autant pour la TPS/TVH que pour la TVQ.
-- ---------------------------------------------------------------------------
create table categories_defauts (
  categorie       categorie_transaction primary key,
  libelle         text not null,
  type_defaut     type_transaction not null,
  nature_defaut   nature_cout,
  pct_recuperable numeric(5,4) not null default 1 check (pct_recuperable between 0 and 1),
  -- Catégories produites par le système (COGS, pertes) : masquées à la saisie.
  saisie_manuelle boolean not null default true,
  ordre           smallint not null default 100,
  actif           boolean not null default true,
  constraint chk_nature_selon_type check (
    (type_defaut = 'depense' and nature_defaut is not null)
    or (type_defaut = 'revenu' and nature_defaut is null)
  )
);

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

create table clients (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null,
  entreprise text,
  courriel   text,
  telephone  text,
  province   province_canada,
  notes      text,
  cree_le    timestamptz not null default now()
);
create index idx_clients_nom on clients (lower(nom));

-- ---------------------------------------------------------------------------
-- Produits physiques.
-- ---------------------------------------------------------------------------
create table produits (
  id             uuid primary key default gen_random_uuid(),
  sku            text not null unique,
  nom            text not null,
  description    text,
  prix_vente_ht  numeric(12,2) not null default 0 check (prix_vente_ht >= 0),
  taxable        boolean not null default true,
  suivi_stock    boolean not null default true,
  est_carte      boolean not null default true,
  actif          boolean not null default true,
  cree_le        timestamptz not null default now(),
  maj_le         timestamptz not null default now()
);
comment on column produits.suivi_stock is
  'Vrai : l''achat est porté au stock (actif) et ne charge le résultat qu''à la vente.';

-- Coûts unitaires de référence, historisés par composante.
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
create unique index uq_couts_unitaires_produit
  on couts_unitaires (produit_id, composante, date_effet) where produit_id is not null;
create unique index uq_couts_unitaires_global
  on couts_unitaires (composante, date_effet) where produit_id is null;
