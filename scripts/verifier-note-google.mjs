#!/usr/bin/env node
/**
 * Vérifie lib/note-google.ts contre une recherche exhaustive :
 *   node --experimental-strip-types scripts/verifier-note-google.mjs
 *
 * Pour chaque nombre d'avis N (1 à 400) et chaque somme d'étoiles S possible,
 * on calcule la note affichée (arrondi au dixième, deux conventions pour les
 * égalités), puis le vrai nombre d'avis 5 ★ nécessaire pour la note suivante,
 * en les ajoutant un par un. Il doit toujours tomber entre « au moins » et
 * « au plus ».
 */
import { prochainesNotes } from '../lib/note-google.ts'

const affiche = (S, N, egaliteVersLeHaut) => {
  const f = Math.floor((10 * S) / N)
  const reste = 10 * S - f * N
  return 2 * reste > N || (egaliteVersLeHaut && 2 * reste === N) ? f + 1 : f
}

let cas = 0
let ecarts = 0
for (let N = 1; N <= 400; N++) {
  for (let S = N; S <= 5 * N; S++) {
    for (const haut of [true, false]) {
      const r = affiche(S, N, haut)
      const etapes = prochainesNotes(N, r / 10, 3)
      if (r < 50 && (!etapes.length || etapes[0].cible !== r + 1)) {
        console.error('Étape manquante', { N, S, r, etapes })
        process.exit(1)
      }
      for (const e of etapes) {
        let n = 0
        while (affiche(S + 5 * n, N + n, haut) < e.cible) n++
        cas++
        if (n < e.auMoins || n > e.auPlus) {
          console.error('Hors bornes', { N, S, r, e, vrai: n })
          process.exit(1)
        }
        if (e.estimation < e.auMoins || e.estimation > e.auPlus) {
          console.error('Estimation hors bornes', { N, S, r, e })
          process.exit(1)
        }
        if (e.auPlus - e.auMoins > 0) ecarts++
      }
    }
  }
}
console.log(`OK : ${cas.toLocaleString('fr-CA')} cas vérifiés, tous dans les bornes (${ecarts.toLocaleString('fr-CA')} avec une fourchette).`)
