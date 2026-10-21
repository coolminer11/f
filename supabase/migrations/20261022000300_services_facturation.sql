-- ============================================================================
-- Tapora Services : la facturation des abonnements
-- ============================================================================
-- Les revenus de Tapora Services sont ceux de la société (convention
-- d'associés, article 8) : chaque mois d'abonnement devient une vraie facture
-- du module des ventes — même numérotation, mêmes taxes, mêmes paiements, même
-- comptabilité. Cette table ne fait que noter quel mois de quel établissement
-- a été facturé, pour ne jamais facturer deux fois le même mois.

-- Le client (fichier des clients) que l'on facture pour un établissement.
alter table etablissements add column if not exists client_id uuid references clients (id) on delete set null;

create table if not exists factures_service (
  id               uuid primary key default gen_random_uuid(),
  etablissement_id uuid references etablissements (id) on delete set null,
  -- Le premier jour du mois facturé.
  mois             date not null check (extract(day from mois) = 1),
  -- Une facture supprimée du module des ventes libère son mois. Vide le
  -- temps de créer la facture : la ligne réserve le mois d'abord, pour qu'un
  -- double clic ne fasse jamais deux factures.
  vente_id         uuid references ventes (id) on delete cascade,
  cree_le          timestamptz not null default now(),
  unique (etablissement_id, mois)
);
create index if not exists i_factures_service_vente on factures_service (vente_id);

do $$
declare r text;
begin
  alter table factures_service enable row level security;
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on factures_service from %I', r);
    end if;
  end loop;
end;
$$;
