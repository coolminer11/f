import 'server-only'
import { requete, requeteUne } from '@/lib/db'

/**
 * Le parrainage, sans carte gratuite :
 *
 *   - le filleul a 10 % sur sa première commande (on ne paie que si la vente
 *     se fait) ;
 *   - le parrain gagne de la visibilité : sa fiche sur
 *     taporacards.com/partenaires (s'il le veut) et un merci sur LinkedIn ;
 *   - dès qu'un filleul devient client, le parrain reçoit la pastille
 *     « Ambassadeur Tapora » sur sa page.
 *
 * La recommandation part de la page client (le jeton est revérifié) et se
 * traite dans le back-office : nouveau → contacté → client ou perdu.
 */

export const RABAIS_FILLEUL = 10
export const PLAFOND_PARRAINAGES_JOUR = 5
export const STATUTS = ['nouveau', 'contacte', 'client', 'perdu'] as const
export type StatutParrainage = (typeof STATUTS)[number]
export const LIBELLES_STATUT: Record<StatutParrainage, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  client: 'Client',
  perdu: 'Pas intéressé',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Parrainage = {
  id: string
  parrain_id: string
  parrain_nom: string
  commerce: string
  contact: string | null
  courriel: string | null
  telephone: string | null
  message: string | null
  statut: StatutParrainage
  cree_le: string
  maj_le: string
}

export type NouvelleRecommandation = {
  commerce: string
  contact: string | null
  courriel: string | null
  telephone: string | null
  message: string | null
}

/**
 * Enregistre une recommandation, dans la limite du plafond par 24 h (le
 * plafond et l'ajout en un seul ordre : deux envois simultanés ne le
 * dépassent pas). Null si le plafond est atteint.
 */
export async function enregistrerRecommandation(parrainId: string, r: NouvelleRecommandation): Promise<{ id: string; parrain_nom: string } | null> {
  return requeteUne<{ id: string; parrain_nom: string }>(
    `insert into parrainages (parrain_id, commerce, contact, courriel, telephone, message)
     select $1::uuid, $2, $3, $4, $5, $6
      where (select count(*) from parrainages
              where parrain_id = $1::uuid and cree_le > now() - interval '24 hours') < $7
     returning id, (select nom from dossiers_cartes where id = $1::uuid) as parrain_nom`,
    [parrainId, r.commerce, r.contact, r.courriel, r.telephone, r.message, PLAFOND_PARRAINAGES_JOUR],
  )
}

/** Le parrain accepte de paraître sur la page Partenaires (jamais retiré d'ici : seulement ajouté). */
export async function accepterPartenaire(dossierId: string, siteWeb: string | null): Promise<void> {
  await requete(
    `update dossiers_cartes set partenaire_public = true, site_web = coalesce($2, site_web) where id = $1::uuid`,
    [dossierId, siteWeb],
  )
}

/** Les recommandations d'un parrain, ou toutes (les ouvertes d'abord). */
export async function listerParrainages(parrainId?: string): Promise<Parrainage[]> {
  if (parrainId && !UUID.test(parrainId)) return []
  return requete<Parrainage>(
    `select p.id, p.parrain_id, d.nom as parrain_nom, p.commerce, p.contact, p.courriel, p.telephone,
            p.message, p.statut, p.cree_le, p.maj_le
       from parrainages p join dossiers_cartes d on d.id = p.parrain_id
      ${parrainId ? 'where p.parrain_id = $1::uuid' : ''}
      order by array_position(array['nouveau','contacte','client','perdu']::text[], p.statut), p.cree_le desc
      limit 300`,
    parrainId ? [parrainId] : [],
  )
}

export async function parrainagesOuverts(): Promise<{ n: number; noms: string[] }> {
  const l = await requeteUne<{ n: number; noms: string[] | null }>(
    `select count(*)::int as n, (array_agg(commerce order by cree_le desc))[1:3] as noms
       from parrainages where statut = 'nouveau'`,
  )
  return { n: l?.n ?? 0, noms: l?.noms ?? [] }
}

/** Côté page client : combien de recommandations, combien devenues clientes. */
export async function bilanParrain(parrainId: string): Promise<{ recommandes: number; clients: number }> {
  const l = await requeteUne<{ recommandes: number; clients: number }>(
    `select count(*)::int as recommandes, count(*) filter (where statut = 'client')::int as clients
       from parrainages where parrain_id = $1::uuid`,
    [parrainId],
  )
  return l ?? { recommandes: 0, clients: 0 }
}

/**
 * Change le statut. Un filleul devenu client fait de son parrain un
 * Ambassadeur (la date du premier reste).
 */
export async function changerStatut(id: string, statut: StatutParrainage): Promise<void> {
  if (!UUID.test(id) || !STATUTS.includes(statut)) return
  const p = await requeteUne<{ parrain_id: string }>(
    `update parrainages set statut = $2 where id = $1::uuid returning parrain_id`,
    [id, statut],
  )
  if (p && statut === 'client') {
    await requete(`update dossiers_cartes set ambassadeur_le = coalesce(ambassadeur_le, now()) where id = $1::uuid`, [p.parrain_id])
  }
}

/** Le merci LinkedIn, prêt à copier, quand un filleul devient client. */
export function merciLinkedIn(parrain: string, filleul: string): string {
  return `Un immense merci à ${parrain} de nous avoir recommandés à ${filleul} 🙏

Le bouche-à-oreille entre commerçants d'ici, c'est ce qui nous fait le plus plaisir. ${parrain} utilise Tapora pour obtenir plus d'avis Google, et a pensé à un voisin : on ne pouvait pas rêver mieux.

Bienvenue à ${filleul} — et longue vie aux commerces de chez nous ! 🏅

#CommerceLocal #Québec #AvisGoogle`
}
