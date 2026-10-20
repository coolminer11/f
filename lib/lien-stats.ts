import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { requete, requeteUne } from '@/lib/db'
import { baseCartesConfiguree } from '@/lib/cartes-url'
import { empreinteMotDePasse, motDePasseCorrespond, sessionOuverte } from '@/lib/auth'
import { baseLiens, contexteRequete } from '@/lib/securite'
import { envoyerCourriel } from '@/lib/courriel'
import { emetteur } from '@/lib/requetes/ventes'
import { courrielInterne } from '@/lib/courriel-portail'

/**
 * Le lien privé des statistiques d'un dossier : /stats/<id>.<signature>.
 *
 * La signature est un HMAC de l'id et de `version_lien`, avec le secret du
 * serveur. Rien n'est stocké : une copie de la base ne donne aucun lien, et
 * incrémenter la version invalide l'ancien lien sur-le-champ. 192 bits de
 * signature : impossible à deviner, même en essayant des milliards de fois.
 *
 * Mot de passe (facultatif, pour un hôtel qui partage la page avec son
 * équipe) : le lien seul ne suffit plus. Une fois le bon mot de passe entré,
 * un témoin signé ouvre la page 30 jours ; changer le mot de passe ou
 * renouveler le lien le rend caduc. Toutes les pages et actions du client
 * passent par dossierDuJeton : aucune n'y échappe.
 */
function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) throw new Error('SESSION_SECRET est requis.')
  return s
}

function signature(dossierId: string, version: number): string {
  return createHmac('sha256', secret())
    .update(`stats-dossier:${dossierId}:${version}`)
    .digest('base64url')
    .slice(0, 32)
}

export function jetonStats(dossierId: string, version: number): string {
  return `${dossierId}.${signature(dossierId, version)}`
}

const FORME = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{32})$/

/** L'id écrit dans le jeton, SANS rien vérifier : pour lancer les lectures en même temps que la vérification. */
export function idDuJeton(jeton: string): string | null {
  return FORME.exec(jeton)?.[1] ?? null
}

type DossierSigne = {
  id: string
  nom: string
  version_lien: number
  mot_de_passe: string | null
  langue: 'fr' | 'en'
}

/** Le dossier si la signature est bonne ET le lien actif — sans regarder le mot de passe. */
async function dossierSigne(jeton: string): Promise<DossierSigne | null> {
  const m = FORME.exec(jeton)
  if (!m) return null
  const [, id, sig] = m
  const d = await requeteUne<DossierSigne & { lien_actif: boolean }>(
    `select id, nom, version_lien, lien_actif, mot_de_passe, langue from dossiers_cartes where id = $1::uuid`,
    [id],
  )
  if (!d || !d.lien_actif) return null
  const attendue = Buffer.from(signature(id, d.version_lien))
  const recue = Buffer.from(sig)
  return attendue.length === recue.length && timingSafeEqual(attendue, recue) ? d : null
}

const nomTemoin = (id: string) => `tapora_page_${id.replace(/-/g, '').slice(0, 16)}`
const valeurTemoin = (d: DossierSigne) =>
  createHmac('sha256', secret())
    .update(`page:${d.id}:${d.version_lien}:${(d.mot_de_passe ?? '').slice(-24)}`)
    .digest('base64url')

export type Acces = { etat: 'ok'; id: string } | { etat: 'verrouille'; id: string; nom: string; langue: 'fr' | 'en' } | { etat: 'invalide' }

export async function accesDossier(jeton: string): Promise<Acces> {
  const d = await dossierSigne(jeton)
  if (!d) return { etat: 'invalide' }
  if (!d.mot_de_passe) return { etat: 'ok', id: d.id }
  const temoin = (await cookies()).get(nomTemoin(d.id))?.value ?? ''
  const attendu = valeurTemoin(d)
  const ok = temoin.length === attendu.length && timingSafeEqual(Buffer.from(temoin), Buffer.from(attendu))
  // Un associé connecté au back-office voit la page sans le mot de passe (aperçu).
  return ok || (await sessionOuverte()) ? { etat: 'ok', id: d.id } : { etat: 'verrouille', id: d.id, nom: d.nom, langue: d.langue }
}

/** L'id du dossier si le jeton est valide, le lien actif ET le mot de passe donné (s'il y en a un) ; null sinon. */
export async function dossierDuJeton(jeton: string): Promise<string | null> {
  const a = await accesDossier(jeton)
  return a.etat === 'ok' ? a.id : null
}

const ESSAIS_PAR_IP = 8 // en 15 minutes
const ESSAIS_PAR_PAGE = 40 // en une heure, toutes adresses confondues
const ESSAIS_PAR_JOUR = 100 // en 24 heures, toutes adresses confondues
const SEUIL_ALERTE = 15 // essais ratés en une heure : Tapora est prévenue

