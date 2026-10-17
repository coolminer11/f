-- ============================================================================
-- Cartes NFC servies par Cloudflare Workers
-- ============================================================================
-- Le Worker (dossier worker/) redirige les taps sans passer par Render. Il
-- parle à Supabase par l'API REST, avec la clé PUBLIQUE (« publishable » /
-- anon) — pas la clé service_role.
--
-- Cette clé ne lit aucune table : le RLS est actif partout sans politique,
-- et les privilèges des rôles publics sont retirés (voir 20260910001200).
-- Elle peut appeler exactement deux fonctions, ci-dessous, et rien d'autre :
--
--   tap_destination(code)  → la destination d'une carte active, ou null ;
--   tap_noter(code, …)     → ajoute un tap à une carte active.
--
-- Ce que la clé permet, l'adresse /t/CODE le permettait déjà à n'importe qui :
-- lire où mène une carte, et la faire compter. Si elle fuit, elle ne donne
-- accès à aucune vente, aucun client, aucun montant.
-- ============================================================================

-- Qui a servi le tap : le serveur (Render) ou Cloudflare. L'écran « En
-- direct » s'en sert pour montrer que le Worker est bien branché.
alter table taps add column if not exists via text not null default 'serveur'
  check (via in ('serveur', 'cloudflare'));

create or replace function tap_destination(p_code text) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('destination', destination)
    from cartes_nfc
   where code = upper(p_code) and actif
$$;

comment on function tap_destination(text) is
  'Worker Cloudflare : destination d''une carte active, null sinon.';

create or replace function tap_noter(
  p_code text,
  p_canal text,
  p_appareil text,
  p_duree_ms integer default null
) returns void
language sql volatile security definer
set search_path = public, pg_temp
as $$
  insert into taps (carte_id, canal, appareil, duree_ms, via)
  select id, p_canal, p_appareil, greatest(p_duree_ms, 0), 'cloudflare'
    from cartes_nfc
   where code = upper(p_code) and actif
$$;

comment on function tap_noter(text, text, text, integer) is
  'Worker Cloudflare : compte un tap. Sans effet si la carte est inconnue ou désactivée.';

-- ---------------------------------------------------------------------------
-- Privilèges. PostgreSQL accorde EXECUTE à PUBLIC — donc à anon — sur toute
-- nouvelle fonction. Jusqu'ici c'était sans conséquence (anon ne lit aucune
-- table, et aucune fonction n'est SECURITY DEFINER) ; maintenant que la clé
-- anon sort dans le Worker, on ferme la porte franchement : plus aucune de
-- nos fonctions n'est appelable par PUBLIC, ni aujourd'hui ni à l'avenir.
-- Les fonctions des extensions (pgcrypto…) ne sont pas touchées.
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proowner = current_user::regrole
       and not exists (select 1 from pg_depend d
                        where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public', f.signature);
  end loop;
end;
$$;

alter default privileges in schema public revoke execute on functions from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant usage on schema public to anon;
    grant execute on function tap_destination(text) to anon;
    grant execute on function tap_noter(text, text, text, integer) to anon;
  end if;
end;
$$;

-- L'API REST de Supabase relit son schéma pour voir les nouvelles fonctions.
notify pgrst, 'reload schema';
