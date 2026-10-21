import { etablissementDuJeton } from '@/lib/services/acces'
import { fileJson } from '@/lib/services/portail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** La file en direct du portail (sondée toutes les 4 secondes) : demandes ouvertes, faites, pouls, avis non lus. */
export async function GET(_r: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const id = await etablissementDuJeton((await params).jeton)
  if (!id) return Response.json({ erreur: 'acces' }, { status: 401, headers: { 'cache-control': 'no-store' } })
  return Response.json(await fileJson(id), { headers: { 'cache-control': 'no-store' } })
}
