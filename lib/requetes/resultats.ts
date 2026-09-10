import 'server-only'
import { requete, requeteUne } from '@/lib/db'

export type ResultatMensuel = {
  mois: string
  revenus_ht: number
  cout_marchandises: number
  couts_variables: number
  couts_fixes: number
  frais_transaction: number
  marge_brute: number
  marge_brute_pct: number | null
  profit_net: number
  profit_net_pct: number | null
  cartes_vendues: number
  nb_ventes: number
  revenus_ht_precedent: number | null
  couts_variables_precedent: number | null
  couts_fixes_precedent: number | null
  marge_brute_precedent: number | null
  profit_net_precedent: number | null
  variation_revenus: number | null
  variation_profit: number | null
  variation_revenus_pct: number | null
  variation_profit_pct: number | null
}

export async function resultatDuMois(mois: string): Promise<ResultatMensuel | null> {
  return requeteUne<ResultatMensuel>(
    `select * from v_resultats_mensuels where mois = $1::date`,
    [mois],
  )
}

export async function moisDisponibles(): Promise<string[]> {
  const lignes = await requete<{ mois: string }>(
    `select mois from v_resultats_mensuels order by mois desc`,
  )
  return lignes.map((l) => l.mois)
}

export type DetailCategorie = {
  categorie: string
  categorie_libelle: string
  nature: 'variable' | 'fixe'
  cout_reel: number
  montant_ht: number
  taxes_recuperables: number
  cout_reel_precedent: number | null
}

/** Dépenses du mois par catégorie, avec le mois précédent en regard. */
export async function depensesParCategorie(mois: string): Promise<DetailCategorie[]> {
  return requete<DetailCategorie>(
    `with courant as (
       select categorie, categorie_libelle, nature, cout_reel, montant_ht, taxes_recuperables
         from v_depenses_par_categorie_mensuelles where mois = $1::date
     ),
     precedent as (
       select categorie, cout_reel
         from v_depenses_par_categorie_mensuelles
        where mois = ($1::date - interval '1 month')::date
     )
     select coalesce(c.categorie, p.categorie)                    as categorie,
            coalesce(c.categorie_libelle, d.libelle)              as categorie_libelle,
            coalesce(c.nature, d.nature_defaut)                   as nature,
            coalesce(c.cout_reel, 0)                              as cout_reel,
            coalesce(c.montant_ht, 0)                             as montant_ht,
            coalesce(c.taxes_recuperables, 0)                     as taxes_recuperables,
            p.cout_reel                                           as cout_reel_precedent
       from courant c
       full join precedent p on p.categorie = c.categorie
       join categories_defauts d on d.categorie = coalesce(c.categorie, p.categorie)
      order by coalesce(c.nature, d.nature_defaut), coalesce(c.cout_reel, 0) desc`,
    [mois],
  )
}

export type RevenuParCanal = {
  canal: string
  nb_ventes: number
  cartes_vendues: number
  revenus_ht: number
}

export async function revenusParCanal(mois: string): Promise<RevenuParCanal[]> {
  return requete<RevenuParCanal>(
    `select canal, nb_ventes, cartes_vendues, revenus_ht
       from v_ventes_mensuelles where mois = $1::date order by revenus_ht desc`,
    [mois],
  )
}

export type PointHistorique = {
  mois: string
  revenus_ht: number
  couts_variables: number
  couts_fixes: number
  profit_net: number
}

/** Douze mois glissants, pour situer le mois affiché dans une tendance. */
export async function historique(mois: string, nbMois = 12): Promise<PointHistorique[]> {
  return requete<PointHistorique>(
    `select mois, revenus_ht, couts_variables, couts_fixes, profit_net
       from v_resultats_mensuels
      where mois <= $1::date
        and mois > ($1::date - make_interval(months => $2::int))
      order by mois`,
    [mois, nbMois],
  )
}

export type SoldeStock = { valeur_stock: number; quantite_en_stock: number }

export async function valeurStock(): Promise<SoldeStock> {
  const ligne = await requeteUne<SoldeStock>(
    `select coalesce(sum(valeur_stock), 0) as valeur_stock,
            coalesce(sum(quantite_en_stock), 0) as quantite_en_stock
       from v_stock`,
  )
  return ligne ?? { valeur_stock: 0, quantite_en_stock: 0 }
}
