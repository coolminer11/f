-- ============================================================================
-- Tapora S.E.N.C. — 08 · Déclarations de taxes, ventilées par juridiction
-- ============================================================================
-- La TVQ se déclare à Revenu Québec, la TPS et la TVH à l'Agence du revenu du
-- Canada, la TVP à la province qui la perçoit. Une déclaration porte donc sur
-- UNE autorité : additionner TPS et TVQ dans un seul « net à remettre » ne
-- correspond à aucun formulaire réel.
--
-- Le rapport est calculé à la volée (`rapport_taxes`), mais une fois transmis
-- il doit être FIGÉ : une facture antérieure saisie en retard ne doit pas
-- modifier rétroactivement une déclaration déjà produite.
-- ============================================================================

create table declarations_taxes (
  id              uuid primary key default gen_random_uuid(),
  autorite        text not null check (autorite in ('ARC', 'RQ', 'BC', 'SK', 'MB')),
  periode_debut   date not null,
  periode_fin     date not null,
  taxes_percues   numeric(12,2) not null default 0,
  credits         numeric(12,2) not null default 0,   -- CTI / RTI
  net_a_remettre  numeric(12,2) generated always as (taxes_percues - credits) stored,
  statut          text not null default 'brouillon'
                  check (statut in ('brouillon', 'transmise', 'payee')),
  date_transmission date,
  date_paiement     date,
  reference       text,
  note            text,
  cree_le         timestamptz not null default now(),
  maj_le          timestamptz not null default now(),

  constraint chk_periode check (periode_fin >= periode_debut),
  -- Deux déclarations à la même autorité ne peuvent pas couvrir la même journée.
  constraint ex_declarations_sans_chevauchement exclude using gist (
    autorite with =,
    daterange(periode_debut, periode_fin, '[]') with &&
  )
);
create index idx_declarations_periode on declarations_taxes (autorite, periode_debut desc);

comment on column declarations_taxes.net_a_remettre is
  'Positif : à remettre à l''autorité. Négatif : remboursement à recevoir.';

-- Détail par code de taxe : l'ARC reçoit TPS et TVH sur le même formulaire,
-- mais la ventilation reste nécessaire au contrôle.
create table declaration_lignes (
  id             uuid primary key default gen_random_uuid(),
  declaration_id uuid not null references declarations_taxes (id) on delete cascade,
  code           text not null references taxes (code) on delete restrict,
  taxes_percues  numeric(12,2) not null default 0,
  credits        numeric(12,2) not null default 0,
  unique (declaration_id, code)
);
