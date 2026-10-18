-- ---------------------------------------------------------------------------
-- Sécurité de la connexion au back-office
--
-- - Chaque essai de connexion (mot de passe ou code) est noté : c'est ce qui
--   permet de freiner le « brute force » et d'afficher un journal.
-- - Double authentification (TOTP) : le secret est chiffré par l'application,
--   les codes de secours ne sont gardés que sous forme d'empreinte.
-- - Défi de connexion : l'étape « code » entre le mot de passe et la session.
-- - Jetons de sécurité : le lien « Ce n'était pas moi » des courriels d'alerte.
--
-- Les adresses IP ne sont jamais gardées en entier (Loi 25) : une forme
-- masquée pour l'affichage (203.0.113.x) et une empreinte HMAC pour compter.
-- ---------------------------------------------------------------------------

create table if not exists tentatives_connexion (
  id             bigserial primary key,
  courriel       text not null check (length(courriel) <= 254),
  utilisateur_id uuid references utilisateurs (id) on delete cascade,
  etape          text not null check (etape in ('mot_de_passe', 'code')),
  reussie        boolean not null,
  ip_masquee     text,
  ip_empreinte   text,
  appareil       text,
  cree_le        timestamptz not null default now()
);
create index if not exists idx_tentatives_courriel on tentatives_connexion (courriel, cree_le desc);
create index if not exists idx_tentatives_ip on tentatives_connexion (ip_empreinte, cree_le desc);
create index if not exists idx_tentatives_utilisateur on tentatives_connexion (utilisateur_id, cree_le desc);

alter table utilisateurs
  add column if not exists totp_secret text,
  add column if not exists totp_actif boolean not null default false,
  add column if not exists totp_dernier bigint,
  add column if not exists codes_secours text[] not null default '{}',
  add column if not exists alerte_essais_le timestamptz;

comment on column utilisateurs.totp_secret is
  'Secret TOTP chiffré (AES-256-GCM) par l''application. Jamais en clair.';
comment on column utilisateurs.totp_dernier is
  'Dernier pas de 30 s accepté : un code déjà utilisé ne sert pas deux fois.';

alter table sessions
  add column if not exists ip_masquee text,
  add column if not exists appareil text;

create table if not exists defis_connexion (
  empreinte      text primary key,
  utilisateur_id uuid not null references utilisateurs (id) on delete cascade,
  expire_le      timestamptz not null,
  essais         int not null default 0,
  suite          text
);

create table if not exists jetons_securite (
  empreinte      text primary key,
  utilisateur_id uuid not null references utilisateurs (id) on delete cascade,
  usage          text not null check (usage in ('pas_moi')),
  expire_le      timestamptz not null,
  utilise_le     timestamptz,
  cree_le        timestamptz not null default now()
);

create or replace function purger_sessions() returns void
language sql as $$
  delete from sessions where expire_le < now();
  delete from defis_connexion where expire_le < now();
  delete from jetons_securite where expire_le < now() - interval '30 days';
  delete from tentatives_connexion where cree_le < now() - interval '180 days';
$$;

alter table tentatives_connexion enable row level security;
alter table defis_connexion enable row level security;
alter table jetons_securite enable row level security;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on tentatives_connexion, defis_connexion, jetons_securite from %I', r);
      execute format('revoke all on sequence tentatives_connexion_id_seq from %I', r);
    end if;
  end loop;
end;
$$;
