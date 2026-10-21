import 'server-only'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { cache } from 'react'
import { requete, requeteUne } from '@/lib/db'
import { egal, type Contexte } from '@/lib/securite'
import { faiblesse } from '@/lib/mots-de-passe'

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
  totp_actif: boolean
  /** Le compte qui possède le logiciel (Arthur) : seul à voir Tapora Services. */
  proprietaire_logiciel: boolean
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

export function verifierForceMotDePasse(motDePasse: string, interdits: string[] = []): string | null {
  if (motDePasse.length < 10) return 'Le mot de passe doit compter au moins 10 caractères.'
  if (!/[a-zA-Z]/.test(motDePasse) || !/[0-9]/.test(motDePasse)) {
    return 'Le mot de passe doit mêler des lettres et des chiffres.'
  }
  const raison = faiblesse(motDePasse, interdits)
  return raison ? `Mot de passe refusé — ${raison.charAt(0).toLowerCase()}${raison.slice(1)}` : null
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

export async function ouvrirSession(utilisateurId: string, ctx?: Contexte): Promise<void> {
  const jeton = randomBytes(32).toString('base64url')
  const agent = (await headers()).get('user-agent')
  await requete(
    `insert into sessions (empreinte, utilisateur_id, expire_le, agent, appareil, ip_masquee)
     values ($1, $2::uuid, now() + make_interval(days => $3::int), $4, $5, $6)`,
    [empreinteJeton(jeton), utilisateurId, DUREE_JOURS, agent?.slice(0, 200) ?? null, ctx?.appareil ?? null, ctx?.ipMasquee ?? null],
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
  const brut = (await cookies()).get(NOM_COOKIE)?.value
  return brut ? lireSession(brut) : null
}

// Une seule lecture par affichage : le gabarit et la page demandent tous deux
// la session ; sans ce cache, chaque page payait deux allers-retours de plus.
const lireSession = cache(async (brut: string): Promise<Utilisateur | null> => {
  const [jeton, signature] = brut.split('.')
  if (!jeton || !signature) return null
  if (!egal(signature, await signer(jeton))) return null

  const utilisateur = await requeteUne<Utilisateur>(
    `select u.id, u.courriel, u.nom, u.role, u.associe_id, u.actif, u.totp_actif, u.proprietaire_logiciel
       from sessions s
       join utilisateurs u on u.id = s.utilisateur_id
      where s.empreinte = $1 and s.expire_le > now() and u.actif`,
    [empreinteJeton(jeton)],
  )
  if (!utilisateur) return null

  // « Vue pour la dernière fois » : au plus une écriture par minute, sans la
  // faire attendre à la page.
  void requete(`update sessions set derniere_vue = now() where empreinte = $1 and derniere_vue < now() - interval '1 minute'`, [
    empreinteJeton(jeton),
  ]).catch(() => {})
  return utilisateur
})

/** Où va un compte sans double authentification : nulle part ailleurs. */
export const PAGE_DOUBLE_AUTH = '/compte/securite?obligatoire=1'

/**
 * À appeler en tête de CHAQUE page et route protégée. Le middleware ne fait
 * qu'écarter les cookies absents ou forgés ; c'est ici que la session est
 * réellement validée contre la base.
 *
 * La double authentification est OBLIGATOIRE : un compte qui ne l'a pas
 * activée n'ouvre que la page Sécurité (qui seule passe `sansDoubleAuth`),
 * le temps de l'activer. Ni lecture ni écriture avant.
 */
export async function exigerSession(options: { sansDoubleAuth?: boolean } = {}): Promise<Utilisateur> {
  const utilisateur = await utilisateurCourant()
  if (!utilisateur) redirect('/connexion')
  if (!utilisateur.totp_actif && !options.sansDoubleAuth) redirect(PAGE_DOUBLE_AUTH)
  return utilisateur
}

/** Variante pour les routes d'API : une session sans double authentification ne compte pas. */
export async function sessionOuverte(): Promise<boolean> {
  return (await utilisateurCourant())?.totp_actif === true
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
    `select id, courriel, nom, role, associe_id, actif, totp_actif, empreinte
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
    `select u.id, u.courriel, u.nom, u.role, u.associe_id, u.actif, u.totp_actif,
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

/**
 * Efface un compte pour de bon.
 *
 * Ses sessions partent en cascade. Ce qu'il a saisi RESTE : les écritures
 * appartiennent à la société, pas à la personne qui les a tapées — seule la
 * mention « saisi par » redevient vide (clés en « set null »).
 */
export async function supprimerUtilisateur(id: string): Promise<void> {
  await requete(`delete from utilisateurs where id = $1::uuid`, [id])
}

/** L'empreinte de la session en cours, pour la reconnaître dans la liste. */
export async function empreinteSessionCourante(): Promise<string | null> {
  const jeton = (await cookies()).get(NOM_COOKIE)?.value?.split('.')[0]
  return jeton ? empreinteJeton(jeton) : null
}

export type SessionListe = { id: string; appareil: string | null; ip_masquee: string | null; cree_le: string; derniere_vue: string; empreinte: string }

export async function listerSessions(utilisateurId: string): Promise<SessionListe[]> {
  return requete<SessionListe>(
    `select id, appareil, ip_masquee, cree_le, derniere_vue, empreinte
       from sessions where utilisateur_id = $1::uuid and expire_le > now()
      order by derniere_vue desc`,
    [utilisateurId],
  )
}

export async function fermerUneSession(utilisateurId: string, sessionId: string): Promise<void> {
  await requete(`delete from sessions where id = $1::uuid and utilisateur_id = $2::uuid`, [sessionId, utilisateurId])
}

/** Ferme toutes les sessions du compte sauf celle en cours. */
export async function fermerAutresSessions(utilisateurId: string): Promise<void> {
  const courante = await empreinteSessionCourante()
  await requete(`delete from sessions where utilisateur_id = $1::uuid and empreinte is distinct from $2`, [utilisateurId, courante])
}

export async function fermerToutesSessions(id: string): Promise<void> {
  await requete(`delete from sessions where utilisateur_id = $1::uuid`, [id])
}
