import { releverAvisSiNecessaire } from '@/lib/avis-google'
import { envoyerRapportsDus } from '@/lib/rapports'
import { envoyerAlerteSommeil } from '@/lib/sommeil'

export const dynamic = 'force-dynamic'

/**
 * Point de réveil, public.
 *
 * Sur le forfait gratuit, le serveur s'endort après quinze minutes sans
 * visite et met près d'une minute à se réveiller. Un service de planification
 * (cron-job.org) appelle cette adresse toutes les dix minutes.
 *
 * Le réveil sert aussi d'horloge — l'hébergeur gratuit n'en a pas d'autre :
 * relevé des avis Google (une fois par heure au plus), rapports mensuels
 * (vérifiés toutes les 30 min) et, le lundi, la liste des cartes qui
 * dorment. Tous sont lancés sans être attendus, se limitent eux-mêmes dans
 * le temps, et n'envoient jamais deux fois la même chose : appeler cette
 * adresse mille fois ne fait rien de plus qu'une.
 */
export function GET(requete: Request) {
  const h = requete.headers
  const hote = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto')?.split(',')[0] ?? 'https'
  const base = hote ? `${proto}://${hote}` : new URL(requete.url).origin

  void releverAvisSiNecessaire().catch(() => {})
  void envoyerRapportsDus(base).catch(() => {})
  void envoyerAlerteSommeil(base).catch(() => {})

  return new Response('ok', { headers: { 'cache-control': 'no-store' } })
}
