import { NextResponse } from 'next/server'
import { dossierDuJeton } from '@/lib/lien-stats'
import { dossier as lireDossier } from '@/lib/requetes/dossiers'
import { langueValide } from '@/lib/langue'

export const dynamic = 'force-dynamic'

/**
 * Le manifeste qui permet d'« installer » la page client sur l'écran
 * d'accueil : elle s'ouvre alors plein écran, comme une app, directement sur
 * les statistiques de CE commerce.
 */
export async function GET(requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  const id = await dossierDuJeton(jeton)
  const d = id ? await lireDossier(id) : null
  if (!d) return NextResponse.json({ erreur: 'Introuvable' }, { status: 404 })
  const l = langueValide(new URL(requete.url).searchParams.get('l')) ?? (d.langue as 'fr' | 'en')
  const chemin = `/stats/${jeton}`
  return NextResponse.json(
    {
      id: chemin,
      name: `${d.nom} · Tapora`,
      short_name: d.nom.length <= 12 ? d.nom : 'Tapora',
      description: l === 'en' ? 'Your Tapora card stats, live.' : 'Les statistiques de vos cartes Tapora, en direct.',
      lang: l === 'en' ? 'en-CA' : 'fr-CA',
      start_url: `${chemin}?l=${l}&source=app`,
      scope: chemin,
      display: 'standalone',
      background_color: '#f7f1e7',
      theme_color: '#f7f1e7',
      icons: [
        { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icones/icone-masquable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' } },
  )
}
