-- Tapora Services : le rapport mensuel de chaque établissement, la
-- provenance des visites (carte NFC ou code QR) et ce qu'il faut pour
-- effacer les vieilles données à temps (règles de confidentialité).

-- Le rapport du mois écoulé, envoyé au contact de l'établissement.
alter table etablissements add column if not exists rapport_mensuel boolean not null default true;

create table if not exists rapports_service (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null references etablissements (id) on delete cascade,
  mois             date not null check (extract(day from mois) = 1),
  statut           text not null default 'en_cours' check (statut in ('en_cours', 'envoye', 'simule', 'echec')),
  destinataire     text check (destinataire is null or length(destinataire) <= 200),
  erreur           text check (erreur is null or length(erreur) <= 500),
  cree_le          timestamptz not null default now(),
  unique (etablissement_id, mois)
);

-- Une visite vient d'un tap (carte NFC) ou d'un scan (code QR, « ?q »).
alter table evenements_service add column if not exists source text check (source is null or source in ('nfc', 'qr'));

-- L'effacement des vieilles lignes (voir lib/services/entretien.ts) sans
-- parcourir toute la table.
create index if not exists i_evenements_date on evenements_service (cree_le);
create index if not exists i_demandes_date on demandes_service (cree_le);
create index if not exists i_retours_date on retours_service (cree_le);

alter table rapports_service enable row level security;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on rapports_service from %I', r);
    end if;
  end loop;
end;
$$;
