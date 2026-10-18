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
  d.rapport_mensuel, d.lien_actif, d.version_lien, d.note, d.cree_le,
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
}

export async function creerDossier(e: SaisieDossierValidee): Promise<string> {
  const ligne = await requeteUne<{ id: string }>(
    `insert into dossiers_cartes (nom, client_id, courriel_rapport, rapport_mensuel, note)
     values ($1, $2::uuid, $3, $4, $5) returning id`,
    [e.nom, e.clientId, e.courrielRapport, e.rapportMensuel, e.note],
  )
  return ligne!.id
}

export async function modifierDossier(id: string, e: SaisieDossierValidee): Promise<void> {
  await requete(
    `update dossiers_cartes
        set nom = $2, client_id = $3::uuid, courriel_rapport = $4, rapport_mensuel = $5, note = $6
      where id = $1::uuid`,
    [id, e.nom, e.clientId, e.courrielRapport, e.rapportMensuel, e.note],
  )
  // Le client de facturation des cartes suit celui du dossier.
  await requete(`update cartes_nfc set client_id = $2::uuid where dossier_id = $1::uuid`, [id, e.clientId])
}

/** Les cartes restent : elles redeviennent « sans dossier ». */
export async function supprimerDossier(id: string): Promise<void> {
  await requete(`delete from dossiers_cartes where id = $1::uuid`, [id])
}

/** Nouveau lien : l'ancien cesse de fonctionner immédiatement. */
export async function renouvelerLien(id: string): Promise<void> {
  await requete(
    `update dossiers_cartes set version_lien = version_lien + 1, lien_actif = true where id = $1::uuid`,
    [id],
  )
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
