-- ============================================================================
-- Tapora S.E.N.C. — 12 · Sécurité
-- ============================================================================
-- Il n'y a pas encore d'authentification : un mot de passe unique en variable
-- d'environnement garde le back-office. Conséquence directe : la base ne doit
-- être accessible QUE depuis le serveur Next.js, avec la clé service_role.
--
-- Stratégie : RLS activé partout, AUCUNE politique. Résultat : les clés
-- publiques (anon, authenticated) ne lisent ni n'écrivent rien, même si elles
-- fuitent dans le navigateur. Seule la clé service_role, qui contourne le RLS
-- et ne quitte jamais le serveur, passe. Le jour où l'authentification
-- arrivera, il suffira d'ajouter des politiques.
-- ============================================================================

do $$
declare r record;
begin
  for r in
    select tablename from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
    execute format('alter table public.%I force row level security', r.tablename);
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
-- Entreposage des reçus (photos de dépenses, factures).
-- Bucket privé : les URL sont signées côté serveur, jamais publiques.
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
