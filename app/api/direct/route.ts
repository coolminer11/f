import { NextResponse } from 'next/server'
import { sessionOuverte } from '@/lib/auth'
import { etatPool } from '@/lib/db'
import { tailleCache } from '@/lib/cache-cartes'
import { etatFile } from '@/lib/file-taps'
import { etatDirect } from '@/lib/requetes/direct'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Le pouls du serveur, pour le moniteur en direct.
 *
 * Trois familles de chiffres, parce qu'un serveur qui ne suit plus ne le dit
 * pas d'une seule façon :
 *   • les taps et leurs temps de réponse — ce que vit le client au comptoir ;
 *   • la file d'attente du pool — la base qui ne suit plus ;
 *   • le retard de la boucle d'événements — le processeur qui ne suit plus.
 * L'âge du processus dit en plus s'il vient de redémarrer (réveil après
 * sommeil, déploiement, ou plantage).
 */
export async function GET() {
  if (!(await sessionOuverte())) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  }

  const avant = performance.now()
  await new Promise((r) => setImmediate(r))
  const retardBoucleMs = performance.now() - avant

  const debutBase = performance.now()
  const direct = await etatDirect()
  const dureeBaseMs = performance.now() - debutBase

  const memoire = process.memoryUsage()
  return NextResponse.json(
    {
      ...direct,
      serveur: {
        age_s: Math.round(process.uptime()),
        memoire_mo: Math.round(memoire.rss / 1024 / 1024),
        retard_boucle_ms: Math.round(retardBoucleMs),
        duree_base_ms: Math.round(dureeBaseMs),
        cartes_en_cache: tailleCache(),
        pool: etatPool(),
        file: etatFile(),
      },
      mesure_le: new Date().toISOString(),
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
