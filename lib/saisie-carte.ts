import 'server-only'
import type { z } from 'zod'
import type { SaisieCarte } from '@/components/champs-carte'
import { enregistrerFiche, releverFiche } from '@/lib/avis-google'
import { requeteUne } from '@/lib/db'
import type { SaisieCarteValidee } from '@/lib/requetes/cartes'

/** Du formulaire validé à l'enregistrement : mémorise la fiche Google choisie. */
export async function preparerCarte(v: z.infer<typeof SaisieCarte>): Promise<SaisieCarteValidee> {
  const placeId = v.place_id || null
  if (placeId) {
    await enregistrerFiche({ place_id: placeId, nom: v.fiche_nom || null, adresse: v.fiche_adresse || null })
  }
  return {
    libelle: v.libelle,
    dossierId: v.dossier_id || null,
    destination: v.destination,
    placeId,
    note: v.note || null,
  }
}

/**
 * Premier relevé d'avis dès qu'une fiche est choisie : la courbe a un point
 * de départ le jour même de la pose — c'est contre lui qu'on mesure les avis
 * gagnés grâce à la carte.
 */
export async function premierReleve(placeId: string | null): Promise<void> {
  if (!placeId) return
  const deja = await requeteUne(`select 1 from avis_google where place_id = $1 limit 1`, [placeId])
  if (deja) return
  await releverFiche(placeId).catch(() => {})
}
