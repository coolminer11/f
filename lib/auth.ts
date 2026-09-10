import 'server-only'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { requete, requeteUne } from '@/lib/db'

const chiffrer = promisify(scrypt) as (
  motDePasse: string,
  sel: string,
  longueur: number,
) => Promise<Buffer>

export const NOM_COOKIE = 'tapora_session'
const DUREE_JOURS = 7

export type Utilisateur = {
  id: string
  courriel: string
  nom: string
  role: 'associe' | 'lecture'
  associe_id: string | null
  actif: boolean
}

// ---------------------------------------------------------------------------
// Mots de passe
// ---------------------------------------------------------------------------

/** scrypt avec un sel par utilisateur. Le mot de passe n'est jamais stocké. */
export async function empreinteMotDePasse(motDePasse: string): Promise<string> {
  const sel = randomBytes(16).toString('hex')
  const derive = await chiffrer(motDePasse, sel, 64)
  return `scrypt$${sel}$${derive.toString('hex')}`
}

export async function motDePasseCorrespond(
  motDePasse: string,
  empreinte: string,
): Promise<boolean> {
  const [algorithme, sel, attendu] = empreinte.split('$')
  if (algorithme !== 'scrypt' || !sel || !attendu) return false
  const derive = await chiffrer(motDePasse, sel, 64)
  const a = Buffer.from(attendu, 'hex')
  // Comparaison à temps constant : ne renseigne pas sur le préfixe correct.
  return a.length === derive.length && timingSafeEqual(a, derive)
}

export function verifierForceMotDePasse(motDePasse: string): string | null {
  if (motDePasse.length < 10) return 'Le mot de passe doit compter au moins 10 caractères.'
  if (!/[a-zA-Z]/.test(motDePasse) || !/[0-9]/.test(motDePasse)) {
    return 'Le mot de passe doit mêler des lettres et des chiffres.'
  }
  return null
}

// ---------------------------------------------------------------------------
// Jeton de session
//
// Le cookie porte « <identifiant>.<signature HMAC> ». La signature permet au
// middleware de rejeter un cookie forgé sans toucher la base ; la base reste
// seule juge de la validité réelle, car fermer une session doit la révoquer.
// ---------------------------------------------------------------------------

function empreinteJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex')
}

async function cle(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET est requis (au moins 16 caractères). Voir .env.example.')
  }
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

export async function signer(charge: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await cle(), new TextEncoder().encode(charge))
  return Buffer.from(signature).toString('base64url')
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * Le drapeau « Secure » du cookie suit la connexion RÉELLE, pas NODE_ENV.
 *
 * Un cookie Secure n'est jamais renvoyé sur une connexion en clair. Le poser
 * parce que « on est en production » rendait l'application inutilisable dès
 * qu'on y accédait autrement que par localhost — sur le réseau du bureau, par
 * exemple : la connexion réussissait, puis chaque écran redemandait le mot de
 * passe, sans le moindre message.
 *
 * Derrière un hébergeur (Render, Vercel), `x-forwarded-proto` vaut toujours
 * « https » et le cookie est donc bien protégé.
 */
async function connexionChiffree(): Promise<boolean> {
  const entetes = await headers()
  return entetes.get('x-forwarded-proto')?.split(',')[0].trim() === 'https'
}

