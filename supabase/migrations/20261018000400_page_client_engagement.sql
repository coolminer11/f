-- ============================================================================
-- Page client : avant/après Tapora, liste de lancement, notifications
-- ============================================================================
-- AVIS_POSE / AVIS_MOIS_AVANT : le point de départ, noté à la pose des
-- cartes — combien d'avis la fiche Google avait, et combien elle en gagnait
-- par mois avant Tapora. C'est ce qui permet d'afficher « avant / après ».
--
-- LANCEMENT : les étapes cochées par le commerce dans sa liste de lancement
-- (des clés courtes, ex. « visible », « equipe »).
--
-- ABONNEMENTS_PUSH : les téléphones qui ont demandé une notification à
-- chaque tap. Rien qui désigne une personne : une adresse technique fournie
-- par Apple, Google ou Mozilla, et deux clés de chiffrement.
-- ============================================================================

set local lock_timeout = '5s';

alter table dossiers_cartes
  add column if not exists avis_pose integer check (avis_pose is null or avis_pose between 0 and 1000000),
  add column if not exists avis_mois_avant numeric(8, 2) check (avis_mois_avant is null or avis_mois_avant between 0 and 100000),
  add column if not exists lancement text[] not null default '{}'
    check (cardinality(lancement) <= 20),
  add column if not exists dernier_push timestamptz;

create table if not exists abonnements_push (
  id          uuid primary key default gen_random_uuid(),
  dossier_id  uuid not null references dossiers_cartes (id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh      text not null check (length(p256dh) <= 200),
  auth        text not null check (length(auth) <= 100),
  langue      text not null default 'fr' check (langue in ('fr', 'en')),
  cree_le     timestamptz not null default now(),
  dernier_envoi timestamptz
);

create index if not exists i_abonnements_dossier on abonnements_push (dossier_id);

comment on table abonnements_push is
  'Téléphones abonnés aux notifications « nouveau tap » d''un dossier (Web Push).';

-- Les clés VAPID du serveur (Web Push), créées au premier besoin. Une seule
-- ligne. Les variables d'environnement VAPID_* ont priorité si présentes.
create table if not exists cles_push (
  id        boolean primary key default true check (id),
  publique  text not null,
  privee    text not null,
  cree_le   timestamptz not null default now()
);

alter table abonnements_push enable row level security;
alter table cles_push enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on abonnements_push, cles_push from %I', r);
    end if;
  end loop;
end;
$$;
