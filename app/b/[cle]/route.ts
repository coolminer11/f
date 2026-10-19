import { BADGE_VIDE, donneesBadge, memoireBadges as memoire, svgBadge, type ThemeBadge } from '@/lib/badge'
import { langueValide } from '@/lib/langue'

export const dynamic = 'force-dynamic'

const FRAIS_MS = 10 * 60 * 1000

/** /b/<clé>.svg — le badge d'avis, collé sur le site du commerce. */
export async function GET(requete: Request, { params }: { params: Promise<{ cle: string }> }) {
  const { cle: brut } = await params
  const m = brut.match(/^([0-9a-f]{12})\.svg$/)
  const url = new URL(requete.url)
  const theme: ThemeBadge = url.searchParams.get('theme') === 'sombre' ? 'sombre' : 'clair'
  const langueDemandee = langueValide(url.searchParams.get('l'))
  const cleMemoire = `${m?.[1]}|${theme}|${langueDemandee ?? ''}`

  let entree = memoire.get(cleMemoire)
  if (!entree || Date.now() - entree.le > FRAIS_MS) {
    const d = m ? await donneesBadge(m[1]) : null
    entree =
      d && d.nb !== null
        ? { svg: svgBadge({ note: d.note, nb: d.nb, langue: langueDemandee ?? d.langue, theme }), vide: false, le: Date.now() }
        : { svg: BADGE_VIDE, vide: true, le: Date.now() }
    if (memoire.size > 2000) memoire.clear()
    memoire.set(cleMemoire, entree)
  }

  return new Response(entree.svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      // Le navigateur garde une heure ; le cache partagé (Cloudflare) jusqu'à
      // une semaine, rafraîchi en arrière-plan par le Worker.
      'cache-control': entree.vide ? 'public, max-age=600' : 'public, max-age=3600, s-maxage=604800',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
      'access-control-allow-origin': '*',
      'cross-origin-resource-policy': 'cross-origin',
    },
  })
}
