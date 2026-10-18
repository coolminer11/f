-- ============================================================================
-- Envois du lien privé au client, depuis la fiche du dossier
-- ============================================================================
-- Un journal simple : à qui, quand, avec quel résultat. Le message lui-même
-- n'est pas gardé (il contient le lien, qui donne accès aux statistiques).
-- ============================================================================

set local lock_timeout = '5s';

create table if not exists envois_liens (
  id           uuid primary key default gen_random_uuid(),
  dossier_id   uuid not null references dossiers_cartes (id) on delete cascade,
  destinataire text not null check (length(destinataire) <= 254),
  modele       text not null check (modele in ('bienvenue', 'rappel', 'nouveau', 'libre')),
  langue       text not null check (langue in ('fr', 'en')),
  statut       text not null check (statut in ('envoye', 'simule', 'echec')),
  erreur       text,
  envoye_par   uuid,
  cree_le      timestamptz not null default now()
);

create index if not exists i_envois_liens_dossier on envois_liens (dossier_id, cree_le desc);

alter table envois_liens enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on envois_liens from %I', r);
    end if;
  end loop;
end;
$$;
