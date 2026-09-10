-- ============================================================================
-- Tapora S.E.N.C. — 11 · Vues de rapport
-- ============================================================================
-- Toutes les vues sont en `security_invoker` : elles n'échappent pas au RLS.
--
-- Deux règles transversales :
--   * les achats portés au stock (`est_stock`) sont un ACTIF : ils sont exclus
--     de tout état des résultats ; c'est le coût des marchandises vendues qui
--     charge le résultat ;
--   * une dépense pèse son `cout_reel` (HT + taxe non récupérable), pas son HT.
-- ============================================================================

create or replace view v_journal with (security_invoker = true) as
select t.id, t.date, date_trunc('month', t.date::timestamp)::date as mois,
       t.description, t.montant_ht, t.total_taxes, t.montant_ttc,
       t.total_taxes_recuperables, t.cout_reel,
       t.type, t.categorie, d.libelle as categorie_libelle, t.nature,
       t.source, t.mode_paiement, t.province, t.est_stock, t.est_remboursement,
       t.piece_jointe_url, t.vente_id, t.note,
       (select jsonb_agg(jsonb_build_object('code', l.code, 'taux', l.taux,
                                            'montant', l.montant, 'autorite', l.autorite)
               order by l.code)
          from lignes_taxe l where l.transaction_id = t.id) as taxes
from transactions t
join categories_defauts d on d.categorie = t.categorie;

-- ---------------------------------------------------------------------------
-- ÉCRAN 1 — État des résultats mensuel
-- ---------------------------------------------------------------------------
create or replace view v_ventes_mensuelles with (security_invoker = true) as
select date_trunc('month', v.date::timestamp)::date as mois,
       v.canal,
       count(distinct v.id)                                        as nb_ventes,
       coalesce(sum(l.quantite) filter (where coalesce(p.est_carte, true)), 0) as cartes_vendues,
       coalesce(sum(l.montant_ht), 0)                              as revenus_ht
from ventes v
join vente_lignes l on l.vente_id = v.id
left join produits p on p.id = l.produit_id
where v.statut <> 'annulee'
group by 1, 2;

create or replace view v_resultats_mensuels with (security_invoker = true) as
with bornes as (
  select date_trunc('month', min(date)::timestamp)::date as d1,
         greatest(date_trunc('month', max(date)::timestamp)::date,
                  date_trunc('month', current_date::timestamp)::date) as d2
  from transactions
),
serie as (select generate_series(d1, d2, interval '1 month')::date as mois from bornes),
agg as (
  select date_trunc('month', date::timestamp)::date as mois,
         sum(montant_ht) filter (where type = 'revenu')                        as revenus_ht,
         sum(cout_reel)  filter (where type = 'depense' and nature = 'variable') as couts_variables,
         sum(cout_reel)  filter (where type = 'depense' and nature = 'fixe')     as couts_fixes,
         sum(cout_reel)  filter (where categorie = 'cout_marchandises_vendues')  as cout_marchandises,
         sum(cout_reel)  filter (where categorie in ('frais_stripe', 'frais_litige')) as frais_transaction
  from transactions
  where not est_stock                       -- le stock est un actif, pas une charge
  group by 1
),
cartes as (
  select mois, sum(cartes_vendues) as cartes_vendues, sum(nb_ventes) as nb_ventes
  from v_ventes_mensuelles group by mois
),
base as (
  select s.mois,
         coalesce(a.revenus_ht, 0)        as revenus_ht,
         coalesce(a.couts_variables, 0)   as couts_variables,
         coalesce(a.couts_fixes, 0)       as couts_fixes,
         coalesce(a.cout_marchandises, 0) as cout_marchandises,
         coalesce(a.frais_transaction, 0) as frais_transaction,
         coalesce(a.revenus_ht, 0) - coalesce(a.couts_variables, 0) as marge_brute,
         coalesce(a.revenus_ht, 0) - coalesce(a.couts_variables, 0)
           - coalesce(a.couts_fixes, 0) as profit_net,
         coalesce(c.cartes_vendues, 0) as cartes_vendues,
         coalesce(c.nb_ventes, 0)      as nb_ventes
  from serie s
  left join agg a on a.mois = s.mois
  left join cartes c on c.mois = s.mois
)
select b.*,
  case when b.revenus_ht <> 0
       then round(b.marge_brute / b.revenus_ht * 100, 2) end as marge_brute_pct,
  case when b.revenus_ht <> 0
       then round(b.profit_net / b.revenus_ht * 100, 2) end  as profit_net_pct,
  lag(b.revenus_ht)      over w as revenus_ht_precedent,
  lag(b.couts_variables) over w as couts_variables_precedent,
  lag(b.couts_fixes)     over w as couts_fixes_precedent,
  lag(b.marge_brute)     over w as marge_brute_precedent,
  lag(b.profit_net)      over w as profit_net_precedent,
  b.revenus_ht - lag(b.revenus_ht) over w as variation_revenus,
  b.profit_net - lag(b.profit_net) over w as variation_profit,
  case when lag(b.revenus_ht) over w > 0
       then round((b.revenus_ht - lag(b.revenus_ht) over w)
                  / lag(b.revenus_ht) over w * 100, 2) end as variation_revenus_pct,
  case when lag(b.profit_net) over w <> 0
       then round((b.profit_net - lag(b.profit_net) over w)
                  / abs(lag(b.profit_net) over w) * 100, 2) end as variation_profit_pct
