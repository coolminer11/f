-- ============================================================================
-- Page client protégée : alerte quand quelqu'un s'acharne sur le mot de passe
-- ============================================================================
-- 15 essais ratés en une heure sur une même page : Tapora reçoit un courriel
-- (au plus un par heure et par page). Cette table garde la trace des alertes
-- envoyées — et ce qu'elles ont compté.

create table if not exists alertes_page_client (
  id          bigint generated always as identity primary key,
  dossier_id  uuid not null references dossiers_cartes (id) on delete cascade,
  essais      integer not null,
  cree_le     timestamptz not null default now()
);
create index if not exists i_alertes_page_client on alertes_page_client (dossier_id, cree_le desc);

alter table alertes_page_client enable row level security;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on alertes_page_client from %I', r);
    end if;
  end loop;
end;
$$;
