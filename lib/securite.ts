import 'server-only'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { requete, requeteUne } from '@/lib/db'
import { baseCartesConfiguree } from '@/lib/cartes-url'

/**
 * Le garde du back-office : qui essaie d'entrer, d'où, et combien de fois.
 *
 * Trois freins contre le « brute force », vérifiés AVANT de tester le mot de
 * passe (un essai bloqué ne teste rien) :
 *  - même courriel ET même adresse : 5 échecs → 15 min, 10 → 1 h, 15 → 24 h ;
 *  - même courriel, toutes adresses : 20 échecs en 1 h → 1 h (attaque répartie) ;
 *  - même adresse, tous courriels : 30 échecs en 1 h → 1 h (balayage).
 * Le premier frein ne bloque que l'attaquant : depuis chez vous, vous pouvez
 * encore entrer pendant qu'un inconnu s'acharne sur votre courriel.
 */

export type Contexte = { ipMasquee: string | null; ipEmpreinte: string | null; appareil: string }

const SEUILS_COMPTE_IP: [number, number][] = [
  [15, 24 * 60],
  [10, 60],
  [5, 15],
]
const MAX_COMPTE_HEURE = 20
const MAX_IP_HEURE = 30

function cleHmac(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) throw new Error('SESSION_SECRET est requis.')
  return s
}

/** Comparaison à temps constant. */
export function egal(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

const empreinte = (jeton: string) => createHash('sha256').update(jeton).digest('hex')

/** Adresse IP réelle du visiteur, derrière Cloudflare ou Render. */
function ipBrute(h: Headers): string | null {
  const brut = h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip')
  const ip = brut?.trim()
  return ip && ip.length <= 64 ? ip : null
}

/** 203.0.113.42 → 203.0.113.x ; 2001:db8:1:2:… → 2001:db8:1:… (Loi 25 : jamais l'adresse entière). */
export function masquerIp(ip: string): string {
  if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}:…`
  const p = ip.split('.')
  return p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}.x` : 'inconnue'
}

/** « Safari · Mac », « Chrome · Android »… sans bibliothèque. */
export function decrireAppareil(agent: string | null | undefined): string {
  const a = agent ?? ''
  const navigateur = /Edg\//.test(a)
    ? 'Edge'
    : /OPR\/|Opera/.test(a)
      ? 'Opera'
      : /Firefox\//.test(a)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(a)
          ? 'Chrome'
          : /Safari\//.test(a)
            ? 'Safari'
            : 'Navigateur inconnu'
  const systeme = /iPhone/.test(a)
    ? 'iPhone'
    : /iPad/.test(a)
      ? 'iPad'
      : /Android/.test(a)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(a)
          ? 'Mac'
          : /Windows/.test(a)
            ? 'Windows'
            : /Linux/.test(a)
              ? 'Linux'
              : 'appareil inconnu'
  return `${navigateur} · ${systeme}`
}

export async function contexteRequete(): Promise<Contexte> {
  const h = await headers()
  const ip = ipBrute(h)
  return {
    ipMasquee: ip ? masquerIp(ip) : null,
    ipEmpreinte: ip ? createHmac('sha256', cleHmac()).update(`ip:${ip}`).digest('hex').slice(0, 32) : null,
    appareil: decrireAppareil(h.get('user-agent')),
  }
}

// ---------------------------------------------------------------------------
// Freins
// ---------------------------------------------------------------------------

export type Verrou = { bloque: false } | { bloque: true; minutes: number }