from base b
window w as (order by b.mois);

create or replace view v_depenses_par_categorie_mensuelles with (security_invoker = true) as
select date_trunc('month', t.date::timestamp)::date as mois,
       t.categorie, d.libelle as categorie_libelle, t.nature,
       sum(t.montant_ht) as montant_ht,
       sum(t.cout_reel)  as cout_reel,
       sum(t.total_taxes_recuperables) as taxes_recuperables
from transactions t
join categories_defauts d on d.categorie = t.categorie
where t.type = 'depense' and not t.est_stock
group by 1, 2, 3, 4;

-- ---------------------------------------------------------------------------
-- ÉCRAN 2 — Marge unitaire
--
-- Depuis la reconnaissance du coût à la vente, le coût de la carte vient du
-- COGS des cartes RÉELLEMENT sorties du stock : acheter un lot de 200 cartes
-- ne déforme plus la marge du mois.
-- ---------------------------------------------------------------------------
create or replace view v_couts_unitaires_courants with (security_invoker = true) as
select p.id as produit_id, p.sku, p.nom, c.composante, c.montant_ht
from produits p
cross join lateral (
  select distinct on (cu.composante) cu.composante, cu.montant_ht
  from couts_unitaires cu
  where cu.date_effet <= current_date
    and (cu.produit_id = p.id or cu.produit_id is null)
  order by cu.composante, (cu.produit_id is not null) desc, cu.date_effet desc
) c
where p.actif;

-- Marge théorique, par canal : le comptant ne paie aucun frais Stripe.
create or replace view v_marge_unitaire_reference with (security_invoker = true) as
with taux_qc as (
  select coalesce(sum(taux), 0) as somme
  from taxes_applicables((select province_etablissement from parametres), current_date)
),
couts as (
  select produit_id,
         coalesce(sum(montant_ht) filter (where composante = 'carte_vierge'), 0) as cout_carte,
         coalesce(sum(montant_ht) filter (where composante = 'impression'),   0) as cout_impression,
         coalesce(sum(montant_ht) filter (where composante = 'expedition'),   0) as cout_expedition,
         coalesce(sum(montant_ht) filter (where composante = 'emballage'),    0) as cout_emballage,
         coalesce(sum(montant_ht) filter (where composante = 'autre'),        0) as cout_autre
  from v_couts_unitaires_courants group by produit_id
),
canaux as (select unnest(array['stripe', 'comptant']::canal_vente[]) as canal),
calcul as (
  select p.id as produit_id, p.sku, p.nom, x.canal, p.prix_vente_ht,
         c.cout_carte, c.cout_impression, c.cout_expedition, c.cout_emballage, c.cout_autre,
         case when x.canal = 'stripe' then
           round(case when par.frais_stripe_taxables
                      then (p.prix_vente_ht * (1 + tq.somme) * par.frais_stripe_pct
                            + par.frais_stripe_fixe) / (1 + tq.somme)
                      else  p.prix_vente_ht * (1 + tq.somme) * par.frais_stripe_pct
                            + par.frais_stripe_fixe end, 2)
         else 0 end as frais_transaction
  from produits p
  join couts c on c.produit_id = p.id
  cross join canaux x cross join taux_qc tq cross join parametres par
  where p.actif and p.est_carte
)
select calcul.*,
       cout_carte + cout_impression + cout_expedition + cout_emballage
         + cout_autre + frais_transaction as cout_unitaire_total,
       prix_vente_ht - (cout_carte + cout_impression + cout_expedition
         + cout_emballage + cout_autre + frais_transaction) as marge_unitaire
