'use server'

import { contexteRequete } from '@/lib/securite'
import { estLangue } from '@/lib/services/langues'
import { CODE_EMPLACEMENT } from '@/lib/services/donnees'
import { annulerParClient, creerDemande, enregistrerRetour, retourVersGoogle, type ResultatDemande } from '@/lib/services/demandes'
import { ajouterCommentaire } from '@/lib/services/client'

/**
 * Ce que le client déclenche depuis sa table ou sa chambre. Tout arrive du
 * navigateur : chaque valeur est vérifiée ici (forme du code, de l'id, de la
 * langue, longueur des textes) avant de toucher la base.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const codeValide = (c: unknown): c is string => typeof c === 'string' && CODE_EMPLACEMENT.test(c.toUpperCase())
const langueValide = (l: unknown) => (estLangue(l) ? l : 'fr')

export async function demander(code: string, cle: string, note: string | null, langue: string): Promise<ResultatDemande> {
  if (!codeValide(code) || typeof cle !== 'string' || !/^[a-z0-9_-]{1,40}$/i.test(cle)) return { etat: 'invalide' }
  const texte = typeof note === 'string' ? note.slice(0, 500) : null
  try {
    return await creerDemande(code, cle, texte, langueValide(langue), await contexteRequete())
  } catch {
    return { etat: 'invalide' }
  }
}

export async function annulerDemande(code: string, id: string): Promise<boolean> {
  if (!codeValide(code) || typeof id !== 'string' || !UUID.test(id)) return false
  return annulerParClient(code, id).catch(() => false)
}

/** La note (1 à 5), enregistrée tout de suite ; le commentaire viendra après, s'il y en a un. */
export async function noter(code: string, demandeId: string | null, note: number, langue: string): Promise<{ id: string } | null> {
  if (!codeValide(code) || !Number.isInteger(note) || note < 1 || note > 5) return null
  const demande = typeof demandeId === 'string' && UUID.test(demandeId) ? demandeId : null
  try {
    const r = await enregistrerRetour(code, { demandeId: demande, note, commentaire: null, langue: langueValide(langue) }, await contexteRequete())
    return r ? { id: r.id } : null
  } catch {
    return null
  }
}

export async function commenter(code: string, retourId: string, commentaire: string): Promise<boolean> {
  if (!codeValide(code) || typeof retourId !== 'string' || !UUID.test(retourId) || typeof commentaire !== 'string') return false
  return ajouterCommentaire(code, retourId, commentaire.slice(0, 1000)).catch(() => false)
}

/** Le client part laisser un avis Google : on le note (le lien lui-même s'ouvre sans attendre). */
export async function versGoogle(code: string, retourId: string | null, langue: string): Promise<void> {
  if (!codeValide(code)) return
  await retourVersGoogle(code, typeof retourId === 'string' && UUID.test(retourId) ? retourId : null, langueValide(langue)).catch(() => null)
}
