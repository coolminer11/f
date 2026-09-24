import { NextResponse } from 'next/server'
import { sessionOuverte } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Battement de cœur du rafraîchissement automatique.
 *
 * Volontairement sans accès à la base : la question posée est « le serveur
 * répond-il et ma session tient-elle toujours ? », pas « que contient la
 * comptabilité ». Une réponse 401 permet à l'écran de dire « session
 * expirée » plutôt que d'afficher des chiffres figés en silence — ce qui est
 * exactement le genre de détail qu'on ne remarque qu'au mauvais moment.
 */
export async function GET() {
  if (!(await sessionOuverte())) {
    return NextResponse.json({ erreur: 'Session expirée' }, { status: 401 })
  }
  return NextResponse.json({ ok: true, instant: new Date().toISOString() })
}
