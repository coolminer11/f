import { accesPortail } from '@/lib/services/acces'
import { lireEtablissement } from '@/lib/services/donnees'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** « Ajouter à l'écran d'accueil » : le portail s'ouvre ensuite en plein écran, comme une app, sur la tablette du comptoir. */
export async function GET(_r: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  const a = await accesPortail(jeton)
  if (a.etat === 'invalide') return Response.json({ erreur: 'Introuvable' }, { status: 404 })
  const e = await lireEtablissement(a.id)
  if (!e) return Response.json({ erreur: 'Introuvable' }, { status: 404 })
  const chemin = `/service/${jeton}`
  return Response.json(
    {
      id: chemin,
      name: `${e.nom} · Service`,
      short_name: e.nom.length <= 12 ? e.nom : 'Service',
      description: 'Le portail du personnel : demandes en direct, plat du jour, statistiques.',
      lang: 'fr-CA',
      start_url: chemin,
      scope: chemin,
      display: 'standalone',
      orientation: 'any',
      background_color: '#0c0c10',
      theme_color: e.couleur,
      icons: [
        { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icones/icone-masquable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'no-store' } },
  )
}
