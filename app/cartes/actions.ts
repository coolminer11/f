'use server'

import { exigerEcriture } from '@/lib/auth'
import { chercherFiches, type Fiche } from '@/lib/avis-google'

/** Recherche de fiche Google depuis le formulaire d'une carte. Réservé aux associés. */
export async function chercherFichesAction(texte: string): Promise<{ fiches: Fiche[]; erreur: string | null }> {
  await exigerEcriture()
  if (typeof texte !== 'string') return { fiches: [], erreur: 'Recherche invalide.' }
  try {
    return { fiches: await chercherFiches(texte), erreur: null }
  } catch (e) {
    return { fiches: [], erreur: e instanceof Error ? e.message : 'Recherche impossible.' }
  }
}