from calcul;

-- Marge réellement constatée sur une FENÊTRE GLISSANTE (90 jours par défaut) :
-- les coûts d'il y a un an ne doivent pas polluer la marge d'aujourd'hui.
create or replace view v_marge_unitaire_reelle with (security_invoker = true) as
with fenetre as (
  select (current_date - make_interval(days => jours_fenetre_marge))::date as debut,
         jours_fenetre_marge as jours
  from parametres
),
ventes_cartes as (
  select v.canal,
         count(distinct v.id) as nb_ventes,
         sum(l.quantite)      as cartes,
         sum(l.montant_ht)    as revenus_ht
  from ventes v
  join vente_lignes l on l.vente_id = v.id
  left join produits p on p.id = l.produit_id
  cross join fenetre f
  where v.statut <> 'annulee' and v.date >= f.debut and coalesce(p.est_carte, true)
  group by v.canal
),
total_cartes as (select coalesce(sum(cartes), 0) as cartes from ventes_cartes),
cogs as (
  select coalesce(sum(t.cout_reel), 0) as montant
  from transactions t cross join fenetre f
  where t.categorie = 'cout_marchandises_vendues' and t.date >= f.debut
),
autres_couts as (
  select coalesce(sum(t.cout_reel), 0) as montant
  from transactions t cross join fenetre f
  where t.type = 'depense' and t.nature = 'variable'
    and t.categorie in ('impression', 'expedition', 'emballage')
    and t.date >= f.debut
),
frais_par_canal as (
  select coalesce(v.canal, 'stripe'::canal_vente) as canal,
         coalesce(sum(t.cout_reel), 0) as frais
  from transactions t
  left join ventes v on v.id = t.vente_id
  cross join fenetre f
  where t.type = 'depense' and t.categorie in ('frais_stripe', 'frais_litige', 'frais_bancaires')
    and t.date >= f.debut
  group by 1
)
select vc.canal, f.jours as fenetre_jours, vc.nb_ventes, vc.cartes, vc.revenus_ht,
       round(vc.revenus_ht / nullif(vc.cartes, 0), 2)              as prix_moyen_ht,
       round(cg.montant / nullif(tc.cartes, 0), 2)                 as cout_carte_moyen,
       round(ac.montant / nullif(tc.cartes, 0), 2)                 as autres_couts_variables,
       round(coalesce(fpc.frais, 0) / nullif(vc.cartes, 0), 2)     as frais_transaction_moyen,
       round(vc.revenus_ht / nullif(vc.cartes, 0)
             - cg.montant / nullif(tc.cartes, 0)
             - ac.montant / nullif(tc.cartes, 0)
             - coalesce(fpc.frais, 0) / nullif(vc.cartes, 0), 2)   as marge_unitaire
from ventes_cartes vc
cross join fenetre f cross join total_cartes tc cross join cogs cg cross join autres_couts ac
left join frais_par_canal fpc on fpc.canal = vc.canal;

