-- ============================================================================
-- Catalogue des cartes, commandes Entreprise, mot de passe des pages client,
-- groupes de cartes
-- ============================================================================
-- Trois cartes, et seulement trois :
--   - Carte Québec : français mis en valeur, anglais après. 35 $. Sans
--     personnalisation. Gardée en stock.
--   - Entreprise — Québec : personnalisée, français d'abord. 30 $ la carte,
--     25 au minimum par commande.
--   - Entreprise — International : personnalisée, anglais d'abord, français
--     après. 30 $ la carte, 25 au minimum. Jamais posée au Québec : la Charte
--     de la langue française y exige que le français soit nettement
--     prédominant.
-- ============================================================================

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. Catalogue
-- ---------------------------------------------------------------------------
alter table produits
  add column if not exists modele text check (modele is null or modele in ('quebec', 'entreprise_qc', 'entreprise_intl')),
  -- fr_en : français d'abord (et mis en valeur) ; en_fr : anglais d'abord.
  add column if not exists langue text check (langue is null or langue in ('fr_en', 'en_fr')),
  add column if not exists personnalisable boolean not null default false,
  add column if not exists quantite_min integer not null default 1 check (quantite_min between 1 and 100000),
  -- Sous ce stock, l'app prévient. Vide : pas d'alerte (cartes faites sur commande).
  add column if not exists seuil_stock integer check (seuil_stock is null or seuil_stock between 0 and 100000),
  add column if not exists ordre smallint not null default 100;

create unique index if not exists u_produits_modele on produits (modele) where modele is not null and actif;

-- La carte d'aujourd'hui devient la Carte Québec (son stock et son historique suivent).
update produits p
   set modele = 'quebec', langue = 'fr_en', personnalisable = false, quantite_min = 1,
       nom = 'Carte Québec', sku = 'CARTE-QC', prix_vente_ht = 35, ordre = 1,
       seuil_stock = coalesce(p.seuil_stock, (select seuil_stock_cartes from parametres where id), 10),
       description = 'Carte NFC d’avis Google, français mis en valeur, anglais après. Sans personnalisation.'
 where p.id = (select id from produits where actif and suivi_stock and est_carte order by cree_le limit 1)
   and not exists (select 1 from produits where modele = 'quebec');

insert into produits (sku, nom, description, prix_vente_ht, taxable, suivi_stock, est_carte, actif,
                      modele, langue, personnalisable, quantite_min, seuil_stock, ordre)
values
  ('CARTE-ENT-QC', 'Carte Entreprise — Québec',
   'Carte NFC d’avis Google personnalisée (logo, couleurs, texte), français d’abord. 25 cartes au minimum.',
   30, true, true, true, true, 'entreprise_qc', 'fr_en', true, 25, null, 2),
  ('CARTE-ENT-INTL', 'Carte Entreprise — International',
   'Carte NFC d’avis Google personnalisée (logo, couleurs, texte), anglais d’abord, français après. Hors Québec. 25 cartes au minimum.',
   30, true, true, true, true, 'entreprise_intl', 'en_fr', true, 25, null, 3)
on conflict (sku) do nothing;

-- Le produit par défaut (réceptions, alertes) : la Carte Québec.
create or replace function produit_carte() returns uuid
language sql stable as $$
  select id from produits
   where actif and suivi_stock and est_carte
   order by (modele = 'quebec') desc nulls last, ordre, nom
   limit 1
$$;

-- Convertir une dépense en réception : maintenant pour le modèle choisi.
drop function if exists convertir_en_reception(uuid, integer, numeric);
create or replace function convertir_en_reception(p_transaction_id uuid, p_quantite integer, p_montant_cartes numeric, p_produit_id uuid default null)
returns uuid
language plpgsql as $$
declare t transactions%rowtype; v_stock uuid; v_produit uuid; v_cout numeric;
begin
  select * into t from transactions where id = p_transaction_id for update;
  if not found then raise exception 'Dépense introuvable.'; end if;
  if t.type <> 'depense' or t.est_stock or t.vente_id is not null
     or t.categorie in ('cout_marchandises_vendues', 'perte_inventaire') then
    raise exception 'Seule une dépense saisie à la main peut devenir une réception de cartes.';
  end if;
  v_produit := coalesce(p_produit_id, produit_carte());
  if v_produit is null or not exists (select 1 from produits where id = v_produit and suivi_stock) then
    raise exception 'Aucun produit « carte » suivi au stock.';
  end if;
  if p_quantite is null or p_quantite <= 0 then raise exception 'Le nombre de cartes reçues doit être plus grand que zéro.'; end if;
  if p_montant_cartes is null or p_montant_cartes <= 0 or p_montant_cartes > t.montant_ht then
    raise exception 'Le montant des cartes doit être entre 0 et le montant de la dépense (% $).', t.montant_ht;
  end if;
  if p_montant_cartes < t.montant_ht and t.total_taxes <> 0 then
    raise exception 'Une dépense avec des taxes se convertit en entier.';
  end if;

  if p_montant_cartes = t.montant_ht then
    update transactions set est_stock = true, categorie = 'cartes_achat', nature = 'variable' where id = t.id;
    v_stock := t.id;
  else
    insert into transactions (date, description, montant_ht, type, categorie, nature, source,
                              mode_paiement, province, piece_jointe_url, est_stock, transaction_liee_id, note)
    values (t.date, 'Cartes — ' || t.description, p_montant_cartes, 'depense', 'cartes_achat', 'variable',
            t.source, t.mode_paiement, t.province, t.piece_jointe_url, true, t.id,
            'Partie « cartes » de la dépense du ' || to_char(t.date, 'YYYY-MM-DD'))
    returning id into v_stock;
    update transactions set montant_ht = montant_ht - p_montant_cartes, description = description || ' (hors cartes)'
     where id = t.id;
  end if;

  select cout_reel into v_cout from transactions where id = v_stock;
  insert into inventaire_mouvements (date, produit_id, type, quantite, cout_unitaire, transaction_id, note)
  values (t.date, v_produit, 'achat', p_quantite, round(v_cout / p_quantite, 4), v_stock, 'Réception de cartes');

  perform recalculer_couts_produit(v_produit, t.date);
  return v_stock;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Commandes Entreprise
