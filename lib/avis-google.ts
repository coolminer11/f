import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import { masquer, secret } from '@/lib/secrets'

/**
 * Avis Google : combien d'avis a la fiche d'un commerce, et quelle note.
 *
 * Passe par l'API Places (New) de Google avec la clé GOOGLE_PLACES_CLE.
 * Sans clé, tout ce module se tait : les écrans affichent « non branché ».
 *
 * ── LE COÛT EST PLAFONNÉ DANS LE CODE ──────────────────────────────────────
 * Google offre chaque mois une part gratuite par type d'appel (environ 1 000
 * lectures de fiche avec note et nombre d'avis, 5 000 recherches). Au-delà,
 * c'est facturé. Le compteur `appels_google` est incrémenté AVANT chaque
 * appel, de façon atomique ; une fois le plafond atteint, plus aucun appel ne
 * part jusqu'au mois suivant. Les plafonds sont sous la part gratuite, avec
 * de la marge : la facture reste à 0 $, quoi qu'il arrive.
 *
 * Un relevé par semaine et par fiche : le nombre d'avis bouge lentement, et
 * c'est ~4 lectures par commerce et par mois — de quoi suivre environ 200
 * commerces dans la part gratuite. Au-delà de 200, le rythme s'espace tout
 * seul pour tenir sous le plafond.
 */
const JOURS_ENTRE_RELEVES = 7
const PLAFOND_DETAILS = 900
const PLAFOND_RECHERCHE = 400
const DELAI_MS = 8_000

export const placesConfigure = (): boolean => Boolean(secret('GOOGLE_PLACES_CLE'))

/** Réserve un appel ; faux si le plafond du mois est atteint. Atomique. */
async function reserver(sorte: 'details' | 'recherche'): Promise<boolean> {
  const plafond = sorte === 'details' ? PLAFOND_DETAILS : PLAFOND_RECHERCHE
  const ligne = await requeteUne<{ nb: number }>(
    `insert into appels_google (mois, sorte, nb)
     values (date_trunc('month', now() at time zone 'UTC')::date, $1, 1)
     on conflict (mois, sorte) do update set nb = appels_google.nb + 1
      where appels_google.nb < $2
     returning nb`,
    [sorte, plafond],
  )
  return ligne !== null
}

export async function quotaDuMois(): Promise<{ details: number; recherche: number; plafondDetails: number; plafondRecherche: number }> {
  const lignes = await requete<{ sorte: string; nb: number }>(
    `select sorte, nb from appels_google where mois = date_trunc('month', now() at time zone 'UTC')::date`,
  )
  const nb = (s: string) => lignes.find((l) => l.sorte === s)?.nb ?? 0
  return { details: nb('details'), recherche: nb('recherche'), plafondDetails: PLAFOND_DETAILS, plafondRecherche: PLAFOND_RECHERCHE }
}

