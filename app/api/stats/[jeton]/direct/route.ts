import { NextResponse } from 'next/server'
import { dossierDuJeton } from '@/lib/lien-stats'
import { direct } from '@/lib/requetes/exploits'

export const dynamic = 'force-dynamic'

/**
 * Le compteur « Aujourd'hui » de la page client, interrogé toutes les 15 s.
 * Même clé que la page : le jeton n'ouvre que son dossier, et un lien
 * révoqué cesse aussitôt de répondre. Trois chiffres, rien d'autre.
 */
export async function GET(_: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  const id = await dossierDuJeton(jeton)
  if (!id) return NextResponse.json({ erreur: 'Introuvable' }, { status: 404 })
  return NextResponse.json(await direct(id), {
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  })
}
