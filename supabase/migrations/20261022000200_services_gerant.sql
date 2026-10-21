-- Tapora Services : le mode gérant du portail du personnel.
--
-- Un second mot de passe, facultatif, donné au gérant de l'établissement : il
-- ouvre, dans le portail, la modification du menu (plats, prix, photos,
-- allergènes), des annonces et des informations de l'établissement. Sans
-- lui, le portail reste celui du personnel. Empreinte scrypt, jamais le mot
-- de passe lui-même.
alter table etablissements add column if not exists mot_de_passe_gerant text;

-- Les essais de mot de passe, freinés séparément pour le portail et pour le gérant.
alter table essais_portail_service add column if not exists quoi text not null default 'portail';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'essais_portail_service_quoi_check') then
    alter table essais_portail_service add constraint essais_portail_service_quoi_check check (quoi in ('portail', 'gerant'));
  end if;
end;
$$;
create index if not exists i_essais_portail_quoi on essais_portail_service (etablissement_id, quoi, cree_le desc);

-- Les tables gardent leur sécurité : aucun accès direct pour anon / authenticated.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on etablissements from %I', r);
      execute format('revoke all on essais_portail_service from %I', r);
    end if;
  end loop;
end;
$$;
