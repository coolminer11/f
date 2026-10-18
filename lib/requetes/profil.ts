import 'server-only'
import { requete, requeteUne } from '@/lib/db'

/**
 * Le portrait chiffré d'un commerce : tout ce qu'il faut pour les surprises
 * du jour, les conseils, les premiers pas et « Votre année Tapora ».
 *
 * Une seule passe sur les taps du dossier, en heure du Québec. Bornes de
 * dates facultatives (pour une année) ; sans bornes, depuis le début.
 */
export type Profil = {
  total: number
  premier_tap: string | null
  dernier_tap: string | null
  jours_actifs: number
  /** Jours écoulés du premier tap à aujourd'hui (ou à la fin de la période). */
  jours_couverts: number
  meilleur_jour: string | null
  meilleur_jour_taps: number
  plus_longue_serie: number
  heures: number[]
  semaine: number[]
  ios: number
  android: number
  autre: number
  nfc: number
  qr: number
  matin: number
  midi: number
  apres_midi: number
  soir: number
  nuit: number
  fin_de_semaine: number
  mois_fort: string | null
  mois_fort_taps: number
  plus_tot: string | null
  plus_tard: string | null
  sept_jours: number
  sept_precedents: number
  semaine_forte_debut: string | null
  semaine_forte_taps: number
}

export async function profil(dossierId: string, debut?: string, fin?: string): Promise<Profil> {
  const l = await requeteUne<Profil>(
    `with t as (
       select (t.tape_le at time zone 'America/Toronto') as local, t.canal, t.appareil
         from taps t join cartes_nfc c on c.id = t.carte_id
        where c.dossier_id = $1::uuid
          and ($2::date is null or t.tape_le >= ($2::date::timestamp at time zone 'America/Toronto'))
          and ($3::date is null or t.tape_le <  (($3::date + 1)::timestamp at time zone 'America/Toronto'))
     ),
     auj as (select least(coalesce($3::date, '9999-12-31'), (now() at time zone 'America/Toronto')::date) as d),
     jours as (select local::date as jour, count(*)::int as n from t group by 1),
     iles as (select jour, jour - (row_number() over (order by jour))::int as ile from jours),
     series as (select count(*)::int as n from iles group by ile),
     meilleur as (select jour, n from jours order by n desc, jour desc limit 1),
     mois as (select to_char(date_trunc('month', local), 'YYYY-MM') as m, count(*)::int as n from t group by 1 order by 2 desc, 1 desc limit 1),
     semaines as (select date_trunc('week', local)::date as s, count(*)::int as n from t group by 1 order by 2 desc, 1 desc limit 1),
     h as (select g as heure, (select count(*)::int from t where extract(hour from local) = g) as n from generate_series(0, 23) g),
     s as (select g as jour, (select count(*)::int from t where extract(isodow from local) = g) as n from generate_series(1, 7) g)
     select (select count(*)::int from t) as total,
            (select to_char(min(local), 'YYYY-MM-DD') from t) as premier_tap,
            (select to_char(max(local), 'YYYY-MM-DD"T"HH24:MI') from t) as dernier_tap,
            (select count(*)::int from jours) as jours_actifs,
            coalesce((select (auj.d - min(local)::date + 1)::int from t, auj group by auj.d), 0) as jours_couverts,
            (select to_char(jour, 'YYYY-MM-DD') from meilleur) as meilleur_jour,
            coalesce((select n from meilleur), 0) as meilleur_jour_taps,
            coalesce((select max(n) from series), 0) as plus_longue_serie,
            (select array_agg(n order by heure) from h) as heures,
            (select array_agg(n order by jour) from s) as semaine,
            (select count(*)::int from t where appareil = 'ios') as ios,
            (select count(*)::int from t where appareil = 'android') as android,
            (select count(*)::int from t where appareil = 'autre') as autre,
            (select count(*)::int from t where canal = 'nfc') as nfc,
            (select count(*)::int from t where canal = 'qr') as qr,
            (select count(*)::int from t where extract(hour from local) between 5 and 10) as matin,
            (select count(*)::int from t where extract(hour from local) between 11 and 13) as midi,
            (select count(*)::int from t where extract(hour from local) between 14 and 16) as apres_midi,
            (select count(*)::int from t where extract(hour from local) between 17 and 21) as soir,
            (select count(*)::int from t where extract(hour from local) >= 22 or extract(hour from local) < 5) as nuit,
            (select count(*)::int from t where extract(isodow from local) >= 6) as fin_de_semaine,
            (select m from mois) as mois_fort,
            coalesce((select n from mois), 0) as mois_fort_taps,
            (select to_char(min(local::time), 'HH24:MI') from t where extract(hour from local) >= 4) as plus_tot,
            (select to_char(max(local::time), 'HH24:MI') from t) as plus_tard,
            (select count(*)::int from t, auj where local::date > auj.d - 7) as sept_jours,
            (select count(*)::int from t, auj where local::date <= auj.d - 7 and local::date > auj.d - 14) as sept_precedents,
            (select to_char(s, 'YYYY-MM-DD') from semaines) as semaine_forte_debut,
            coalesce((select n from semaines), 0) as semaine_forte_taps`,
    [dossierId, debut ?? null, fin ?? null],
  )
  return l!
}

export type LigneCourse = { id: string; libelle: string; semaine: number; precedente: number }

