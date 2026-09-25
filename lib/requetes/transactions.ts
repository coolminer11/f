import 'server-only'
import { requete, requeteUne } from '@/lib/db'

export type LigneTaxe = { code: string; taux: number; montant: number; autorite: string }

export type LigneJournal = {
  id: string
  date: string
  description: string
  montant_ht: number
  total_taxes: number
  montant_ttc: number
  total_taxes_recuperables: number
  cout_reel: number
  type: 'revenu' | 'depense'
  categorie: string
  categorie_libelle: string
  nature: 'variable' | 'fixe' | null
  source: 'stripe' | 'banque' | 'manuel'
  mode_paiement: string
  province: string
  est_stock: boolean
  est_remboursement: boolean
  vente_id: string | null
  piece_jointe_url: string | null
  note: string | null
  taxes: LigneTaxe[] | null
}

export type FiltresJournal = {
  debut?: string
  fin?: string
  type?: string
  categorie?: string
  source?: string
  province?: string
  recherche?: string
  page?: number
}

const PAR_PAGE = 50

export async function listerTransactions(filtres: FiltresJournal) {
  const conditions: string[] = []
  const valeurs: unknown[] = []
  const ajouter = (sql: string, valeur: unknown) => {
    valeurs.push(valeur)
    conditions.push(sql.replace('?', `$${valeurs.length}`))
  }

  if (filtres.debut) ajouter('date >= ?', filtres.debut)
  if (filtres.fin) ajouter('date <= ?', filtres.fin)
  if (filtres.type) ajouter('type = ?::type_transaction', filtres.type)
  if (filtres.categorie) ajouter('categorie = ?::categorie_transaction', filtres.categorie)
  if (filtres.source) ajouter('source = ?::source_transaction', filtres.source)
  if (filtres.province) ajouter('province = ?::province_canada', filtres.province)
  if (filtres.recherche) ajouter('description ilike ?', `%${filtres.recherche}%`)

  const ou = conditions.length ? `where ${conditions.join(' and ')}` : ''
  const page = Math.max(1, filtres.page ?? 1)

  const lignes = await requete<LigneJournal>(
    `select * from v_journal ${ou}
      order by date desc, description
      limit ${PAR_PAGE} offset ${(page - 1) * PAR_PAGE}`,
    valeurs,
  )

  // Les totaux portent sur TOUT le filtre, pas sur la page affichée.
  const totaux = await requeteUne<{
    nb: number
    revenus: number
    depenses: number
    taxes_percues: number
    taxes_recuperables: number
  }>(
    `select count(*)::int as nb,
            coalesce(sum(montant_ht) filter (where type = 'revenu'), 0) as revenus,
            coalesce(sum(cout_reel) filter (where type = 'depense' and not est_stock), 0) as depenses,
            coalesce(sum(total_taxes) filter (where type = 'revenu'), 0) as taxes_percues,
            coalesce(sum(total_taxes_recuperables), 0) as taxes_recuperables
       from v_journal ${ou}`,
    valeurs,
  )

  return { lignes, totaux, page, parPage: PAR_PAGE }
}

export type Categorie = {
  categorie: string
  libelle: string
  type_defaut: 'revenu' | 'depense'
  nature_defaut: 'variable' | 'fixe' | null
  pct_recuperable: number
  saisie_manuelle: boolean
}

export async function listerCategories(): Promise<Categorie[]> {
  return requete<Categorie>(
    `select categorie, libelle, type_defaut, nature_defaut, pct_recuperable, saisie_manuelle
       from categories_defauts where actif order by ordre`,
  )
}

export type ApercuTaxes = { code: string; taux: number; montant: number; autorite: string }

/** Aperçu des taxes qu'une saisie va produire, avant enregistrement. */
export async function apercuTaxes(
  montantHt: number,
  province: string,
  date: string,
): Promise<ApercuTaxes[]> {
  return requete<ApercuTaxes>(
    `select code, taux, montant, autorite
       from calculer_taxes($1::numeric, $2::province_canada, $3::date)`,
    [montantHt, province, date],
  )
}

/** TTC saisi (montant imprimé sur le reçu) -> HT et total des taxes. */
export async function ventilerTtc(
  montantTtc: number,
  province: string,
  date: string,
): Promise<{ montant_ht: number; montant_taxes: number }> {
  const ligne = await requeteUne<{ montant_ht: number; montant_taxes: number }>(
    `select montant_ht, montant_taxes
       from ventiler_ttc($1::numeric, $2::province_canada, $3::date)`,
    [montantTtc, province, date],
  )
  return ligne ?? { montant_ht: montantTtc, montant_taxes: 0 }
}

export async function creerDepense(entree: {
  date: string
  description: string
  montantHt: number
  categorie: string
  province: string
  modePaiement: string
  totalTaxes: number | null
  pieceJointeUrl: string | null
  note: string | null
}): Promise<string> {
  const ligne = await requeteUne<{ id: string }>(
    `select enregistrer_depense(
        $1::date, $2::text, $3::numeric, $4::categorie_transaction,
        $5::province_canada, $6::mode_paiement, null,
        $7::text, $8::numeric, $9::text) as id`,
    [
      entree.date,
      entree.description,
      entree.montantHt,
      entree.categorie,
      entree.province,
      entree.modePaiement,
      entree.pieceJointeUrl,
      entree.totalTaxes,
      entree.note,
    ],
  )
  return ligne!.id
}

export const PROVINCES = [
  ['QC', 'Québec'],
  ['ON', 'Ontario'],
  ['AB', 'Alberta'],
  ['BC', 'Colombie-Britannique'],
  ['MB', 'Manitoba'],
  ['NB', 'Nouveau-Brunswick'],
  ['NL', 'Terre-Neuve-et-Labrador'],
  ['NS', 'Nouvelle-Écosse'],
  ['NT', 'Territoires du Nord-Ouest'],
  ['NU', 'Nunavut'],
  ['PE', 'Île-du-Prince-Édouard'],
  ['SK', 'Saskatchewan'],
  ['YT', 'Yukon'],
] as const

export const MODES_PAIEMENT = [
  ['comptant', 'Argent comptant'],
  ['carte_credit', 'Carte de crédit'],
  ['carte_debit', 'Carte de débit'],
  ['interac', 'Virement Interac'],
  ['virement', 'Virement bancaire'],
  ['cheque', 'Chèque'],
  ['stripe', 'Stripe'],
  ['autre', 'Autre'],
] as const

/** Efface une écriture saisie à la main, et le mouvement de stock qu'elle portait. */
export async function supprimerTransaction(
  id: string,
  motif: string | null,
  par: string | null,
): Promise<void> {
  await requete('select supprimer_transaction($1::uuid, $2, $3)', [id, motif, par])
}