-- ---------------------------------------------------------------------------
-- ÉCRAN 3 — Seuil de rentabilité
-- Les DEUX marges sont toujours exposées côte à côte, avec le volume sur
-- lequel la marge réelle est calculée. Aucune bascule silencieuse : le chiffre
-- ne doit jamais changer de sens sans que ce soit visible à l'écran.
-- ---------------------------------------------------------------------------
create or replace view v_seuil_rentabilite with (security_invoker = true) as
with fixes as (
  select coalesce(round(avg(r.couts_fixes), 2), 0) as couts_fixes_mensuels,
         p.mois_lissage_couts_fixes as mois_lisses
  from parametres p
  left join v_resultats_mensuels r
    on r.mois >= (date_trunc('month', current_date::timestamp)
                  - make_interval(months => p.mois_lissage_couts_fixes))::date
   and r.mois < date_trunc('month', current_date::timestamp)::date
  group by p.mois_lissage_couts_fixes
),
reelle as (
  select case when sum(cartes) > 0
              then round(sum(marge_unitaire * cartes) / sum(cartes), 2) end as marge,
         coalesce(sum(cartes), 0)    as cartes,
         coalesce(sum(nb_ventes), 0) as nb_ventes,
         max(fenetre_jours)          as fenetre_jours
  from v_marge_unitaire_reelle
),
reference as (select round(avg(marge_unitaire), 2) as marge from v_marge_unitaire_reference),
courant as (
  select coalesce(sum(cartes_vendues), 0) as cartes_mois_courant
  from v_ventes_mensuelles
  where mois = date_trunc('month', current_date::timestamp)::date
)
select f.couts_fixes_mensuels,
       f.mois_lisses,
       round(f.couts_fixes_mensuels * 12, 2) as couts_fixes_annualises,

       -- Scénario « marge observée »
       r.marge         as marge_unitaire_reelle,
       r.cartes        as cartes_observees,
       r.nb_ventes     as ventes_observees,
       r.fenetre_jours as fenetre_jours,
       case when r.marge > 0
            then ceil(f.couts_fixes_mensuels / r.marge)::integer end
         as cartes_par_mois_marge_reelle,

       -- Scénario « coûts de référence »
       ref.marge as marge_unitaire_reference,
       case when ref.marge > 0
            then ceil(f.couts_fixes_mensuels / ref.marge)::integer end
         as cartes_par_mois_marge_reference,

       c.cartes_mois_courant
from fixes f cross join reelle r cross join reference ref cross join courant c;

-- ---------------------------------------------------------------------------
-- ÉCRAN 4 — Taxes, ventilées par juridiction
-- ---------------------------------------------------------------------------
create or replace view v_taxes_mensuelles with (security_invoker = true) as
select date_trunc('month', t.date::timestamp)::date as mois,
       l.autorite, l.code,
       coalesce(sum(l.montant) filter (where t.type = 'revenu'), 0)             as taxes_percues,
       coalesce(sum(l.montant_recuperable) filter (where t.type = 'depense'), 0) as credits,
       coalesce(sum(l.montant) filter (where t.type = 'revenu'), 0)
       - coalesce(sum(l.montant_recuperable) filter (where t.type = 'depense'), 0) as net_a_remettre
from lignes_taxe l
join transactions t on t.id = l.transaction_id
group by 1, 2, 3;

create or replace view v_ventes_par_province with (security_invoker = true) as
select v.province,
       count(distinct v.id) as nb_ventes,
       coalesce(sum(l.quantite), 0)   as cartes,
       coalesce(sum(l.montant_ht), 0) as revenus_ht
from ventes v
join vente_lignes l on l.vente_id = v.id
where v.statut <> 'annulee'
group by v.province;

-- ---------------------------------------------------------------------------
-- Caisse et stock
-- ---------------------------------------------------------------------------
create or replace view v_solde_caisse with (security_invoker = true) as
select coalesce(sum(montant), 0) as solde,
       coalesce(sum(montant) filter (where type = 'encaissement_vente'), 0) as encaissements,
       coalesce(sum(-montant) filter (where type = 'depot_bancaire'), 0)    as depots,
       max(date) filter (where type = 'depot_bancaire')                     as dernier_depot
from mouvements_caisse;

create or replace view v_stock with (security_invoker = true) as
select p.id as produit_id, p.sku, p.nom,
       coalesce(sum(m.quantite), 0) as quantite_en_stock,
       cout_moyen(p.id) as cout_moyen,
       round(coalesce(sum(m.quantite), 0) * cout_moyen(p.id), 2) as valeur_stock
from produits p
left join inventaire_mouvements m on m.produit_id = p.id
where p.actif and p.suivi_stock
group by p.id, p.sku, p.nom;

comment on view v_stock is
  'Stock détenu, valorisé au coût moyen. C''est l''actif que le dénombrement vient vérifier.';

