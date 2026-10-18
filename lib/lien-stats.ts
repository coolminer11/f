import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { requeteUne } from '@/lib/db'
import { baseCartesConfiguree } from '@/lib/cartes-url'

/**
 * Le lien privé des statistiques d'un dossier : /stats/<id>.<signature>.
 *
 * La signature est un HMAC de l'id et de `version_lien`, avec le secret du
 * serveur. Rien n'est stocké : une copie de la base ne donne aucun lien, et
 * incrémenter la version invalide l'ancien lien sur-le-champ. 192 bits de
 * signature : impossible à deviner, même en essayant des milliards de fois.
 */
function signature(dossierId: string, version: number): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 16) throw new Error('SESSION_SECRET est requis.')
  return createHmac('sha256', secret)
    .update(`stats-dossier:${dossierId}:${version}`)
    .digest('base64url')
    .slice(0, 32)
}

export function jetonStats(dossierId: string, version: number): string {
  return `${dossierId}.${signature(dossierId, version)}`
}

const FORME = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{32})$/

/** L'id du dossier si le jeton est valide ET le lien actif ; null sinon. */
export async function dossierDuJeton(jeton: string): Promise<string | null> {
  const m = FORME.exec(jeton)
  if (!m) return null
  const [, id, sig] = m
  const d = await requeteUne<{ version_lien: number; lien_actif: boolean }>(
    `select version_lien, lien_actif from dossiers_cartes where id = $1::uuid`,
    [id],
  )
  if (!d || !d.lien_actif) return null
  const attendue = Buffer.from(signature(id, d.version_lien))
  const recue = Buffer.from(sig)
  return attendue.length === recue.length && timingSafeEqual(attendue, recue) ? id : null
}

/**
 * Adresse complète du lien. Elle passe par le domaine des cartes
 * (go.taporacards.com) : le Worker la relaie au serveur, et le client voit
 * le nom de la société plutôt que celui de l'hébergeur.
 */
export function urlStats(dossierId: string, version: number, baseRepli: string): string {
  return `${baseCartesConfiguree() ?? baseRepli}/stats/${jetonStats(dossierId, version)}`
}
