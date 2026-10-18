import 'server-only'
import { requete, requeteUne } from '@/lib/db'

/**
 * Avis Google saisis à la main : une fois par semaine, on regarde la fiche
 * Google du commerce et on entre le nombre d'avis et la note.
 *
 * Les relevés vont dans la même table que les relevés automatiques
 * (`avis_google`), sous une clé propre au dossier — « manuel_d<id> » — ou à
 * la carte quand elle n'a pas de dossier — « manuel_c<id> ». Tout ce qui lit
 * les avis (graphiques, page client, rapport mensuel) fonctionne donc sans
 * savoir d'où vient le chiffre.
 */
export const RYTHME_JOURS = 7

export type Cible = { type: 'dossier' | 'carte'; id: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function cleAvis(c: Cible): string {
  return `manuel_${c.type === 'dossier' ? 'd' : 'c'}${c.id.replace(/-/g, '').toLowerCase()}`
}

/** Enregistre le relevé du jour (le remplace s'il existe déjà). */
export async function noterAvis(c: Cible, nb: number, note: number | null): Promise<void> {
  if (!UUID.test(c.id)) throw new Error('Cible invalide.')
  const nom = await requeteUne<{ nom: string }>(
    c.type === 'dossier'
      ? `select nom from dossiers_cartes where id = $1::uuid`
      : `select libelle as nom from cartes_nfc where id = $1::uuid`,
    [c.id],
  )
  if (!nom) throw new Error('Introuvable.')
  const cle = cleAvis(c)
  await requete(
    `insert into fiches_google (place_id, nom) values ($1, $2)
     on conflict (place_id) do update set nom = excluded.nom, maj_le = now()`,
    [cle, nom.nom.slice(0, 200)],
  )
  await requete(
    `insert into avis_google (place_id, jour, nb_avis, note)
     values ($1, (now() at time zone 'America/Toronto')::date, $2, $3)
     on conflict (place_id, jour) do update
       set nb_avis = excluded.nb_avis, note = excluded.note, releve_le = now()`,
    [cle, nb, note],
  )
}

export type Suivi = Cible & {
  nom: string
  dernier_jour: string | null
  nb_avis: number | null
  note: number | null
  /** Jours depuis le dernier relevé ; null si jamais relevé. */
  jours: number | null
  a_faire: boolean
}

const SUIVI = `
  with cibles as (
    select 'dossier'::text as type, d.id, d.nom, 'manuel_d' || replace(d.id::text, '-', '') as cle
      from dossiers_cartes d
     where exists (select 1 from cartes_nfc c where c.dossier_id = d.id and c.actif)
    union all
    select 'carte', c.id, c.libelle, 'manuel_c' || replace(c.id::text, '-', '')
      from cartes_nfc c
     where c.dossier_id is null and c.actif
  )
  select x.type, x.id, x.nom,
         to_char(a.jour, 'YYYY-MM-DD') as dernier_jour, a.nb_avis, a.note,
         ((now() at time zone 'America/Toronto')::date - a.jour)::int as jours
    from cibles x
    left join lateral (
      select jour, nb_avis, note from avis_google where place_id = x.cle order by jour desc limit 1
    ) a on true`

function avecEtat(lignes: Omit<Suivi, 'a_faire'>[]): Suivi[] {
  return lignes
    .map((l) => ({ ...l, a_faire: l.jours === null || l.jours >= RYTHME_JOURS }))
    .sort((a, b) => Number(b.a_faire) - Number(a.a_faire) || (b.jours ?? 9999) - (a.jours ?? 9999) || a.nom.localeCompare(b.nom, 'fr'))
}

/** Tous les commerces (dossiers) et cartes isolées, ceux à mettre à jour d'abord. */
export async function suiviAvis(): Promise<Suivi[]> {
  return avecEtat(await requete<Omit<Suivi, 'a_faire'>>(SUIVI))
}

export async function suiviPour(c: Cible): Promise<Suivi | null> {
  if (!UUID.test(c.id)) return null
  const lignes = await requete<Omit<Suivi, 'a_faire'>>(`select * from (${SUIVI}) s where s.type = $1 and s.id = $2::uuid`, [c.type, c.id])
  return avecEtat(lignes)[0] ?? null
}
