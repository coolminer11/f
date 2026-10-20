import 'server-only'
import { requete, requeteUne } from '@/lib/db'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Dossier = {
  id: string
  nom: string
  client_id: string | null
  client_nom: string | null
  courriel_rapport: string | null
  rapport_mensuel: boolean
  lien_actif: boolean
  version_lien: number
  note: string | null
  langue: 'fr' | 'en'
  objectif_avis: number | null
  avis_pose: number | null
  avis_mois_avant: number | null
  date_pose: string | null
  cle_badge: string
  badge_actif: boolean
  site_web: string | null
  partenaire_public: boolean
  ambassadeur_le: string | null
  lancement: string[]
  /** Page client protégée par un mot de passe (l'empreinte, elle, ne sort jamais de la base). */
  protege: boolean
  cree_le: string
  nb_cartes: number
  nb_actives: number
}

export type DossierListe = Dossier & {
  taps_periode: number
  taps_precedent: number
  dernier_tap: string | null
}

const COLONNES = `d.id, d.nom, d.client_id, cl.nom as client_nom, d.courriel_rapport,
  d.rapport_mensuel, d.lien_actif, d.version_lien, d.note, d.langue, d.objectif_avis, d.avis_pose, d.avis_mois_avant::float8 as avis_mois_avant,
  to_char(d.date_pose, 'YYYY-MM-DD') as date_pose, d.cle_badge, d.badge_actif, d.site_web, d.partenaire_public, d.ambassadeur_le,
  d.lancement, d.mot_de_passe is not null as protege, d.cree_le,
  (select count(*)::int from cartes_nfc c where c.dossier_id = d.id) as nb_cartes,
  (select count(*)::int from cartes_nfc c where c.dossier_id = d.id and c.actif) as nb_actives`

export async function listerDossiers(jours = 30): Promise<DossierListe[]> {
  return requete<DossierListe>(
    `select ${COLONNES},
            coalesce(s.courant, 0) as taps_periode,
            coalesce(s.precedent, 0) as taps_precedent,
            s.dernier as dernier_tap
       from dossiers_cartes d
       left join clients cl on cl.id = d.client_id
       left join lateral (
         select count(*) filter (where t.tape_le >= now() - make_interval(days => $1::int))::int as courant,
                count(*) filter (where t.tape_le <  now() - make_interval(days => $1::int)
                                   and t.tape_le >= now() - make_interval(days => 2 * $1::int))::int as precedent,
                max(t.tape_le) as dernier
           from taps t join cartes_nfc c on c.id = t.carte_id
          where c.dossier_id = d.id
       ) s on true
      order by coalesce(s.courant, 0) desc, lower(d.nom)`,
    [jours],
  )
}

/** Pour les listes déroulantes. */
export async function nomsDossiers(): Promise<{ id: string; nom: string }[]> {
  return requete<{ id: string; nom: string }>(`select id, nom from dossiers_cartes order by lower(nom)`)
}

export async function dossier(id: string): Promise<Dossier | null> {
  if (!UUID.test(id)) return null
  return requeteUne<Dossier>(
    `select ${COLONNES} from dossiers_cartes d left join clients cl on cl.id = d.client_id where d.id = $1::uuid`,
    [id],
  )
}

export type SaisieDossierValidee = {
  nom: string
  clientId: string | null
  courrielRapport: string | null
  rapportMensuel: boolean
  note: string | null
  langue: 'fr' | 'en'
  objectifAvis: number | null
  avisPose: number | null
  avisMoisAvant: number | null
  datePose: string | null
  siteWeb: string | null
  partenairePublic: boolean
}

export async function creerDossier(e: SaisieDossierValidee): Promise<string> {
  const ligne = await requeteUne<{ id: string }>(
    `insert into dossiers_cartes (nom, client_id, courriel_rapport, rapport_mensuel, note, langue, objectif_avis, avis_pose, avis_mois_avant, date_pose, site_web, partenaire_public)
     values ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::date, $11, $12) returning id`,
    [e.nom, e.clientId, e.courrielRapport, e.rapportMensuel, e.note, e.langue, e.objectifAvis, e.avisPose, e.avisMoisAvant, e.datePose, e.siteWeb, e.partenairePublic],
  )
  await releveDePose(ligne!.id, e)
  return ligne!.id
}

