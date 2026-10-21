-- ============================================================================
-- Tapora Services : menus vivants, appel du serveur, concierge de chambre
-- ============================================================================
-- Une activité distincte de la société (voir la convention d'associés,
-- article 8) : seul le compte du propriétaire du logiciel la voit dans le
-- back-office.
--
--   établissement (restaurant ou hôtel)
--     ├─ emplacements : tables, chambres, zones — chacun a son code (carte NFC / QR)
--     ├─ menus → sections → plats (textes dans chaque langue, photos, allergènes)
--     ├─ annonces : plat du jour, promos, infos
--     ├─ rubriques du concierge : wifi, horaires, services, recommandations…
--     ├─ types de demandes : serveur, addition, serviettes, ménage… (sur mesure)
--     ├─ demandes : ce que les clients ont demandé, et qui s'en est occupé
--     ├─ retours : la note laissée juste après une demande
--     └─ événements : ce qui a été vu (pour les statistiques)

-- ---------------------------------------------------------------------------
-- Le propriétaire du logiciel
-- ---------------------------------------------------------------------------
alter table utilisateurs add column if not exists proprietaire_logiciel boolean not null default false;
update utilisateurs u set proprietaire_logiciel = true
  from associes a
 where a.id = u.associe_id and a.nom ilike 'Arthur%';
-- Base de développement : un compte « Arthur » sans associé lié.
update utilisateurs set proprietaire_logiciel = true
 where nom ilike 'Arthur%' and not exists (select 1 from utilisateurs where proprietaire_logiciel);

-- ---------------------------------------------------------------------------
-- Codes d'emplacement (8 caractères, sans 0/O/1/I : lisibles à voix haute)
-- ---------------------------------------------------------------------------
create or replace function nouveau_code_emplacement() returns text language plpgsql set search_path = public, extensions, pg_temp as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from emplacements e where e.code = v_code);
  end loop;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Établissements
-- ---------------------------------------------------------------------------
create table if not exists etablissements (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('restaurant', 'hotel')),
  nom           text not null check (length(btrim(nom)) between 1 and 120),
  langues       text[] not null default '{fr,en}' check (cardinality(langues) between 1 and 12),
  langue_defaut text not null default 'fr',
  couleur       text not null default '#c2552f' check (couleur ~ '^#[0-9a-fA-F]{6}$'),
  logo          text check (logo is null or length(logo) <= 300),
  couverture    text check (couverture is null or length(couverture) <= 300),
  accueil       jsonb not null default '{}'::jsonb,
  adresse       text check (adresse is null or length(adresse) <= 300),
  telephone     text check (telephone is null or length(telephone) <= 40),
  site_web      text check (site_web is null or site_web ~* '^https://'),
  avis_url      text check (avis_url is null or avis_url ~* '^https://'),
  wifi_nom      text check (wifi_nom is null or length(wifi_nom) <= 64),
  wifi_mdp      text check (wifi_mdp is null or length(wifi_mdp) <= 64),
  devise        text not null default 'CAD',
  options       jsonb not null default '{}'::jsonb,
  version_lien  integer not null default 1,
  mot_de_passe  text,
  actif         boolean not null default true,
  formule       text not null default 'essai' check (formule in ('essai', 'actif', 'suspendu')),
  essai_jusqua  date default (current_date + 30),
  prix_mensuel  numeric(10, 2) check (prix_mensuel is null or prix_mensuel >= 0),
  contact_nom   text check (contact_nom is null or length(contact_nom) <= 120),
  contact_courriel text check (contact_courriel is null or length(contact_courriel) <= 254),
  notes         text check (notes is null or length(notes) <= 4000),
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now(),
  constraint langue_defaut_dans_langues check (langue_defaut = any (langues))
);

create table if not exists emplacements (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements (id) on delete cascade,
  type             text not null default 'table' check (type in ('table', 'chambre', 'zone', 'comptoir')),
  libelle          text not null check (length(btrim(libelle)) between 1 and 60),
  groupe           text check (groupe is null or length(btrim(groupe)) between 1 and 60),
  code             text not null unique default nouveau_code_emplacement() check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  actif            boolean not null default true,
  ordre            integer not null default 0,
  cree_le          timestamptz not null default now()
);
create index if not exists i_emplacements_etab on emplacements (etablissement_id, ordre);

