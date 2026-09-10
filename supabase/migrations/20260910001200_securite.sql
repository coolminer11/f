-- ============================================================================
-- Tapora S.E.N.C. — 12 · Sécurité
-- ============================================================================
--                 ⚠  AUCUN APPEL SUPABASE DEPUIS LE NAVIGATEUR  ⚠
--
-- Il n'y a pas d'authentification : un mot de passe unique en variable
-- d'environnement (BACKOFFICE_PASSWORD) garde le back-office. Il n'existe donc
-- aucun utilisateur Supabase à qui rattacher une politique de sécurité, et
-- aucun moyen d'écrire une règle « cet utilisateur voit ses données ».
--
-- Conséquence, assumée et volontaire : le RLS est activé sur TOUTES les tables
-- et il n'existe AUCUNE politique. Autrement dit, les clés publiques (anon,
-- authenticated) ne lisent rien, n'écrivent rien, ne comptent rien — même si
-- elles fuitent dans le bundle du navigateur. Seule la clé `service_role`,
-- qui contourne le RLS et ne quitte jamais le serveur, accède aux données.
--
-- EN PRATIQUE, POUR QUI LIT CECI DANS SIX MOIS :
--   * tout accès aux données passe par un route handler ou une server action
--     Next.js, jamais par un client Supabase monté dans un composant client ;
--   * il n'y a pas de NEXT_PUBLIC_SUPABASE_ANON_KEY dans ce projet, c'est
--     délibéré : un client navigateur ne remonterait que des tableaux vides,
--     SANS message d'erreur — le RLS ne refuse pas, il filtre tout ;
--   * si un écran ne montre rien, la première question à se poser est
--     « est-ce que cet appel part du serveur ? » ;
--   * le jour où une vraie authentification arrivera, il suffira d'ajouter des
--     politiques : la structure des tables n'aura pas à changer.
-- ============================================================================

-- NOTE : `enable` sans `force`, volontairement.
-- `force row level security` soumet AUSSI le propriétaire des tables au RLS.
-- Comme il n'existe aucune politique, le rôle `postgres` — celui qui applique
-- les migrations et celui avec lequel le serveur se connecte — se retrouverait
-- lui-même à ne rien voir. `enable` seul suffit à bloquer anon et
-- authenticated, qui ne sont ni propriétaires ni porteurs de BYPASSRLS.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end;
$$;

-- Ceinture et bretelles : on retire aussi les privilèges accordés par défaut
-- aux rôles publics de Supabase, y compris sur les vues.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables    in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('revoke all on all functions in schema public from %I', r);
      execute format('alter default privileges in schema public revoke all on tables    from %I', r);
      execute format('alter default privileges in schema public revoke all on sequences from %I', r);
      execute format('alter default privileges in schema public revoke all on functions from %I', r);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Entreposage des reçus. Bucket privé : les URL sont signées côté serveur.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('recus', 'recus', false, 10485760,
            array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;
  end if;
end;
$$;
