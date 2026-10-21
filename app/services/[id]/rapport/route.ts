import { exigerSession } from '@/lib/auth'
import { baseLiens } from '@/lib/securite'
import { lireEtablissement } from '@/lib/services/donnees'
import { courrielRapportService, donneesRapportService, moisPrecedentService } from '@/lib/services/rapport'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * L'aperçu du rapport mensuel d'un établissement, tel que son contact le
 * recevra : le mois écoulé, ou ?mois=AAAA-MM-01. Réservé au propriétaire.
 */
export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const introuvable = () => new Response('Introuvable', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
  if (!(await exigerSession()).proprietaire_logiciel) return introuvable()
  const { id } = await params
  const e = await lireEtablissement(id)
  if (!e) return introuvable()
  const demande = new URL(requete.url).searchParams.get('mois')
  const mois = demande && /^\d{4}-\d{2}-01$/.test(demande) ? demande : await moisPrecedentService(e.options.fuseau)
  const d = await donneesRapportService(e.id, mois)
  if (!d) return introuvable()
  const c = await courrielRapportService(d, await baseLiens())
  return new Response(c.html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', 'content-security-policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'self'" },
  })
}
