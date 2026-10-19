import 'server-only'
import { requeteUne } from '@/lib/db'
import { cleAvis } from '@/lib/avis-manuels'
import { dernierAvis } from '@/lib/badge'
import { pointDeDepart } from '@/lib/requetes/profil'

/**
 * Les chiffres d'une étude de cas : depuis la pose, combien d'avis gagnés,
 * en combien de jours, avec combien de taps — et, si on connaît le rythme
 * d'avant, combien de fois plus vite. Rien d'inventé : sans relevé d'avis à
 * la pose et aujourd'hui, pas d'étude de cas.
 */
export type DonneesEtude = {
  nom: string
  pose: string
  jours: number
  avisPose: number
  avisMaintenant: number
  note: number | null
  taps: number
  /** Avis par mois avant Tapora (saisi dans le dossier), sinon null. */
  avantParMois: number | null
  /** Avis par mois depuis la pose. */
  apresParMois: number
}

export async function donneesEtude(dossierId: string, nom: string, placeIds: string[]): Promise<DonneesEtude | null> {
  const cle = cleAvis({ type: 'dossier', id: dossierId })
  const [depart, avis, t] = await Promise.all([
    pointDeDepart(dossierId, cle),
    dernierAvis([cle, ...placeIds]),
    requeteUne<{ taps: number; jours: number }>(
      `with p as (
         select coalesce(d.date_pose, (select min(cree_le) at time zone 'America/Toronto' from cartes_nfc where dossier_id = d.id)::date) as jour
           from dossiers_cartes d where d.id = $1::uuid
       )
       select (select count(*)::int from taps t join cartes_nfc c on c.id = t.carte_id
                where c.dossier_id = $1::uuid and t.tape_le >= (select jour from p)::timestamp at time zone 'America/Toronto') as taps,
              greatest(1, ((now() at time zone 'America/Toronto')::date - (select jour from p))::int) as jours`,
      [dossierId],
    ),
  ])
  if (!depart.pose || depart.avis_pose === null || avis.nb === null || !t) return null
  const gagnes = avis.nb - depart.avis_pose
  return {
    nom,
    pose: depart.pose,
    jours: t.jours,
    avisPose: depart.avis_pose,
    avisMaintenant: avis.nb,
    note: avis.note,
    taps: t.taps,
    avantParMois: depart.avis_mois_avant && depart.avis_mois_avant > 0 ? depart.avis_mois_avant : null,
    apresParMois: Math.max(0, gagnes) / (t.jours / 30.4),
  }
}