async function appelGoogle(url: string, champs: string, init: RequestInit = {}): Promise<unknown> {
  const r = await fetch(url, {
    ...init,
    headers: {
      'X-Goog-Api-Key': secret('GOOGLE_PLACES_CLE') as string,
      'X-Goog-FieldMask': champs,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(DELAI_MS),
    cache: 'no-store',
  })
  const corps = (await r.json().catch(() => ({}))) as { error?: { message?: string } }
  if (!r.ok) throw new Error(masquer(`Google : ${corps.error?.message ?? `HTTP ${r.status}`}`))
  return corps
}

export const PLACE_ID = /^[A-Za-z0-9_-]{10,255}$/

export type Fiche = { place_id: string; nom: string; adresse: string }

/** Recherche d'une fiche par nom et ville : « Café Olimpico Montréal ». */
export async function chercherFiches(texte: string): Promise<Fiche[]> {
  if (!placesConfigure()) throw new Error('La clé Google (GOOGLE_PLACES_CLE) n’est pas configurée.')
  const q = texte.trim().slice(0, 200)
  if (q.length < 3) return []
  if (!(await reserver('recherche'))) {
    throw new Error('Plafond mensuel de recherches Google atteint : réessayez le mois prochain, ou collez l’identifiant de la fiche.')
  }
  const r = (await appelGoogle(
    'https://places.googleapis.com/v1/places:searchText',
    'places.id,places.displayName,places.formattedAddress',
    { method: 'POST', body: JSON.stringify({ textQuery: q, languageCode: 'fr', regionCode: 'CA', pageSize: 5 }) },
  )) as { places?: { id?: string; displayName?: { text?: string }; formattedAddress?: string }[] }
  return (r.places ?? [])
    .filter((p) => p.id && PLACE_ID.test(p.id))
    .map((p) => ({ place_id: p.id!, nom: p.displayName?.text ?? 'Sans nom', adresse: p.formattedAddress ?? '' }))
}

/** Lien qui ouvre directement la fenêtre « Écrire un avis » de la fiche. */
export function lienAvis(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
}

export async function enregistrerFiche(f: { place_id: string; nom: string | null; adresse: string | null }): Promise<void> {
  if (!PLACE_ID.test(f.place_id)) return
  await requete(
    `insert into fiches_google (place_id, nom, adresse) values ($1, $2, $3)
     on conflict (place_id) do update
       set nom = coalesce(excluded.nom, fiches_google.nom),
           adresse = coalesce(excluded.adresse, fiches_google.adresse)`,
    [f.place_id, f.nom?.slice(0, 200) || null, f.adresse?.slice(0, 300) || null],
  )
}

/** Un relevé : nombre d'avis et note du jour. Faux si rien n'a été lu. */
export async function releverFiche(placeId: string): Promise<boolean> {
  if (!placesConfigure() || !PLACE_ID.test(placeId)) return false
  if (!(await reserver('details'))) return false
  const r = (await appelGoogle(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=fr`,
    'displayName,formattedAddress,rating,userRatingCount',
  )) as { displayName?: { text?: string }; formattedAddress?: string; rating?: number; userRatingCount?: number }
  await enregistrerFiche({ place_id: placeId, nom: r.displayName?.text ?? null, adresse: r.formattedAddress ?? null })
  await requete(`update fiches_google set maj_le = now() where place_id = $1`, [placeId])
  await requete(
    `insert into avis_google (place_id, jour, nb_avis, note)
     values ($1, (now() at time zone 'America/Toronto')::date, $2, $3)
     on conflict (place_id, jour) do update
       set nb_avis = excluded.nb_avis, note = excluded.note, releve_le = now()`,
    [placeId, Math.max(0, Math.round(r.userRatingCount ?? 0)), typeof r.rating === 'number' ? r.rating : null],
  )
  return true
}

const globale = globalThis as typeof globalThis & { __releveAvis?: number }

/**
 * Relève les fiches qui en ont besoin. Appelée à chaque réveil (toutes les
 * 10 min) ; ne fait réellement quelque chose qu'une fois par heure au plus,
 * et au plus 20 fiches par passage.
 */
export async function releverAvisSiNecessaire(): Promise<void> {
  if (!placesConfigure()) return
  const maintenant = Date.now()
  if (globale.__releveAvis && maintenant - globale.__releveAvis < 60 * 60 * 1000) return
  globale.__releveAvis = maintenant

  const fiches = await requete<{ place_id: string }>(
    `with suivies as (
       select distinct place_id from cartes_nfc where actif and place_id is not null
     ), rythme as (
       select greatest($2::int, ceil(count(*) * 31.0 / $1))::int as jours from suivies
     )
     select s.place_id
       from suivies s cross join rythme r
      where not exists (
        select 1 from avis_google a
         where a.place_id = s.place_id
           and a.jour > (now() at time zone 'America/Toronto')::date - r.jours
      )
      limit 20`,
    [PLAFOND_DETAILS, JOURS_ENTRE_RELEVES],
  )
  for (const f of fiches) {
    try {
      if (!(await releverFiche(f.place_id))) break
    } catch {
      // Une fiche supprimée chez Google ne doit pas bloquer les autres.
    }
  }
}

// ---------------------------------------------------------------------------
// Lecture pour les écrans
// ---------------------------------------------------------------------------

export type ResumeAvis = {
  fiches: number
  nb_actuel: number | null
  note: number | null
  nb_debut: number | null
  dernier_releve: string | null
}

/**
 * Nombre d'avis aujourd'hui et au début de la période, sur les fiches données
 * (une carte, ou toutes celles d'un dossier). Pour chaque fiche, on prend le
 * dernier relevé connu à chaque date : un relevé sauté n'est pas un zéro.
 */
export async function resumeAvis(placeIds: string[], jours: number): Promise<ResumeAvis> {
  const ids = [...new Set(placeIds.filter((p) => PLACE_ID.test(p)))]
  if (!ids.length) return { fiches: 0, nb_actuel: null, note: null, nb_debut: null, dernier_releve: null }
  const ligne = await requeteUne<ResumeAvis>(
    `with dernier as (
       select distinct on (place_id) place_id, nb_avis, note, releve_le
         from avis_google where place_id = any($1) order by place_id, jour desc
     ), debut as (
       select distinct on (place_id) place_id, nb_avis
         from avis_google
        where place_id = any($1)
          and jour <= (now() at time zone 'America/Toronto')::date - $2::int
        order by place_id, jour desc
     ), premier as (
       select distinct on (place_id) place_id, nb_avis
         from avis_google where place_id = any($1) order by place_id, jour
     )
     select (select count(*)::int from dernier) as fiches,
            (select sum(nb_avis)::int from dernier) as nb_actuel,
            (select case when count(*) = 1 then max(note) end from dernier) as note,
            (select sum(coalesce(d.nb_avis, p.nb_avis))::int
               from premier p left join debut d using (place_id)) as nb_debut,
            (select max(releve_le) from dernier) as dernier_releve`,
    [ids, jours],
  )
  return ligne ?? { fiches: 0, nb_actuel: null, note: null, nb_debut: null, dernier_releve: null }
}

/**
 * Avis gagnés par jour, en moyenne, sur les 90 derniers jours (somme des
 * fiches). Sert à estimer quand le prochain palier sera atteint. Null tant
 * qu'il n'y a pas au moins une semaine de relevés : une estimation sur deux
 * jours ne vaut rien.
 */
export async function rythmeAvis(placeIds: string[]): Promise<number | null> {
  const ids = [...new Set(placeIds.filter((p) => PLACE_ID.test(p)))]
  if (!ids.length) return null
  const l = await requeteUne<{ par_jour: number | null }>(
    `with bornes as (
       select place_id,
              (array_agg(nb_avis order by jour))[1] as nb0, min(jour) as j0,
              (array_agg(nb_avis order by jour desc))[1] as nb1, max(jour) as j1
         from avis_google
        where place_id = any($1) and jour >= (now() at time zone 'America/Toronto')::date - 90
        group by place_id
     )
     select sum((nb1 - nb0)::float8 / (j1 - j0)) filter (where j1 - j0 >= 7) as par_jour from bornes`,
    [ids],
  )
  return l?.par_jour && l.par_jour > 0 ? l.par_jour : null
}

/** Nombre d'avis jour par jour sur la période (somme des fiches, dernier relevé reporté). */
export async function serieAvis(placeIds: string[], jours: number): Promise<{ jour: string; nb: number | null }[]> {
  const ids = [...new Set(placeIds.filter((p) => PLACE_ID.test(p)))]
  if (!ids.length) return []
  return requete<{ jour: string; nb: number | null }>(
    `with cal as (
       select generate_series((now() at time zone 'America/Toronto')::date - ($2::int - 1),
                              (now() at time zone 'America/Toronto')::date, interval '1 day')::date as jour
     )
     select to_char(cal.jour, 'YYYY-MM-DD') as jour,
            (select sum(v.nb_avis)::int from (
               select distinct on (a.place_id) a.nb_avis
                 from avis_google a
                where a.place_id = any($1) and a.jour <= cal.jour
                order by a.place_id, a.jour desc
             ) v) as nb
       from cal order by cal.jour`,
    [ids, jours],
  )
}

/** Avis gagnés pendant un mois donné (« 2026-10-01 »), pour le rapport mensuel. */
export async function resumeAvisMois(
  placeIds: string[],
  mois: string,
): Promise<{ gagnes: number | null; total: number | null; note: number | null }> {
  const ids = [...new Set(placeIds.filter((p) => PLACE_ID.test(p)))]
  if (!ids.length) return { gagnes: null, total: null, note: null }
  const l = await requeteUne<{ fin: number | null; debut: number | null; note: number | null; fiches: number }>(
    `with fin as (
       select distinct on (place_id) place_id, nb_avis, note
         from avis_google
        where place_id = any($1) and jour < $2::date + interval '1 month'
        order by place_id, jour desc
     ), debut as (
       select distinct on (place_id) place_id, nb_avis
         from avis_google
        where place_id = any($1)
        order by place_id,
                 (jour < $2::date) desc,           -- d'abord le dernier relevé d'avant le mois
                 case when jour < $2::date then jour end desc,
                 jour                                -- sinon le premier du mois
     )
     select (select sum(nb_avis)::int from fin) as fin,
            (select sum(d.nb_avis)::int from debut d where d.place_id in (select place_id from fin)) as debut,
            (select case when count(*) = 1 then max(note) end from fin) as note,
            (select count(*)::int from fin) as fiches`,
    [ids, mois],
  )
  if (!l || l.fin === null) return { gagnes: null, total: null, note: null }
  return { gagnes: l.debut !== null ? l.fin - l.debut : null, total: l.fin, note: l.note }
}
