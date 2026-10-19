'use server'

import { exigerEcriture } from '@/lib/auth'
import { chercherFiches, type Fiche } from '@/lib/avis-google'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { noterAvis } from '@/lib/avis-manuels'
import { reglerSommeil } from '@/lib/sommeil'

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


const SaisieAvis = z.object({
  type: z.enum(['dossier', 'carte']),
  id: z.string().uuid(),
  nb: z.coerce.number().int('Nombre d’avis entier.').min(0).max(10_000_000),
  // « 4,6 » comme « 4.6 » ; vide = pas de note.
  note: z
    .string()
    .trim()
    .transform((v) => v.replace(',', '.'))
    .refine((v) => v === '' || (/^\d(\.\d)?$/.test(v) && Number(v) >= 1 && Number(v) <= 5), 'La note va de 1,0 à 5,0.')
    .transform((v) => (v === '' ? null : Number(v))),
  retour: z.string().regex(/^\/cartes(\/[\w\-/]*)?$/).catch('/cartes'),
})

/** Avis Google saisis à la main, depuis la liste « à mettre à jour » ou un dossier. */
export async function noterAvisAction(donnees: FormData): Promise<void> {
  await exigerEcriture()
  const analyse = SaisieAvis.safeParse(Object.fromEntries(donnees))
  const retour = SaisieAvis.shape.retour.parse(donnees.get('retour'))
  if (!analyse.success) {
    redirect(`${retour}?erreur=${encodeURIComponent(analyse.error.issues[0].message)}#avis`)
  }
  const v = analyse.data
  await noterAvis({ type: v.type, id: v.id }, v.nb, v.note)
  revalidatePath(retour)
  redirect(`${retour}?message=${encodeURIComponent('Avis enregistrés. Prochaine mise à jour dans 7 jours.')}#avis`)
}

/** « C'est réglé » sur une carte qui dort : elle quitte la liste pour une semaine. */
export async function reglerSommeilAction(donnees: FormData): Promise<void> {
  await exigerEcriture()
  await reglerSommeil(String(donnees.get('id') ?? ''))
  revalidatePath('/cartes')
}
