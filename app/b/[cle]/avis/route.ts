import { CLE_BADGE, donneesBadge, lienAvisGoogle } from '@/lib/badge'

export const dynamic = 'force-dynamic'

/** /b/<clé>/avis — un clic sur le badge mène aux avis Google du commerce. */
export async function GET(_: Request, { params }: { params: Promise<{ cle: string }> }) {
  const { cle } = await params
  const d = CLE_BADGE.test(cle) ? await donneesBadge(cle) : null
  return new Response(null, {
    status: 302,
    headers: {
      location: d ? lienAvisGoogle(d) : 'https://taporacards.com/',
      'cache-control': 'public, max-age=3600, s-maxage=604800',
      'referrer-policy': 'no-referrer',
      'x-robots-tag': 'noindex',
    },
  })
}
