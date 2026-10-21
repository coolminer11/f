-- Tapora Services : les commandes (à la table, ou le service aux chambres).
--
-- Une commande est une demande comme les autres (cle = 'commande') : elle
-- arrive dans la file du personnel, passe par « J'arrive » et « Fait », et le
-- client la suit en direct. Elle porte en plus ses lignes (details) et son
-- total, recalculés par le serveur à partir des prix du menu — jamais ceux
-- envoyés par le téléphone. Le paiement reste à l'addition ou porté à la
-- chambre : aucune donnée de paiement n'est demandée ni gardée.

alter table demandes_service add column if not exists details jsonb;
alter table demandes_service add column if not exists total numeric(10, 2);

do $$
begin
  alter table demandes_service add constraint demandes_service_details_lignes
    check (details is null or (jsonb_typeof(details) = 'array' and jsonb_array_length(details) between 1 and 30));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table demandes_service add constraint demandes_service_total_positif check (total is null or (total >= 0 and total < 100000));
exception when duplicate_object then null;
end;
$$;

create index if not exists i_demandes_commandes on demandes_service (etablissement_id, cree_le desc) where cle = 'commande';

-- Les nouvelles colonnes suivent la table : RLS active, rien pour anon ni authenticated.
do $$
declare r text;
begin
  alter table demandes_service enable row level security;
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on demandes_service from %I', r);
    end if;
  end loop;
end;
$$;
