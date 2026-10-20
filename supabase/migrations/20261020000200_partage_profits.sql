-- ============================================================================
-- Partage des profits dans le temps
-- ============================================================================
-- Le partage peut changer (60/40, puis 50/50 à partir d'une date). Chaque
-- revenu et chaque dépense est réparti selon le partage EN VIGUEUR À SA DATE :
-- les profits gagnés pendant une période se partagent comme on l'avait
-- convenu pour cette période.
--
-- Un changement se propose avec une date de début et ne s'applique qu'une
-- fois approuvé par tous les associés concernés ; il est alors inscrit au
-- registre des décisions, approuvé par tous.
--
-- Arrondis : la répartition se fait par morceau (un mois × une période de
-- partage). Dans chaque morceau, chacun reçoit sa part tronquée au cent, puis
-- les cents restants vont aux plus fortes fractions (méthode du plus fort
-- reste) : la somme des parts vaut toujours exactement le profit, quel que
-- soit le regroupement (mois, période, année).
-- ============================================================================

set local lock_timeout = '5s';

create table if not exists partages (
  id           uuid primary key default gen_random_uuid(),
  -- En vigueur à partir de ce jour (inclus), jusqu'au début du suivant.
  debut        date not null check (debut >= date '2000-01-01'),
  motif        text check (motif is null or length(motif) <= 300),
  propose_par  uuid references utilisateurs (id) on delete set null,
  propose_le   timestamptz not null default now(),
  -- Rempli quand tous les associés concernés ont approuvé.
  applique_le  timestamptz,
  -- Proposition annulée, ou partage remplacé par un autre du même jour.
  annule_le    timestamptz,
  decision_id  uuid references decisions (id) on delete set null
);

-- Un seul partage appliqué par date de début ; une seule proposition ouverte à la fois.
create unique index if not exists u_partages_debut_applique on partages (debut)
  where applique_le is not null and annule_le is null;
create unique index if not exists u_partages_proposition_ouverte on partages ((true))
  where applique_le is null and annule_le is null;

create table if not exists partages_parts (
  partage_id uuid not null references partages (id) on delete cascade,
  associe_id uuid not null references associes (id) on delete restrict,
  part       numeric(5,4) not null check (part > 0 and part <= 1),
  primary key (partage_id, associe_id)
);

create table if not exists partages_approbations (
  partage_id  uuid not null references partages (id) on delete cascade,
  associe_id  uuid not null references associes (id) on delete cascade,
  approuve_le timestamptz not null default now(),
  primary key (partage_id, associe_id)
);

-- Le partage de départ : celui d'aujourd'hui, depuis toujours.
do $$
declare v uuid;
begin
  if not exists (select 1 from partages) then
    insert into partages (debut, motif, applique_le) values (date '2000-01-01', 'Partage de départ', now())
    returning id into v;
    insert into partages_parts (partage_id, associe_id, part)
    select v, id, part from associes where actif;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lecture
-- ---------------------------------------------------------------------------

-- Le partage en vigueur à une date : le dernier appliqué qui commence au plus
-- tard ce jour-là. Le tout premier vaut aussi pour les dates qui le précèdent.
create or replace function partage_en_vigueur(p_date date) returns uuid
language sql stable as $$
  select coalesce(
    (select id from partages
      where applique_le is not null and annule_le is null and debut <= p_date
      order by debut desc limit 1),
    (select id from partages
      where applique_le is not null and annule_le is null
      order by debut limit 1))
$$;

create or replace function part_en_vigueur(p_associe uuid, p_date date) returns numeric
language sql stable as $$
  select coalesce(
    (select part from partages_parts where partage_id = partage_en_vigueur(p_date) and associe_id = p_associe),
    0)
$$;

-- La répartition du profit entre le p_debut et le p_fin (inclus), par
-- morceau (mois × période de partage). Avec p_fiscal, les repas et frais de
-- représentation ne sont déductibles qu'à 50 % (impôt sur le revenu).
create or replace function repartition_profits(p_debut date, p_fin date, p_fiscal boolean default false)
returns table (mois date, partage_id uuid, associe_id uuid, part numeric, profit numeric, montant numeric)
language sql stable as $$
  with periodes as (
    select p.id,
           case when row_number() over (order by p.debut) = 1 then date '0001-01-01' else p.debut end as d1,
           coalesce(lead(p.debut) over (order by p.debut) - 1, date '9999-12-31') as d2
      from partages p
     where p.applique_le is not null and p.annule_le is null
  ),
  morceaux as (
    select date_trunc('month', t.date)::date as mois, per.id as partage_id,
           sum(case
                 when t.type = 'revenu' then t.montant_ht
                 when p_fiscal and t.categorie = 'repas_representation' then -round(t.cout_reel * 0.5, 2)
                 else -t.cout_reel
               end) as profit
      from transactions t
      join periodes per on t.date between per.d1 and per.d2
     where not t.est_stock
       and t.date between p_debut and p_fin
     group by 1, 2
  ),
  brut as (
    select m.mois, m.partage_id, pp.associe_id, pp.part, m.profit,
           m.profit * pp.part as exact,
           trunc(m.profit * pp.part, 2) as base
      from morceaux m
      join partages_parts pp on pp.partage_id = m.partage_id
  ),
  classe as (
    select b.*,
           -- Les cents qui restent une fois chacun tronqué au cent (même signe que le profit).
           round((b.profit - sum(b.base) over w) * 100)::int as cents,
           -- Méthode du plus fort reste ; à égalité, un tirage fixe par morceau : personne
           -- n'est avantagé à la longue.
           row_number() over (w order by abs(b.exact - b.base) desc,
                                         md5(b.mois::text || b.partage_id::text || b.associe_id::text)) as rang
      from brut b
    window w as (partition by b.mois, b.partage_id)
  )
  select c.mois, c.partage_id, c.associe_id, c.part, c.profit,
         c.base + case when c.rang <= abs(c.cents) then sign(c.cents) * 0.01 else 0 end as montant
    from classe c
$$;

-- ---------------------------------------------------------------------------
-- Les comptes d'associés : la part de l'exercice en cours suit le partage
-- de chaque période (avant : un seul pourcentage pour tout).
-- ---------------------------------------------------------------------------
drop view if exists v_capital_associes;
create view v_capital_associes with (security_invoker = true) as
with ouvert as (
  select r.associe_id, sum(r.montant) as profit
    from exercices e
   cross join lateral repartition_profits(e.date_debut, e.date_fin) r
   where e.statut = 'ouvert'
   group by r.associe_id
),
mvt as (
  select associe_id,
         coalesce(sum(montant) filter (where type = 'apport'), 0)       as apports,
         coalesce(sum(montant) filter (where type = 'prelevement'), 0)  as prelevements,
         coalesce(sum(montant) filter (where type = 'part_profit'), 0)  as profits_attribues,
         coalesce(sum(montant_signe) filter (where compte = 'capital'), 0) as capital_mouvements,
         coalesce(sum(montant_signe) filter (where compte = 'courant'), 0) as compte_courant
  from mouvements_associes group by associe_id
)
select a.id as associe_id, a.nom,
       part_en_vigueur(a.id, current_date)::numeric(5,4) as part,
       coalesce(m.apports, 0)           as apports,
       coalesce(m.prelevements, 0)      as prelevements,
       coalesce(m.profits_attribues, 0) as profits_attribues,
       coalesce(o.profit, 0)            as part_profit_exercice_courant,
       coalesce(m.capital_mouvements, 0) + coalesce(o.profit, 0) as solde_capital,
       coalesce(m.compte_courant, 0)    as solde_compte_courant,
       coalesce(m.capital_mouvements, 0) + coalesce(o.profit, 0)
         + coalesce(m.compte_courant, 0) as total_du_a_lassocie
from associes a
left join ouvert o on o.associe_id = a.id
left join mvt m on m.associe_id = a.id
where a.actif
order by a.ordre;

-- ---------------------------------------------------------------------------
-- Clôture d'exercice : même répartition, au cent près.
-- ---------------------------------------------------------------------------
create or replace function cloturer_exercice(p_annee integer)
returns numeric
language plpgsql as $$
declare v_profit numeric; v_debut date; v_fin date;
begin
  select date_debut, date_fin into v_debut, v_fin from exercices where annee = p_annee;
  if not found then raise exception 'Exercice % introuvable.', p_annee; end if;
  if exists (select 1 from exercices where annee = p_annee and statut = 'clos') then
    raise exception 'Exercice % déjà clos.', p_annee;
  end if;

  -- Les achats portés au stock sont un actif : ils ne comptent pas ici.
  select coalesce(sum(case when type = 'revenu' then montant_ht else -cout_reel end), 0)
    into v_profit
  from transactions where date between v_debut and v_fin and not est_stock;

  delete from mouvements_associes where type = 'part_profit' and annee = p_annee;
  insert into mouvements_associes (associe_id, date, compte, type, montant, description)
  select r.associe_id, v_fin, 'capital', 'part_profit', sum(r.montant),
         'Part du résultat de l''exercice ' || p_annee
    from repartition_profits(v_debut, v_fin) r
   group by r.associe_id
  having sum(r.montant) <> 0;

  update exercices set statut = 'clos', date_cloture = now() where annee = p_annee;
  return v_profit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Proposer, approuver, annuler un changement de partage
-- ---------------------------------------------------------------------------
create or replace function texte_partage(p_partage uuid) returns text
language sql stable as $$
  select string_agg(
           a.nom || ' ' || replace(rtrim(rtrim(to_char(pp.part * 100, 'FM990.00'), '0'), '.'), '.', ',') || ' %',
           ' · ' order by a.ordre)
    from partages_parts pp join associes a on a.id = pp.associe_id
   where pp.partage_id = p_partage
$$;

create or replace function proposer_partage(p_debut date, p_parts jsonb, p_motif text, p_utilisateur uuid)
returns uuid
language plpgsql as $$
declare
  v_id uuid;
  v_total numeric;
  v_clos date;
  v_associe uuid;
begin
  if p_debut is null or p_debut <= date '2000-01-01' then
    raise exception 'Choisissez la date à partir de laquelle le nouveau partage s''applique.';
  end if;
  select max(date_fin) into v_clos from exercices where statut = 'clos';
  if v_clos is not null and p_debut <= v_clos then
    raise exception 'Le nouveau partage doit commencer après le dernier exercice clos (%).', v_clos;
  end if;
  if exists (select 1 from partages where applique_le is null and annule_le is null) then
    raise exception 'Un changement de partage attend déjà les approbations : approuvez-le ou annulez-le d''abord.';
  end if;
  if exists (select 1 from associes a where a.actif and not (p_parts ? a.id::text))
     or exists (select 1 from jsonb_object_keys(p_parts) k
                 where not exists (select 1 from associes a where a.actif and a.id::text = k)) then
    raise exception 'Il faut une part pour chaque associé, et seulement pour eux.';
  end if;
  if exists (select 1 from jsonb_each_text(p_parts) j
              where j.value !~ '^\d(\.\d{1,4})?$' or j.value::numeric <= 0 or j.value::numeric > 1) then
    raise exception 'Chaque part doit être plus grande que zéro et au plus égale au total, avec deux décimales au plus.';
  end if;
  select sum(value::numeric) into v_total from jsonb_each_text(p_parts);
  if v_total <> 1 then
    raise exception 'Les parts doivent totaliser 100 %% (total actuel : %).', replace(to_char(v_total * 100, 'FM9990.00'), '.', ',') || ' %';
  end if;
  if not exists (select 1 from jsonb_each_text(p_parts) j where j.value::numeric <> part_en_vigueur(j.key::uuid, p_debut)) then
    raise exception 'C''est déjà le partage en vigueur à cette date.';
  end if;

  insert into partages (debut, motif, propose_par) values (p_debut, nullif(btrim(p_motif), ''), p_utilisateur)
  returning id into v_id;
  insert into partages_parts (partage_id, associe_id, part)
  select v_id, j.key::uuid, j.value::numeric from jsonb_each_text(p_parts) j;

  -- Proposer, c'est approuver pour soi.
  select associe_id into v_associe from utilisateurs where id = p_utilisateur;
  if v_associe is not null then
    perform approuver_partage(v_id, v_associe);
  end if;
  return v_id;
end;
$$;

create or replace function approuver_partage(p_partage uuid, p_associe uuid)
returns text
language plpgsql as $$
declare
  p partages%rowtype;
  v_clos date;
  v_decision uuid;
  v_avant text;
begin
  select * into p from partages where id = p_partage for update;
  if not found or p.annule_le is not null then
    raise exception 'Ce changement de partage n''existe plus.';
  end if;
  if p.applique_le is not null then return 'applique'; end if;
  if not exists (select 1 from partages_parts where partage_id = p_partage and associe_id = p_associe) then
    raise exception 'Seul un associé concerné par ce partage peut l''approuver.';
  end if;

  insert into partages_approbations (partage_id, associe_id) values (p_partage, p_associe)
  on conflict do nothing;
  if exists (select 1 from partages_parts pp
              where pp.partage_id = p_partage
                and not exists (select 1 from partages_approbations x
                                 where x.partage_id = p_partage and x.associe_id = pp.associe_id)) then
    return 'en_attente';
  end if;

  -- Tout le monde a approuvé : on applique.
  select max(date_fin) into v_clos from exercices where statut = 'clos';
  if v_clos is not null and p.debut <= v_clos then
    raise exception 'Un exercice a été clos entre-temps : ce partage commencerait dedans. Annulez-le et proposez une date plus récente.';
  end if;
  v_avant := texte_partage(partage_en_vigueur(p.debut));

  -- Un partage déjà appliqué qui commence le même jour est remplacé.
  update partages set annule_le = now()
   where applique_le is not null and annule_le is null and debut = p.debut and id <> p_partage;
  update partages set applique_le = now() where id = p_partage;

  -- Les écrans qui lisent encore associes.part voient le partage d'aujourd'hui.
  update associes a set part = pp.part
    from partages_parts pp
   where pp.partage_id = partage_en_vigueur(current_date) and pp.associe_id = a.id;

  -- Au registre des décisions, approuvée par tous.
  insert into decisions (date, titre, description, decision, categorie)
  values (current_date,
          'Partage des profits à partir du ' || to_char(p.debut, 'YYYY-MM-DD'),
          coalesce(p.motif, 'Changement du partage des profits entre les associés.'),
          'Nouveau partage : ' || texte_partage(p_partage) || '. Avant : ' || coalesce(v_avant, '—') || '.',
          'finance')
  returning id into v_decision;
  update decisions_approbations set approuve = true
   where decision_id = v_decision
     and associe_id in (select associe_id from partages_approbations where partage_id = p_partage);
  update partages set decision_id = v_decision where id = p_partage;
  return 'applique';
end;
$$;

create or replace function annuler_partage(p_partage uuid) returns boolean
language sql as $$
  update partages set annule_le = now()
   where id = p_partage and applique_le is null and annule_le is null
  returning true
$$;

-- ---------------------------------------------------------------------------
-- Privilèges : rien de tout ça n'est appelable avec la clé publique.
revoke execute on function partage_en_vigueur(date), part_en_vigueur(uuid, date),
  repartition_profits(date, date, boolean), texte_partage(uuid),
  proposer_partage(date, jsonb, text, uuid), approuver_partage(uuid, uuid),
  annuler_partage(uuid), cloturer_exercice(integer) from public;

alter table partages              enable row level security;
alter table partages_parts        enable row level security;
alter table partages_approbations enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on partages, partages_parts, partages_approbations, v_capital_associes from %I', r);
      execute format('revoke all on function partage_en_vigueur(date), part_en_vigueur(uuid, date), repartition_profits(date, date, boolean), texte_partage(uuid), proposer_partage(date, jsonb, text, uuid), approuver_partage(uuid, uuid), annuler_partage(uuid), cloturer_exercice(integer) from %I', r);
    end if;
  end loop;
end;
$$;
