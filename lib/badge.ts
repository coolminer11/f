import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import { cleAvis } from '@/lib/avis-manuels'
import type { Langue } from '@/lib/langue'
import { HAUTEUR_BADGE, LARGEUR_BADGE, type ThemeBadge } from '@/lib/badge-code'

export type { ThemeBadge }

/**
 * Le badge d'avis : une petite image « ★ 4,8 · 246 avis Google » que le
 * commerce colle sur son propre site. Elle se met à jour toute seule à
 * chaque relevé d'avis.
 *
 * Adresse publique : /b/<clé>.svg. La clé (12 caractères) est propre au
 * badge — ce n'est PAS le lien privé du client — et le badge ne montre que
 * des chiffres déjà publics sur Google. Désactiver le badge, ou changer sa
 * clé, le fait disparaître des sites où il est collé.
 *
 * Sur go.taporacards.com, le Worker Cloudflare garde l'image en cache : le
 * serveur gratuit (qui s'endort) n'est sollicité qu'une fois par heure au
 * plus, et le badge s'affiche même pendant qu'il se réveille.
 */

export const CLE_BADGE = /^[0-9a-f]{12}$/

export type DonneesBadge = {
  dossier_id: string
  nom: string
  langue: Langue
  note: number | null
  nb: number | null
  destination: string | null
  place_id: string | null
}

/** Les chiffres d'un badge actif, ou null (clé inconnue, badge désactivé). */
export async function donneesBadge(cle: string): Promise<DonneesBadge | null> {
  if (!CLE_BADGE.test(cle)) return null
  const d = await requeteUne<{ id: string; nom: string; langue: Langue; destination: string | null; places: string[] | null }>(
    `select d.id, d.nom, d.langue,
            (select c.destination from cartes_nfc c where c.dossier_id = d.id and c.actif order by c.cree_le limit 1) as destination,
            (select array_agg(distinct c.place_id) from cartes_nfc c where c.dossier_id = d.id and c.place_id is not null) as places
       from dossiers_cartes d
      where d.cle_badge = $1 and d.badge_actif`,
    [cle],
  )
  if (!d) return null
  const places = (d.places ?? []).filter((p) => /^[A-Za-z0-9_-]{10,255}$/.test(p))
  const cles = [cleAvis({ type: 'dossier', id: d.id }), ...places]
  const r = await dernierAvis(cles)
  return {
    dossier_id: d.id,
    nom: d.nom,
    langue: d.langue,
    nb: r?.nb ?? null,
    note: r?.note ?? null,
    destination: d.destination,
    place_id: places[0] ?? null,
  }
}

/**
 * Le relevé le plus récent (manuel ou automatique) parmi ces fiches ; la
 * note, si le dernier relevé n'en a pas, vient du plus récent qui en a une
 * (90 jours au plus).
 */
export async function dernierAvis(cles: string[]): Promise<{ nb: number | null; note: number | null }> {
  const r = await requeteUne<{ nb: number | null; note: number | null }>(
    `select (select nb_avis from avis_google where place_id = any($1) order by jour desc, releve_le desc limit 1) as nb,
            (select note::float8 from avis_google
              where place_id = any($1) and note is not null and jour > current_date - 90
              order by jour desc, releve_le desc limit 1) as note`,
    [cles],
  )
  return r ?? { nb: null, note: null }
}

/**
 * Où mène un clic sur le badge : la page des avis Google du commerce. Avec
 * l'identifiant de la fiche, la liste des avis ; sinon le lien Google de la
 * carte (souvent « laisser un avis ») ; sinon une recherche Google.
 */
