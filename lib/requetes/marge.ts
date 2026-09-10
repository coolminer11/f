import 'server-only'
import { requete, requeteUne } from '@/lib/db'

export type MargeReelle = {
  canal: string
  fenetre_jours: number
  nb_ventes: number
  cartes: number
  revenus_ht: number
  prix_moyen_ht: number | null
  cout_carte_moyen: number | null
  autres_couts_variables: number | null
  frais_transaction_moyen: number | null
  marge_unitaire: number | null
}

export type MargeReference = {
  produit_id: string
  sku: string
  nom: string
  canal: string
  prix_vente_ht: number
  cout_carte: number
  cout_impression: number
  cout_expedition: number
  cout_emballage: number
  cout_autre: number
  frais_transaction: number
  cout_unitaire_total: number
  marge_unitaire: number
}

export type Seuil = {
  couts_fixes_mensuels: number
  mois_lisses: number
  couts_fixes_annualises: number
  marge_unitaire_reelle: number | null
  cartes_observees: number
  ventes_observees: number
  fenetre_jours: number
  cartes_par_mois_marge_reelle: number | null
  marge_unitaire_reference: number | null
  cartes_par_mois_marge_reference: number | null
  cartes_mois_courant: number
}

export async function margeReelle(): Promise<MargeReelle[]> {
  return requete<MargeReelle>(`select * from v_marge_unitaire_reelle order by cartes desc`)
}

export async function margeReference(): Promise<MargeReference[]> {
  return requete<MargeReference>(
    `select * from v_marge_unitaire_reference order by nom, canal`,
  )
}

export async function seuilRentabilite(): Promise<Seuil | null> {
  return requeteUne<Seuil>(`select * from v_seuil_rentabilite`)
}

export type CoutReference = {
  composante: string
  montant_ht: number
  date_effet: string
  produit_id: string | null
}

export async function coutsReference(): Promise<CoutReference[]> {
  return requete<CoutReference>(
    `select distinct on (composante) composante, montant_ht, date_effet, produit_id
       from couts_unitaires
      where produit_id is null and date_effet <= current_date
      order by composante, date_effet desc`,
  )
}

/**
 * Un coût de référence ne s'écrase pas : on ajoute une valeur avec sa date
 * d'effet. Un rapport sur une période passée doit continuer à voir le coût
 * qui avait cours à l'époque.
 */
export async function definirCoutReference(
  composante: string,
  montant: number,
  dateEffet: string,
): Promise<void> {
  await requete(
    `insert into couts_unitaires (produit_id, composante, montant_ht, date_effet)
     values (null, $1, $2::numeric, $3::date)
     on conflict (composante, date_effet) where produit_id is null
     do update set montant_ht = excluded.montant_ht`,
    [composante, montant, dateEffet],
  )
}

export async function definirPrixProduit(produitId: string, prix: number): Promise<void> {
  await requete(`update produits set prix_vente_ht = $2::numeric where id = $1::uuid`, [
    produitId,
    prix,
  ])
}

export type Hypotheses = {
  frais_stripe_pct: number
  frais_stripe_fixe: number
  jours_fenetre_marge: number
  mois_lissage_couts_fixes: number
}

export async function hypotheses(): Promise<Hypotheses> {
  const p = await requeteUne<Hypotheses>(
    `select frais_stripe_pct, frais_stripe_fixe, jours_fenetre_marge, mois_lissage_couts_fixes
       from parametres where id`,
  )
  if (!p) throw new Error('Paramètres absents.')
  return p
}

export async function definirHypotheses(entree: {
  joursFenetre: number
  moisLissage: number
}): Promise<void> {
  await requete(
    `update parametres set jours_fenetre_marge = $1::smallint,
                           mois_lissage_couts_fixes = $2::smallint where id`,
    [entree.joursFenetre, entree.moisLissage],
  )
}

export const COMPOSANTES = [
  ['carte_vierge', 'Carte vierge'],
  ['impression', 'Impression'],
  ['expedition', 'Expédition'],
  ['emballage', 'Emballage'],
] as const
