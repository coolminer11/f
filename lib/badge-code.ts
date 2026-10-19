import type { Langue } from '@/lib/langue'

/** Ce que le navigateur a aussi besoin de connaître du badge (voir lib/badge.ts). */
export type ThemeBadge = 'clair' | 'sombre'
export const LARGEUR_BADGE = 264
export const HAUTEUR_BADGE = 76

export function urlBadge(base: string, cle: string, theme: ThemeBadge): string {
  return `${base}/b/${cle}.svg${theme === 'sombre' ? '?theme=sombre' : ''}`
}

/** Le code HTML à coller sur le site du commerce. */
export function codeBadge(base: string, cle: string, theme: ThemeBadge, langue: Langue): string {
  const fr = langue === 'fr'
  const img = urlBadge(base, cle, theme)
  return `<a href="${base}/b/${cle}/avis" target="_blank" rel="noopener"><img src="${img}" alt="${fr ? 'Nos avis Google' : 'Our Google reviews'}" width="${LARGEUR_BADGE}" height="${HAUTEUR_BADGE}" loading="lazy" style="border:0;max-width:100%;height:auto"></a>
<a href="https://taporacards.com/${fr ? '' : 'en/'}?ref=badge" target="_blank" rel="noopener" style="display:block;margin-top:4px;font:11px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#8a7b6d;text-decoration:none">${fr ? 'propulsé par Tapora' : 'powered by Tapora'}</a>`
}
