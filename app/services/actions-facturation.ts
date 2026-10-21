'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import { choisirClient, facturerMois, facturerTous, lierClient, MOIS_VALIDE, nomMois } from '@/lib/services/facturation'

/**
 * La facturation des abonnements Tapora Services. Chaque action commence par
 * `exigerProprietaire()` ; le travail se fait dans un try, la redirection
 * (avec ?message= ou ?erreur=, et ?aller= pour revenir à la bonne section)
 * toujours après.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function champ(d: FormData, n: string): string {
  const v = d.get(n)
  return typeof v === 'string' ? v.trim() : ''
}

function raison(x: unknown): string {
  const code = x && typeof x === 'object' && 'code' in x ? (x as { code: unknown }).code : null
  if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return 'La base a refusé cette facture : vérifiez la fiche du client et les paramètres de la société.'
  return x instanceof Error ? x.message : 'Action impossible.'
}

function vers(chemin: string, cle: 'message' | 'erreur', texte: string, aller?: string): string {
  const sp = new URLSearchParams({ [cle]: texte.slice(0, 300) })
  if (aller) sp.set('aller', aller)
  return `${chemin}?${sp.toString()}`
}

function etabDe(d: FormData): string {
  const id = champ(d, 'etab')
  if (!UUID.test(id)) redirect('/services')
  return id
}

export async function facturerMoisAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  const etab = etabDe(d)
  const mois = champ(d, 'mois')
  const page = `/services/${etab}/facturation`
  let issue: string
  let cle: 'message' | 'erreur' = 'message'
  try {
    if (!MOIS_VALIDE.test(mois)) throw new Error('Mois invalide.')
    const f = await facturerMois(etab, mois, champ(d, 'forcer') === '1')
    issue = `Facture ${f.numero} créée pour ${nomMois(mois)}. Elle est dans Factures, avec les autres ventes de la société.`
  } catch (x) {
    cle = 'erreur'
    issue = raison(x)
  }
  revalidatePath('/services', 'layout')
  revalidatePath('/ventes')
  redirect(vers(page, cle, issue, 'historique'))
}

export async function facturerTousAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  const mois = champ(d, 'mois')
  let issue: string
  let cle: 'message' | 'erreur' = 'message'
  try {
    if (!MOIS_VALIDE.test(mois)) throw new Error('Mois invalide.')
    const { crees, erreurs } = await facturerTous(mois)
    if (!crees.length && !erreurs.length) issue = `Rien à facturer : tous les abonnements de ${nomMois(mois)} le sont déjà.`
    else if (!erreurs.length) issue = `${crees.length} facture${crees.length > 1 ? 's' : ''} créée${crees.length > 1 ? 's' : ''} pour ${nomMois(mois)} (${crees.map((c) => c.numero).join(', ')}).`
    else {
      cle = crees.length ? 'message' : 'erreur'
      issue = `${crees.length} facture${crees.length > 1 ? 's' : ''} créée${crees.length > 1 ? 's' : ''}. Attention — pas facturé : ${erreurs.map((e) => `${e.nom} (${e.raison})`).join(' ; ')}`
    }
  } catch (x) {
    cle = 'erreur'
    issue = raison(x)
  }
  revalidatePath('/services', 'layout')
  revalidatePath('/ventes')
  redirect(vers('/services', cle, issue, 'facturation'))
}

export async function lierClientAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  const etab = etabDe(d)
  let issue: string
  let cle: 'message' | 'erreur' = 'message'
  try {
    const c = await lierClient(etab)
    issue = `Fiche client « ${c.nom} » liée : elle servira à chaque facture.`
  } catch (x) {
    cle = 'erreur'
    issue = raison(x)
  }
  revalidatePath(`/services/${etab}`, 'layout')
  redirect(vers(`/services/${etab}/facturation`, cle, issue, 'client'))
}

export async function choisirClientAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  const etab = etabDe(d)
  const client = champ(d, 'client')
  let issue: string
  let cle: 'message' | 'erreur' = 'message'
  try {
    await choisirClient(etab, client || null)
    issue = client ? 'Client facturé changé.' : 'Fiche client déliée : la prochaine facture la retrouvera ou la recréera.'
  } catch (x) {
    cle = 'erreur'
    issue = raison(x)
  }
  revalidatePath(`/services/${etab}`, 'layout')
  redirect(vers(`/services/${etab}/facturation`, cle, issue, 'client'))
}
