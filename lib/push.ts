import 'server-only'
import webpush from 'web-push'
import { requete, requeteUne } from '@/lib/db'
import { PALIERS_TAPS } from '@/lib/paliers'

/**
 * Le « Ding ! » : une notification sur le téléphone du commerce quand un
 * client tape sa carte (Web Push, gratuit, sans application).
 *
 * Les clés VAPID (l'identité du serveur auprès d'Apple, Google et Mozilla)
 * sont créées au premier besoin et gardées en base ; VAPID_PUBLIQUE et
 * VAPID_PRIVEE dans l'environnement, si présentes, ont priorité.
 *
 * Pour ne pas transformer un samedi chargé en mitraillette, un même
 * commerce reçoit au plus une notification par minute ; la suivante
 * regroupe les taps arrivés entre-temps (« 3 nouveaux taps »).
 */

// Seuls les services de notification des navigateurs sont acceptés comme
// destination : le serveur ne doit jamais envoyer de requête ailleurs.
const SERVICES = [
  /^https:\/\/fcm\.googleapis\.com\//,
  /^https:\/\/[a-z0-9.-]*\.push\.apple\.com\//,
  /^https:\/\/updates\.push\.services\.mozilla\.com\//,
  /^https:\/\/[a-z0-9.-]*\.notify\.windows\.com\//,
  /^https:\/\/[a-z0-9.-]*\.push\.services\.mozilla\.com\//,
]
export function endpointValide(url: string): boolean {
  return url.length <= 1000 && SERVICES.some((r) => r.test(url))
}

const globale = globalThis as typeof globalThis & { __vapid?: { publique: string; privee: string } }

export async function clesVapid(): Promise<{ publique: string; privee: string }> {
  if (process.env.VAPID_PUBLIQUE && process.env.VAPID_PRIVEE) return { publique: process.env.VAPID_PUBLIQUE, privee: process.env.VAPID_PRIVEE }
  if (globale.__vapid) return globale.__vapid
  let l = await requeteUne<{ publique: string; privee: string }>(`select publique, privee from cles_push where id`)
  if (!l) {
    const k = webpush.generateVAPIDKeys()
    await requete(`insert into cles_push (id, publique, privee) values (true, $1, $2) on conflict (id) do nothing`, [k.publicKey, k.privateKey])
    l = await requeteUne<{ publique: string; privee: string }>(`select publique, privee from cles_push where id`)
  }
  globale.__vapid = l!
  return l!
}

type Abonnement = { id: string; endpoint: string; p256dh: string; auth: string; langue: 'fr' | 'en' }
type Message = { titre: string; corps: string; url: string; etiquette: string }

async function envoyer(abonnements: Abonnement[], message: (l: 'fr' | 'en') => Message): Promise<number> {
  if (!abonnements.length) return 0
  const { publique, privee } = await clesVapid()
  let reussis = 0
  await Promise.all(
    abonnements.map(async (a) => {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          JSON.stringify(message(a.langue)),
          { vapidDetails: { subject: 'https://taporacards.com', publicKey: publique, privateKey: privee }, TTL: 600, urgency: 'high', timeout: 8000 },
        )
        reussis++
        await requete(`update abonnements_push set dernier_envoi = now() where id = $1`, [a.id])
      } catch (e) {
        // 404 / 410 : l'abonnement n'existe plus (application retirée,
        // permission révoquée) — on l'oublie.
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await requete(`delete from abonnements_push where id = $1`, [a.id])
      }
    }),
  )
  return reussis
}

export async function abonnementsDe(dossierId: string): Promise<Abonnement[]> {
  return requete<Abonnement>(`select id, endpoint, p256dh, auth, langue from abonnements_push where dossier_id = $1::uuid`, [dossierId])
}

/** Une notification d'essai, vers un seul appareil. */
export async function essai(dossierId: string, endpoint: string, chemin: string): Promise<boolean> {
  const a = await requete<Abonnement>(
    `select id, endpoint, p256dh, auth, langue from abonnements_push where dossier_id = $1::uuid and endpoint = $2`,
    [dossierId, endpoint],
  )
  const n = await envoyer(a, (l) => ({
    titre: l === 'fr' ? '🔔 Ding ! Ça marche.' : '🔔 Ding! It works.',
    corps: l === 'fr' ? 'Vous serez prévenu ici à chaque tap sur vos cartes.' : 'You’ll be notified here every time someone taps your cards.',
    url: chemin,
    etiquette: 'essai',
  }))
  return n > 0
}