-- ---------------------------------------------------------------------------
-- MODULE 2 — Associés
-- ---------------------------------------------------------------------------
create or replace view v_capital_associes with (security_invoker = true) as
with profit_ouvert as (
  select coalesce(sum(case when t.type = 'revenu' then t.montant_ht else -t.cout_reel end), 0) as profit
  from transactions t
  join exercices e on e.annee = t.annee and e.statut = 'ouvert'
  where not t.est_stock
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
select a.id as associe_id, a.nom, a.part,
       coalesce(m.apports, 0)           as apports,
       coalesce(m.prelevements, 0)      as prelevements,
       coalesce(m.profits_attribues, 0) as profits_attribues,
       round(a.part * po.profit, 2)     as part_profit_exercice_courant,
       coalesce(m.capital_mouvements, 0) + round(a.part * po.profit, 2) as solde_capital,
       coalesce(m.compte_courant, 0)    as solde_compte_courant,
       coalesce(m.capital_mouvements, 0) + round(a.part * po.profit, 2)
         + coalesce(m.compte_courant, 0) as total_du_a_lassocie
from associes a
cross join profit_ouvert po
left join mvt m on m.associe_id = a.id
where a.actif
order by a.ordre;

create or replace view v_prelevements_exercice with (security_invoker = true) as
with base as (
  select e.annee, a.id as associe_id, a.nom,
         coalesce(sum(m.montant) filter (where m.type = 'prelevement'), 0) as prelevements,
         count(m.id) filter (where m.type = 'prelevement')                 as nb_prelevements,
         max(m.date) filter (where m.type = 'prelevement')                 as dernier_prelevement
  from exercices e
  cross join associes a
  left join mouvements_associes m on m.associe_id = a.id and m.annee = e.annee
  where a.actif
  group by e.annee, a.id, a.nom
)
select b.*,
       max(b.prelevements) over (partition by b.annee) as prelevement_le_plus_eleve,
       max(b.prelevements) over (partition by b.annee) - b.prelevements as ecart,
       (max(b.prelevements) over (partition by b.annee) - b.prelevements)
         > (select seuil_alerte_prelevement from parametres) as alerte_desequilibre
from base b;

create or replace view v_decisions with (security_invoker = true) as
select d.id, d.numero, d.date, d.titre, d.description, d.decision,
       d.categorie, d.notes, d.piece_jointe_url, d.cree_le,
       count(ap.*)                            as nb_associes,
       count(*) filter (where ap.approuve)    as nb_approbations,
       coalesce(bool_and(ap.approuve), false) as est_unanime,
       case when coalesce(bool_and(ap.approuve), false) then 'unanime'
            when count(*) filter (where ap.approuve) > 0 then 'partielle'
            else 'en_attente' end             as statut_approbation,
       max(ap.date_approbation)               as date_unanimite
from decisions d
left join decisions_approbations ap on ap.decision_id = d.id
group by d.id;

-- Rétrofacturations. Deux montants distincts, souvent confondus :
--   perte_encaissement : l'argent réellement repris du compte (TTC + frais) ;
--   impact_resultat    : ce que le résultat encaisse (revenu HT perdu + frais
--                        HT + coût des cartes déjà expédiées). Les taxes
--                        reprises ne sont pas une perte : elles ne seront
--                        simplement plus à remettre.
create or replace view v_litiges with (security_invoker = true) as
select l.id, l.date_ouverture, l.date_cloture, l.statut, l.motif,
       v.numero as vente_numero, v.client_nom,
       l.montant_conteste, l.frais,
       case when l.statut = 'gagne' then l.frais
            else l.montant_conteste + l.frais end as perte_encaissement,
       coalesce(abs(tr.montant_ht), 0) * (case when l.statut = 'gagne' then 0 else 1 end)
         + coalesce(tf.cout_reel, 0)
         + coalesce(tc.cout_reel, 0) * (case when l.statut = 'gagne' then 0 else 1 end)
         as impact_resultat
from litiges l
left join ventes v on v.id = l.vente_id
left join transactions tr on tr.id = l.transaction_reprise_id
left join transactions tf on tf.id = l.transaction_frais_id
left join transactions tc on tc.vente_id = l.vente_id
                         and tc.categorie = 'cout_marchandises_vendues';
