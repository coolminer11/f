export const dynamic = 'force-dynamic'

/**
 * Point de réveil, public et muet.
 *
 * Sur le forfait gratuit, le serveur s'endort après quinze minutes sans
 * visite et met près d'une minute à se réveiller. Pour un back-office, c'est
 * agaçant ; pour une carte NFC tapée au comptoir, c'est rédhibitoire — le
 * client range son téléphone avant que la page ne s'ouvre. Un service de
 * planification (cron-job.org) appelle cette adresse toutes les dix minutes.
 * Elle ne renvoie rien d'autre que « ok » et ne touche pas à la base.
 */
export function GET() {
  return new Response('ok', { headers: { 'cache-control': 'no-store' } })
}
