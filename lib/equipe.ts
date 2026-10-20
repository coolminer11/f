import 'server-only'
import { requete, requeteUne } from '@/lib/db'

/**
 * Qui fait quoi : le rôle de chaque associé, ses responsabilités et ses
 * objectifs de la semaine.
 *
 * Les objectifs « manuels » sont entrés par l'associé lui-même, et par lui
 * seul : personne n'écrit les chiffres de l'autre. Les autres se comptent
 * tout seuls à partir de l'app (nouveaux dossiers, cartes créées,
 * recommandations traitées) — pour toute l'équipe, puisque l'app ne note pas
 * qui a créé quoi.
 *
 * La semaine commence le lundi, heure du Québec.
 */

const FUSEAU = 'America/Toronto'
export const NB_SEMAINES = 8

export const MESURES = {
  manuel: 'Entré à la main',
  nouveaux_clients: 'Nouveaux dossiers (compté par l’app)',
  cartes_posees: 'Cartes créées (compté par l’app)',
  recommandations_traitees: 'Recommandations traitées (compté par l’app)',
} as const
export type Mesure = keyof typeof MESURES
export const estMesure = (m: string): m is Mesure => m in MESURES

export type Responsabilite = { id: string; libelle: string; detail: string | null }
export type Objectif = { id: string; libelle: string; cible: number; mesure: Mesure }
/** La valeur d'un objectif une semaine donnée ; null = pas encore entrée. */
export type Case = { semaine: string; valeurs: Record<string, number | null>; score: number | null }

export type Membre = {
  associe_id: string
  nom: string
  titre: string | null
  mission: string | null
  maj_le: string | null
  maj_par: string | null
  responsabilites: Responsabilite[]
  objectifs: Objectif[]
  /** Les semaines, de la plus récente à la plus ancienne. */
  semaines: Case[]
}

/** Les lundis des NB_SEMAINES dernières semaines, du plus récent au plus ancien. */
export async function semainesRecentes(): Promise<string[]> {
  const l = await requete<{ s: string }>(
    `select to_char(date_trunc('week', (now() at time zone $1)::date) - make_interval(weeks => g), 'YYYY-MM-DD') as s
       from generate_series(0, $2::int - 1) g order by g`,
    [FUSEAU, NB_SEMAINES],
  )
  return l.map((x) => x.s)
}

/**
 * L'équipe, avec pour chaque objectif sa valeur de chacune des dernières
 * semaines. Une semaine antérieure à la création d'un objectif ne compte pas
 * pour lui ; le score d'une semaine est la moyenne des objectifs atteints
 * (chacun plafonné à 100 %).
 */
