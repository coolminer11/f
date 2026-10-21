import { CODE_EMPLACEMENT, parCode } from '@/lib/services/donnees'
import { noterEvenement, type TypeEvenement } from '@/lib/services/evenements'
import { estLangue } from '@/lib/services/langues'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Ce que le client regarde (navigator.sendBeacon) : un plat, une rubrique du
 * concierge, le Wi-Fi, un menu PDF, une langue choisie. Les visites, les menus
 * et le concierge sont comptés par le serveur en affichant la page : ils ne
 * passent pas par ici. Toujours 204 — une balise n'attend pas de réponse.
 */
const TYPES = new Set<TypeEvenement>(['plat', 'rubrique', 'wifi', 'pdf', 'langue'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(r: Request, { params }: { params: Promise<{ code: string }> }) {
  const rien = new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
  const { code } = await params
  if (!CODE_EMPLACEMENT.test(code.toUpperCase())) return rien
  let corps: { type?: unknown; cible?: unknown; langue?: unknown }
  try {
    const brut = await r.text()
    if (brut.length > 1024) return rien
    corps = JSON.parse(brut)
  } catch {
    return rien
  }
  const type = corps?.type as TypeEvenement
  if (!TYPES.has(type)) return rien
  const cible = typeof corps.cible === 'string' ? corps.cible.slice(0, 80) : null
  // La cible a la forme attendue pour son type : un id pour un plat, une rubrique ou un menu, une langue pour « langue », rien pour le Wi-Fi.
  if ((type === 'plat' || type === 'rubrique' || type === 'pdf') && !(cible && UUID.test(cible))) return rien
  if (type === 'langue' && !estLangue(cible)) return rien
  const lieu = await parCode(code).catch(() => null)
  if (!lieu) return rien
  const langue = estLangue(corps.langue) && lieu.etab.langues.includes(corps.langue) ? corps.langue : null
  await noterEvenement(lieu.etab.id, lieu.emplacement.id, type, type === 'wifi' ? null : cible, langue)
  return rien
}
