-- ============================================================================
-- Durcissement (audit de sécurité du 20 octobre 2026)
-- ============================================================================
-- 1. Destinations des cartes et des commandes : https seulement. Le Worker
--    n'ouvre que du https ; une carte en http:// afficherait « pas encore
--    activée » sur le domaine des cartes.
-- 2. Chaque fonction de la base a un search_path fixe (avis Supabase).
-- 3. Index manquants sur des clés étrangères lues souvent ; clé primaire
--    pour les essais de mot de passe.

-- ---------------------------------------------------------------------------
-- 1. https seulement
-- ---------------------------------------------------------------------------
update commandes  set destination = regexp_replace(destination, '^http://', 'https://', 'i') where destination ~* '^http://';
update cartes_nfc set destination = regexp_replace(destination, '^http://', 'https://', 'i') where destination ~* '^http://';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_commandes_destination_https') then
    alter table commandes add constraint chk_commandes_destination_https check (destination is null or destination ~* '^https://');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_cartes_destination_https') then
    alter table cartes_nfc add constraint chk_cartes_destination_https check (destination ~* '^https://');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. search_path fixe pour toutes nos fonctions (pas celles des extensions)
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind in ('f', 'p')
       and p.proconfig is null
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter routine %s set search_path = public, extensions, pg_temp', f.signature);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Index et clé primaire
-- ---------------------------------------------------------------------------
create index if not exists i_commandes_dossier on commandes (dossier_id) where dossier_id is not null;
create index if not exists i_cartes_client on cartes_nfc (client_id) where client_id is not null;
create index if not exists i_demandes_cartes_a_traiter on demandes_cartes (cree_le desc) where traitee_le is null;

alter table essais_page_client add column if not exists id bigint generated always as identity;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'essais_page_client'::regclass and contype = 'p') then
    alter table essais_page_client add primary key (id);
  end if;
end;
$$;