-- ---------------------------------------------------------------------------
create sequence if not exists seq_commande;

create table if not exists commandes (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique
                default ('C-' || to_char(now() at time zone 'America/Toronto', 'YYYY') || '-' || lpad(nextval('seq_commande')::text, 3, '0')),
  client_id     uuid references clients (id) on delete set null,
  client_nom    text not null check (length(btrim(client_nom)) between 1 and 200),
  courriel      text check (courriel is null or courriel ~* '^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$'),
  dossier_id    uuid references dossiers_cartes (id) on delete set null,
  produit_id    uuid not null references produits (id),
  quantite      integer not null check (quantite between 1 and 100000),
  prix_unitaire numeric(12,2) not null check (prix_unitaire >= 0),
  -- Où les cartes seront posées : code de province (QC, ON…) ou INTL.
  lieu          text not null default 'QC' check (lieu ~ '^([A-Z]{2}|INTL)$'),
  -- La personnalisation.
  couleurs      text check (couleurs is null or length(couleurs) <= 200),
  texte_fr      text check (texte_fr is null or length(texte_fr) <= 300),
  texte_en      text check (texte_en is null or length(texte_en) <= 300),
  noms_cartes   text check (noms_cartes is null or length(noms_cartes) <= 8000),
  destination   text check (destination is null or destination ~* '^https?://'),
  logo_url      text,
  maquette_url  text,
  notes         text check (notes is null or length(notes) <= 2000),
  -- Où elle en est : demande → maquette → approuvee → commandee → recue → posee → facturee.
  etape         text not null default 'demande'
                check (etape in ('demande', 'maquette', 'approuvee', 'commandee', 'recue', 'posee', 'facturee')),
  annulee_le    timestamptz,
  devis_id      uuid references ventes (id) on delete set null,
  facture_id    uuid references ventes (id) on delete set null,
  reception_id  uuid references transactions (id) on delete set null,
  cree_par      uuid references utilisateurs (id) on delete set null,
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now()
);
create index if not exists i_commandes_etape on commandes (etape, cree_le desc);

drop trigger if exists t_maj_le on commandes;
create trigger t_maj_le before update on commandes
  for each row execute function trg_maj_le();

create table if not exists commandes_etapes (
  commande_id uuid not null references commandes (id) on delete cascade,
  etape       text not null,
  fait_le     timestamptz not null default now(),
  par         uuid references utilisateurs (id) on delete set null,
  note        text check (note is null or length(note) <= 500),
  primary key (commande_id, etape)
);

-- Les règles de la commande, vérifiées par la base (aucun écran ne peut les contourner).
create or replace function trg_verifier_commande() returns trigger
language plpgsql as $$
declare p produits%rowtype;
begin
  select * into p from produits where id = new.produit_id;
  if not found or not p.personnalisable then
    raise exception 'Une commande Entreprise se fait avec une carte Entreprise.';
  end if;
  if new.quantite < p.quantite_min then
    raise exception 'La carte « % » se commande par % au minimum.', p.nom, p.quantite_min;
  end if;
  if p.langue = 'en_fr' and new.lieu = 'QC' then
    raise exception 'Au Québec, le français doit être nettement prédominant : choisissez « Carte Entreprise — Québec », ou indiquez où les cartes seront posées (hors Québec).';
  end if;
  return new;
end;
$$;

drop trigger if exists t_verifier_commande on commandes;
create trigger t_verifier_commande before insert or update of produit_id, quantite, lieu on commandes
  for each row execute function trg_verifier_commande();

-- ---------------------------------------------------------------------------
-- 3. Mot de passe de la page client (facultatif)
-- ---------------------------------------------------------------------------
alter table dossiers_cartes add column if not exists mot_de_passe text;

-- Les essais ratés, pour freiner qui voudrait deviner (IP sous forme d'empreinte).
create table if not exists essais_page_client (
  dossier_id  uuid not null references dossiers_cartes (id) on delete cascade,
  empreinte   text,
  cree_le     timestamptz not null default now()
);
create index if not exists i_essais_page_client on essais_page_client (dossier_id, cree_le desc);

-- ---------------------------------------------------------------------------
-- 4. Groupes de cartes (étage, salle, succursale…)
-- ---------------------------------------------------------------------------
alter table cartes_nfc add column if not exists groupe text check (groupe is null or length(btrim(groupe)) between 1 and 60);

-- ---------------------------------------------------------------------------
alter table commandes          enable row level security;
alter table commandes_etapes   enable row level security;
alter table essais_page_client enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on commandes, commandes_etapes, essais_page_client from %I', r);
    end if;
  end loop;
end;
$$;
revoke execute on function produit_carte(), convertir_en_reception(uuid, integer, numeric, uuid), trg_verifier_commande() from public;
