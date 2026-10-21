import { deverrouillerGerant, quitterGerant } from '@/lib/services/acces'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Le mode gérant, appelé par l'écran du cadenas (fetch) : `mot_de_passe`
 * l'ouvre pour 12 heures sur cet appareil, `quitter=1` le referme. Même
 * origine seulement ; les essais sont freinés dans deverrouillerGerant().
 */
export async function POST(requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const origine = requete.headers.get('origin')
  const hote = requete.headers.get('x-forwarded-host') ?? requete.headers.get('host')
  let memeOrigine = false
  try {
    memeOrigine = Boolean(origine && hote && new URL(origine).host === hote)
  } catch {}
  if (!memeOrigine) return Response.json({ etat: 'invalide' }, { status: 403 })
  const { jeton } = await params
  let donnees: FormData
  try {
    donnees = await requete.formData()
  } catch {
    return Response.json({ etat: 'invalide' }, { status: 400 })
  }
  const entetes = { 'cache-control': 'no-store' }
  if (donnees.get('quitter') === '1') {
    await quitterGerant(jeton.slice(0, 80))
    return Response.json({ etat: 'ok' }, { headers: entetes })
  }
  const etat = await deverrouillerGerant(jeton.slice(0, 80), String(donnees.get('mot_de_passe') ?? ''))
  const statut = etat === 'ok' ? 200 : etat === 'bloque' ? 429 : etat === 'absent' ? 404 : 401
  return Response.json({ etat }, { status: statut, headers: entetes })
}
