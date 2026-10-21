import { etablissementDuJeton, jetonPortail } from '@/lib/services/acces'
import { lireEtablissement } from '@/lib/services/donnees'
import { desinscrireAppareil, inscrireAppareil, notifierPersonnel } from '@/lib/services/notifications'
import { clesVapid } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const pasDeCache = { 'cache-control': 'no-store' }

/** Même origine seulement : un autre site ne peut pas inscrire un appareil à la place du personnel. */
function memeOrigine(r: Request): boolean {
  const origine = r.headers.get('origin')
  const hote = r.headers.get('x-forwarded-host') ?? r.headers.get('host')
  try {
    return Boolean(origine && hote && new URL(origine).host === hote)
  } catch {
    return false
  }
}

/** La clé publique VAPID, pour que le navigateur s'abonne. */
export async function GET(_r: Request, { params }: { params: Promise<{ jeton: string }> }) {
  if (!(await etablissementDuJeton((await params).jeton))) return Response.json({ erreur: 'acces' }, { status: 401, headers: pasDeCache })
  return Response.json({ cle: (await clesVapid()).publique }, { headers: pasDeCache })
}

/** Inscrire l'appareil (avec un secteur facultatif) — ou, avec ?essai=1, envoyer une notification d'essai. */
export async function POST(r: Request, { params }: { params: Promise<{ jeton: string }> }) {
  if (!memeOrigine(r)) return Response.json({ ok: false }, { status: 403, headers: pasDeCache })
  const jeton = (await params).jeton
  const id = await etablissementDuJeton(jeton)
  if (!id) return Response.json({ ok: false }, { status: 401, headers: pasDeCache })
  const corps = (await r.json().catch(() => null)) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; groupe?: unknown } | null
  if (new URL(r.url).searchParams.get('essai') === '1') {
    const etab = await lireEtablissement(id)
    const groupe = typeof corps?.groupe === 'string' && corps.groupe ? corps.groupe.slice(0, 60) : null
    const n = await notifierPersonnel(id, groupe, {
      titre: `🔔 ${etab?.nom ?? 'Tapora'}`,
      corps: 'Les notifications du portail fonctionnent sur cet appareil.',
      url: `/service/${jetonPortail(id, etab?.version_lien ?? 1)}`,
      etiquette: 'essai-portail',
    })
    return Response.json({ ok: n > 0 }, { headers: pasDeCache })
  }
  const endpoint = typeof corps?.endpoint === 'string' ? corps.endpoint : ''
  const p256dh = typeof corps?.keys?.p256dh === 'string' ? corps.keys.p256dh : ''
  const auth = typeof corps?.keys?.auth === 'string' ? corps.keys.auth : ''
  const groupe = typeof corps?.groupe === 'string' && corps.groupe.trim() ? corps.groupe.trim() : null
  if (!endpoint || !p256dh || !auth) return Response.json({ ok: false }, { status: 400, headers: pasDeCache })
  return Response.json({ ok: await inscrireAppareil(id, { endpoint, p256dh, auth, groupe }) }, { headers: pasDeCache })
}

export async function DELETE(r: Request, { params }: { params: Promise<{ jeton: string }> }) {
  if (!memeOrigine(r)) return Response.json({ ok: false }, { status: 403, headers: pasDeCache })
  const id = await etablissementDuJeton((await params).jeton)
  if (!id) return Response.json({ ok: false }, { status: 401, headers: pasDeCache })
  const corps = (await r.json().catch(() => null)) as { endpoint?: unknown } | null
  if (typeof corps?.endpoint === 'string') await desinscrireAppareil(id, corps.endpoint)
  return Response.json({ ok: true }, { headers: pasDeCache })
}
