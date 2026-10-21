'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requete } from '@/lib/db'
import { baseLiens } from '@/lib/securite'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import { lireEtablissement } from '@/lib/services/donnees'
import { envoyerRapportService, moisPrecedentService } from '@/lib/services/rapport'

/**
 * Le rapport mensuel, depuis le back-office du propriétaire : l'envoyer tout
 * de suite (ou le renvoyer), et l'accepter ou le refuser pour un
 * établissement. Retour à la page d'où vient le formulaire, avec un pop-up.
 */
function retour(etab: string, chemin: FormDataEntryValue | null, cle: 'message' | 'erreur', texte: string): never {
  const c = typeof chemin === 'string' && chemin.startsWith(`/services/${etab}`) && !chemin.includes('//') ? chemin.split('?')[0] : `/services/${etab}`
  redirect(`${c}?${new URLSearchParams({ [cle]: texte, aller: 'rapport' }).toString()}`)
}

export async function envoyerRapportAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  const e = await lireEtablissement(String(d.get('etab') ?? ''))
  if (!e) redirect('/services')
  const mois = await moisPrecedentService(e!.options.fuseau)
  const r = await envoyerRapportService(e!.id, mois, await baseLiens(), true)
  revalidatePath(`/services/${e!.id}`, 'layout')
  if (r.statut === 'envoye') retour(e!.id, d.get('retour'), 'message', 'Rapport envoyé au contact de l’établissement.')
  if (r.statut === 'simule') retour(e!.id, d.get('retour'), 'message', 'Rapport simulé : aucune messagerie n’est configurée sur ce serveur.')
  retour(e!.id, d.get('retour'), 'erreur', r.erreur ?? 'Envoi impossible.')
}

export async function rapportMensuelAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  const e = await lireEtablissement(String(d.get('etab') ?? ''))
  if (!e) redirect('/services')
  const oui = d.get('rapport') === 'oui'
  await requete(`update etablissements set rapport_mensuel = $2 where id = $1::uuid`, [e!.id, oui])
  revalidatePath(`/services/${e!.id}`, 'layout')
  retour(e!.id, d.get('retour'), 'message', oui ? 'Le rapport mensuel partira le 1er de chaque mois.' : 'Rapport mensuel désactivé.')
}