export async function ouvrirSession(utilisateurId: string, agent?: string): Promise<void> {
  const jeton = randomBytes(32).toString('base64url')
  await requete(
    `insert into sessions (empreinte, utilisateur_id, expire_le, agent)
     values ($1, $2::uuid, now() + make_interval(days => $3::int), $4)`,
    [empreinteJeton(jeton), utilisateurId, DUREE_JOURS, agent?.slice(0, 200) ?? null],
  )
  await requete(`update utilisateurs set derniere_connexion = now() where id = $1::uuid`, [
    utilisateurId,
  ])
  await requete(`select purger_sessions()`)

  const magasin = await cookies()
  magasin.set(NOM_COOKIE, `${jeton}.${await signer(jeton)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await connexionChiffree(),
    path: '/',
    maxAge: DUREE_JOURS * 24 * 60 * 60,
  })
}

export async function fermerSession(): Promise<void> {
  const magasin = await cookies()
  const brut = magasin.get(NOM_COOKIE)?.value
  const jeton = brut?.split('.')[0]
  if (jeton) {
    await requete(`delete from sessions where empreinte = $1`, [empreinteJeton(jeton)])
  }
  magasin.delete(NOM_COOKIE)
}

/** Utilisateur de la session en cours, ou null. Vérifie signature ET base. */
export async function utilisateurCourant(): Promise<Utilisateur | null> {
  const magasin = await cookies()
  const brut = magasin.get(NOM_COOKIE)?.value
  if (!brut) return null

  const [jeton, signature] = brut.split('.')
  if (!jeton || !signature) return null
  if (signature !== (await signer(jeton))) return null

  const utilisateur = await requeteUne<Utilisateur>(
    `select u.id, u.courriel, u.nom, u.role, u.associe_id, u.actif
       from sessions s
       join utilisateurs u on u.id = s.utilisateur_id
      where s.empreinte = $1 and s.expire_le > now() and u.actif`,
    [empreinteJeton(jeton)],
  )
  if (!utilisateur) return null

  await requete(`update sessions set derniere_vue = now() where empreinte = $1`, [
    empreinteJeton(jeton),
  ])
  return utilisateur
}

/**
 * À appeler en tête de CHAQUE page et route protégée. Le middleware ne fait
 * qu'écarter les cookies absents ou forgés ; c'est ici que la session est
 * réellement validée contre la base.
 */
export async function exigerSession(): Promise<Utilisateur> {
  const utilisateur = await utilisateurCourant()
  if (!utilisateur) redirect('/connexion')
  return utilisateur
}

/** Variante pour les routes d'API : renvoie null plutôt que de rediriger. */
export async function sessionOuverte(): Promise<boolean> {
  return (await utilisateurCourant()) !== null
}

export async function exigerEcriture(): Promise<Utilisateur> {
  const utilisateur = await exigerSession()
  if (utilisateur.role !== 'associe') {
    throw new Error('Votre compte est en lecture seule.')
  }
  return utilisateur
}

// ---------------------------------------------------------------------------
// Comptes
// ---------------------------------------------------------------------------

export async function nombreUtilisateurs(): Promise<number> {
  const ligne = await requeteUne<{ n: number }>(`select count(*)::int as n from utilisateurs`)
  return ligne?.n ?? 0
}

export async function authentifier(
  courriel: string,
  motDePasse: string,
): Promise<Utilisateur | null> {
  const ligne = await requeteUne<Utilisateur & { empreinte: string }>(
    `select id, courriel, nom, role, associe_id, actif, empreinte
       from utilisateurs where lower(courriel) = lower($1) and actif`,
    [courriel],
  )
  // Une empreinte factice garde le temps de réponse identique quand le compte
  // n'existe pas : sinon la durée révèle quels courriels sont enregistrés.
  const empreinte =
    ligne?.empreinte ??
    'scrypt$0000000000000000000000000000000000000000000000000000000000000000$00'
  const correspond = await motDePasseCorrespond(motDePasse, empreinte)
  return ligne && correspond ? ligne : null
}

export type CompteListe = Utilisateur & {
  derniere_connexion: string | null
  cree_le: string
  associe_nom: string | null
  sessions_actives: number
}

export async function listerUtilisateurs(): Promise<CompteListe[]> {
  return requete<CompteListe>(
    `select u.id, u.courriel, u.nom, u.role, u.associe_id, u.actif,
            u.derniere_connexion, u.cree_le, a.nom as associe_nom,
            (select count(*)::int from sessions s
              where s.utilisateur_id = u.id and s.expire_le > now()) as sessions_actives
       from utilisateurs u
       left join associes a on a.id = u.associe_id
      order by u.cree_le`,
  )
}

export async function creerUtilisateur(entree: {
  courriel: string
  nom: string
  motDePasse: string
  associeId: string | null
  role: 'associe' | 'lecture'
}): Promise<string> {
  const ligne = await requeteUne<{ id: string }>(
    `insert into utilisateurs (courriel, nom, empreinte, associe_id, role)
     values ($1, $2, $3, $4::uuid, $5) returning id`,
    [
      entree.courriel.trim(),
      entree.nom.trim(),
      await empreinteMotDePasse(entree.motDePasse),
      entree.associeId,
      entree.role,
    ],
  )
  return ligne!.id
}

export async function changerMotDePasse(id: string, motDePasse: string): Promise<void> {
  await requete(`update utilisateurs set empreinte = $2 where id = $1::uuid`, [
    id,
    await empreinteMotDePasse(motDePasse),
  ])
  // Changer de mot de passe ferme les autres sessions : c'est le geste que l'on
  // fait justement quand on soupçonne qu'une session traîne ailleurs.
  await requete(`delete from sessions where utilisateur_id = $1::uuid`, [id])
}

export async function basculerActif(id: string, actif: boolean): Promise<void> {
  await requete(`update utilisateurs set actif = $2::boolean where id = $1::uuid`, [id, actif])
  if (!actif) await requete(`delete from sessions where utilisateur_id = $1::uuid`, [id])
}

export async function fermerToutesSessions(id: string): Promise<void> {
  await requete(`delete from sessions where utilisateur_id = $1::uuid`, [id])
}
