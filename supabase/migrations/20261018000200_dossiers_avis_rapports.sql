-- ============================================================================
-- Cartes NFC : dossiers, avis Google, rapports mensuels
-- ============================================================================
-- DOSSIER : un commerce qui achète plusieurs cartes (comptoir, tables,
-- terrasse…). Ses cartes se regardent ensemble ; il reçoit, s'il le veut,
-- un rapport mensuel, et un lien privé vers ses statistiques.
--
-- Le lien privé n'est stocké nulle part : il est dérivé (HMAC) de l'id du
-- dossier, de `version_lien` et du secret du serveur (lib/lien-stats.ts).
-- Une fuite de la base ne donne donc aucun lien valide ; incrémenter
-- `version_lien` révoque l'ancien sur-le-champ.
-- ============================================================================

-- Les cartes servent pendant la migration : si un verrou sur cartes_nfc ne
-- s'obtient pas en 5 s, on abandonne (le démarrage réessaiera) plutôt que de
-- faire attendre les taps derrière nous.
set local lock_timeout = '5s';

create table if not exists dossiers_cartes (
  id               uuid primary key default gen_random_uuid(),
  nom              text not null check (length(btrim(nom)) between 1 and 120),
  -- Le client de facturation, quand il existe déjà.
  client_id        uuid references clients (id) on delete set null,
  courriel_rapport text check (courriel_rapport is null
                               or courriel_rapport ~* '^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$'),
  rapport_mensuel  boolean not null default false,
  lien_actif       boolean not null default true,
  version_lien     integer not null default 1 check (version_lien >= 1),
  note             text check (note is null or length(note) <= 500),
  cree_le          timestamptz not null default now(),
  maj_le           timestamptz not null default now()
);

comment on table dossiers_cartes is
  'Regroupe les cartes d''un même commerce : statistiques communes, lien client, rapport mensuel.';

drop trigger if exists t_maj_le on dossiers_cartes;
create trigger t_maj_le before update on dossiers_cartes
  for each row execute function trg_maj_le();

alter table cartes_nfc
  add column if not exists dossier_id uuid references dossiers_cartes (id) on delete set null,
  -- Identifiant Google de la fiche du commerce (« ChIJ… »), pour suivre les avis.
  add column if not exists place_id text
    check (place_id is null or place_id ~ '^[A-Za-z0-9_-]{10,255}$');

create index if not exists i_cartes_dossier on cartes_nfc (dossier_id);

-- Reprise de l'existant : un dossier par client qui a déjà des cartes.
insert into dossiers_cartes (nom, client_id)
select distinct on (cl.id) left(cl.nom, 120), cl.id
  from cartes_nfc c
  join clients cl on cl.id = c.client_id
 where c.dossier_id is null
   and not exists (select 1 from dossiers_cartes d where d.client_id = cl.id);

update cartes_nfc c
   set dossier_id = d.id
  from dossiers_cartes d
 where d.client_id = c.client_id and c.dossier_id is null;

-- ---------------------------------------------------------------------------
-- Avis Google
-- ---------------------------------------------------------------------------
create table if not exists fiches_google (
  place_id text primary key check (place_id ~ '^[A-Za-z0-9_-]{10,255}$'),
  nom      text,
  adresse  text,
  maj_le   timestamptz not null default now()
);

-- Un relevé par fiche et par jour : le nombre d'avis et la note ce jour-là.
create table if not exists avis_google (
  place_id  text not null references fiches_google (place_id) on delete cascade,
  jour      date not null,
  nb_avis   integer not null check (nb_avis >= 0),
  note      numeric(2, 1) check (note is null or note between 0 and 5),
  releve_le timestamptz not null default now(),
  primary key (place_id, jour)
);

-- Compteur d'appels à Google, par mois : c'est lui qui garantit qu'on ne
-- dépasse jamais la part gratuite (lib/avis-google.ts).
create table if not exists appels_google (
  mois  date not null,
  sorte text not null check (sorte in ('details', 'recherche')),
  nb    integer not null default 0,
  primary key (mois, sorte)
);

-- ---------------------------------------------------------------------------
-- Rapports mensuels : une ligne par dossier et par mois. La clé primaire est
-- le verrou — deux réveils simultanés ne peuvent pas envoyer deux fois.
-- ---------------------------------------------------------------------------
create table if not exists rapports_mensuels (
  dossier_id   uuid not null references dossiers_cartes (id) on delete cascade,
  mois         date not null check (extract(day from mois) = 1),
  statut       text not null check (statut in ('en_cours', 'envoye', 'simule', 'echec')),
  destinataire text,
  erreur       text,
  cree_le      timestamptz not null default now(),
  primary key (dossier_id, mois)
);

-- ---------------------------------------------------------------------------
-- Vue des cartes : on ajoute le dossier et la fiche Google (en fin de liste,
-- « create or replace view » n'accepte que des colonnes ajoutées au bout).
-- ---------------------------------------------------------------------------
create or replace view v_cartes_nfc with (security_invoker = true) as
select c.id, c.code, c.libelle, c.destination, c.actif, c.note, c.cree_le,
       c.client_id,
       cl.nom as client_nom,
       count(t.id)::int                                                   as taps_total,
       count(t.id) filter (where t.tape_le >= now() - interval '7 days')::int  as taps_7j,
       count(t.id) filter (where t.tape_le >= now() - interval '30 days')::int as taps_30j,
       count(t.id) filter (where t.tape_le >= now() - interval '60 days'
                             and t.tape_le <  now() - interval '30 days')::int as taps_30j_precedents,
       count(t.id) filter (where t.canal = 'qr')::int                     as taps_qr,
       count(t.id) filter (where t.appareil = 'ios')::int                 as taps_ios,
       count(t.id) filter (where t.appareil = 'android')::int             as taps_android,
       max(t.tape_le)                                                     as dernier_tap,
       c.dossier_id,
       d.nom as dossier_nom,
       c.place_id,
       f.nom as fiche_nom
  from cartes_nfc c
  left join clients cl on cl.id = c.client_id
  left join dossiers_cartes d on d.id = c.dossier_id
  left join fiches_google f on f.place_id = c.place_id
  left join taps t on t.carte_id = c.id
 group by c.id, cl.nom, d.nom, f.nom;

-- ---------------------------------------------------------------------------
-- Sécurité : même régime que tout le reste — RLS sans politique, aucun
-- privilège pour les rôles publics.
-- ---------------------------------------------------------------------------
alter table dossiers_cartes   enable row level security;
alter table fiches_google     enable row level security;
alter table avis_google       enable row level security;
alter table appels_google     enable row level security;
alter table rapports_mensuels enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on dossiers_cartes, fiches_google, avis_google, appels_google, rapports_mensuels, v_cartes_nfc from %I', r);
    end if;
  end loop;
end;
$$;
