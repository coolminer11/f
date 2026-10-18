/**
 * Le manifeste du back-office : ce qui en fait une app installable sur le
 * téléphone (icône sur l'écran d'accueil, plein écran, raccourcis).
 * La page client (/stats/…) a le sien, propre à chaque commerce.
 */
export function GET() {
  return Response.json(
    {
      id: '/transactions',
      name: 'Tapora — Back-office',
      short_name: 'Tapora',
      description: 'Ventes, dépenses, cartes et statistiques de Tapora S.E.N.C.',
      lang: 'fr-CA',
      start_url: '/transactions?source=app',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: '#f7f1e7',
      theme_color: '#f7f1e7',
      icons: [
        { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icones/icone-masquable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: 'Saisir une dépense', short_name: 'Dépense', url: '/transactions/nouvelle', icons: [{ src: '/icones/icone-192.png', sizes: '192x192' }] },
        { name: 'Cartes NFC', short_name: 'Cartes', url: '/cartes', icons: [{ src: '/icones/icone-192.png', sizes: '192x192' }] },
        { name: 'Factures', short_name: 'Factures', url: '/ventes', icons: [{ src: '/icones/icone-192.png', sizes: '192x192' }] },
        { name: 'Sécurité', short_name: 'Sécurité', url: '/compte/securite', icons: [{ src: '/icones/icone-192.png', sizes: '192x192' }] },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } },
  )
}
