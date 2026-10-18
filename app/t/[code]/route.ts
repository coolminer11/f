import { resoudre } from '@/lib/requetes/cartes'
import { noterTap } from '@/lib/file-taps'
import { carteEnCache } from '@/lib/cache-cartes'
import { notifierTap } from '@/lib/push'
import { urlStats } from '@/lib/lien-stats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * La redirection d'une carte NFC — l'adresse écrite sur la puce.
 *
 * C'est le seul écran que voit le client du client, debout au comptoir, le
 * téléphone à la main. Trois règles en découlent :
 *
 *   1. Rediriger d'abord. Le tap est compté APRÈS la réponse : le
 *      téléphone n'attend que la lecture de la destination — souvent servie
 *      de mémoire, sans toucher la base. Si le compteur échoue, le tap se
 *      perd ; la redirection, jamais.
 *   2. Ne compter que les vrais humains. Les aperçus de liens (iMessage,
 *      WhatsApp, Slack…) et les robots visitent l'adresse sans que personne
 *      n'ait tapé : ils sont redirigés mais pas comptés. Un même téléphone
 *      qui recharge la page dans la minute ne compte qu'une fois (petit
 *      témoin de 60 s, sans identifiant).
 *   3. Rien qui désigne une personne n'est conservé (Loi 25) : ni IP, ni
 *      témoin durable, ni position.
 *
 * Le QR imprimé sur la carte porte « ?q » : c'est ce qui permet de savoir
 * quelle part des clients passe par la puce et quelle part par l'appareil photo.
 */
const ROBOTS =
  /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slack|telegram|discord|twitter|linkedin|embedly|quora|pinterest|skype|headless|curl|wget|python|axios|node-fetch|go-http/i

function appareil(agent: string): 'ios' | 'android' | 'autre' {
  if (/iphone|ipad|ipod/i.test(agent)) return 'ios'
  if (/android/i.test(agent)) return 'android'
  return 'autre'
}

const CODE = /^[A-HJ-NP-Z2-9]{6}$/

export async function GET(requete: Request, { params }: { params: Promise<{ code: string }> }) {
  const debut = performance.now()
  const { code: brut } = await params
  const code = brut.toUpperCase()
  if (!CODE.test(code)) return pageInactive()

  let carte: { id: string; destination: string } | null = null
  try {
    carte = await carteEnCache(code, () => resoudre(code))
  } catch {
    return pageIndisponible()
  }
  if (!carte) return pageInactive()

  const agent = requete.headers.get('user-agent') ?? ''
  const temoin = `t_${code}`
  const dejaCompte = (requete.headers.get('cookie') ?? '').includes(`${temoin}=1`)
  const canal = new URL(requete.url).searchParams.has('q') ? 'qr' : 'nfc'

  if (!ROBOTS.test(agent) && !dejaCompte) {
    // Le tap part dans la file d'écriture (lib/file-taps.ts) : la réponse
    // n'attend pas la base, et les taps s'écrivent par paquets.
    noterTap({ carteId: carte.id, canal, appareil: appareil(agent), dureeMs: performance.now() - debut })
    // Le « Ding ! » des abonnés, une fois le tap écrit (la file vide toutes les ~2 s).
    setTimeout(() => {
      notifierTap(code, (id, v) => new URL(urlStats(id, v, 'https://go.taporacards.com')).pathname, false).catch(() => {})
    }, 3000)
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: carte.destination,
      'cache-control': 'no-store',
      'set-cookie': `${temoin}=1; Max-Age=60; Path=/t/${code}; SameSite=Lax; Secure; HttpOnly`,
      'referrer-policy': 'no-referrer',
    },
  })
}

function page(titre: string, texte: string, statut: number): Response {
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titre}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#f7f8fa;color:#16181d;padding:24px;box-sizing:border-box">
<div style="max-width:360px;text-align:center"><p style="margin:0;font-size:13px;color:#5b6472">Tapora Cards</p><h1 style="margin:8px 0 0;font-size:20px">${titre}</h1><p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:#3a404b">${texte}</p></div></body></html>`,
    { status: statut, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  )
}

const pageInactive = () =>
  page(
    'Carte pas encore activée',
    'Cette carte n’est reliée à aucune page pour l’instant. Le commerce qui vous l’a présentée peut la faire activer.',
    404,
  )

const pageIndisponible = () =>
  page('Un instant…', 'Le service est momentanément indisponible. Réessayez dans quelques secondes.', 503)
