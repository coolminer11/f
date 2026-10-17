/**
 * Tapora Cards — redirection des cartes NFC, sur Cloudflare Workers.
 *
 * Toutes les requêtes de go.taporacards.com passent par ici. Seules les
 * adresses de cartes (/t/CODE) sont traitées sur place ; le reste continue
 * vers le serveur d'origine (Render), comme si le Worker n'existait pas.
 *
 * Pourquoi ici plutôt que sur Render : Cloudflare répond depuis la ville du
 * client (Montréal, Toronto…), ne s'endort jamais, et encaisse des milliers
 * de taps par seconde là où le serveur gratuit de Render plafonne vers 30.
 *
 * Les règles sont celles de app/t/[code]/route.ts, qui reste en place comme
 * filet de sécurité — les deux doivent rester alignés :
 *
 *   1. Rediriger d'abord. Le tap est compté après la réponse (waitUntil) ;
 *      s'il se perd, tant pis, la redirection ne doit jamais attendre.
 *   2. Ne compter que les humains : aperçus de liens et robots sont redirigés
 *      sans être comptés ; un même téléphone ne compte qu'une fois par minute.
 *   3. Rien qui désigne une personne (Loi 25) : ni IP, ni témoin durable.
 *
 * Trois niveaux de repli, pour qu'une carte chez un client ne casse jamais :
 *
 *   - Worker pas encore configuré (secrets absents) → tout passe à Render ;
 *   - Supabase ne répond pas → dernière destination connue (gardée 30 jours
 *     dans le cache de Cloudflare), sinon Render ;
 *   - quota gratuit dépassé (100 000 requêtes/jour) → la route est réglée en
 *     « fail open » : Cloudflare envoie directement à Render.
 *
 * Le Worker utilise la clé PUBLIQUE de Supabase. Elle ne peut appeler que
 * tap_destination et tap_noter (migration 20261018000100) : aucune table,
 * aucune vente, aucun client.
 */

export interface Env {
  /** https://xxxx.supabase.co */
  SUPABASE_URL?: string
  /** Clé publique : « publishable » (sb_publishable_…) ou l'ancienne clé anon. */
  SUPABASE_CLE?: string
}

const CODE = /^[A-HJ-NP-Z2-9]{6}$/

const ROBOTS =
  /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slack|telegram|discord|twitter|linkedin|embedly|quora|pinterest|skype|headless|curl|wget|python|axios|node-fetch|go-http/i

/** Une destination modifiée dans l'app s'applique au plus tard après ce délai. */
const FRAIS_MS = 15_000
/** Dernière destination connue, pour survivre à une panne de Supabase. */
const SECOURS_S = 30 * 24 * 60 * 60
/** Au-delà, on considère Supabase injoignable et on passe au repli. */
const DELAI_SUPABASE_MS = 2_500

type Carte = { destination: string } | null
type Resolu = { carte: Carte; le: number }

// Mémoire de l'isolat : instantanée, mais propre à une instance du Worker.
// Les promesses en cours y sont partagées : cinquante taps simultanés sur
// une carte froide font UNE requête à Supabase, pas cinquante.
const memoire = new Map<string, { resolu: Resolu } | { enCours: Promise<Resolu> }>()

export default {
  async fetch(requete: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(requete.url)
    const m = url.pathname.match(/^\/t\/([^/]+)\/?$/)
    if (!m || (requete.method !== 'GET' && requete.method !== 'HEAD')) return fetch(requete)
    if (!env.SUPABASE_URL || !env.SUPABASE_CLE) return fetch(requete)

    const debut = Date.now()
    const code = m[1].toUpperCase()
    if (!CODE.test(code)) return pageInactive()

    let resolu: Resolu | null
    try {
      resolu = await resoudre(code, url.origin, env, ctx)
    } catch {
      resolu = null
    }
    // Ni Supabase ni le cache : Render a sa propre connexion à la base.
    if (!resolu) return fetch(requete)
    if (!resolu.carte) return pageInactive()

    const agent = requete.headers.get('user-agent') ?? ''
    const temoin = `t_${code}`
    const dejaCompte = (requete.headers.get('cookie') ?? '').includes(`${temoin}=1`)
    const canal = url.searchParams.has('q') ? 'qr' : 'nfc'

    if (requete.method === 'GET' && !ROBOTS.test(agent) && !dejaCompte) {
      ctx.waitUntil(
        rpc(env, 'tap_noter', {
          p_code: code,
          p_canal: canal,
          p_appareil: appareil(agent),
          p_duree_ms: Date.now() - debut,
        }).catch(() => {}),
      )
    }

    return new Response(null, {
      status: 302,
      headers: {
        location: resolu.carte.destination,
        'cache-control': 'no-store',
        'set-cookie': `${temoin}=1; Max-Age=60; Path=/t/${code}; SameSite=Lax; Secure; HttpOnly`,
        'referrer-policy': 'no-referrer',
        'x-robots-tag': 'noindex',
      },
    })
  },
} satisfies ExportedHandler<Env>

