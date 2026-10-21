import 'server-only'
import { cache } from 'react'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { requete, requeteUne } from '@/lib/db'
import { baseCartesConfiguree } from '@/lib/cartes-url'
import { empreinteMotDePasse, motDePasseCorrespond, utilisateurCourant } from '@/lib/auth'
import { contexteRequete } from '@/lib/securite'

/**
 * Le portail du personnel d'un établissement : /service/<id>.<signature>.
 * Même porte que les pages client (lib/lien-stats.ts) : signature HMAC liée
 * à `version_lien` (renouveler le lien invalide l'ancien), mot de passe
 * facultatif (scrypt), témoin signé de 30 jours, essais freinés (8 par
 * adresse en 15 min, 40 par heure et 100 par jour pour l'établissement).
 *
 * Le mode gérant : un second mot de passe, facultatif, ouvre la modification
 * du menu, des annonces et des informations de l'établissement. Son témoin
 * dure 12 heures et tombe dès que le mot de passe du gérant change ou que le
 * lien du portail est renouvelé.
 *
 * Le propriétaire du logiciel, connecté au back-office avec la double
 * authentification, entre partout sans mot de passe : le bouton « Portail du
 * personnel ↗ » du back-office ouvre le portail directement.
 */
function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) throw new Error('SESSION_SECRET est requis.')
  return s
}

const signature = (id: string, version: number) =>
  createHmac('sha256', secret()).update(`services-portail:${id}:${version}`).digest('base64url').slice(0, 32)

export const jetonPortail = (id: string, version: number) => `${id}.${signature(id, version)}`

export function urlPortail(id: string, version: number, baseRepli: string): string {
  return `${baseCartesConfiguree() ?? baseRepli}/service/${jetonPortail(id, version)}`
}

const FORME = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{32})$/

type EtabSigne = {
  id: string
  nom: string
  type: 'restaurant' | 'hotel'
  version_lien: number
  mot_de_passe: string | null
  mot_de_passe_gerant: string | null
  langue_defaut: string
}

// Une seule lecture par affichage : le gabarit, les métadonnées et la page la partagent.
const etabSigne = cache(async (jeton: string): Promise<EtabSigne | null> => {
  const m = FORME.exec(jeton)
  if (!m) return null
  const [, id, sig] = m
  const e = await requeteUne<EtabSigne & { actif: boolean }>(
    `select id, nom, type, version_lien, mot_de_passe, mot_de_passe_gerant, langue_defaut, actif from etablissements where id = $1::uuid`,
    [id],
  )
  if (!e || !e.actif) return null
  const a = Buffer.from(signature(id, e.version_lien))
  const b = Buffer.from(sig)
  return a.length === b.length && timingSafeEqual(a, b) ? e : null
})

const nomTemoin = (id: string) => `tapora_portail_${id.replace(/-/g, '').slice(0, 16)}`
const valeurTemoin = (e: EtabSigne) =>
  createHmac('sha256', secret()).update(`portail:${e.id}:${e.version_lien}:${(e.mot_de_passe ?? '').slice(-24)}`).digest('base64url')

/**
 * Le mode gérant de cet appareil :
 * - `proprietaire` : le propriétaire du logiciel, connecté au back-office ;
 * - `actif` : le mot de passe du gérant a été donné (moins de 12 h) ;
 * - `verrouille` : le mode existe, pas encore ouvert sur cet appareil ;
 * - `absent` : l'établissement n'a pas de mot de passe de gérant.
 */
export type EtatGerant = 'proprietaire' | 'actif' | 'verrouille' | 'absent'

export type AccesPortail =
  | { etat: 'ok'; id: string; gerant: EtatGerant }
  | { etat: 'verrouille'; id: string; nom: string; type: 'restaurant' | 'hotel'; langue: string }
  | { etat: 'invalide' }

/** Le propriétaire du logiciel, connecté au back-office et passé par la double authentification. */
async function proprietaireConnecte(): Promise<boolean> {
  const u = await utilisateurCourant().catch(() => null)
  return Boolean(u?.actif && u.totp_actif && u.proprietaire_logiciel)
}