export async function verrouConnexion(courriel: string, ctx: Contexte): Promise<Verrou> {
  const c = courriel.trim().toLowerCase()
  const ligne = await requeteUne<{ consecutifs: number; dernier: string | null; heure_compte: number; heure_ip: number; plus_ancien_ip: string | null; plus_ancien_compte: string | null }>(
    `with derniere_reussite as (
       select max(cree_le) as t from tentatives_connexion
        where courriel = $1 and ip_empreinte is not distinct from $2 and reussie
     )
     select
       (select count(*)::int from tentatives_connexion, derniere_reussite d
         where courriel = $1 and ip_empreinte is not distinct from $2 and not reussie
           and cree_le > now() - interval '24 hours' and cree_le > coalesce(d.t, '-infinity')) as consecutifs,
       (select max(cree_le) from tentatives_connexion
         where courriel = $1 and ip_empreinte is not distinct from $2 and not reussie) as dernier,
       (select count(*)::int from tentatives_connexion
         where courriel = $1 and not reussie and cree_le > now() - interval '1 hour') as heure_compte,
       (select min(cree_le) from (select cree_le from tentatives_connexion
         where courriel = $1 and not reussie and cree_le > now() - interval '1 hour'
         order by cree_le desc limit $3) x) as plus_ancien_compte,
       (select count(*)::int from tentatives_connexion
         where $2::text is not null and ip_empreinte = $2 and not reussie and cree_le > now() - interval '1 hour') as heure_ip,
       (select min(cree_le) from (select cree_le from tentatives_connexion
         where $2::text is not null and ip_empreinte = $2 and not reussie and cree_le > now() - interval '1 hour'
         order by cree_le desc limit $4) x) as plus_ancien_ip`,
    [c, ctx.ipEmpreinte, MAX_COMPTE_HEURE, MAX_IP_HEURE],
  )
  if (!ligne) return { bloque: false }
  const maintenant = Date.now()
  const restes: number[] = []

  const palier = SEUILS_COMPTE_IP.find(([n]) => ligne.consecutifs >= n)
  if (palier && ligne.dernier) restes.push(new Date(ligne.dernier).getTime() + palier[1] * 60_000 - maintenant)
  if (ligne.heure_compte >= MAX_COMPTE_HEURE && ligne.plus_ancien_compte)
    restes.push(new Date(ligne.plus_ancien_compte).getTime() + 3_600_000 - maintenant)
  if (ligne.heure_ip >= MAX_IP_HEURE && ligne.plus_ancien_ip)
    restes.push(new Date(ligne.plus_ancien_ip).getTime() + 3_600_000 - maintenant)

  const reste = Math.max(0, ...restes)
  return reste > 0 ? { bloque: true, minutes: Math.max(1, Math.ceil(reste / 60_000)) } : { bloque: false }
}

export async function noterTentative(e: {
  courriel: string
  utilisateurId: string | null
  etape: 'mot_de_passe' | 'code'
  reussie: boolean
  ctx: Contexte
}): Promise<void> {
  await requete(
    `insert into tentatives_connexion (courriel, utilisateur_id, etape, reussie, ip_masquee, ip_empreinte, appareil)
     values ($1, $2::uuid, $3, $4, $5, $6, $7)`,
    [e.courriel.trim().toLowerCase().slice(0, 254), e.utilisateurId, e.etape, e.reussie, e.ctx.ipMasquee, e.ctx.ipEmpreinte, e.ctx.appareil],
  )
}

/** Après un échec : on ralentit (jusqu'à 3 s) — un robot n'essaie plus que quelques mots de passe par minute. */
export async function ralentir(courriel: string, ctx: Contexte): Promise<void> {
  const ligne = await requeteUne<{ n: number }>(
    `select count(*)::int as n from tentatives_connexion
      where courriel = $1 and ip_empreinte is not distinct from $2 and not reussie
        and cree_le > now() - interval '15 minutes'`,
    [courriel.trim().toLowerCase(), ctx.ipEmpreinte],
  )
  const n = ligne?.n ?? 1
  await new Promise((r) => setTimeout(r, Math.min(3000, 300 + 350 * n)))
}

/**
 * Le compte vient-il d'être bloqué ? Alors on prévient son propriétaire,
 * au plus une fois par heure.
 */
export async function alerteSiBloque(utilisateurId: string): Promise<boolean> {
  const ligne = await requeteUne<{ id: string }>(
    `update utilisateurs set alerte_essais_le = now()
      where id = $1::uuid and (alerte_essais_le is null or alerte_essais_le < now() - interval '1 hour')
      returning id`,
    [utilisateurId],
  )
  return Boolean(ligne)
}

/**
 * Connexion depuis un appareil ou un réseau jamais vu ces 90 derniers jours ?
 * (On ne prévient pas pour la toute première connexion enregistrée.)
 */
export async function appareilInconnu(utilisateurId: string, ctx: Contexte): Promise<boolean> {
  const ligne = await requeteUne<{ deja: boolean; vu: boolean }>(
    `select exists (select 1 from tentatives_connexion where utilisateur_id = $1::uuid and reussie) as deja,
            exists (select 1 from sessions where utilisateur_id = $1::uuid and appareil = $2 and ip_masquee is not distinct from $3)
            or exists (select 1 from tentatives_connexion
                        where utilisateur_id = $1::uuid and reussie and appareil = $2
                          and ip_empreinte is not distinct from $4 and cree_le > now() - interval '90 days') as vu`,
    [utilisateurId, ctx.appareil, ctx.ipMasquee, ctx.ipEmpreinte],
  )
  return Boolean(ligne?.deja && !ligne.vu)
}

// ---------------------------------------------------------------------------
// Défi de double authentification (entre le mot de passe et la session)
// ---------------------------------------------------------------------------

const COOKIE_DEFI = 'tapora_defi'
const ESSAIS_CODE = 5

async function connexionChiffree(): Promise<boolean> {
  return (await headers()).get('x-forwarded-proto')?.split(',')[0].trim() === 'https'
}

const signerDefi = (jeton: string) => createHmac('sha256', cleHmac()).update(`defi:${jeton}`).digest('base64url')