-- ---------------------------------------------------------------------------
-- Menus
-- ---------------------------------------------------------------------------
create table if not exists menus (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements (id) on delete cascade,
  type             text not null default 'carte' check (type in ('carte', 'boissons', 'room_service', 'dejeuner', 'autre')),
  nom              jsonb not null default '{}'::jsonb,
  description      jsonb not null default '{}'::jsonb,
  -- Un PDF par langue, en plus (ou à la place) du menu détaillé : { "fr": "services/…pdf" }.
  pdf              jsonb not null default '{}'::jsonb,
  heure_debut      time,
  heure_fin        time,
  jours            smallint[] not null default '{1,2,3,4,5,6,7}',
  actif            boolean not null default true,
  ordre            integer not null default 0,
  cree_le          timestamptz not null default now()
);
create index if not exists i_menus_etab on menus (etablissement_id, ordre);

create table if not exists menu_sections (
  id          uuid primary key default gen_random_uuid(),
  menu_id     uuid not null references menus (id) on delete cascade,
  nom         jsonb not null default '{}'::jsonb,
  description jsonb not null default '{}'::jsonb,
  ordre       integer not null default 0
);
create index if not exists i_sections_menu on menu_sections (menu_id, ordre);

create table if not exists menu_items (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references menu_sections (id) on delete cascade,
  nom         jsonb not null default '{}'::jsonb,
  description jsonb not null default '{}'::jsonb,
  prix        numeric(10, 2) check (prix is null or prix >= 0),
  -- Formats ou options : [{ "nom": { "fr": "Petit" }, "prix": 6.5 }]
  variantes   jsonb not null default '[]'::jsonb,
  photo       text check (photo is null or length(photo) <= 300),
  allergenes  text[] not null default '{}',
  etiquettes  text[] not null default '{}',
  disponible  boolean not null default true,
  ordre       integer not null default 0,
  cree_le     timestamptz not null default now()
);
create index if not exists i_items_section on menu_items (section_id, ordre);

create table if not exists annonces_service (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements (id) on delete cascade,
  type             text not null default 'plat_du_jour' check (type in ('plat_du_jour', 'promo', 'info', 'evenement')),
  titre            jsonb not null default '{}'::jsonb,
  texte            jsonb not null default '{}'::jsonb,
  prix             numeric(10, 2) check (prix is null or prix >= 0),
  debut            date,
  fin              date,
  actif            boolean not null default true,
  ordre            integer not null default 0,
  cree_le          timestamptz not null default now()
);
create index if not exists i_annonces_etab on annonces_service (etablissement_id, actif);

-- ---------------------------------------------------------------------------
-- Concierge (hôtels — aussi permis aux restaurants : wifi, heures…)
-- ---------------------------------------------------------------------------
create table if not exists rubriques_concierge (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements (id) on delete cascade,
  type             text not null default 'autre'
                   check (type in ('horaires', 'service', 'restauration', 'activite', 'recommandation', 'transport', 'urgence', 'regle', 'autre')),
  icone            text check (icone is null or length(icone) <= 16),
  titre            jsonb not null default '{}'::jsonb,
  texte            jsonb not null default '{}'::jsonb,
  lien             text check (lien is null or lien ~* '^https://'),
  telephone        text check (telephone is null or length(telephone) <= 40),
  actif            boolean not null default true,
  ordre            integer not null default 0,
  cree_le          timestamptz not null default now()
);
create index if not exists i_rubriques_etab on rubriques_concierge (etablissement_id, ordre);