const egal = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export async function accesPortail(jeton: string): Promise<AccesPortail> {
  const e = await etabSigne(jeton)
  if (!e) return { etat: 'invalide' }
  const proprio = await proprietaireConnecte()
  if (e.mot_de_passe && !proprio) {
    const t = (await cookies()).get(nomTemoin(e.id))?.value ?? ''
    if (!egal(t, valeurTemoin(e))) return { etat: 'verrouille', id: e.id, nom: e.nom, type: e.type, langue: e.langue_defaut }
  }
  return { etat: 'ok', id: e.id, gerant: proprio ? 'proprietaire' : await etatGerant(e) }
}

/** L'id de l'établissement si le jeton est bon ET le mot de passe donné ; sinon null. Toute action du portail passe par ici. */
export async function etablissementDuJeton(jeton: string): Promise<string | null> {
  const a = await accesPortail(jeton)
  return a.etat === 'ok' ? a.id : null
}

/** L'id de l'établissement si le portail est ouvert ET le mode gérant aussi ; sinon null. Toute action du gérant passe par ici. */
export async function etablissementGerant(jeton: string): Promise<string | null> {
  const a = await accesPortail(jeton)
  return a.etat === 'ok' && (a.gerant === 'actif' || a.gerant === 'proprietaire') ? a.id : null
}

/** Les essais de mot de passe de la dernière journée (portail ou gérant) : faux si l'appareil ou l'établissement doit attendre. */
async function essaisPermis(etabId: string, quoi: 'portail' | 'gerant', ip: string | null): Promise<boolean> {
  const r = await requeteUne<{ ip: number; heure: number; jour: number }>(
    `select count(*) filter (where empreinte is not distinct from $3 and cree_le > now() - interval '15 minutes')::int as ip,
            count(*) filter (where cree_le > now() - interval '1 hour')::int as heure,
            count(*)::int as jour
       from essais_portail_service where etablissement_id = $1::uuid and quoi = $2 and cree_le > now() - interval '24 hours'`,
    [etabId, quoi, ip],
  )
  return (r?.ip ?? 0) < 8 && (r?.heure ?? 0) < 40 && (r?.jour ?? 0) < 100
}

export async function deverrouillerPortail(jeton: string, motDePasse: string): Promise<'ok' | 'faux' | 'bloque' | 'invalide'> {
  const e = await etabSigne(jeton)
  if (!e) return 'invalide'
  if (!e.mot_de_passe) return 'ok'
  const ctx = await contexteRequete()
  if (!(await essaisPermis(e.id, 'portail', ctx.ipEmpreinte))) return 'bloque'
  if (!(await motDePasseCorrespond(motDePasse.trim().slice(0, 200), e.mot_de_passe))) {
    await requete(`insert into essais_portail_service (etablissement_id, empreinte, quoi) values ($1::uuid, $2, 'portail')`, [e.id, ctx.ipEmpreinte])
    return 'faux'
  }
  ;(await cookies()).set(nomTemoin(e.id), valeurTemoin(e), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 86_400,
  })
  return 'ok'
}

/** Mettre, changer ou retirer le mot de passe du portail : un changement referme le portail et coupe ses notifications. */
export async function definirMotDePassePortail(id: string, motDePasse: string | null): Promise<void> {
  const empreinte = motDePasse ? await empreinteMotDePasse(motDePasse) : null
  await requete(`update etablissements set mot_de_passe = $2, maj_le = now() where id = $1::uuid`, [id, empreinte])
  await requete(`delete from essais_portail_service where etablissement_id = $1::uuid and quoi = 'portail'`, [id])
  if (motDePasse) await requete(`delete from abonnements_push_service where etablissement_id = $1::uuid`, [id])
}

// ---------------------------------------------------------------------------
// Le mode gérant
// ---------------------------------------------------------------------------

