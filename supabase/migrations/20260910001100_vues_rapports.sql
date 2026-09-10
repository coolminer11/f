-- ============================================================================
-- Tapora S.E.N.C. — 11 · Vues de rapport (alimentent les 5 écrans)
-- ============================================================================
-- Toutes les vues sont en `security_invoker` : elles n'échappent pas au RLS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 11.0 Journal enrichi
-- ---------------------------------------------------------------------------
create or replace view v_journal with (security_invoker = true) as
select t.id, t.date, date_trunc('month', t.date::timestamp)::date as mois,
       t.description, t.montant_ht, t.tps, t.tvq, t.montant_ttc,
       t.type, t.categorie, d.libelle as categorie_libelle, t.nature,
       t.source, t.mode_paiement, t.cti, t.rti,
       t.piece_jointe_url, t.vente_id, t.est_remboursement, t.note
from transactions t
join categories_defauts d on d.categorie = t.categorie;

-- ---------------------------------------------------------------------------
-- 11.1 ÉCRAN 1 — État des résultats mensuel + comparaison mois précédent
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
serie as (
  select generate_series(d1, d2, interval '1 month')::date as mois from bornes
),
agg as (
  select date_trunc('month', date::timestamp)::date as mois,
         sum(montant_ht) filter (where type = 'revenu')                          as revenus_ht,
         sum(montant_ht) filter (where type = 'depense' and nature = 'variable')  as couts_variables,
         sum(montant_ht) filter (where type = 'depense' and nature = 'fixe')      as couts_fixes,
         sum(tps) filter (where type = 'revenu')                                  as tps_percue,
         sum(tvq) filter (where type = 'revenu')                                  as tvq_percue,
         sum(cti)                                                                 as cti,
         sum(rti)                                                                 as rti
  from transactions
  group by 1
),
cartes as (
  select mois, sum(cartes_vendues) as cartes_vendues, sum(nb_ventes) as nb_ventes
  from v_ventes_mensuelles group by mois
),
base as (
  select s.mois,
         coalesce(a.revenus_ht, 0)      as revenus_ht,
         coalesce(a.couts_variables, 0) as couts_variables,
         coalesce(a.couts_fixes, 0)     as couts_fixes,
         coalesce(a.revenus_ht, 0) - coalesce(a.couts_variables, 0) as marge_brute,
         coalesce(a.revenus_ht, 0) - coalesce(a.couts_variables, 0)
           - coalesce(a.couts_fixes, 0) as profit_net,
         coalesce(a.tps_percue, 0) as tps_percue,
         coalesce(a.tvq_percue, 0) as tvq_percue,
         coalesce(a.cti, 0) as cti,
         coalesce(a.rti, 0) as rti,
         coalesce(c.cartes_vendues, 0) as cartes_vendues,
         coalesce(c.nb_ventes, 0) as nb_ventes
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
       sum(t.cti + t.rti) as taxes_recuperables
from transactions t
join categories_defauts d on d.categorie = t.categorie
where t.type = 'depense'
group by 1, 2, 3, 4;

-- ---------------------------------------------------------------------------
-- 11.2 ÉCRAN 2 — Marge unitaire
-- ---------------------------------------------------------------------------

-- Coût courant par composante : le coût propre au produit prime sur le coût global.
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

-- Marge théorique, déclinée par canal : le comptant ne paie aucun frais Stripe,
-- c'est précisément l'intérêt de vendre la carte en main propre.
create or replace view v_marge_unitaire_reference with (security_invoker = true) as
with taux as (select taux_tps, taux_tvq from taux_en_vigueur(current_date)),
couts as (
  select produit_id,
         coalesce(sum(montant_ht) filter (where composante = 'carte_vierge'), 0) as cout_carte,
         coalesce(sum(montant_ht) filter (where composante = 'impression'),   0) as cout_impression,
         coalesce(sum(montant_ht) filter (where composante = 'expedition'),   0) as cout_expedition,
         coalesce(sum(montant_ht) filter (where composante = 'emballage'),    0) as cout_emballage,
         coalesce(sum(montant_ht) filter (where composante = 'autre'),        0) as cout_autre
  from v_couts_unitaires_courants group by produit_id
),
canaux as (select unnest(array['stripe', 'comptant']::canal_vente[]) as canal)
select p.id as produit_id, p.sku, p.nom, x.canal,
       p.prix_vente_ht,
       c.cout_carte, c.cout_impression, c.cout_expedition, c.cout_emballage, c.cout_autre,
       case when x.canal = 'stripe' then
         round(
           case when par.frais_stripe_taxables
                then (p.prix_vente_ht * (1 + tx.taux_tps + tx.taux_tvq) * par.frais_stripe_pct
                      + par.frais_stripe_fixe) / (1 + tx.taux_tps + tx.taux_tvq)
                else  p.prix_vente_ht * (1 + tx.taux_tps + tx.taux_tvq) * par.frais_stripe_pct
                      + par.frais_stripe_fixe
           end, 2)
       else 0 end as frais_transaction,
       p.prix_vente_ht
         - (c.cout_carte + c.cout_impression + c.cout_expedition + c.cout_emballage + c.cout_autre)
         - case when x.canal = 'stripe' then
             round(case when par.frais_stripe_taxables
                        then (p.prix_vente_ht * (1 + tx.taux_tps + tx.taux_tvq) * par.frais_stripe_pct
                              + par.frais_stripe_fixe) / (1 + tx.taux_tps + tx.taux_tvq)
                        else  p.prix_vente_ht * (1 + tx.taux_tps + tx.taux_tvq) * par.frais_stripe_pct
                              + par.frais_stripe_fixe
                   end, 2)
           else 0 end as marge_unitaire
from produits p
join couts c on c.produit_id = p.id
cross join canaux x
cross join taux tx
cross join parametres par
where p.actif and p.est_carte;

-- Marge réellement constatée sur les 12 derniers mois.
--
-- Piège évité ici : diviser les achats de la période par les cartes vendues.
-- Acheter 200 cartes vierges et en vendre 4 donnerait un « coût réel » de
-- 130 $ la carte, ce qui est faux. Le coût de la carte vierge vient donc du
-- coût moyen d'ACHAT en stock (le lot est consommé sur plusieurs mois), tandis
-- que l'impression, l'expédition et l'emballage, eux réellement engagés à
-- chaque vente, sont répartis sur les cartes vendues.
create or replace view v_marge_unitaire_reelle with (security_invoker = true) as
with periode as (select (current_date - interval '12 months')::date as debut),
ventes_cartes as (
  select v.canal,
         sum(l.quantite)   as cartes,
         sum(l.montant_ht) as revenus_ht
  from ventes v
  join vente_lignes l on l.vente_id = v.id
  left join produits p on p.id = l.produit_id
  cross join periode pe
  where v.statut <> 'annulee' and v.date >= pe.debut and coalesce(p.est_carte, true)
  group by v.canal
),
total_cartes as (select coalesce(sum(cartes), 0) as cartes from ventes_cartes),
cout_carte as (
  -- Coût moyen d'acquisition d'une carte vierge, tiré des entrées en stock.
  -- À défaut d'historique d'achat, on retombe sur le coût de référence.
  select coalesce(
           (select sum(m.quantite * m.cout_unitaire) filter (where m.type = 'achat')
                 / nullif(sum(m.quantite) filter (where m.type = 'achat'), 0)
            from inventaire_mouvements m),
           (select avg(montant_ht) from v_couts_unitaires_courants
             where composante = 'carte_vierge'),
           0)::numeric as montant
),
autres_couts as (
  -- Coûts variables engagés à la vente : répartis sur les cartes vendues.
  select coalesce(sum(t.montant_ht), 0) as montant
  from transactions t cross join periode pe
  where t.type = 'depense' and t.nature = 'variable'
    and t.categorie in ('impression', 'expedition', 'emballage')
    and t.date >= pe.debut
),
frais_par_canal as (
  -- Frais de transaction réels, rattachés au canal de la vente qui les a générés.
  select coalesce(v.canal, 'stripe'::canal_vente) as canal,
         coalesce(sum(t.montant_ht), 0) as frais
  from transactions t
  left join ventes v on v.id = t.vente_id
  cross join periode pe
  where t.type = 'depense' and t.categorie in ('frais_stripe', 'frais_bancaires')
    and t.date >= pe.debut
  group by 1
)
select vc.canal,
       vc.cartes,
       vc.revenus_ht,
       round(vc.revenus_ht / nullif(vc.cartes, 0), 2)        as prix_moyen_ht,
       round(cc.montant, 2)                                  as cout_carte_moyen,
       round(ac.montant / nullif(tc.cartes, 0), 2)           as autres_couts_variables,
       round(coalesce(fc.frais, 0) / nullif(vc.cartes, 0), 2) as frais_transaction_moyen,
       round(cc.montant + ac.montant / nullif(tc.cartes, 0)
             + coalesce(fc.frais, 0) / nullif(vc.cartes, 0), 2) as cout_unitaire_total,
       round(vc.revenus_ht / nullif(vc.cartes, 0)
             - cc.montant
             - ac.montant / nullif(tc.cartes, 0)
             - coalesce(fc.frais, 0) / nullif(vc.cartes, 0), 2) as marge_unitaire
from ventes_cartes vc
cross join total_cartes tc
cross join cout_carte cc
cross join autres_couts ac
left join frais_par_canal fc on fc.canal = vc.canal;

-- Marge unitaire moyenne servant de base au seuil de rentabilité.
-- La marge réelle ne prend le dessus qu'une fois qu'elle est significative
-- (au moins 10 cartes vendues et une marge positive) ; avant cela, les frais
-- de démarrage la rendraient absurde et on s'appuie sur les coûts de référence.
create or replace view v_marge_unitaire_moyenne with (security_invoker = true) as
with reelle as (
  select case when sum(cartes) > 0
              then round(sum(marge_unitaire * cartes) / sum(cartes), 2) end as marge,
         coalesce(sum(cartes), 0) as cartes
  from v_marge_unitaire_reelle
),
reference as (select round(avg(marge_unitaire), 2) as marge from v_marge_unitaire_reference)
select case when r.cartes >= 10 and coalesce(r.marge, 0) > 0 then r.marge else ref.marge end
         as marge_unitaire,
       r.marge  as marge_unitaire_reelle,
       ref.marge as marge_unitaire_reference,
       r.cartes as cartes_reference,
       case when r.cartes >= 10 and coalesce(r.marge, 0) > 0
            then 'réelle (12 derniers mois)'
            else 'théorique (coûts de référence)' end as base_de_calcul
from reelle r cross join reference ref;

-- ---------------------------------------------------------------------------
-- 11.3 ÉCRAN 3 — Seuil de rentabilité
-- ---------------------------------------------------------------------------
create or replace view v_seuil_rentabilite with (security_invoker = true) as
with fixes as (
  select coalesce(round(avg(r.couts_fixes), 2), 0) as couts_fixes_mensuels
  from v_resultats_mensuels r, parametres p
  where r.mois >= (date_trunc('month', current_date::timestamp)
                   - make_interval(months => p.mois_lissage_couts_fixes))::date
    and r.mois < date_trunc('month', current_date::timestamp)::date
),
marge as (select * from v_marge_unitaire_moyenne),
reel as (
  select coalesce(sum(cartes_vendues), 0) as cartes_mois_courant
  from v_ventes_mensuelles
  where mois = date_trunc('month', current_date::timestamp)::date
)
select f.couts_fixes_mensuels,
       m.marge_unitaire,
       m.base_de_calcul,
       case when m.marge_unitaire > 0
            then ceil(f.couts_fixes_mensuels / m.marge_unitaire)::integer end as cartes_par_mois,
       case when m.marge_unitaire > 0
            then ceil(f.couts_fixes_mensuels / m.marge_unitaire / 21.7)::integer end as cartes_par_jour_ouvrable,
       r.cartes_mois_courant,
       case when m.marge_unitaire > 0
            then greatest(ceil(f.couts_fixes_mensuels / m.marge_unitaire)::integer
                          - r.cartes_mois_courant, 0) end as cartes_restantes_ce_mois,
       round(f.couts_fixes_mensuels * 12, 2) as couts_fixes_annualises
from fixes f cross join marge m cross join reel r;

-- ---------------------------------------------------------------------------
-- 11.4 ÉCRAN 4 — TPS/TVQ : voir la fonction rapport_taxes(debut, fin).
--       Vue de suivi trimestriel prête à l'emploi.
-- ---------------------------------------------------------------------------
create or replace view v_taxes_trimestrielles with (security_invoker = true) as
select date_trunc('quarter', t.date::timestamp)::date as trimestre,
       sum(t.tps) filter (where t.type = 'revenu')  as tps_percue,
       sum(t.tvq) filter (where t.type = 'revenu')  as tvq_percue,
       sum(t.cti) as cti,
       sum(t.rti) as rti,
       sum(t.tps) filter (where t.type = 'revenu') - sum(t.cti) as net_tps,
       sum(t.tvq) filter (where t.type = 'revenu') - sum(t.rti) as net_tvq,
       (sum(t.tps) filter (where t.type = 'revenu') - sum(t.cti))
       + (sum(t.tvq) filter (where t.type = 'revenu') - sum(t.rti)) as net_a_remettre
from transactions t
group by 1;

-- ---------------------------------------------------------------------------
-- 11.5 Caisse et stock (ventes comptant)
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
       round(coalesce(
         sum(m.quantite * m.cout_unitaire) filter (where m.type = 'achat')
         / nullif(sum(m.quantite) filter (where m.type = 'achat'), 0), 0), 4) as cout_moyen
from produits p
left join inventaire_mouvements m on m.produit_id = p.id
where p.actif and p.suivi_stock
group by p.id, p.sku, p.nom;

-- ---------------------------------------------------------------------------
-- 11.6 MODULE 2 — Associés
-- ---------------------------------------------------------------------------
create or replace view v_capital_associes with (security_invoker = true) as
with profit_ouvert as (
  select coalesce(sum(case when t.type = 'revenu' then t.montant_ht else -t.montant_ht end), 0) as profit
  from transactions t
  join exercices e on e.annee = t.annee and e.statut = 'ouvert'
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

comment on view v_prelevements_exercice is
  'Écart de prélèvements par exercice. alerte_desequilibre = un associé a pris nettement plus que l''autre.';

create or replace view v_decisions with (security_invoker = true) as
select d.id, d.numero, d.date, d.titre, d.description, d.decision,
       d.categorie, d.notes, d.piece_jointe_url, d.cree_le,
       count(ap.*)                                as nb_associes,
       count(*) filter (where ap.approuve)        as nb_approbations,
       coalesce(bool_and(ap.approuve), false)     as est_unanime,
       case when coalesce(bool_and(ap.approuve), false) then 'unanime'
            when count(*) filter (where ap.approuve) > 0 then 'partielle'
            else 'en_attente' end                 as statut_approbation,
       max(ap.date_approbation)                   as date_unanimite
from decisions d
left join decisions_approbations ap on ap.decision_id = d.id
group by d.id;
