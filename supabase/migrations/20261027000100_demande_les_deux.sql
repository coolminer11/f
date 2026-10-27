-- Formulaire Entreprise : « Les deux » (une version Québec, français
-- d'abord, et une version hors Québec, anglais d'abord). Deux designs, donc
-- 25 cartes minimum chacun : 50 au moins pour la demande.
do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'demandes_entreprise'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%lieu%'
  loop
    execute format('alter table demandes_entreprise drop constraint %I', c);
  end loop;
end;
$$;
alter table demandes_entreprise add constraint demandes_entreprise_lieu_check check (lieu in ('QC', 'HORS_QC', 'LES_DEUX'));
alter table demandes_entreprise add constraint demandes_entreprise_deux_versions_check check (lieu <> 'LES_DEUX' or quantite >= 50);
