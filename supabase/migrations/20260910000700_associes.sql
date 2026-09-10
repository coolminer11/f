-- ============================================================================
-- Tapora S.E.N.C. — 07 · Comptes d'associés et registre des décisions
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Mouvements des comptes d'associés.
--
-- Deux comptes distincts, à ne jamais confondre :
--   * CAPITAL  : apports + part des profits − prélèvements. C'est la mise de
--                l'associé dans la société.
--   * COURANT  : avances faites à la société (prêt), remboursables sans toucher
--                au capital ni au partage des profits.
--
-- `montant` est toujours saisi positif ; le TYPE porte le sens. La colonne
-- générée `montant_signe` évite qu'une erreur de signe à la saisie fausse un
-- solde (seul « ajustement » accepte un montant négatif).
-- ---------------------------------------------------------------------------
create table mouvements_associes (
  id          uuid primary key default gen_random_uuid(),
  associe_id  uuid not null references associes (id) on delete restrict,
  date        date not null default current_date,
  compte      text not null check (compte in ('capital', 'courant')),
  type        type_mouvement_associe not null,
  montant     numeric(12,2) not null check (montant <> 0),
  montant_signe numeric(12,2) generated always as (
    case type
      when 'prelevement'          then -montant
      when 'remboursement_avance' then -montant
      else montant
    end
  ) stored,
  description      text,
  piece_jointe_url text,
  -- Rattachement au flux d'argent réel (sortie bancaire ou prise en caisse).
  transaction_id      uuid references transactions (id) on delete set null,
  mouvement_caisse_id uuid references mouvements_caisse (id) on delete set null,
  annee smallint generated always as (extract(year from date)::smallint) stored,
  cree_le timestamptz not null default now(),

  -- Chaque type appartient à un seul compte.
  constraint chk_compte_type check (
    (compte = 'capital' and type in ('apport', 'prelevement', 'part_profit', 'ajustement'))
    or (compte = 'courant' and type in ('avance', 'remboursement_avance', 'ajustement'))
  ),
  -- Hors ajustement et part de profit (une PERTE se répartit aussi), la saisie
  -- doit être positive.
  constraint chk_montant_positif check (type in ('ajustement', 'part_profit') or montant > 0)
);
create index idx_mvt_associes_associe on mouvements_associes (associe_id, date desc);
create index idx_mvt_associes_type on mouvements_associes (type, date desc);
-- La part de profit d'un exercice ne peut être attribuée qu'une fois par associé.
create unique index uq_part_profit_annuelle
  on mouvements_associes (associe_id, annee) where type = 'part_profit';

comment on table mouvements_associes is
  'Capital et compte courant. Un prélèvement n''est pas une dépense : il ne touche pas le profit.';

-- ---------------------------------------------------------------------------
-- Registre des décisions unanimes.
-- Une S.E.N.C. décide à l'unanimité : l'unanimité n'est pas une colonne à
-- cocher sur la décision, elle se DÉDUIT des approbations individuelles.
-- ---------------------------------------------------------------------------
create table decisions (
  id          uuid primary key default gen_random_uuid(),
  numero      integer not null generated always as identity,
  date        date not null default current_date,
  titre       text not null,
  description text not null,
  decision    text not null,
  categorie   text not null default 'autre'
              check (categorie in ('finance', 'operations', 'juridique', 'produit', 'autre')),
  notes       text,
  piece_jointe_url text,
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now()
);
create unique index uq_decisions_numero on decisions (numero);
create index idx_decisions_date on decisions (date desc);
create index idx_decisions_categorie on decisions (categorie, date desc);
-- Recherche plein texte française pour le filtre de l'écran registre.
create index idx_decisions_recherche on decisions
  using gin (to_tsvector('french', titre || ' ' || description || ' ' || decision));

create table decisions_approbations (
  decision_id      uuid not null references decisions (id) on delete cascade,
  associe_id       uuid not null references associes (id) on delete cascade,
  approuve         boolean not null default false,
  date_approbation timestamptz,
  note             text,
  primary key (decision_id, associe_id)
);
create index idx_approbations_associe on decisions_approbations (associe_id);

comment on table decisions_approbations is
  'Une ligne par associé et par décision, créée automatiquement (trigger). Unanimité = toutes approuvées.';