export async function ouvrirDefi(utilisateurId: string, suite: string): Promise<void> {
  const jeton = randomBytes(32).toString('base64url')
  await requete(
    `insert into defis_connexion (empreinte, utilisateur_id, expire_le, suite)
     values ($1, $2::uuid, now() + interval '5 minutes', $3)`,
    [empreinte(jeton), utilisateurId, suite.slice(0, 300)],
  )
  ;(await cookies()).set(COOKIE_DEFI, `${jeton}.${signerDefi(jeton)}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: await connexionChiffree(),
    path: '/connexion',
    maxAge: 5 * 60,
  })
}

export type Defi = { empreinte: string; utilisateurId: string; suite: string; essais: number; courriel: string; nom: string }

export async function lireDefi(): Promise<Defi | null> {
  const brut = (await cookies()).get(COOKIE_DEFI)?.value
  const [jeton, signature] = brut?.split('.') ?? []
  if (!jeton || !signature || !egal(signature, signerDefi(jeton))) return null
  return requeteUne<Defi>(
    `select d.empreinte, d.utilisateur_id as "utilisateurId", coalesce(d.suite, '') as suite, d.essais,
            u.courriel, u.nom
       from defis_connexion d join utilisateurs u on u.id = d.utilisateur_id
      where d.empreinte = $1 and d.expire_le > now() and d.essais < $2 and u.actif and u.totp_actif`,
    [empreinte(jeton), ESSAIS_CODE],
  )
}

/** Un code raté : renvoie le nombre d'essais restants (0 = défi annulé). */
export async function echecDefi(defi: Defi): Promise<number> {
  const ligne = await requeteUne<{ essais: number }>(
    `update defis_connexion set essais = essais + 1 where empreinte = $1 returning essais`,
    [defi.empreinte],
  )
  const restants = ESSAIS_CODE - (ligne?.essais ?? ESSAIS_CODE)
  if (restants <= 0) await fermerDefi(defi)
  return Math.max(0, restants)
}

export async function fermerDefi(defi?: Defi): Promise<void> {
  if (defi) await requete(`delete from defis_connexion where empreinte = $1`, [defi.empreinte])
  ;(await cookies()).delete({ name: COOKIE_DEFI, path: '/connexion' })
}

// ---------------------------------------------------------------------------
// Lien « Ce n'était pas moi » (24 h, usage unique)
// ---------------------------------------------------------------------------

export async function creerJetonPasMoi(utilisateurId: string): Promise<string> {
  const jeton = randomBytes(32).toString('base64url')
  await requete(
    `insert into jetons_securite (empreinte, utilisateur_id, usage, expire_le)
     values ($1, $2::uuid, 'pas_moi', now() + interval '24 hours')`,
    [empreinte(jeton), utilisateurId],
  )
  return jeton
}

export async function lireJetonPasMoi(jeton: string): Promise<{ utilisateurId: string; nom: string; courriel: string } | null> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(jeton)) return null
  return requeteUne(
    `select j.utilisateur_id as "utilisateurId", u.nom, u.courriel
       from jetons_securite j join utilisateurs u on u.id = j.utilisateur_id
      where j.empreinte = $1 and j.usage = 'pas_moi' and j.utilise_le is null and j.expire_le > now()`,
    [empreinte(jeton)],
  )
}

/** Consomme le jeton (et tous les autres du même compte). */
export async function consommerJetonsPasMoi(utilisateurId: string): Promise<void> {
  await requete(
    `update jetons_securite set utilise_le = now() where utilisateur_id = $1::uuid and utilise_le is null`,
    [utilisateurId],
  )
}

/**
 * L'adresse des liens envoyés par courriel. Jamais l'en-tête x-forwarded-host
 * (un attaquant le choisit) : l'adresse configurée, sinon l'hôte de la requête.
 */
export async function baseLiens(): Promise<string> {
  const configuree = process.env.URL_APP?.trim() || baseCartesConfiguree()
  if (configuree) return configuree.replace(/\/+$/, '')
  const h = await headers()
  const proto = h.get('x-forwarded-proto')?.split(',')[0].trim() === 'https' ? 'https' : 'http'
  return `${proto}://${h.get('host') ?? 'localhost:3000'}`
}

/** Un chemin interne sûr pour « revenir là où on était » — jamais un autre site. */
export function cheminSur(suite: string | null | undefined, defaut = '/transactions'): string {
  if (!suite || suite.length > 300) return defaut
  // « //site.com » et « /\site.com » sont des adresses EXTERNES pour un navigateur.
  if (!/^\/(?![/\\])/.test(suite) || /[\u0000-\u001f\\]/.test(suite)) return defaut
  if (suite.startsWith('/connexion') || suite.startsWith('/securite')) return defaut
  return suite
}
