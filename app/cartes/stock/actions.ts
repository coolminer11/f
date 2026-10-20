'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { exigerEcriture } from '@/lib/auth'
import { changerSeuil, convertirEnReception, modifierReception, recevoirCartes } from '@/lib/stock'
import { supprimerTransaction } from '@/lib/requetes/transactions'
import { televerserRecu } from '@/lib/stockage'

const ICI = '/cartes/stock'
const aller = (cle: 'message' | 'erreur', texte: string): never => redirect(`${ICI}?${cle}=${encodeURIComponent(texte)}`)
const erreur = (e: unknown) => (e instanceof Error ? e.message : 'Opération impossible.').replace(/^error:\s*/i, '')
const MODES = new Set(['comptant', 'carte_credit', 'carte_debit', 'interac', 'virement', 'cheque', 'stripe', 'autre'])

/** « 357,95 » ou « 357.95 » → 357.95 ; refus si ce n'est pas un montant. */
function montant(brut: FormDataEntryValue | null): number | null {
  const v = String(brut ?? '').trim().replace(/\s/g, '').replace(',', '.').replace(/\$$/, '')
  return /^\d{1,7}(\.\d{1,2})?$/.test(v) ? Number(v) : null
}
function entier(brut: FormDataEntryValue | null): number | null {
  const v = String(brut ?? '').trim()
  return /^\d{1,6}$/.test(v) && Number(v) > 0 ? Number(v) : null
}

/** Réception de cartes : le nombre reçu et le total payé, le reste est automatique. */
export async function recevoirAction(donnees: FormData): Promise<void> {
  await exigerEcriture()
  const date = String(donnees.get('date') ?? '')
  const quantite = entier(donnees.get('quantite'))
  const total = montant(donnees.get('total'))
  const taxes = montant(donnees.get('taxes')) ?? 0
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) aller('erreur', 'Choisissez la date de réception.')
  if (!quantite) aller('erreur', 'Le nombre de cartes reçues : un nombre entier plus grand que zéro.')
  if (!total) aller('erreur', 'Le montant total payé : un montant comme 357,95.')
  const mode = String(donnees.get('mode_paiement') ?? 'autre')
  let piece: string | null = null
  const f = donnees.get('recu')
  if (f instanceof File && f.size > 0) {
    if (f.size > 10 * 1024 * 1024) aller('erreur', 'Reçu trop volumineux (10 Mo maximum).')
    try {
      piece = await televerserRecu(f)
    } catch (e) {
      aller('erreur', erreur(e))
    }
  }
  try {
    await recevoirCartes({
      produitId: String(donnees.get('produit_id') ?? '') || null,
      date,
      quantite: quantite!,
      total: total!,
      taxes,
      description: String(donnees.get('description') ?? '').trim().slice(0, 200) || null,
      modePaiement: MODES.has(mode) ? mode : 'autre',
      pieceJointe: piece,
    })
  } catch (e) {
    aller('erreur', erreur(e))
  }
  revalidatePath('/', 'layout')
  aller('message', `${quantite} cartes ajoutées au stock, à ${(Math.round((total! - taxes) / quantite! * 100) / 100).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $ la carte.`)
}

/** Une dépense déjà inscrite était un achat de cartes. */
export async function convertirAction(donnees: FormData): Promise<void> {
  await exigerEcriture()
  const quantite = entier(donnees.get('quantite'))
  const cartes = montant(donnees.get('montant_cartes'))
  if (!quantite) aller('erreur', 'Le nombre de cartes reçues : un nombre entier plus grand que zéro.')
  if (!cartes) aller('erreur', 'La part « cartes » du montant : un montant comme 357,95.')
  try {
    await convertirEnReception(String(donnees.get('id') ?? ''), quantite!, cartes!, String(donnees.get('produit_id') ?? '') || null)
  } catch (e) {
    aller('erreur', erreur(e))
  }
  revalidatePath('/', 'layout')
  aller('message', `Dépense convertie : ${quantite} cartes au stock. Le coût des ventes est recalculé.`)
}

export async function modifierAction(donnees: FormData): Promise<void> {
  await exigerEcriture()
  const quantite = entier(donnees.get('quantite'))
  const total = montant(donnees.get('total'))
  const cartes = montant(donnees.get('montant_cartes'))
  if (!quantite || !total || !cartes) aller('erreur', 'Vérifiez le nombre de cartes et les montants.')
  try {
    await modifierReception(String(donnees.get('id') ?? ''), quantite!, total!, cartes!)
  } catch (e) {
    aller('erreur', erreur(e))
  }
  revalidatePath('/', 'layout')
  aller('message', 'Réception corrigée. Le coût des ventes est recalculé.')
}

export async function supprimerAction(donnees: FormData): Promise<void> {
  const moi = await exigerEcriture()
  try {
    await supprimerTransaction(String(donnees.get('id') ?? ''), 'Réception de cartes supprimée', moi.courriel)
  } catch (e) {
    aller('erreur', erreur(e))
  }
  revalidatePath('/', 'layout')
  aller('message', 'Réception supprimée. Le stock et le coût des ventes sont recalculés.')
}

export async function seuilAction(donnees: FormData): Promise<void> {
  await exigerEcriture()
  const v = String(donnees.get('seuil') ?? '').trim()
  if (v !== '' && !/^\d{1,5}$/.test(v)) aller('erreur', 'Le seuil : un nombre entier (vide = pas d’alerte).')
  try {
    await changerSeuil(String(donnees.get('produit_id') ?? ''), v === '' ? null : Number(v))
  } catch (e) {
    aller('erreur', erreur(e))
  }
  revalidatePath('/', 'layout')
  aller('message', v === '' ? 'Alerte retirée pour ce modèle.' : `Alerte quand il reste moins de ${v} cartes.`)
}
