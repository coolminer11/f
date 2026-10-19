-- ============================================================================
-- Croissance : cartes qui dorment, badge d'avis, parrainage
-- ============================================================================
-- 1. Cartes qui dorment : une carte active sans tap depuis 7 jours remonte
--    dans le back-office et dans le courriel du lundi. « C'est réglé » la
--    met en pause 7 jours (sommeil_vu_le).
-- 2. Badge d'avis : chaque dossier reçoit une clé publique, distincte du lien
--    privé du client. Le badge ne montre que des chiffres déjà publics sur
--    Google (note, nombre d'avis).
-- 3. Parrainage : un commerce recommande un autre commerce depuis sa page.
--    Le filleul a 10 % sur sa première commande ; le parrain, de la
--    visibilité (page Partenaires, LinkedIn) et la pastille Ambassadeur.
-- ============================================================================

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. Cartes qui dorment
-- ---------------------------------------------------------------------------
alter table cartes_nfc
  add column if not exists sommeil_vu_le timestamptz;

-- Un courriel par semaine au plus : la semaine (le lundi) est la clé.
create table if not exists alertes_sommeil (
  semaine    date primary key,
  nb_cartes  integer not null check (nb_cartes >= 0),
  statut     text not null check (statut in ('envoye', 'simule', 'echec', 'rien')),
  cree_le    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Badge d'avis
-- ---------------------------------------------------------------------------
-- 12 caractères hexadécimaux (48 bits) tirés d'un UUID aléatoire : impossible
-- à deviner, donc impossible de lister les clients de Tapora par le badge.
alter table dossiers_cartes
  add column if not exists cle_badge text,
  add column if not exists badge_actif boolean not null default true;

update dossiers_cartes
   set cle_badge = substr(md5(gen_random_uuid()::text), 1, 12)
 where cle_badge is null;

alter table dossiers_cartes
  alter column cle_badge set default substr(md5(gen_random_uuid()::text), 1, 12),
  alter column cle_badge set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dossiers_cle_badge_format') then
    alter table dossiers_cartes add constraint dossiers_cle_badge_format check (cle_badge ~ '^[0-9a-f]{12}$');
  end if;
end;
$$;

create unique index if not exists u_dossiers_cle_badge on dossiers_cartes (cle_badge);

-- ---------------------------------------------------------------------------
-- 3. Parrainage et page Partenaires
-- ---------------------------------------------------------------------------
alter table dossiers_cartes
  -- Le site du commerce, pour le lien de la page Partenaires.
  add column if not exists site_web text,
  -- Accord du commerce pour paraître sur taporacards.com/partenaires.
  add column if not exists partenaire_public boolean not null default false,
  -- Premier filleul devenu client : la pastille « Ambassadeur Tapora ».
  add column if not exists ambassadeur_le timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dossiers_site_web_format') then
    alter table dossiers_cartes add constraint dossiers_site_web_format
      check (site_web is null or (site_web ~* '^https?://[^\s<>"'']+\.[^\s<>"'']+$' and length(site_web) <= 300));
  end if;
end;
$$;

create table if not exists parrainages (
  id          uuid primary key default gen_random_uuid(),
  parrain_id  uuid not null references dossiers_cartes (id) on delete cascade,
  commerce    text not null check (length(btrim(commerce)) between 1 and 120),
  contact     text check (contact is null or length(contact) <= 120),
  courriel    text check (courriel is null or (courriel ~* '^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$' and length(courriel) <= 254)),
  telephone   text check (telephone is null or length(telephone) <= 40),
  message     text check (message is null or length(message) <= 500),
  statut      text not null default 'nouveau' check (statut in ('nouveau', 'contacte', 'client', 'perdu')),
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now(),
  constraint parrainage_joignable check (courriel is not null or telephone is not null)
);

create index if not exists i_parrainages_parrain on parrainages (parrain_id, cree_le desc);
create index if not exists i_parrainages_a_traiter on parrainages (cree_le desc) where statut in ('nouveau', 'contacte');

drop trigger if exists t_maj_le on parrainages;
create trigger t_maj_le before update on parrainages
  for each row execute function trg_maj_le();

alter table alertes_sommeil enable row level security;
alter table parrainages     enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on alertes_sommeil, parrainages from %I', r);
    end if;
  end loop;
end;
$$;
