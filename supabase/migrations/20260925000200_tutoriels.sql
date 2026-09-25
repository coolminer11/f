-- ---------------------------------------------------------------------------
-- Vidéos d'explication — « comment on s'en sert ».
--
-- Deux façons de poser une vidéo, parce qu'aucune ne convient seule :
--   • un LIEN (YouTube non répertorié, Loom, Drive) : rien à entreposer,
--     rien à payer, et la lecture est fluide même sur un forfait gratuit ;
--   • un FICHIER dans le seau « tutoriels » : quand la vidéo montre de vrais
--     chiffres et n'a rien à faire sur une plateforme publique.
--
-- La contrainte garantit qu'il y a exactement l'un ou l'autre : une ligne avec
-- les deux laisserait l'écran choisir, et l'écran choisirait mal.
-- ---------------------------------------------------------------------------

create table if not exists tutoriels (
  id          uuid primary key default gen_random_uuid(),
  titre       text not null check (length(trim(titre)) > 0),
  description text,
  lien        text,
  chemin      text,
  taille      bigint,
  ordre       integer not null default 0,
  cree_le     timestamptz not null default now(),
  cree_par    text,
  constraint chk_source_unique check (num_nonnulls(lien, chemin) = 1)
);

comment on table tutoriels is
  'Vidéos d''explication de l''application : un lien externe ou un fichier entreposé.';

create index if not exists i_tutoriels_ordre on tutoriels (ordre, cree_le);

alter table tutoriels enable row level security;

-- Seau privé : une vidéo de formation montre des écrans avec de vrais
-- montants. Les adresses de lecture sont signées et expirent.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('tutoriels', 'tutoriels', false, 209715200,
            array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'])
    on conflict (id) do nothing;
  end if;
end;
$$;