function appareil(agent: string): 'ios' | 'android' | 'autre' {
  if (/iphone|ipad|ipod/i.test(agent)) return 'ios'
  if (/android/i.test(agent)) return 'android'
  return 'autre'
}

// ---------------------------------------------------------------------------
// Résolution : mémoire → cache de Cloudflare → Supabase → secours
// ---------------------------------------------------------------------------

async function resoudre(code: string, origine: string, env: Env, ctx: ExecutionContext): Promise<Resolu | null> {
  const ici = memoire.get(code)
  if (ici && 'resolu' in ici && Date.now() - ici.resolu.le < FRAIS_MS) return ici.resolu
  if (ici && 'enCours' in ici) return ici.enCours
  const ancien = ici && 'resolu' in ici ? ici.resolu : null

  const enCours = (async (): Promise<Resolu> => {
    const cle = new Request(`${origine}/__cache/carte/${code}`)
    const cache = caches.default

    const enCache = await lireCache(cache, cle)
    if (enCache && Date.now() - enCache.le < FRAIS_MS) return enCache

    try {
      const carte = (await rpc(env, 'tap_destination', { p_code: code })) as Carte
      const resolu: Resolu = { carte: valide(carte), le: Date.now() }
      ctx.waitUntil(
        cache.put(
          cle,
          new Response(JSON.stringify(resolu), {
            headers: { 'content-type': 'application/json', 'cache-control': `max-age=${SECOURS_S}` },
          }),
        ),
      )
      return resolu
    } catch (e) {
      // Supabase muet : la dernière destination connue vaut mieux qu'une
      // carte morte. Elle peut dater, mais elle a marché.
      if (enCache) return enCache
      if (ancien) return ancien
      throw e
    }
  })()

  // Des codes inventés (scanners, curieux) rempliraient la mémoire sans fin.
  if (memoire.size > 5_000) memoire.clear()
  memoire.set(code, { enCours })
  try {
    const resolu = await enCours
    memoire.set(code, { resolu })
    return resolu
  } catch (e) {
    memoire.delete(code)
    throw e
  }
}

async function lireCache(cache: Cache, cle: Request): Promise<Resolu | null> {
  try {
    const r = await cache.match(cle)
    if (!r) return null
    const lu = (await r.json()) as Resolu
    return typeof lu?.le === 'number' ? { carte: valide(lu.carte), le: lu.le } : null
  } catch {
    return null
  }
}

/** On ne redirige que vers du https : une valeur inattendue vaut « pas de carte ». */
function valide(carte: unknown): Carte {
  const d = (carte as { destination?: unknown } | null)?.destination
  return typeof d === 'string' && d.startsWith('https://') ? { destination: d } : null
}

async function rpc(env: Env, fonction: string, corps: Record<string, unknown>): Promise<unknown> {
  const cle = env.SUPABASE_CLE!.trim()
  const entetes: Record<string, string> = { apikey: cle, 'content-type': 'application/json' }
  // L'ancienne clé anon est un JWT et doit aussi aller dans Authorization ;
  // la nouvelle clé « publishable » non (Supabase la refuserait là).
  if (cle.startsWith('eyJ')) entetes.authorization = `Bearer ${cle}`

  const r = await fetch(`${env.SUPABASE_URL!.trim().replace(/\/+$/, '')}/rest/v1/rpc/${fonction}`, {
    method: 'POST',
    headers: entetes,
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(DELAI_SUPABASE_MS),
  })
  if (!r.ok) throw new Error(`Supabase ${fonction} : HTTP ${r.status}`)
  const texte = await r.text()
  return texte ? JSON.parse(texte) : null
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function pageInactive(): Response {
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Carte pas encore activée</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#f7f8fa;color:#16181d;padding:24px;box-sizing:border-box">
<div style="max-width:360px;text-align:center"><p style="margin:0;font-size:13px;color:#5b6472">Tapora Cards</p><h1 style="margin:8px 0 0;font-size:20px">Carte pas encore activée</h1><p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:#3a404b">Cette carte n’est reliée à aucune page pour l’instant. Le commerce qui vous l’a présentée peut la faire activer.</p></div></body></html>`,
    { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  )
}