/** Les cartes actives d'un dossier, taps de la semaine (depuis lundi) et de la précédente. */
export async function course(dossierId: string): Promise<LigneCourse[]> {
  return requete<LigneCourse>(
    `with lundi as (select date_trunc('week', now() at time zone 'America/Toronto') as d)
     select c.id, c.libelle,
            count(t.id) filter (where t.tape_le >= (lundi.d at time zone 'America/Toronto'))::int as semaine,
            count(t.id) filter (where t.tape_le <  (lundi.d at time zone 'America/Toronto')
                                  and t.tape_le >= ((lundi.d - interval '7 days') at time zone 'America/Toronto'))::int as precedente
       from cartes_nfc c
       cross join lundi
       left join taps t on t.carte_id = c.id and t.tape_le >= ((lundi.d - interval '7 days') at time zone 'America/Toronto')
      where c.dossier_id = $1::uuid and c.actif
      group by c.id, c.libelle, lundi.d
      order by semaine desc, precedente desc, lower(c.libelle)`,
    [dossierId],
  )
}

export type CarteTotale = { libelle: string; total: number; periode: number; dernier_tap: string | null; jours_silence: number | null }

/** Chaque carte active : total, taps sur la période (bornes facultatives), silence en jours. */
export async function cartesProfil(dossierId: string, debut?: string, fin?: string): Promise<CarteTotale[]> {
  return requete<CarteTotale>(
    `select c.libelle,
            count(t.id)::int as total,
            count(t.id) filter (where ($2::date is null or t.tape_le >= ($2::date::timestamp at time zone 'America/Toronto'))
                              and ($3::date is null or t.tape_le < (($3::date + 1)::timestamp at time zone 'America/Toronto')))::int as periode,
            max(t.tape_le) as dernier_tap,
            case when max(t.tape_le) is null then null
                 else ((now() at time zone 'America/Toronto')::date - (max(t.tape_le) at time zone 'America/Toronto')::date)::int end as jours_silence
       from cartes_nfc c left join taps t on t.carte_id = c.id
      where c.dossier_id = $1::uuid and c.actif
      group by c.id, c.libelle
      order by periode desc, total desc`,
    [dossierId, debut ?? null, fin ?? null],
  )
}

export type Pose = { pose: string | null; avis_pose: number | null; avis_mois_avant: number | null; source_pose: 'saisie' | 'releve' | null }

/**
 * Le point de départ du dossier : date de pose (première carte créée) et
 * nombre d'avis à ce moment — saisi dans le dossier, sinon le tout premier
 * relevé d'avis.
 */
export async function pointDeDepart(dossierId: string, cleManuelle: string): Promise<Pose> {
  const l = await requeteUne<{ pose: string | null; avis_pose: number | null; avis_mois_avant: number | null; premier_releve: number | null }>(
    `select to_char((select min(cree_le) at time zone 'America/Toronto' from cartes_nfc where dossier_id = $1::uuid), 'YYYY-MM-DD') as pose,
            d.avis_pose, d.avis_mois_avant::float8 as avis_mois_avant,
            (select nb_avis from avis_google where place_id = $2 order by jour limit 1) as premier_releve
       from dossiers_cartes d where d.id = $1::uuid`,
    [dossierId, cleManuelle],
  )
  if (!l) return { pose: null, avis_pose: null, avis_mois_avant: null, source_pose: null }
  const avisPose = l.avis_pose ?? l.premier_releve
  return {
    pose: l.pose,
    avis_pose: avisPose,
    avis_mois_avant: l.avis_mois_avant,
    source_pose: l.avis_pose !== null ? 'saisie' : l.premier_releve !== null ? 'releve' : null,
  }
}

/** Avis au début et à la fin d'une période (dernier relevé connu à chaque date). */
export async function avisEntre(cles: string[], debut: string, fin: string): Promise<{ debut: number | null; fin: number | null; note: number | null }> {
  const l = await requeteUne<{ debut: number | null; fin: number | null; note: number | null }>(
    `with f as (
       select distinct on (place_id) place_id, nb_avis, note from avis_google
        where place_id = any($1) and jour <= $3::date order by place_id, jour desc
     ), d as (
       select distinct on (place_id) place_id, nb_avis from avis_google
        where place_id = any($1)
        order by place_id, (jour < $2::date) desc, case when jour < $2::date then jour end desc nulls last, jour
     )
     select (select sum(nb_avis)::int from d) as debut, (select sum(nb_avis)::int from f) as fin,
            (select case when count(*) = 1 then max(note)::float8 end from f) as note`,
    [cles, debut, fin],
  )
  return l ?? { debut: null, fin: null, note: null }
}

/** Taps de chaque mois d'une année (12 valeurs), et le total d'avant l'année. */
export async function anneeEnMois(dossierId: string, annee: number): Promise<{ mois: number[]; avant: number }> {
  const l = await requeteUne<{ mois: number[]; avant: number }>(
    `with t as (
       select t.tape_le at time zone 'America/Toronto' as local
         from taps t join cartes_nfc c on c.id = t.carte_id where c.dossier_id = $1::uuid
     )
     select (select array_agg(coalesce((select count(*)::int from t where extract(year from local) = $2 and extract(month from local) = m), 0) order by m)
               from generate_series(1, 12) m) as mois,
            (select count(*)::int from t where extract(year from local) < $2) as avant`,
    [dossierId, annee],
  )
  return l ?? { mois: Array(12).fill(0), avant: 0 }
}
