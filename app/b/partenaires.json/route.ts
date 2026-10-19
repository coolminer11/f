import { requete } from '@/lib/db'
import { baseCartesConfiguree } from '@/lib/cartes-url'

export const dynamic = 'force-dynamic'

let memoire: { corps: string; le: number } | null = null
const FRAIS_MS = 10 * 60 * 1000

/**
 * /b/partenaires.json — les commerces qui ont accepté de paraître sur
 * taporacards.com/partenaires (case cochée par eux, ou par nous avec leur
 * accord). Ambassadeurs d'abord. Rien d'autre que ce qui est déjà public :
 * le nom, le site, le badge d'avis.
 */
export async function GET(requete_: Request) {
  if (!memoire || Date.now() - memoire.le > FRAIS_MS) {
    const base = baseCartesConfiguree() ?? new URL(requete_.url).origin
    const lignes = await requete<{ nom: string; site_web: string | null; ambassadeur: boolean; cle: string | null }>(
      `select d.nom, d.site_web, d.ambassadeur_le is not null as ambassadeur,
              case when d.badge_actif then d.cle_badge end as cle
         from dossiers_cartes d
        where d.partenaire_public
          and exists (select 1 from cartes_nfc c where c.dossier_id = d.id and c.actif)
        order by d.ambassadeur_le is null, lower(d.nom)
        limit 200`,
    )
    memoire = {
      corps: JSON.stringify({
        partenaires: lignes.map((l) => ({
          nom: l.nom,
          site: l.site_web,
          ambassadeur: l.ambassadeur,
          badge: l.cle ? `${base}/b/${l.cle}.svg` : null,
          avis: l.cle ? `${base}/b/${l.cle}/avis` : null,
        })),
      }),
      le: Date.now(),
    }
  }
  return new Response(memoire.corps, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=604800',
      'access-control-allow-origin': '*',
      'x-content-type-options': 'nosniff',
    },
  })
}
