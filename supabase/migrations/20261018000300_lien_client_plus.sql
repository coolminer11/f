-- ============================================================================
-- Page client : langue, objectif d'avis, demandes de cartes
-- ============================================================================
-- LANGUE : la langue dans laquelle la page du client s'ouvre (il peut
-- basculer d'un clic). OBJECTIF_AVIS : un objectif fixé avec le commerce ;
-- vide, la page vise simplement le prochain palier (100, 250, 300…).
--
-- DEMANDES_CARTES : le bouton « Commander plus de cartes » de la page client.
-- Rien n'est facturé ici : c'est une demande, que l'on traite à la main.
-- ============================================================================

set local lock_timeout = '5s';

alter table dossiers_cartes
  add column if not exists langue text not null default 'fr' check (langue in ('fr', 'en')),
  add column if not exists objectif_avis integer check (objectif_avis is null or objectif_avis between 1 and 1000000);

create table if not exists demandes_cartes (
  id          uuid primary key default gen_random_uuid(),
  dossier_id  uuid not null references dossiers_cartes (id) on delete cascade,
  quantite    integer not null check (quantite between 1 and 500),
  message     text check (message is null or length(message) <= 500),
  cree_le     timestamptz not null default now(),
  traitee_le  timestamptz
);

comment on table demandes_cartes is
  'Demandes de cartes supplémentaires envoyées depuis la page client (lien privé).';

create index if not exists i_demandes_dossier on demandes_cartes (dossier_id, cree_le desc);
create index if not exists i_demandes_a_traiter on demandes_cartes (cree_le desc) where traitee_le is null;

-- Même règle que les autres tables : rien n'est exposé à l'API publique de
-- Supabase ; seul le serveur (rôle propriétaire) lit et écrit.
alter table demandes_cartes enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on demandes_cartes from %I', r);
    end if;
  end loop;
end;
$$;
