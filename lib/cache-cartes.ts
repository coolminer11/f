import 'server-only'

/**
 * Destinations des cartes, gardées en mémoire quelques secondes.
 *
 * Une carte populaire est tapée des dizaines de fois par heure, et sa
 * destination ne change presque jamais : la redemander à la base à chaque
 * tap, c'est payer un aller-retour réseau pour rien, et rendre chaque tap
 * dépendant d'une base qui peut avoir un hoquet. Avec le cache, un tap
 * répété ne touche plus la base avant de rediriger.
 *
 * Toute modification de carte vide son entrée immédiatement. La durée de
 * vie est le filet de sécurité : si un jour plusieurs serveurs tournent, un
 * changement fait sur l'un sera vu par les autres en DURÉE secondes au plus.
 *
 * La Map vit sur globalThis pour être la même partout dans le processus,
 * quel que soit le paquet Next qui charge ce module.
 */
const DUREE_MS = 30_000
/** Un code inconnu est retenu moins longtemps : une carte peut être créée juste après. */
const DUREE_INCONNU_MS = 5_000

type Entree = { carte: { id: string; destination: string } | null; expire: number }

const globale = globalThis as typeof globalThis & { __cacheCartes?: Map<string, Entree> }
const cache = (globale.__cacheCartes ??= new Map())

export async function carteEnCache(
  code: string,
  charger: () => Promise<{ id: string; destination: string } | null>,
): Promise<{ id: string; destination: string } | null> {
  const maintenant = Date.now()
  const entree = cache.get(code)
  if (entree && entree.expire > maintenant) return entree.carte

  const carte = await charger()
  cache.set(code, { carte, expire: maintenant + (carte ? DUREE_MS : DUREE_INCONNU_MS) })
  // Une Map qui grossit sans fin finit par manger la mémoire du petit serveur.
  if (cache.size > 5_000) {
    for (const [cle, e] of cache) if (e.expire <= maintenant) cache.delete(cle)
  }
  return carte
}

export function oublierCarte(code: string): void {
  cache.delete(code)
}

export function tailleCache(): number {
  return cache.size
}