/**
 * Appelé après un tap. `verifier` : l'appel vient de l'extérieur (le Worker
 * Cloudflare) — on exige alors qu'un vrai tap de cette carte vienne d'être
 * enregistré, ce qui rend l'adresse inoffensive : au pire, quelqu'un
 * déclenche une notification pour un tap qui a réellement eu lieu.
 */
export async function notifierTap(code: string, cheminStats: (dossierId: string, version: number) => string, verifier: boolean): Promise<void> {
  // Une seule requête, et l'on s'arrête là pour l'immense majorité des taps :
  // ceux d'un commerce qui n'a aucun téléphone abonné.
  const c = await requeteUne<{ dossier_id: string | null; nom: string; version_lien: number; lien_actif: boolean; abonne: boolean; dernier_tap: string | null }>(
    `select c.dossier_id, d.nom, d.version_lien, d.lien_actif,
            exists (select 1 from abonnements_push a where a.dossier_id = c.dossier_id) as abonne,
            case when $2 then (select max(t.tape_le) from taps t where t.carte_id = c.id) end as dernier_tap
       from cartes_nfc c join dossiers_cartes d on d.id = c.dossier_id
      where c.code = $1`,
    [code, verifier],
  )
  if (!c?.dossier_id || !c.lien_actif || !c.abonne) return
  if (verifier && (!c.dernier_tap || Date.now() - new Date(c.dernier_tap).getTime() > 120_000)) return
  const abonnements = await abonnementsDe(c.dossier_id)
  if (!abonnements.length) return

  // Le verrou d'une minute, posé et lu en un seul ordre : deux taps
  // simultanés ne font jamais deux notifications.
  const v = await requeteUne<{ precedent: string | null }>(
    `with avant as (select dernier_push from dossiers_cartes where id = $1::uuid for update)
     update dossiers_cartes d set dernier_push = now()
       from avant
      where d.id = $1::uuid and (avant.dernier_push is null or avant.dernier_push < now() - interval '60 seconds')
     returning avant.dernier_push as precedent`,
    [c.dossier_id],
  )
  if (!v) return

  const s = await requeteUne<{ aujourdhui: number; depuis: number; record: number; total: number }>(
    `with t as (
       select t.tape_le from taps t join cartes_nfc k on k.id = t.carte_id where k.dossier_id = $1::uuid
     ), jours as (
       select (tape_le at time zone 'America/Toronto')::date as j, count(*)::int as n from t group by 1
     )
     select coalesce((select n from jours where j = (now() at time zone 'America/Toronto')::date), 0) as aujourdhui,
            (select count(*)::int from t where $2::timestamptz is null or tape_le > $2::timestamptz) as depuis,
            coalesce((select max(n) from jours where j < (now() at time zone 'America/Toronto')::date), 0) as record,
            (select count(*)::int from t) as total`,
    [c.dossier_id, v.precedent],
  )
  if (!s) return
  const nouveaux = Math.max(1, s.depuis)
  const palier = PALIERS_TAPS.find((p) => s.total >= p && s.total - nouveaux < p)
  const record = s.record > 0 && s.aujourdhui > s.record && s.aujourdhui - nouveaux <= s.record
  const url = cheminStats(c.dossier_id, c.version_lien)

  await envoyer(abonnements, (l) => {
    const fr = l === 'fr'
    const nf = new Intl.NumberFormat(fr ? 'fr-CA' : 'en-CA')
    if (palier)
      return {
        titre: fr ? `🎉 ${nf.format(palier)} taps !` : `🎉 ${nf.format(palier)} taps!`,
        corps: fr ? `${c.nom} vient de franchir le cap des ${nf.format(palier)} taps. Bravo !` : `${c.nom} just passed ${nf.format(palier)} taps. Congrats!`,
        url,
        etiquette: 'palier',
      }
    if (record)
      return {
        titre: fr ? '🏆 Nouveau record !' : '🏆 New record!',
        corps: fr ? `${s.aujourdhui} taps aujourd’hui : votre meilleure journée à vie.` : `${s.aujourdhui} taps today: your best day ever.`,
        url,
        etiquette: 'record',
      }
    return {
      titre: nouveaux > 1 ? (fr ? `🔔 ${nouveaux} nouveaux taps` : `🔔 ${nouveaux} new taps`) : fr ? '🔔 Ding ! Un client vient de taper' : '🔔 Ding! A customer just tapped',
      corps: fr ? `${c.nom} · ${s.aujourdhui} tap${s.aujourdhui > 1 ? 's' : ''} aujourd’hui` : `${c.nom} · ${s.aujourdhui} tap${s.aujourdhui > 1 ? 's' : ''} today`,
      url,
      etiquette: 'tap',
    }
  })
}
