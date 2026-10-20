import { deverrouiller } from '@/lib/lien-stats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Le mot de passe de la page client, appelé par l'écran du cadenas (fetch) :
 * il répond « ok » ou la raison du refus, et pose le témoin d'accès. L'écran
 * joue alors l'animation, puis ouvre la page. Même origine seulement ; les
 * essais sont freinés dans deverrouiller().
 */
export async function POST(requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const origine = requete.headers.get('origin')
  const hote = requete.headers.get('x-forwarded-host') ?? requete.headers.get('host')
  if (!origine || !hote || new URL(origine).host !== hote) return Response.json({ etat: 'invalide' }, { status: 403 })
  const { jeton } = await params
  let motDePasse = ''
  try {
    motDePasse = String((await requete.formData()).get('mot_de_passe') ?? '')
  } catch {
    return Response.json({ etat: 'invalide' }, { status: 400 })
  }
  const etat = await deverrouiller(jeton.slice(0, 80), motDePasse)
  return Response.json({ etat }, { status: etat === 'ok' ? 200 : etat === 'bloque' ? 429 : 401, headers: { 'cache-control': 'no-store' } })
}
