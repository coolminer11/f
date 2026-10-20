import type { NextConfig } from 'next'

/**
 * En-têtes de sécurité, sur toutes les pages.
 *
 * - Aucune page ne peut être affichée dans un cadre d'un autre site
 *   (clickjacking : un faux bouton posé par-dessus un vrai).
 * - HTTPS imposé au navigateur pour un an.
 * - Les pages publiques d'un client (document, statistiques) ne sont jamais
 *   indexées et ne transmettent pas leur adresse — qui contient le jeton —
 *   aux sites vers lesquels elles pointent.
 */
const COMMUNS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
]
const PRIVES = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Cache-Control', value: 'private, no-store' },
]

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', 'pdfkit'],
  // Reçus et convention signée : jusqu'à 10 Mo (1 Mo par défaut, trop peu
  // pour une photo de téléphone ou un PDF numérisé).
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:chemin*', headers: COMMUNS },
      { source: '/stats/:chemin*', headers: PRIVES },
      { source: '/documents/:chemin*', headers: PRIVES },
      { source: '/securite/:chemin*', headers: PRIVES },
      { source: '/connexion/:chemin*', headers: PRIVES },
      { source: '/compte/:chemin*', headers: PRIVES },
    ]
  },
}

export default nextConfig
