-- ============================================================================
-- Qui fait quoi, objectifs de la semaine, convention d'associés
-- ============================================================================
-- 1. Le rôle de chaque associé : un titre, une mission, ses responsabilités.
-- 2. Ses objectifs de la semaine, avec ce qui a été fait. Certains se mesurent
--    tout seuls (nouveaux clients, cartes posées, recommandations traitées) :
--    on ne discute pas un chiffre que l'app a compté.
-- 3. La convention d'associés : chaque modification crée une nouvelle
--    version ; chaque associé approuve la version courante pour lui-même ;
--    le PDF signé chez le notaire ou l'avocat s'y joint.
-- ============================================================================

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. Rôles et responsabilités
-- ---------------------------------------------------------------------------
create table if not exists roles_associes (
  associe_id  uuid primary key references associes (id) on delete cascade,
  titre       text not null check (length(btrim(titre)) between 1 and 80),
  mission     text check (mission is null or length(mission) <= 400),
  maj_par     uuid references utilisateurs (id) on delete set null,
  maj_le      timestamptz not null default now()
);

create table if not exists responsabilites (
  id          uuid primary key default gen_random_uuid(),
  associe_id  uuid not null references associes (id) on delete cascade,
  libelle     text not null check (length(btrim(libelle)) between 1 and 80),
  detail      text check (detail is null or length(detail) <= 240),
  ordre       smallint not null default 0
);
create index if not exists i_responsabilites_associe on responsabilites (associe_id, ordre);

-- ---------------------------------------------------------------------------
-- 2. Objectifs de la semaine
-- ---------------------------------------------------------------------------
create table if not exists objectifs_hebdo (
  id          uuid primary key default gen_random_uuid(),
  associe_id  uuid not null references associes (id) on delete cascade,
  libelle     text not null check (length(btrim(libelle)) between 1 and 80),
  cible       integer not null check (cible between 1 and 1000),
  -- « manuel » : l'associé entre son chiffre. Les autres sont comptés par l'app.
  mesure      text not null default 'manuel'
              check (mesure in ('manuel', 'nouveaux_clients', 'cartes_posees', 'recommandations_traitees')),
  ordre       smallint not null default 0,
  cree_le     timestamptz not null default now()
);
create index if not exists i_objectifs_associe on objectifs_hebdo (associe_id, ordre);

-- La semaine commence le lundi (heure du Québec).
create table if not exists realisations_hebdo (
  objectif_id uuid not null references objectifs_hebdo (id) on delete cascade,
  semaine     date not null check (extract(isodow from semaine) = 1),
  valeur      integer not null check (valeur between 0 and 100000),
  maj_par     uuid references utilisateurs (id) on delete set null,
  maj_le      timestamptz not null default now(),
  primary key (objectif_id, semaine)
);

-- ---------------------------------------------------------------------------
-- 3. Convention d'associés
-- ---------------------------------------------------------------------------
create table if not exists conventions (
  id          uuid primary key default gen_random_uuid(),
  version     integer not null unique check (version >= 1),
  texte       text not null check (length(texte) between 1 and 60000),
  -- Le PDF signé (bucket privé des pièces, comme les reçus).
  pdf_signe   text,
  cree_par    uuid references utilisateurs (id) on delete set null,
  cree_le     timestamptz not null default now()
);

create table if not exists conventions_approbations (
  convention_id uuid not null references conventions (id) on delete cascade,
  associe_id    uuid not null references associes (id) on delete cascade,
  approuve_le   timestamptz not null default now(),
  primary key (convention_id, associe_id)
);

-- ---------------------------------------------------------------------------
-- La répartition de départ : celle convenue par les associés.
-- Seulement si rien n'existe encore pour l'associé.
-- ---------------------------------------------------------------------------
insert into roles_associes (associe_id, titre, mission)
select a.id, 'Produit, marque et réseau',
       'Construire et faire tourner l’outil, donner une image forte à Tapora, ouvrir des portes et garder les clients heureux.'
  from associes a
 where a.nom ilike 'arthur%'