export function lienAvisGoogle(d: Pick<DonneesBadge, 'nom' | 'destination' | 'place_id'>): string {
  const place = d.place_id ?? d.destination?.match(/[?&]placeid=([A-Za-z0-9_-]{10,255})/i)?.[1] ?? null
  if (place) return `https://search.google.com/local/reviews?placeid=${place}`
  if (d.destination) {
    try {
      const h = new URL(d.destination).hostname
      if (/(^|\.)(google\.[a-z.]+|g\.page|goo\.gl)$/i.test(h)) return d.destination
    } catch {
      // destination illisible : on passe à la recherche
    }
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${d.nom} avis`)}`
}

// ---------------------------------------------------------------------------
// Le dessin
// ---------------------------------------------------------------------------
const ETOILE = 'M8 0.6l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L.8 5.9l5-.7z'

const COULEURS = {
  clair: { fond: '#fffaf2', bord: '#eadfcd', encre: '#2a211a', doux: '#6b5d50', vide: '#eadfcd', ombre: '#c2552f' },
  sombre: { fond: '#2a211a', bord: '#43362c', encre: '#fffaf2', doux: '#cdbfb7', vide: '#4a3c31', ombre: '#e4a53a' },
} as const

/** Image vide (1 × 1, transparente) : un badge désactivé disparaît sans laisser d'image cassée. */
export const BADGE_VIDE = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"/>'

export function svgBadge(e: { note: number | null; nb: number | null; langue: Langue; theme: ThemeBadge }): string {
  const c = COULEURS[e.theme]
  const fr = e.langue === 'fr'
  const nf = new Intl.NumberFormat(fr ? 'fr-CA' : 'en-CA')
  const L = LARGEUR_BADGE
  const H = HAUTEUR_BADGE
  const serif = `Georgia,'Times New Roman',serif`
  const sans = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`
  const nb = e.nb ?? 0
  const avis = fr ? `${nf.format(nb)} avis Google` : `${nf.format(nb)} Google review${nb === 1 ? '' : 's'}`

  // Le grand chiffre : la note si on l'a, sinon le nombre d'avis.
  const avecNote = e.note !== null
  const grand = avecNote ? e.note!.toFixed(1).replace('.', fr ? ',' : '.') : nf.format(nb)
  const largeurGrand = Math.round(grand.length * 19 + 4)
  const x2 = 22 + largeurGrand + 16

  const etoiles = Array.from({ length: 5 }, (_, i) => `<path transform="translate(${x2 + i * 19} 17)" d="${ETOILE}"/>`).join('')
  const remplies = avecNote ? Math.max(0, Math.min(5, e.note!)) : 0
  const blocDroit = avecNote
    ? `<g fill="${c.vide}">${etoiles}</g>
  <clipPath id="r"><rect x="${x2}" y="16" width="${(remplies / 5) * (5 * 19 - 3)}" height="18"/></clipPath>
  <g fill="#e4a53a" clip-path="url(#r)">${etoiles}</g>
  <text x="${x2}" y="54" font-family="${sans}" font-size="14" font-weight="600" fill="${c.encre}">${avis}</text>`
    : `<text x="${x2}" y="36" font-family="${sans}" font-size="14" font-weight="600" fill="${c.encre}">${fr ? 'avis Google' : `Google review${nb === 1 ? '' : 's'}`}</text>
  <text x="${x2}" y="54" font-family="${sans}" font-size="12.5" fill="${c.doux}">${fr ? 'et ça continue' : 'and counting'}</text>`

  const titre = avecNote
    ? fr
      ? `Note de ${grand} sur 5 sur Google, ${avis}`
      : `Rated ${grand} out of 5 on Google, ${avis}`
    : avis

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}" role="img" aria-label="${titre}">
  <title>${titre}</title>
  <rect x="0.5" y="0.5" width="${L - 1}" height="${H - 1}" rx="18" fill="${c.fond}" stroke="${c.bord}"/>
  <text x="22" y="${avecNote ? 50 : 48}" font-family="${serif}" font-size="${avecNote ? 38 : 32}" font-weight="700" fill="${c.encre}" letter-spacing="-1">${grand}</text>
  ${blocDroit}
  <g transform="translate(${L - 30} 12)">
    <circle cx="8" cy="8" r="8" fill="${c.ombre}"/>
    <path transform="translate(3.6 3.5) scale(.55)" d="${ETOILE}" fill="${e.theme === 'clair' ? '#fffaf2' : '#2a211a'}"/>
  </g>
</svg>`
}

// Mémoire du serveur : un site très visité ne fait pas une requête à la base
// par visiteur. Vidée quand un badge est désactivé ou change d'adresse.
// (Devant, le Worker Cloudflare garde l'image une heure de plus au plus.)
const globale = globalThis as typeof globalThis & { __badges?: Map<string, { svg: string; vide: boolean; le: number }> }
export const memoireBadges = (globale.__badges ??= new Map())

// ---------------------------------------------------------------------------
// Back-office : activer, désactiver, changer la clé
// ---------------------------------------------------------------------------
export async function etatBadge(dossierId: string): Promise<{ cle: string; actif: boolean } | null> {
  return requeteUne<{ cle: string; actif: boolean }>(
    `select cle_badge as cle, badge_actif as actif from dossiers_cartes where id = $1::uuid`,
    [dossierId],
  )
}

export async function basculerBadge(dossierId: string, actif: boolean): Promise<void> {
  await requete(`update dossiers_cartes set badge_actif = $2 where id = $1::uuid`, [dossierId, actif])
  memoireBadges.clear()
}

/** Nouvelle clé : l'ancien badge disparaît des sites où il était collé. */
export async function nouvelleCleBadge(dossierId: string): Promise<void> {
  await requete(`update dossiers_cartes set cle_badge = substr(md5(gen_random_uuid()::text), 1, 12) where id = $1::uuid`, [dossierId])
  memoireBadges.clear()
}
