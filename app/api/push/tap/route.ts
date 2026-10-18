import { after, NextResponse } from 'next/server'
import { notifierTap } from '@/lib/push'
import { urlStats } from '@/lib/lien-stats'

export const dynamic = 'force-dynamic'

const CODE = /^[A-HJ-NP-Z2-9]{6}$/

/**
 * Appelé par le Worker Cloudflare juste après qu'un tap a été enregistré :
 * déclenche le « Ding ! » sur les téléphones abonnés du commerce.
 *
 * Publique et sans secret, volontairement inoffensive : notifierTap exige
 * qu'un vrai tap de cette carte date de moins de deux minutes, et un même
 * commerce n'est notifié qu'une fois par minute. Au pire, un curieux
 * déclenche la notification d'un tap qui a réellement eu lieu.
 */
export async function POST(requete: Request) {
  const code = new URL(requete.url).searchParams.get('code')?.toUpperCase() ?? ''
  if (!CODE.test(code)) return NextResponse.json({ ok: false }, { status: 400 })
  // On répond tout de suite ; l'envoi se fait après.
  after(() => notifierTap(code, (id, v) => new URL(urlStats(id, v, 'https://go.taporacards.com')).pathname, true).catch(() => {}))
  return NextResponse.json({ ok: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } })
}