export async function equipe(): Promise<Membre[]> {
  const [associes, responsabilites, objectifs, valeurs] = await Promise.all([
    requete<{ associe_id: string; nom: string; titre: string | null; mission: string | null; maj_le: string | null; maj_par: string | null }>(
      `select a.id as associe_id, a.nom, r.titre, r.mission, r.maj_le, u.nom as maj_par
         from associes a
         left join roles_associes r on r.associe_id = a.id
         left join utilisateurs u on u.id = r.maj_par
        where a.actif
        order by a.ordre`,
    ),
    requete<Responsabilite & { associe_id: string }>(
      `select id, associe_id, libelle, detail from responsabilites order by associe_id, ordre, libelle`,
    ),
    requete<Objectif & { associe_id: string }>(
      `select id, associe_id, libelle, cible, mesure from objectifs_hebdo order by associe_id, ordre, libelle`,
    ),
    requete<{ objectif_id: string; semaine: string; valeur: number | null; compte: boolean }>(
      `with semaines as (
         select (date_trunc('week', (now() at time zone $1)::date) - make_interval(weeks => g))::date as debut
           from generate_series(0, $2::int - 1) g
       ), auto as (
         select s.debut,
                (select count(*) from dossiers_cartes d
                  where (d.cree_le at time zone $1)::date >= s.debut and (d.cree_le at time zone $1)::date < s.debut + 7)::int as nouveaux_clients,
                (select count(*) from cartes_nfc c
                  where (c.cree_le at time zone $1)::date >= s.debut and (c.cree_le at time zone $1)::date < s.debut + 7)::int as cartes_posees,
                (select count(*) from parrainages p
                  where p.statut <> 'nouveau'
                    and (p.maj_le at time zone $1)::date >= s.debut and (p.maj_le at time zone $1)::date < s.debut + 7)::int as recommandations_traitees
           from semaines s
       )
       select o.id as objectif_id, to_char(s.debut, 'YYYY-MM-DD') as semaine,
              case o.mesure
                when 'manuel' then r.valeur
                when 'nouveaux_clients' then a.nouveaux_clients
                when 'cartes_posees' then a.cartes_posees
                else a.recommandations_traitees
              end as valeur,
              -- Un objectif ne compte qu'à partir de la semaine où il a été créé.
              s.debut >= date_trunc('week', (o.cree_le at time zone $1)::date)::date as compte
         from objectifs_hebdo o
        cross join semaines s
         join auto a on a.debut = s.debut
         left join realisations_hebdo r on r.objectif_id = o.id and r.semaine = s.debut`,
      [FUSEAU, NB_SEMAINES],
    ),
  ])
  const semaines = await semainesRecentes()

  return associes.map((a) => {
    const objs = objectifs.filter((o) => o.associe_id === a.associe_id).map(({ id, libelle, cible, mesure }) => ({ id, libelle, cible, mesure }))
    const cases: Case[] = semaines.map((semaine) => {
      const v: Record<string, number | null> = {}
      const parts: number[] = []
      for (const o of objs) {
        const l = valeurs.find((x) => x.objectif_id === o.id && x.semaine === semaine)
        if (!l?.compte) continue
        v[o.id] = l.valeur
        parts.push(Math.min(1, (l.valeur ?? 0) / o.cible))
      }
      return { semaine, valeurs: v, score: parts.length ? parts.reduce((s, x) => s + x, 0) / parts.length : null }
    })
    return {
      ...a,
      responsabilites: responsabilites.filter((r) => r.associe_id === a.associe_id).map(({ id, libelle, detail }) => ({ id, libelle, detail })),
      objectifs: objs,
      semaines: cases,
    }
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type SaisieRole = {
  titre: string
  mission: string | null
  responsabilites: { libelle: string; detail: string | null }[]
  /** id présent : objectif existant (mis à jour) ; absent : nouveau. Les existants omis sont supprimés. */
  objectifs: { id: string | null; libelle: string; cible: number; mesure: Mesure }[]
}

/**
 * Enregistre le rôle d'un associé. Les objectifs gardent leur identifiant
 * (et donc leur historique) tant qu'ils ne sont pas supprimés.
 */
export async function enregistrerRole(associeId: string, e: SaisieRole, utilisateurId: string): Promise<void> {
  if (!UUID.test(associeId)) throw new Error('Associé invalide.')
  await requete(
    `insert into roles_associes (associe_id, titre, mission, maj_par, maj_le) values ($1::uuid, $2, $3, $4::uuid, now())
     on conflict (associe_id) do update set titre = excluded.titre, mission = excluded.mission, maj_par = excluded.maj_par, maj_le = now()`,
    [associeId, e.titre, e.mission, utilisateurId],
  )
  await requete(`delete from responsabilites where associe_id = $1::uuid`, [associeId])
  for (const [i, r] of e.responsabilites.entries()) {
    await requete(`insert into responsabilites (associe_id, libelle, detail, ordre) values ($1::uuid, $2, $3, $4)`, [associeId, r.libelle, r.detail, i + 1])
  }
  const gardes = e.objectifs.map((o) => o.id).filter((id): id is string => !!id && UUID.test(id))
  await requete(`delete from objectifs_hebdo where associe_id = $1::uuid and not (id = any($2::uuid[]))`, [associeId, gardes])
  for (const [i, o] of e.objectifs.entries()) {
    if (o.id && UUID.test(o.id)) {
      await requete(
        `update objectifs_hebdo set libelle = $3, cible = $4, mesure = $5, ordre = $6 where id = $1::uuid and associe_id = $2::uuid`,
        [o.id, associeId, o.libelle, o.cible, o.mesure, i + 1],
      )
    } else {
      await requete(`insert into objectifs_hebdo (associe_id, libelle, cible, mesure, ordre) values ($1::uuid, $2, $3, $4, $5)`, [
        associeId,
        o.libelle,
        o.cible,
        o.mesure,
        i + 1,
      ])
    }
  }
}

/**
 * Les chiffres manuels d'une semaine, pour SES propres objectifs seulement
 * (le contrôle est dans la requête : un objectif d'un autre associé, ou
 * compté par l'app, est ignoré). Vide = effacer.
 */
export async function enregistrerSemaine(
  associeId: string,
  semaine: string,
  valeurs: { objectifId: string; valeur: number | null }[],
  utilisateurId: string,
): Promise<void> {
  if (!UUID.test(associeId) || !/^\d{4}-\d{2}-\d{2}$/.test(semaine)) throw new Error('Saisie invalide.')
  const permises = await semainesRecentes()
  if (!permises.includes(semaine)) throw new Error('Cette semaine ne peut plus être modifiée.')
  for (const v of valeurs) {
    if (!UUID.test(v.objectifId)) continue
    if (v.valeur === null) {
      await requete(
        `delete from realisations_hebdo r using objectifs_hebdo o
          where r.objectif_id = o.id and o.id = $1::uuid and o.associe_id = $2::uuid and r.semaine = $3::date`,
        [v.objectifId, associeId, semaine],
      )
    } else {
      await requete(
        `insert into realisations_hebdo (objectif_id, semaine, valeur, maj_par)
         select o.id, $3::date, $4, $5::uuid from objectifs_hebdo o
          where o.id = $1::uuid and o.associe_id = $2::uuid and o.mesure = 'manuel'
         on conflict (objectif_id, semaine) do update set valeur = excluded.valeur, maj_par = excluded.maj_par, maj_le = now()`,
        [v.objectifId, associeId, semaine, v.valeur, utilisateurId],
      )
    }
  }
}

/** L'associé lié au compte connecté, s'il y en a un. */
export async function associeDuCompte(utilisateurId: string): Promise<string | null> {
  const l = await requeteUne<{ associe_id: string | null }>(`select associe_id from utilisateurs where id = $1::uuid`, [utilisateurId])
  return l?.associe_id ?? null
}
