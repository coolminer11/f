/**
 * Combien d'avis 5 ★ faut-il pour que Google affiche la note suivante ?
 *
 * Ce que l'on sait vraiment :
 *   • N, le nombre d'avis — exact ;
 *   • la note affichée, arrondie au dixième (4,7) — la vraie moyenne est
 *     cachée quelque part entre 4,65 et 4,75 ;
 *   • la somme des étoiles est un ENTIER S, entre N et 5N.
 *
 * Donc S est un entier tel que S/N ∈ [r − 0,05 ; r + 0,05] (bornes incluses :
 * on ne présume pas du sens de l'arrondi de Google sur les égalités). Pour
 * chaque S possible, on sait exactement combien d'avis 5 ★ font passer la
 * moyenne au-dessus du seuil d'affichage suivant (r + 0,05). Le pire cas
 * donne un nombre GARANTI (« au plus »), le meilleur cas un minimum.
 *
 * Tout est calculé en entiers (centièmes d'étoile) : aucune erreur d'arrondi
 * de virgule flottante. Vérifié contre une recherche exhaustive dans
 * scripts/verifier-note-google.mjs.
 */
export type EtapeNote = {
  /** Note visée, en dixièmes (48 = 4,8). */
  cible: number
  /** Avis 5 ★ qui suffisent dans le meilleur cas. */
  auMoins: number
  /** Avis 5 ★ qui suffisent à coup sûr. */
  auPlus: number
  /** Estimation : si la vraie moyenne est la note affichée elle-même. */
  estimation: number
}

/** Plage des sommes d'étoiles compatibles avec ce qu'affiche Google ; null si incohérent. */
export function sommesPossibles(nb: number, noteDixiemes: number): { min: number; max: number } | null {
  if (!Number.isInteger(nb) || nb < 1 || !Number.isInteger(noteDixiemes) || noteDixiemes < 10 || noteDixiemes > 50) return null
  // S/N ≥ (10r − 5)/100  ⇔  100·S ≥ N·(10r − 5)
  const bas = nb * (noteDixiemes * 10 - 5)
  const haut = nb * (noteDixiemes * 10 + 5)
  const min = Math.max(nb, Math.ceil(bas / 100))
  const max = Math.min(5 * nb, Math.floor(haut / 100))
  return min <= max ? { min, max } : null
}

/**
 * Plus petit n tel que (S + 5n)/(N + n) dépasse le seuil d'affichage de `cible`.
 * `strict` : dépasser vraiment (pour le chiffre garanti, quel que soit le sens
 * de l'arrondi de Google) ; sinon l'atteindre suffit.
 */
function avisNecessaires(nb: number, somme: number, cible: number, strict: boolean): number {
  const seuil = cible * 10 - 5 // en centièmes
  if (seuil >= 500) return Infinity
  // 100·(S + 5n) ≥ seuil·(N + n)  ⇔  n·(500 − seuil) ≥ seuil·N − 100·S
  const num = seuil * nb - 100 * somme
  const den = 500 - seuil
  if (num < 0) return 0
  if (strict) return Math.floor(num / den) + 1
  return Math.max(0, Math.ceil(num / den))
}

/** Les prochaines notes atteignables (une ou deux), avec le nombre d'avis 5 ★ nécessaires. */
export function prochainesNotes(nb: number, note: number, combien = 2): EtapeNote[] {
  const r = Math.round(note * 10)
  const s = sommesPossibles(nb, r)
  if (!s) return []
  const etapes: EtapeNote[] = []
  for (let cible = r + 1; cible <= 50 && etapes.length < combien; cible++) {
    const auPlus = avisNecessaires(nb, s.min, cible, true)
    const auMoins = Math.max(1, avisNecessaires(nb, s.max, cible, false))
    if (!Number.isFinite(auPlus)) break
    const milieu = Math.min(s.max, Math.max(s.min, Math.round((nb * r) / 10)))
    const bas = Math.min(auMoins, auPlus)
    const estimation = Math.min(auPlus, Math.max(bas, avisNecessaires(nb, milieu, cible, false)))
    etapes.push({ cible, auMoins: bas, auPlus, estimation })
  }
  return etapes
}
