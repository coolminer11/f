import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import { oublierCarte } from '@/lib/cache-cartes'

/** Fuseau de la société : un tap à 23 h 30 à Lévis appartient à sa journée. */
const FUSEAU = 'America/Toronto'

export type Carte = {
  id: string
  code: string
  libelle: string
  destination: string
  actif: boolean
  note: string | null
  cree_le: string
  client_id: string | null
  client_nom: string | null
  taps_total: number
  taps_7j: number
  taps_30j: number
  taps_30j_precedents: number
  taps_qr: number
  taps_ios: number
  taps_android: number
  dernier_tap: string | null
  dossier_id: string | null
  dossier_nom: string | null
  place_id: string | null
  fiche_nom: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function listerCartes(dossierId?: string | null): Promise<Carte[]> {
  if (dossierId !== undefined && dossierId !== null && !UUID.test(dossierId)) return []
  return requete<Carte>(
    `select * from v_cartes_nfc
      where ($1::uuid is null or dossier_id = $1::uuid)
      order by actif desc, taps_30j desc, cree_le desc`,
    [dossierId ?? null],
  )
}

export async function carte(id: string): Promise<Carte | null> {
  if (!UUID.test(id)) return null
  return requeteUne<Carte>('select * from v_cartes_nfc where id = $1::uuid', [id])
}

export type SaisieCarteValidee = {
  libelle: string
  dossierId: string | null
  destination: string
  placeId: string | null
  note: string | null
}

// Le client de facturation suit le dossier : une seule chose à choisir.
const CLIENT_DU_DOSSIER = `(select client_id from dossiers_cartes where id = $2::uuid)`

export async function creerCarte(entree: SaisieCarteValidee): Promise<string> {
  const ligne = await requeteUne<{ id: string }>(
    `insert into cartes_nfc (code, libelle, dossier_id, client_id, destination, place_id, note)
     values (nouveau_code_carte(), $1, $2::uuid, ${CLIENT_DU_DOSSIER}, $3, $4, $5) returning id`,
    [entree.libelle, entree.dossierId, entree.destination, entree.placeId, entree.note],
  )
  return ligne!.id
}

/**
 * Plusieurs cartes d'un coup — « Table 1 » à « Table 24 » — dans une seule
 * transaction : soit toutes existent, soit aucune.
 */
export async function creerCartesEnLot(entree: {
  prefixe: string
  nombre: number
  premier: number
  dossierId: string | null
  destination: string
  placeId: string | null
}): Promise<number> {
  const lignes = await requete<{ id: string }>(
    `insert into cartes_nfc (code, libelle, dossier_id, client_id, destination, place_id)
     select nouveau_code_carte(), $1 || ' ' || n, $2::uuid, ${CLIENT_DU_DOSSIER}, $3, $4
       from generate_series($5::int, $5::int + $6::int - 1) n
     returning id`,
    [entree.prefixe, entree.dossierId, entree.destination, entree.placeId, entree.premier, entree.nombre],
  )
  return lignes.length
}

export async function modifierCarte(id: string, entree: SaisieCarteValidee): Promise<void> {
  const ligne = await requeteUne<{ code: string }>(
    `update cartes_nfc
        set libelle = $1, dossier_id = $2::uuid, client_id = ${CLIENT_DU_DOSSIER},
            destination = $3, place_id = $4, note = $5
      where id = $6::uuid returning code`,
    [entree.libelle, entree.dossierId, entree.destination, entree.placeId, entree.note, id],
  )
  // La nouvelle destination doit servir dès le tap suivant, pas dans 30 s.
  if (ligne) oublierCarte(ligne.code)
}

export async function basculerCarte(id: string, actif: boolean): Promise<void> {
  const ligne = await requeteUne<{ code: string }>(
    'update cartes_nfc set actif = $2 where id = $1::uuid returning code',
    [id, actif],
  )
  if (ligne) oublierCarte(ligne.code)
}

export async function supprimerCarte(id: string): Promise<void> {
  // Le code reste dans codes_cartes_emis : il ne sera jamais réattribué, et
  // une carte oubliée dans un tiroir ne mènera jamais chez quelqu'un d'autre.
  const ligne = await requeteUne<{ code: string }>(
    'delete from cartes_nfc where id = $1::uuid returning code',
    [id],
  )
  if (ligne) oublierCarte(ligne.code)
}

// ---------------------------------------------------------------------------
// Redirection
// ---------------------------------------------------------------------------

export async function resoudre(code: string): Promise<{ id: string; destination: string } | null> {
  return requeteUne<{ id: string; destination: string }>(
    'select id, destination from cartes_nfc where code = $1 and actif',
    [code],
  )
}

// ---------------------------------------------------------------------------
// Statistiques
//
// Chaque statistique se calcule sur une PORTÉE : une carte, un dossier (toutes
// les cartes d'un commerce), ou tout le parc quand la portée est vide.
// ---------------------------------------------------------------------------

export type Portee = { carte?: string | null; dossier?: string | null }

/** Paramètres SQL de la portée, validés : un identifiant mal formé ne vise rien. */
function parametresPortee(p: Portee): [string | null, string | null] {
  const carte = p.carte && UUID.test(p.carte) ? p.carte : null
  const dossier = p.dossier && UUID.test(p.dossier) ? p.dossier : null
  if ((p.carte && !carte) || (p.dossier && !dossier)) {
    // Une portée demandée mais invalide ne doit JAMAIS retomber sur « tout ».
    return ['00000000-0000-0000-0000-000000000000', null]
  }
  return [carte, dossier]
}

/** Condition sur l'alias `t` (taps), avec les paramètres $a (carte) et $b (dossier). */
function condition(a: string, b: string): string {
  return `(${a}::uuid is null or t.carte_id = ${a}::uuid)
      and (${b}::uuid is null or t.carte_id in (select id from cartes_nfc where dossier_id = ${b}::uuid))`
}

export type Point = { jour: string; taps: number }

/** Taps par jour, jours vides compris : un trou dans la courbe est une information. */
export async function tapsParJour(portee: Portee, jours: number): Promise<Point[]> {
  const [a, b] = parametresPortee(portee)
  return requete<Point>(
    `with bornes as (
       select (now() at time zone $3)::date as fin
     ), calendrier as (
       select generate_series(fin - ($4::int - 1), fin, interval '1 day')::date as jour from bornes
     )
     select to_char(c.jour, 'YYYY-MM-DD') as jour,
            count(t.id)::int as taps
       from calendrier c
       left join taps t
         on (t.tape_le at time zone $3)::date = c.jour
        and ${condition('$1', '$2')}
      group by c.jour
      order by c.jour`,
    [a, b, FUSEAU, jours],
  )
}

export type Repartition = { cle: number; taps: number }

/** Taps par heure de la journée (0–23), sur la période. */
export async function tapsParHeure(portee: Portee, jours: number): Promise<Repartition[]> {
  const [a, b] = parametresPortee(portee)
  return requete<Repartition>(
    `select h as cle, count(t.id)::int as taps
       from generate_series(0, 23) h
       left join taps t
         on extract(hour from t.tape_le at time zone $3)::int = h
        and t.tape_le >= now() - make_interval(days => $4::int)
        and ${condition('$1', '$2')}
      group by h order by h`,
    [a, b, FUSEAU, jours],
  )
}

/** Taps par jour de la semaine (1 = lundi … 7 = dimanche), sur la période. */
export async function tapsParJourSemaine(portee: Portee, jours: number): Promise<Repartition[]> {
  const [a, b] = parametresPortee(portee)
  return requete<Repartition>(
    `select d as cle, count(t.id)::int as taps
       from generate_series(1, 7) d
       left join taps t
         on extract(isodow from t.tape_le at time zone $3)::int = d
        and t.tape_le >= now() - make_interval(days => $4::int)
        and ${condition('$1', '$2')}
      group by d order by d`,
    [a, b, FUSEAU, jours],
  )
}

export type Case = { jour: number; heure: number; taps: number }

/** La grille jour × heure (7 × 24 cases, vides comprises), heure du Québec. */
export async function tapsJourHeure(portee: Portee, jours: number): Promise<Case[]> {
  const [a, b] = parametresPortee(portee)
  return requete<Case>(
    `select d as jour, h as heure, count(t.id)::int as taps
       from generate_series(1, 7) d
      cross join generate_series(0, 23) h
       left join taps t
         on extract(isodow from t.tape_le at time zone $3)::int = d
        and extract(hour from t.tape_le at time zone $3)::int = h
        and t.tape_le >= now() - make_interval(days => $4::int)
        and ${condition('$1', '$2')}
      group by d, h order by d, h`,
    [a, b, FUSEAU, jours],
  )
}

export type PointCumul = { jour: string; taps: number; cumul: number }

/**
 * Taps cumulés depuis la pose : du jour de création de la plus ancienne carte
 * de la portée jusqu'à aujourd'hui. Au-delà de 400 jours, un point par
 * semaine — la courbe garde sa forme, le navigateur respire.
 */
export async function cumulDepuisPose(portee: Portee): Promise<PointCumul[]> {
  const [a, b] = parametresPortee(portee)
  return requete<PointCumul>(
    `with debut as (
       select coalesce(min((cree_le at time zone $3)::date), (now() at time zone $3)::date) as d
         from cartes_nfc
        where ($1::uuid is null or id = $1::uuid)
          and ($2::uuid is null or dossier_id = $2::uuid)
     ), pas as (
       select case when (now() at time zone $3)::date - d > 400 then 7 else 1 end as n, d from debut
     ), cal as (
       select generate_series(pas.d, (now() at time zone $3)::date, make_interval(days => pas.n))::date as jour,
              pas.n
         from pas
     ), par_jour as (
       select cal.jour, count(t.id)::int as taps
         from cal
         left join taps t
           on (t.tape_le at time zone $3)::date >= cal.jour
          and (t.tape_le at time zone $3)::date <  cal.jour + cal.n
          and ${condition('$1', '$2')}
        group by cal.jour
     )
     select to_char(jour, 'YYYY-MM-DD') as jour, taps,
            (sum(taps) over (order by jour))::int as cumul
       from par_jour order by jour`,
    [a, b, FUSEAU],
  )
}

/** Taps par jour de plusieurs cartes, pour les comparer sur une même échelle. */
export async function seriesParCarte(ids: string[], jours: number): Promise<Record<string, number[]>> {
  const valides = ids.filter((i) => UUID.test(i))
  if (!valides.length) return {}
  const lignes = await requete<{ carte_id: string; serie: number[] }>(
    `with cal as (
       select generate_series((now() at time zone $2)::date - ($3::int - 1),
                              (now() at time zone $2)::date, interval '1 day')::date as jour
     )
     select c.id as carte_id,
            array_agg(coalesce(n.taps, 0) order by cal.jour) as serie
       from unnest($1::uuid[]) as c(id)
      cross join cal
       left join lateral (
         select count(*)::int as taps from taps t
          where t.carte_id = c.id and (t.tape_le at time zone $2)::date = cal.jour
       ) n on true
      group by c.id`,
    [valides, FUSEAU, jours],
  )
  return Object.fromEntries(lignes.map((l) => [l.carte_id, l.serie]))
}

export type Totaux = {
  courant: number
  precedent: number
  nfc: number
  qr: number
  ios: number
  android: number
  autre: number
  cartes_tapees: number
  dernier_tap: string | null
}

/**
 * Totaux de la période, et de la période d'égale longueur qui la précède —
 * une évolution ne se lit que contre une base comparable.
 */
export async function totaux(portee: Portee, jours: number): Promise<Totaux> {
  const [a, b] = parametresPortee(portee)
  const ligne = await requeteUne<Totaux>(
    `with p as (select now() - make_interval(days => $3::int) as debut,
                       now() - make_interval(days => 2 * $3::int) as avant)
     select count(*) filter (where t.tape_le >= p.debut)::int                          as courant,
            count(*) filter (where t.tape_le >= p.avant and t.tape_le < p.debut)::int  as precedent,
            count(*) filter (where t.tape_le >= p.debut and t.canal = 'nfc')::int      as nfc,
            count(*) filter (where t.tape_le >= p.debut and t.canal = 'qr')::int       as qr,
            count(*) filter (where t.tape_le >= p.debut and t.appareil = 'ios')::int   as ios,
            count(*) filter (where t.tape_le >= p.debut and t.appareil = 'android')::int as android,
            count(*) filter (where t.tape_le >= p.debut and t.appareil = 'autre')::int as autre,
            count(distinct t.carte_id) filter (where t.tape_le >= p.debut)::int        as cartes_tapees,
            max(t.tape_le)                                                             as dernier_tap
       from p left join taps t on ${condition('$1', '$2')}`,
    [a, b, jours],
  )
  return (
    ligne ?? {
      courant: 0, precedent: 0, nfc: 0, qr: 0, ios: 0, android: 0, autre: 0,
      cartes_tapees: 0, dernier_tap: null,
    }
  )
}

/** Taps de chaque carte sur la période, pour le classement. */
export async function tapsParCarte(jours: number): Promise<Record<string, { courant: number; precedent: number }>> {
  const lignes = await requete<{ carte_id: string; courant: number; precedent: number }>(
    `select carte_id,
            count(*) filter (where tape_le >= now() - make_interval(days => $1::int))::int as courant,
            count(*) filter (where tape_le <  now() - make_interval(days => $1::int))::int as precedent
       from taps
      where tape_le >= now() - make_interval(days => 2 * $1::int)
      group by carte_id`,
    [jours],
  )
  return Object.fromEntries(lignes.map((l) => [l.carte_id, { courant: l.courant, precedent: l.precedent }]))
}

/** Les quatorze derniers jours d'une carte, pour la mini-courbe du tableau. */
export async function tendances(jours = 14): Promise<Record<string, number[]>> {
  const lignes = await requete<{ carte_id: string; serie: number[] }>(
    `with cal as (
       select generate_series((now() at time zone $2)::date - ($1::int - 1),
                              (now() at time zone $2)::date, interval '1 day')::date as jour
     )
     select c.id as carte_id,
            array_agg((select count(*)::int from taps t
                        where t.carte_id = c.id
                          and (t.tape_le at time zone $2)::date = cal.jour) order by cal.jour) as serie
       from cartes_nfc c cross join cal
      group by c.id`,
    [jours, FUSEAU],
  )
  return Object.fromEntries(lignes.map((l) => [l.carte_id, l.serie]))
}

export type DernierTap = { tape_le: string; canal: 'nfc' | 'qr'; appareil: string }

export async function derniersTaps(carteId: string, nombre = 15): Promise<DernierTap[]> {
  return requete<DernierTap>(
    `select tape_le, canal, appareil from taps where carte_id = $1::uuid
      order by tape_le desc limit $2`,
    [carteId, nombre],
  )
}