on conflict (associe_id) do nothing;

insert into roles_associes (associe_id, titre, mission)
select a.id, 'Ventes et terrain',
       'Être dans les commerces : trouver les clients, vendre, poser les cartes et s’assurer qu’elles servent. En scooter 🛵, d’un commerce à l’autre.'
  from associes a
 where a.nom ilike 'julien%'
on conflict (associe_id) do nothing;

insert into responsabilites (associe_id, libelle, detail, ordre)
select a.id, r.libelle, r.detail, r.ordre
  from associes a
 cross join (values
   ('Back-office et site web', 'L’app, le site taporacards.com, les cartes et leur programmation.', 1),
   ('Produit et marque', 'Logo, design, visuels, nouvelles fonctions.', 2),
   ('LinkedIn et contenu', 'Publications, page de l’entreprise, études de cas.', 3),
   ('Réseautage', 'Événements, rencontres, partenariats.', 4),
   ('Fournisseurs', 'Commandes et impression des cartes, outils.', 5),
   ('Relation clients', 'Courriels, suivi, rapports, questions des commerces.', 6)
 ) as r (libelle, detail, ordre)
 where a.nom ilike 'arthur%'
   and not exists (select 1 from responsabilites x where x.associe_id = a.id);

insert into responsabilites (associe_id, libelle, detail, ordre)
select a.id, r.libelle, r.detail, r.ordre
  from associes a
 cross join (values
   ('Prospection sur le terrain', 'Visiter les commerces, en scooter, quartier par quartier.', 1),
   ('Vente et démonstration', 'Montrer la carte, faire taper, conclure.', 2),
   ('Pose des cartes', 'Installer, activer le Ding, faire la liste de lancement avec l’équipe.', 3),
   ('Cartes qui dorment', 'Passer voir les commerces dont la carte ne sert plus.', 4),
   ('Recommandations', 'Contacter les commerces recommandés par nos clients.', 5)
 ) as r (libelle, detail, ordre)
 where a.nom ilike 'julien%'
   and not exists (select 1 from responsabilites x where x.associe_id = a.id);

insert into objectifs_hebdo (associe_id, libelle, cible, mesure, ordre)
select a.id, o.libelle, o.cible, o.mesure, o.ordre
  from associes a
 cross join (values
   ('Publications LinkedIn', 2, 'manuel', 1),
   ('Contacts de réseautage', 5, 'manuel', 2),
   ('Suivis de clients', 3, 'manuel', 3)
 ) as o (libelle, cible, mesure, ordre)
 where a.nom ilike 'arthur%'
   and not exists (select 1 from objectifs_hebdo x where x.associe_id = a.id);

insert into objectifs_hebdo (associe_id, libelle, cible, mesure, ordre)
select a.id, o.libelle, o.cible, o.mesure, o.ordre
  from associes a
 cross join (values
   ('Commerces visités', 10, 'manuel', 1),
   ('Nouveaux clients', 2, 'nouveaux_clients', 2),
   ('Cartes posées', 3, 'cartes_posees', 3),
   ('Recommandations traitées', 1, 'recommandations_traitees', 4)
 ) as o (libelle, cible, mesure, ordre)
 where a.nom ilike 'julien%'
   and not exists (select 1 from objectifs_hebdo x where x.associe_id = a.id);

-- ---------------------------------------------------------------------------
alter table roles_associes            enable row level security;
alter table responsabilites           enable row level security;
alter table objectifs_hebdo           enable row level security;
alter table realisations_hebdo        enable row level security;
alter table conventions               enable row level security;
alter table conventions_approbations  enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on roles_associes, responsabilites, objectifs_hebdo, realisations_hebdo, conventions, conventions_approbations from %I', r);
    end if;
  end loop;
end;
$$;
