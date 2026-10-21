import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { requete, requeteUne } from '@/lib/db'
import { baseCartesConfiguree } from '@/lib/cartes-url'
import { empreinteMotDePasse, motDePasseCorrespond } from '@/lib/auth'
import { contexteRequete } from '@/lib/securite'

/**
 * Le portail du personnel d'un établissement : /service/<id>.<signature>.
 * Même porte que les pages client (lib/lien-stats.ts) : signature HMAC liée
 * à `version_lien` (renouveler le lien invalide l'ancien), mot de passe
 * facultatif (scrypt), témoin signé de 30 jours, essais freinés (8 par
 * adresse en 15 min, 40 par heure et 100 par jour pour l'établissement).
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

type EtabSigne = { id: string; nom: string; type: 'restaurant' | 'hotel'; version_lien: number; mot_de_passe: string | null; langue_defaut: string }

async function etabSigne(jeton: string): Promise<EtabSigne | null> {
  const m = FORME.exec(jeton)
  if (!m) return null
  const [, id, sig] = m
  const e = await requeteUne<EtabSigne & { actif: boolean }>(
    `select id, nom, type, version_lien, mot_de_passe, langue_defaut, actif from etablissements where id = $1::uuid`,
    [id],
  )
  if (!e || !e.actif) return null
  const a = Buffer.from(signature(id, e.version_lien))
  const b = Buffer.from(sig)
  return a.length === b.length && timingSafeEqual(a, b) ? e : null
}

const nomTemoin = (id: string) => `tapora_portail_${id.replace(/-/g, '').slice(0, 16)}`
const valeurTemoin = (e: EtabSigne) =>
  createHmac('sha256', secret()).update(`portail:${e.id}:${e.version_lien}:${(e.mot_de_passe ?? '').slice(-24)}`).digest('base64url')

export type AccesPortail =
  | { etat: 'ok'; id: string }
  | { etat: 'verrouille'; id: string; nom: string; type: 'restaurant' | 'hotel'; langue: string }
  | { etat: 'invalide' }

export async function accesPortail(jeton: string): Promise<AccesPortail> {
  const e = await etabSigne(jeton)
  if (!e) return { etat: 'invalide' }
  if (!e.mot_de_passe) return { etat: 'ok', id: e.id }
  const t = (await cookies()).get(nomTemoin(e.id))?.value ?? ''
  const attendu = valeurTemoin(e)
  const ok = t.length === attendu.length && timingSafeEqual(Buffer.from(t), Buffer.from(attendu))
  return ok ? { etat: 'ok', id: e.id } : { etat: 'verrouille', id: e.id, nom: e.nom, type: e.type, langue: e.langue_defaut }
}

/** L'id de l'établissement si le jeton est bon ET le mot de passe donné ; sinon null. Toute action du portail passe par ici. */
export async function etablissementDuJeton(jeton: string): Promise<string | null> {
  const a = await accesPortail(jeton)
  return a.etat === 'ok' ? a.id : null
}

export async function deverrouillerPortail(jeton: string, motDePasse: string): Promise<'ok' | 'faux' | 'bloque' | 'invalide'> {
  const e = await etabSigne(jeton)
  if (!e) return 'invalide'
  if (!e.mot_de_passe) return 'ok'
  const ctx = await contexteRequete()
  const r = await requeteUne<{ ip: number; heure: number; jour: number }>(
    `select count(*) filter (where empreinte is not distinct from $2 and cree_le > now() - interval '15 minutes')::int as ip,
            count(*) filter (where cree_le > now() - interval '1 hour')::int as heure,
            count(*)::int as jour
       from essais_portail_service where etablissement_id = $1::uuid and cree_le > now() - interval '24 hours'`,
    [e.id, ctx.ipEmpreinte],
  )
  if ((r?.ip ?? 0) >= 8 || (r?.heure ?? 0) >= 40 || (r?.jour ?? 0) >= 100) return 'bloque'
  if (!(await motDePasseCorrespond(motDePasse.trim().slice(0, 200), e.mot_de_passe))) {
    await requete(`insert into essais_portail_service (etablissement_id, empreinte) values ($1::uuid, $2)`, [e.id, ctx.ipEmpreinte])
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
  await requete(`delete from essais_portail_service where etablissement_id = $1::uuid`, [id])
  if (motDePasse) await requete(`delete from abonnements_push_service where etablissement_id = $1::uuid`, [id])
}

/** Nouveau lien du portail : l'ancien cesse de fonctionner, les appareils sont désinscrits. */
export async function renouvelerLienPortail(id: string): Promise<void> {
  await requete(`update etablissements set version_lien = version_lien + 1, maj_le = now() where id = $1::uuid`, [id])
  await requete(`delete from abonnements_push_service where etablissement_id = $1::uuid`, [id])
}