const DUREE_GERANT = 12 * 3600
const nomTemoinGerant = (id: string) => `tapora_gerant_${id.replace(/-/g, '').slice(0, 16)}`
// Liée au lien (version) et au mot de passe du gérant : changer l'un ou l'autre referme le mode sur tous les appareils.
const signatureGerant = (e: EtabSigne, expire: number) =>
  createHmac('sha256', secret()).update(`gerant:${e.id}:${e.version_lien}:${(e.mot_de_passe_gerant ?? '').slice(-24)}:${expire}`).digest('base64url')

async function etatGerant(e: EtabSigne): Promise<EtatGerant> {
  if (!e.mot_de_passe_gerant) return 'absent'
  const brut = (await cookies()).get(nomTemoinGerant(e.id))?.value ?? ''
  const [exp, sig] = brut.split('.')
  const expire = Number(exp)
  if (!sig || !Number.isInteger(expire) || expire * 1000 < Date.now()) return 'verrouille'
  return egal(sig, signatureGerant(e, expire)) ? 'actif' : 'verrouille'
}

/**
 * Le mot de passe du gérant, appelé par l'écran du cadenas (fetch). Le
 * portail doit déjà être ouvert sur cet appareil (mot de passe de l'équipe
 * donné, ou portail sans mot de passe).
 */
export async function deverrouillerGerant(jeton: string, motDePasse: string): Promise<'ok' | 'faux' | 'bloque' | 'invalide' | 'absent'> {
  const a = await accesPortail(jeton)
  if (a.etat !== 'ok') return 'invalide'
  if (a.gerant === 'proprietaire' || a.gerant === 'actif') return 'ok'
  if (a.gerant === 'absent') return 'absent'
  const e = await etabSigne(jeton)
  if (!e?.mot_de_passe_gerant) return 'absent'
  const ctx = await contexteRequete()
  if (!(await essaisPermis(e.id, 'gerant', ctx.ipEmpreinte))) return 'bloque'
  if (!(await motDePasseCorrespond(motDePasse.trim().slice(0, 200), e.mot_de_passe_gerant))) {
    await requete(`insert into essais_portail_service (etablissement_id, empreinte, quoi) values ($1::uuid, $2, 'gerant')`, [e.id, ctx.ipEmpreinte])
    return 'faux'
  }
  const expire = Math.floor(Date.now() / 1000) + DUREE_GERANT
  ;(await cookies()).set(nomTemoinGerant(e.id), `${expire}.${signatureGerant(e, expire)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DUREE_GERANT,
  })
  return 'ok'
}

/** « Quitter le mode gérant » : le témoin est retiré de cet appareil. */
export async function quitterGerant(jeton: string): Promise<void> {
  const m = FORME.exec(jeton)
  if (m) (await cookies()).delete(nomTemoinGerant(m[1]))
}

/** Mettre, changer ou retirer le mot de passe du gérant : un changement referme le mode gérant sur tous les appareils. */
export async function definirMotDePasseGerant(id: string, motDePasse: string | null): Promise<void> {
  const empreinte = motDePasse ? await empreinteMotDePasse(motDePasse) : null
  await requete(`update etablissements set mot_de_passe_gerant = $2, maj_le = now() where id = $1::uuid`, [id, empreinte])
  await requete(`delete from essais_portail_service where etablissement_id = $1::uuid and quoi = 'gerant'`, [id])
}

/** Le back-office : l'établissement a-t-il un mot de passe de gérant ? */
export async function gerantProtege(id: string): Promise<boolean> {
  const l = await requeteUne<{ p: boolean }>(`select mot_de_passe_gerant is not null as p from etablissements where id = $1::uuid`, [id])
  return l?.p ?? false
}

/** Nouveau lien du portail : l'ancien cesse de fonctionner, les appareils sont désinscrits. */
export async function renouvelerLienPortail(id: string): Promise<void> {
  await requete(`update etablissements set version_lien = version_lien + 1, maj_le = now() where id = $1::uuid`, [id])
  await requete(`delete from abonnements_push_service where etablissement_id = $1::uuid`, [id])
}
