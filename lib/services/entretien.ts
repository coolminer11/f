import 'server-only'
import { requete } from '@/lib/db'

/**
 * L'entretien des données de Tapora Services, appelé par le réveil
 * (/api/eveil). Il tient ce que promettent les règles de confidentialité
 * (/confidentialite#services) :
 *
 * - l'empreinte de l'adresse IP (freins contre les abus) est retirée après
 *   30 jours ;
 * - les statistiques de visite sont effacées après 13 mois ;
 * - les demandes, les commandes et les avis, après 25 mois.
 *
 * Au plus une fois par six heures, par lots de 5 000 lignes : un réveil ne
 * reste jamais bloqué, et le reste attend le passage suivant.
 */
const globale = globalThis as typeof globalThis & { __entretienServices?: number }
const LOT = 5000

export async function entretienServices(): Promise<void> {
  const maintenant = Date.now()
  if (globale.__entretienServices && maintenant - globale.__entretienServices < 6 * 3600 * 1000) return
  globale.__entretienServices = maintenant

  await requete(
    `update demandes_service set empreinte = null
      where id in (select id from demandes_service where empreinte is not null and cree_le < now() - interval '30 days' limit ${LOT})`,
  )
  await requete(
    `update retours_service set empreinte = null
      where id in (select id from retours_service where empreinte is not null and cree_le < now() - interval '30 days' limit ${LOT})`,
  )
  await requete(`delete from essais_portail_service where cree_le < now() - interval '30 days'`)
  await requete(
    `delete from evenements_service where id in (select id from evenements_service where cree_le < now() - interval '13 months' limit ${LOT})`,
  )
  // Les avis d'abord : ils pointent vers leur demande.
  await requete(`delete from retours_service where id in (select id from retours_service where cree_le < now() - interval '25 months' limit ${LOT})`)
  await requete(`delete from demandes_service where id in (select id from demandes_service where cree_le < now() - interval '25 months' limit ${LOT})`)
}
