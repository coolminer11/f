-- ============================================================================
-- Tapora S.E.N.C. — 17 · Comptes, sessions, envoi des documents
-- ============================================================================
-- Trois besoins :
--   1. Un compte par associé, à la place du mot de passe partagé. Les deux
--      associés doivent pouvoir se connecter séparément, et un compte se
--      révoque sans changer le mot de passe de l'autre.
--   2. Une trace de qui a créé quoi — dans une société à deux, c'est la
--      première question posée devant une écriture surprenante.
--   3. Un lien public, non devinable, vers un document de vente : c'est ce que
--      l'on envoie au client par courriel. Il ouvre CE document et rien d'autre.
-- ============================================================================

create table utilisateurs (
  id                 uuid primary key default gen_random_uuid(),
  courriel           text not null unique,
  nom                text not null,
  -- Empreinte scrypt : « scrypt$sel$empreinte », jamais le mot de passe.
  empreinte          text not null,
  associe_id         uuid references associes (id) on delete set null,
  role               text not null default 'associe' check (role in ('associe', 'lecture')),
  actif              boolean not null default true,
  derniere_connexion timestamptz,
  cree_le            timestamptz not null default now()
);
create unique index uq_utilisateurs_courriel on utilisateurs (lower(courriel));

comment on column utilisateurs.role is
  'associe : accès complet. lecture : consultation seulement, aucune écriture.';

-- Les sessions vivent en base : fermer une session doit la révoquer vraiment,
-- ce qu'un jeton signé auto-porteur ne permet pas.
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  -- Empreinte SHA-256 du jeton. Le jeton lui-même n'est jamais stocké : une
  -- fuite de cette table ne permet pas d'ouvrir une session.
  empreinte     text not null unique,
  utilisateur_id uuid not null references utilisateurs (id) on delete cascade,
  cree_le       timestamptz not null default now(),
  expire_le     timestamptz not null,
  derniere_vue  timestamptz not null default now(),
  agent         text
);
create index idx_sessions_utilisateur on sessions (utilisateur_id);
create index idx_sessions_expiration on sessions (expire_le);

create or replace function purger_sessions() returns void
language sql as $$
  delete from sessions where expire_le < now();
$$;

-- ---------------------------------------------------------------------------
-- Qui a saisi quoi
-- ---------------------------------------------------------------------------
alter table transactions add column if not exists cree_par uuid
  references utilisateurs (id) on delete set null;
alter table ventes add column if not exists cree_par uuid
  references utilisateurs (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Lien public d'un document
-- ---------------------------------------------------------------------------
alter table ventes
  add column if not exists jeton_public text unique,
  add column if not exists derniere_expedition timestamptz,
  add column if not exists destinataire_expedition text;

comment on column ventes.jeton_public is
  'Jeton aléatoire donnant accès en lecture à CE document. Créé au premier envoi, révocable.';

create table envois_document (
  id            uuid primary key default gen_random_uuid(),
  vente_id      uuid not null references ventes (id) on delete cascade,
  destinataire  text not null,
  objet         text not null,
  message       text,
  statut        text not null default 'envoye' check (statut in ('envoye', 'echec', 'simule')),
  erreur        text,
  reference     text,
  envoye_par    uuid references utilisateurs (id) on delete set null,
  envoye_le     timestamptz not null default now()
);
create index idx_envois_vente on envois_document (vente_id, envoye_le desc);

comment on table envois_document is
  'Journal des envois. « simulé » : aucun service de courriel configuré, le message a été écrit sur disque.';

-- ---------------------------------------------------------------------------
-- Sécurité des nouvelles tables
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' and not rowsecurity loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end;
$$;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all functions in schema public from %I', r);
    end if;
  end loop;
end;
$$;