-- ---------------------------------------------------------------------------
-- Demandes : les types (sur mesure), les demandes, les retours
-- ---------------------------------------------------------------------------
create table if not exists types_demandes (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements (id) on delete cascade,
  cle              text not null check (cle ~ '^[a-z0-9_]{2,30}$'),
  libelle          jsonb not null default '{}'::jsonb,
  icone            text check (icone is null or length(icone) <= 16),
  avec_note        boolean not null default false,
  -- Juste après cette demande, le client est invité à donner son avis.
  avis_apres       boolean not null default false,
  actif            boolean not null default true,
  ordre            integer not null default 0,
  unique (etablissement_id, cle)
);

create table if not exists demandes_service (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements (id) on delete cascade,
  emplacement_id   uuid references emplacements (id) on delete set null,
  type_id          uuid references types_demandes (id) on delete set null,
  cle              text not null,
  libelle          text not null check (length(libelle) <= 120),
  note             text check (note is null or length(note) <= 500),
  langue           text not null default 'fr',
  statut           text not null default 'nouvelle' check (statut in ('nouvelle', 'prise', 'faite', 'annulee')),
  prise_par        text check (prise_par is null or length(prise_par) <= 60),
  empreinte        text check (empreinte is null or length(empreinte) <= 128),
  cree_le          timestamptz not null default now(),
  prise_le         timestamptz,
  faite_le         timestamptz
);
create index if not exists i_demandes_etab on demandes_service (etablissement_id, cree_le desc);
create index if not exists i_demandes_ouvertes on demandes_service (etablissement_id) where statut in ('nouvelle', 'prise');

create table if not exists retours_service (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements (id) on delete cascade,
  emplacement_id   uuid references emplacements (id) on delete set null,
  demande_id       uuid references demandes_service (id) on delete set null,
  note             smallint not null check (note between 1 and 5),
  commentaire      text check (commentaire is null or length(commentaire) <= 1000),
  google           boolean not null default false,
  langue           text not null default 'fr',
  empreinte        text check (empreinte is null or length(empreinte) <= 128),
  lu_le            timestamptz,
  cree_le          timestamptz not null default now()
);
create index if not exists i_retours_etab on retours_service (etablissement_id, cree_le desc);

-- ---------------------------------------------------------------------------
-- Statistiques : ce qui a été vu, et où
-- ---------------------------------------------------------------------------
create table if not exists evenements_service (
  id               bigint generated always as identity primary key,
  etablissement_id uuid not null references etablissements (id) on delete cascade,
  emplacement_id   uuid references emplacements (id) on delete set null,
  type             text not null check (type in ('ouverture', 'menu', 'plat', 'concierge', 'rubrique', 'wifi', 'demandes', 'avis_google', 'pdf', 'langue')),
  cible            text check (cible is null or length(cible) <= 80),
  langue           text,
  cree_le          timestamptz not null default now()
);
create index if not exists i_evenements_etab on evenements_service (etablissement_id, cree_le desc);

-- ---------------------------------------------------------------------------
-- Le portail du personnel : notifications et essais de mot de passe
-- ---------------------------------------------------------------------------
create table if not exists abonnements_push_service (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements (id) on delete cascade,
  endpoint         text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh           text not null check (length(p256dh) <= 200),
  auth             text not null check (length(auth) <= 100),
  groupe           text check (groupe is null or length(groupe) <= 60),
  cree_le          timestamptz not null default now()
);

create table if not exists essais_portail_service (
  id               bigint generated always as identity primary key,
  etablissement_id uuid not null references etablissements (id) on delete cascade,
  empreinte        text,
  cree_le          timestamptz not null default now()
);
create index if not exists i_essais_portail on essais_portail_service (etablissement_id, cree_le desc);

-- ---------------------------------------------------------------------------
do $$
declare t text; r text;
begin
  foreach t in array array['etablissements', 'emplacements', 'menus', 'menu_sections', 'menu_items', 'annonces_service', 'rubriques_concierge',
                           'types_demandes', 'demandes_service', 'retours_service', 'evenements_service', 'abonnements_push_service', 'essais_portail_service'] loop
    execute format('alter table %I enable row level security', t);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on %I from %I', t, r);
      end if;
    end loop;
  end loop;
end;
$$;
revoke execute on function nouveau_code_emplacement() from public;
