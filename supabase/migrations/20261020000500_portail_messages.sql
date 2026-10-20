-- ============================================================================
-- Portail des entreprises : messages, demandes Entreprise du site, accès
-- ============================================================================
-- 1. messages_clients : le client écrit à Tapora depuis sa page (son
--    portail) ; Tapora répond depuis le back-office. Un fil par dossier.
-- 2. demandes_entreprise : le formulaire « offre Entreprise » du site
--    taporacards.com arrive ici, prêt à devenir une commande.
-- 3. demandes_acces_portail : « recevoir mon lien par courriel », freiné.
-- 4. La maquette approuvée par le client depuis son portail est notée.
-- Rien n'est lisible par anon/authenticated : seul le serveur y touche.

-- ---------------------------------------------------------------------------
-- 1. Messages
-- ---------------------------------------------------------------------------
create table if not exists messages_clients (
  id          uuid primary key default gen_random_uuid(),
  dossier_id  uuid not null references dossiers_cartes (id) on delete cascade,
  auteur      text not null check (auteur in ('client', 'tapora')),
  sujet       text not null default 'question'
              check (sujet in ('question', 'destination', 'probleme', 'commande', 'design', 'autre')),
  texte       text not null check (length(btrim(texte)) between 1 and 2000),
  par         uuid references utilisateurs (id) on delete set null,
  empreinte   text check (empreinte is null or length(empreinte) <= 128),
  cree_le     timestamptz not null default now(),
  traite_le   timestamptz
);

comment on table messages_clients is
  'Fil entre un client (depuis sa page privée) et Tapora (depuis le back-office).';

create index if not exists i_messages_dossier on messages_clients (dossier_id, cree_le desc);
create index if not exists i_messages_a_traiter on messages_clients (cree_le desc)
  where auteur = 'client' and traite_le is null;

-- ---------------------------------------------------------------------------
-- 2. Demandes Entreprise (site)
-- ---------------------------------------------------------------------------
create table if not exists demandes_entreprise (
  id           uuid primary key default gen_random_uuid(),
  contact_nom  text not null check (length(btrim(contact_nom)) between 1 and 120),
  entreprise   text not null check (length(btrim(entreprise)) between 1 and 200),
  courriel     text not null check (length(courriel) <= 254 and courriel ~* '^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$'),
  telephone    text check (telephone is null or length(telephone) <= 40),
  quantite     integer not null check (quantite between 1 and 100000),
  lieu         text not null check (lieu in ('QC', 'HORS_QC')),
  langue       text not null default 'fr' check (langue in ('fr', 'en')),
  message      text check (message is null or length(message) <= 3000),
  empreinte    text check (empreinte is null or length(empreinte) <= 128),
  cree_le      timestamptz not null default now(),
  traitee_le   timestamptz,
  commande_id  uuid references commandes (id) on delete set null
);

comment on table demandes_entreprise is
  'Formulaire « offre Entreprise » de taporacards.com : à rappeler, puis à convertir en commande.';

create index if not exists i_demandes_entreprise on demandes_entreprise (cree_le desc);

-- ---------------------------------------------------------------------------
-- 3. Accès au portail par courriel
-- ---------------------------------------------------------------------------
create table if not exists demandes_acces_portail (
  courriel_empreinte text not null check (length(courriel_empreinte) <= 128),
  empreinte          text check (empreinte is null or length(empreinte) <= 128),
  cree_le            timestamptz not null default now()
);
create index if not exists i_acces_portail on demandes_acces_portail (cree_le desc);

-- ---------------------------------------------------------------------------
-- 4. Approbation de la maquette par le client
-- ---------------------------------------------------------------------------
alter table commandes add column if not exists maquette_approuvee_le timestamptz;

-- ---------------------------------------------------------------------------
alter table messages_clients       enable row level security;
alter table demandes_entreprise    enable row level security;
alter table demandes_acces_portail enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on messages_clients, demandes_entreprise, demandes_acces_portail from %I', r);
    end if;
  end loop;
end;
$$;