export async function modifierDossier(id: string, e: SaisieDossierValidee): Promise<void> {
  await requete(
    `update dossiers_cartes
        set nom = $2, client_id = $3::uuid, courriel_rapport = $4, rapport_mensuel = $5, note = $6,
            langue = $7, objectif_avis = $8, avis_pose = $9, avis_mois_avant = $10, date_pose = $11::date,
            site_web = $12, partenaire_public = $13
      where id = $1::uuid`,
    [id, e.nom, e.clientId, e.courrielRapport, e.rapportMensuel, e.note, e.langue, e.objectifAvis, e.avisPose, e.avisMoisAvant, e.datePose, e.siteWeb, e.partenairePublic],
  )
  await releveDePose(id, e)
  // Le client de facturation des cartes suit celui du dossier.
  await requete(`update cartes_nfc set client_id = $2::uuid where dossier_id = $1::uuid`, [id, e.clientId])
}

/**
 * Carte posée avant d'être ajoutée ici : les avis du jour de la pose
 * deviennent le premier relevé du dossier, à cette date. Les avis gagnés
 * (30 jours, graphiques, rapport) partent ainsi du bon jour. Un relevé plus
 * ancien que la pose n'a pas de sens : il est retiré.
 */
async function releveDePose(id: string, e: SaisieDossierValidee): Promise<void> {
  if (e.avisPose === null || !e.datePose) return
  const cle = `manuel_d${id.replace(/-/g, '').toLowerCase()}`
  await requete(
    `insert into fiches_google (place_id, nom) values ($1, $2)
     on conflict (place_id) do update set nom = excluded.nom, maj_le = now()`,
    [cle, e.nom.slice(0, 200)],
  )
  await requete(`delete from avis_google where place_id = $1 and jour < $2::date`, [cle, e.datePose])
  await requete(
    `insert into avis_google (place_id, jour, nb_avis) values ($1, $2::date, $3)
     on conflict (place_id, jour) do update set nb_avis = excluded.nb_avis, releve_le = now()`,
    [cle, e.datePose, e.avisPose],
  )
}

/** Les cartes restent : elles redeviennent « sans dossier ». */
export async function supprimerDossier(id: string): Promise<void> {
  await requete(`delete from dossiers_cartes where id = $1::uuid`, [id])
}

/** Nouveau lien : l'ancien cesse de fonctionner immédiatement. */
/** Nouveau lien : l'ancien cesse de fonctionner, et les appareils inscrits aux notifications sont désinscrits. */
export async function renouvelerLien(id: string): Promise<void> {
  await requete(
    `update dossiers_cartes set version_lien = version_lien + 1, lien_actif = true where id = $1::uuid`,
    [id],
  )
  await requete(`delete from abonnements_push where dossier_id = $1::uuid`, [id])
  await requete(`delete from essais_page_client where dossier_id = $1::uuid`, [id])
}

export async function basculerLien(id: string, actif: boolean): Promise<void> {
  await requete(`update dossiers_cartes set lien_actif = $2 where id = $1::uuid`, [id, actif])
}

export async function rattacherCartes(dossierId: string, carteIds: string[]): Promise<void> {
  const ids = carteIds.filter((i) => UUID.test(i))
  if (!ids.length) return
  await requete(
    `update cartes_nfc
        set dossier_id = $1::uuid,
            client_id = (select client_id from dossiers_cartes where id = $1::uuid)
      where id = any($2::uuid[])`,
    [dossierId, ids],
  )
}

export type DemandeCartes = {
  id: string
  dossier_id: string
  dossier_nom: string
  quantite: number
  message: string | null
  cree_le: string
  traitee_le: string | null
}

/** Les demandes « Commander plus de cartes » d'un dossier, ou toutes celles à traiter. */
export async function demandesCartes(dossierId?: string): Promise<DemandeCartes[]> {
  if (dossierId && !UUID.test(dossierId)) return []
  return requete<DemandeCartes>(
    `select q.id, q.dossier_id, d.nom as dossier_nom, q.quantite, q.message, q.cree_le, q.traitee_le
       from demandes_cartes q join dossiers_cartes d on d.id = q.dossier_id
      where ${dossierId ? 'q.dossier_id = $1::uuid' : 'q.traitee_le is null'}
      order by q.traitee_le is not null, q.cree_le desc
      limit 20`,
    dossierId ? [dossierId] : [],
  )
}

export async function traiterDemande(id: string): Promise<void> {
  if (!UUID.test(id)) return
  await requete(`update demandes_cartes set traitee_le = now() where id = $1::uuid and traitee_le is null`, [id])
}
