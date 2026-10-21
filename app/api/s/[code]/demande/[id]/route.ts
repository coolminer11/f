import { CODE_EMPLACEMENT } from '@/lib/services/donnees'
import { etatPourClient } from '@/lib/services/demandes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Où en est une demande, pour l'écran du client (interrogé toutes les 3 s
 * tant qu'elle est ouverte) : seulement depuis l'emplacement de la demande.
 */
export async function GET(_r: Request, { params }: { params: Promise<{ code: string; id: string }> }) {
  const { code, id } = await params
  const entetes = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' }
  if (!CODE_EMPLACEMENT.test(code.toUpperCase()) || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ erreur: 'Introuvable' }, { status: 404, headers: entetes })
  const etat = await etatPourClient(code, id).catch(() => undefined)
  if (etat === undefined) return Response.json({ erreur: 'Indisponible' }, { status: 503, headers: entetes })
  if (!etat) return Response.json({ erreur: 'Introuvable' }, { status: 404, headers: entetes })
  return Response.json({ statut: etat.statut, prise_par: etat.prise_par, cree_le: new Date(etat.cree_le).toISOString() }, { headers: entetes })
}
