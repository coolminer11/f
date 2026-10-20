'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { exigerEcriture } from '@/lib/auth'
import { marquerDemande, marquerTraite, repondreClient } from '@/lib/portail'
import { traiterDemande } from '@/lib/requetes/dossiers'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const aller = (ancre: string, cle: 'message' | 'erreur', texte: string): never =>
  redirect(`/messages?${cle}=${encodeURIComponent(texte)}${ancre ? `#${ancre}` : ''}`)
const id = (d: FormData, k: string) => {
  const v = String(d.get(k) ?? '')
  return UUID.test(v) ? v : null
}

/** Répondre au client : la réponse s'affiche sur son portail et part par courriel. */
export async function repondreAction(d: FormData): Promise<void> {
  const moi = await exigerEcriture()
  const dossier = id(d, 'dossier')
  const texte = String(d.get('texte') ?? '').trim()
  if (!dossier) aller('', 'erreur', 'Conversation introuvable.')
  if (!texte || texte.length > 2000) aller(`d-${dossier}`, 'erreur', 'La réponse est vide (ou dépasse 2 000 caractères).')
  const r = await repondreClient(dossier!, texte, moi.id)
  revalidatePath('/', 'layout')
  aller(
    `d-${dossier}`,
    'message',
    r.statut === 'envoye'
      ? `Réponse envoyée : sur son portail et par courriel (${r.courriel}).`
      : r.statut === 'simule'
        ? 'Réponse sur son portail. Courriel simulé : la messagerie n’est pas configurée.'
        : r.statut === 'echec'
          ? 'Réponse sur son portail, mais le courriel n’est pas parti.'
          : 'Réponse sur son portail (pas de courriel connu pour ce client).',
  )
}

export async function regleAction(d: FormData): Promise<void> {
  await exigerEcriture()
  const dossier = id(d, 'dossier')
  if (dossier) await marquerTraite(dossier)
  revalidatePath('/', 'layout')
  aller(dossier ? `d-${dossier}` : '', 'message', 'Conversation marquée comme réglée.')
}

export async function demandeAction(d: FormData): Promise<void> {
  await exigerEcriture()
  const demande = id(d, 'demande')
  if (demande) await marquerDemande(demande, d.get('traitee') === '1')
  revalidatePath('/', 'layout')
  aller(demande ? `demande-${demande}` : '', 'message', d.get('traitee') === '1' ? 'Demande marquée comme traitée.' : 'Demande rouverte.')
}

export async function demandeCartesAction(d: FormData): Promise<void> {
  await exigerEcriture()
  const demande = id(d, 'demande')
  if (demande) await traiterDemande(demande)
  revalidatePath('/', 'layout')
  aller('cartes', 'message', 'Demande de cartes traitée.')
}