/** Entrer le mot de passe d'une page : freiné contre les essais en série. */
export async function deverrouiller(jeton: string, motDePasse: string): Promise<'ok' | 'faux' | 'bloque' | 'invalide'> {
  const d = await dossierSigne(jeton)
  if (!d) return 'invalide'
  if (!d.mot_de_passe) return 'ok'
  const ctx = await contexteRequete()
  // Les plafonds par page tiennent même si l'adresse IP change à chaque essai :
  // un robot qui tourne sur mille adresses reste à 40 essais par heure.
  const r = await requeteUne<{ ip: number; heure: number; jour: number }>(
    `select count(*) filter (where empreinte is not distinct from $2 and cree_le > now() - interval '15 minutes')::int as ip,
            count(*) filter (where cree_le > now() - interval '1 hour')::int as heure,
            count(*)::int as jour
       from essais_page_client where dossier_id = $1::uuid and cree_le > now() - interval '24 hours'`,
    [d.id, ctx.ipEmpreinte],
  )
  if ((r?.ip ?? 0) >= ESSAIS_PAR_IP || (r?.heure ?? 0) >= ESSAIS_PAR_PAGE || (r?.jour ?? 0) >= ESSAIS_PAR_JOUR) return 'bloque'
  if (!(await motDePasseCorrespond(motDePasse.trim().slice(0, 200), d.mot_de_passe))) {
    await requete(
      `with ancien as (delete from essais_page_client where dossier_id = $1::uuid and cree_le < now() - interval '1 day')
       insert into essais_page_client (dossier_id, empreinte) values ($1::uuid, $2)`,
      [d.id, ctx.ipEmpreinte],
    )
    if ((r?.heure ?? 0) + 1 >= SEUIL_ALERTE) await alerterAcharnement(d, (r?.heure ?? 0) + 1)
    return 'faux'
  }
  ;(await cookies()).set(nomTemoin(d.id), valeurTemoin(d), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 86_400,
  })
  return 'ok'
}

/**
 * Quelqu'un s'acharne sur le mot de passe d'une page : un courriel à Tapora,
 * au plus un par heure et par page. Le geste à faire est dans le courriel :
 * changer le mot de passe ou renouveler le lien.
 */
async function alerterAcharnement(d: DossierSigne, essais: number): Promise<void> {
  const nouvelle = await requeteUne<{ id: number }>(
    `insert into alertes_page_client (dossier_id, essais)
     select $1::uuid, $2 where not exists (select 1 from alertes_page_client where dossier_id = $1::uuid and cree_le > now() - interval '1 hour')
     returning id`,
    [d.id, essais],
  )
  if (!nouvelle) return
  try {
    const societe = await emetteur()
    if (!societe.courriel_contact) return
    const { html, texte } = courrielInterne({
      titre: `Quelqu’un essaie de deviner le mot de passe de « ${d.nom} »`,
      lignes: [
        ['Essais ratés', `${essais} dans la dernière heure`],
        ['Protection', `bloqué à ${ESSAIS_PAR_PAGE} essais par heure et ${ESSAIS_PAR_JOUR} par jour, même en changeant d’adresse IP`],
        ['Si ce n’est pas le client', 'changez le mot de passe, ou renouvelez le lien (l’ancien cesse de fonctionner)'],
      ],
      lien: `${await baseLiens()}/cartes/dossiers/${d.id}#mot-de-passe`,
      bouton: 'Ouvrir le dossier',
    })
    await envoyerCourriel({ destinataire: societe.courriel_contact, objet: `🔐 Essais répétés sur la page de ${d.nom}`, html, texte })
  } catch {
    // L'alerte est notée ; le courriel n'est qu'un avertissement de plus.
  }
}

/**
 * Mettre, changer ou retirer (null) le mot de passe d'une page client. Un
 * nouveau mot de passe ferme la page partout (le témoin d'accès dépend de
 * l'empreinte) et coupe les notifications « Ding » des appareils inscrits :
 * ils devront rentrer le nouveau pour les retrouver.
 */
export async function definirMotDePasse(dossierId: string, motDePasse: string | null): Promise<void> {
  const empreinte = motDePasse ? await empreinteMotDePasse(motDePasse) : null
  await requete(`update dossiers_cartes set mot_de_passe = $2 where id = $1::uuid`, [dossierId, empreinte])
  await requete(`delete from essais_page_client where dossier_id = $1::uuid`, [dossierId])
  if (motDePasse) await requete(`delete from abonnements_push where dossier_id = $1::uuid`, [dossierId])
}

/**
 * Adresse complète du lien. Elle passe par le domaine des cartes
 * (go.taporacards.com) : le Worker la relaie au serveur, et le client voit
 * le nom de la société plutôt que celui de l'hébergeur.
 */
export function urlStats(dossierId: string, version: number, baseRepli: string): string {
  return `${baseCartesConfiguree() ?? baseRepli}/stats/${jetonStats(dossierId, version)}`
}
