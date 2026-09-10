-- ============================================================================
-- Tapora S.E.N.C. — 08 · Déclarations TPS/TVQ
-- ============================================================================
-- Le rapport de taxes est calculé à la volée (fonction rapport_taxes), mais une
-- fois transmis il doit être FIGÉ : une facture antérieure saisie en retard ne
-- doit pas modifier rétroactivement une déclaration déjà produite.
-- ============================================================================

create table declarations_taxes (
  id              uuid primary key default gen_random_uuid(),
  periode_debut   date not null,
  periode_fin     date not null,
  tps_percue      numeric(12,2) not null default 0,
  tvq_percue      numeric(12,2) not null default 0,
  cti             numeric(12,2) not null default 0,   -- TPS payée récupérable
  rti             numeric(12,2) not null default 0,   -- TVQ payée récupérable
  net_tps         numeric(12,2) generated always as (tps_percue - cti) stored,
  net_tvq         numeric(12,2) generated always as (tvq_percue - rti) stored,
  net_a_remettre  numeric(12,2) generated always as
                    ((tps_percue - cti) + (tvq_percue - rti)) stored,
  statut          text not null default 'brouillon'
                  check (statut in ('brouillon', 'transmise', 'payee')),
  date_transmission date,
  date_paiement     date,
  reference       text,
  note            text,
  cree_le         timestamptz not null default now(),
  maj_le          timestamptz not null default now(),

  constraint chk_periode check (periode_fin >= periode_debut),
  -- Deux déclarations ne peuvent pas couvrir la même journée.
  constraint ex_declarations_sans_chevauchement exclude using gist (
    daterange(periode_debut, periode_fin, '[]') with &&
  )
);
create index idx_declarations_periode on declarations_taxes (periode_debut desc);

comment on column declarations_taxes.net_a_remettre is
  'Positif : à remettre à Revenu Québec. Négatif : remboursement à recevoir.';
