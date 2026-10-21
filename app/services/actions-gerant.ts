'use server'

import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import { lireEtablissement } from '@/lib/services/donnees'
import { definirMotDePasseGerant } from '@/lib/services/acces'
import { faiblesse } from '@/lib/mots-de-passe'

/**
 * Le mot de passe du gérant, réglé par le propriétaire (section « Liens et
 * accès » de l'aperçu d'un établissement). Même règle que les autres actions
 * de Tapora Services : `exigerProprietaire()` d'abord, le travail dans un
 * try, la redirection après — avec ?message= / ?erreur= et ?aller=acces
 * (jamais de #ancre : la redirection d'une action ne se terminerait pas).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RETOUR = /^\/services\/[0-9a-f-]{36}(\/[a-z]+)?(\?[A-Za-z0-9_=&%.\-]*)?$/

const champ = (d: FormData, n: string) => {
  const v = d.get(n)
  return typeof v === 'string' ? v.trim() : ''
}

async function agir(d: FormData, travail: (e: { id: string; nom: string }) => Promise<string>): Promise<void> {
  await exigerProprietaire()
  const id = champ(d, 'etab')
  const e = UUID.test(id) ? await lireEtablissement(id) : null
  if (!e) notFound()
  const r = champ(d, 'retour')
  const [chemin, q = ''] = (RETOUR.test(r) && r.startsWith(`/services/${e.id}`) ? r : `/services/${e.id}`).split('?')
  const sp = new URLSearchParams(q)
  sp.delete('message')
  sp.delete('erreur')
  try {
    sp.set('message', (await travail(e)).slice(0, 300))
  } catch (x) {
    sp.set('erreur', (x instanceof Error ? x.message : 'Action impossible.').slice(0, 300))
  }
  sp.set('aller', 'acces')
  revalidatePath('/services', 'layout')
  redirect(`${chemin}?${sp.toString()}`)
}

export async function motDePasseGerantAction(d: FormData): Promise<void> {
  await agir(d, async (e) => {
    const mdp = champ(d, 'mot_de_passe')
    const refus = mdp.length > 100 ? '100 caractères au plus.' : faiblesse(mdp, [e.nom])
    if (refus) throw new Error(`Mot de passe refusé : ${refus}`)
    await definirMotDePasseGerant(e.id, mdp)
    return 'Mot de passe du gérant enregistré : donnez-le au gérant, il ne sera plus jamais affiché. Les appareils déjà ouverts en mode gérant se referment.'
  })
}

export async function retirerMotDePasseGerantAction(d: FormData): Promise<void> {
  await agir(d, async (e) => {
    await definirMotDePasseGerant(e.id, null)
    return 'Mode gérant retiré : le portail redevient celui du personnel seulement.'
  })
}
