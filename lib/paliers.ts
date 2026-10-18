/**
 * Les paliers de la page client : des étapes rapprochées au début (la
 * première arrive vite, on y prend goût), plus espacées ensuite.
 *
 * La jauge va du dernier palier atteint au prochain, pas de zéro : à 280 avis,
 * viser 300 montre une barre presque pleine — on a envie de la finir.
 */
export const PALIERS_AVIS = [10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000]
export const PALIERS_TAPS = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000]

export type Situation = {
  atteints: number[]
  /** Dernier palier franchi (0 au départ). */
  precedent: number
  /** Prochain palier, ou null quand tout est franchi. */
  prochain: number | null
  /** Avancement entre `precedent` et `prochain`, de 0 à 1. */
  avancement: number
}

export function situer(valeur: number, paliers: number[]): Situation {
  const atteints = paliers.filter((p) => p <= valeur)
  const precedent = atteints[atteints.length - 1] ?? 0
  const prochain = paliers.find((p) => p > valeur) ?? null
  const avancement = prochain === null ? 1 : (valeur - precedent) / (prochain - precedent)
  return { atteints, precedent, prochain, avancement: Math.max(0, Math.min(1, avancement)) }
}

/** Identifiants stables des paliers franchis, pour ne fêter chacun qu'une fois. */
export const clePalier = (type: 'avis' | 'taps', p: number) => `${type}-${p}`
