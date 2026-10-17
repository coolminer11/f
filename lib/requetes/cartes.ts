import 'server-only'
import { requete, requeteUne } from '@/lib/db'

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
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function listerCartes(): Promise<Carte[]> {
  return requete<Carte>(
    'select * from v_cartes_nfc order by actif desc, taps_30j desc, cree_le desc',
  )
}

export async function carte(id: string): Promise<Carte | null> {
  if (!UUID.test(id)) return null
  return requeteUne<Carte>('select * from v_cartes_nfc where id = $1::uuid', [id])
}

export async function creerCarte(entree: {
  libelle: string
  clientId: string | null
  destination: string
  note: string | null
}): Promise<string> {
  const ligne = await requeteUne<{ id: string }>(
    `insert into cartes_nfc (code, libelle, client_id, destination, note)
     values (nouveau_code_carte(), $1, $2::uuid, $3, $4) returning id`,
    [entree.libelle, entree.clientId, entree.destination, entree.note],
  )
  return ligne!.id
}

export async function modifierCarte(
  id: string,
  entree: { libelle: string; clientId: string | null; destination: string; note: string | null },
): Promise<void> {
  await requete(
    `update cartes_nfc set libelle = $2, client_id = $3::uuid, destination = $4, note = $5
      where id = $1::uuid`,
    [id, entree.libelle, entree.clientId, entree.destination, entree.note],
  )
}

export async function basculerCarte(id: string, actif: boolean): Promise<void> {
  await requete('update cartes_nfc set actif = $2 where id = $1::uuid', [id, actif])
}

export async function supprimerCarte(id: string): Promise<void> {
  // Le code reste dans codes_cartes_emis : il ne sera jamais réattribué, et
  // une carte oubliée dans un tiroir ne mènera jamais chez quelqu'un d'autre.
  await requete('delete from cartes_nfc where id = $1::uuid', [id])
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

export async function enregistrerTap(
  carteId: string,
  canal: 'nfc' | 'qr',
  appareil: 'ios' | 'android' | 'autre',
): Promise<void> {
  await requete('insert into taps (carte_id, canal, appareil) values ($1::uuid, $2, $3)', [
    carteId,
    canal,
    appareil,
  ])
}

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------

export type Point = { jour: string; taps: number }

/** Taps par jour, jours vides compris : un trou dans la courbe est une information. */
export async function tapsParJour(carteId: string | null, jours: number): Promise<Point[]> {
  return requete<Point>(
    `with bornes as (
       select (now() at time zone $3)::date as fin
     ), calendrier as (
       select generate_series(fin - ($2::int - 1), fin, interval '1 day')::date as jour from bornes
     )
     select to_char(c.jour, 'YYYY-MM-DD') as jour,
            count(t.id)::int as taps
       from calendrier c
       left join taps t
         on (t.tape_le at time zone $3)::date = c.jour
        and ($1::uuid is null or t.carte_id = $1::uuid)
      group by c.jour
      order by c.jour`,
    [carteId, jours, FUSEAU],
  )
}

export type Repartition = { cle: number; taps: number }

/** Taps par heure de la journée (0–23), sur la période. */
export async function tapsParHeure(carteId: string | null, jours: number): Promise<Repartition[]> {
  return requete<Repartition>(
    `select h as cle, count(t.id)::int as taps
       from generate_series(0, 23) h
       left join taps t
         on extract(hour from t.tape_le at time zone $2)::int = h
        and t.tape_le >= now() - make_interval(days => $3::int)
        and ($1::uuid is null or t.carte_id = $1::uuid)
      group by h order by h`,
    [carteId, FUSEAU, jours],
  )
}

/** Taps par jour de la semaine (1 = lundi … 7 = dimanche), sur la période. */
export async function tapsParJourSemaine(carteId: string | null, jours: number): Promise<Repartition[]> {
  return requete<Repartition>(
    `select d as cle, count(t.id)::int as taps
       from generate_series(1, 7) d
       left join taps t
         on extract(isodow from t.tape_le at time zone $2)::int = d
        and t.tape_le >= now() - make_interval(days => $3::int)
        and ($1::uuid is null or t.carte_id = $1::uuid)
      group by d order by d`,
    [carteId, FUSEAU, jours],
  )
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
export async function totaux(carteId: string | null, jours: number): Promise<Totaux> {
  const ligne = await requeteUne<Totaux>(
    `with p as (select now() - make_interval(days => $2::int) as debut,
                       now() - make_interval(days => 2 * $2::int) as avant)
     select count(*) filter (where t.tape_le >= p.debut)::int                          as courant,
            count(*) filter (where t.tape_le >= p.avant and t.tape_le < p.debut)::int  as precedent,
            count(*) filter (where t.tape_le >= p.debut and t.canal = 'nfc')::int      as nfc,
            count(*) filter (where t.tape_le >= p.debut and t.canal = 'qr')::int       as qr,
            count(*) filter (where t.tape_le >= p.debut and t.appareil = 'ios')::int   as ios,
            count(*) filter (where t.tape_le >= p.debut and t.appareil = 'android')::int as android,
            count(*) filter (where t.tape_le >= p.debut and t.appareil = 'autre')::int as autre,
            count(distinct t.carte_id) filter (where t.tape_le >= p.debut)::int        as cartes_tapees,
            max(t.tape_le)                                                             as dernier_tap
       from p left join taps t on ($1::uuid is null or t.carte_id = $1::uuid)`,
    [carteId, jours],
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
