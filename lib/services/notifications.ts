import 'server-only'
import webpush from 'web-push'
import { requete } from '@/lib/db'
import { clesVapid, endpointValide } from '@/lib/push'

/**
 * Le « Ding » du personnel : chaque demande d'un client fait sonner les
 * téléphones et tablettes inscrits sur le portail de l'établissement
 * (Web Push, gratuit, sans application). Un appareil peut ne suivre qu'un
 * groupe (« Terrasse », « 2e étage ») ; sans groupe, il reçoit tout.
 */
type Abonnement = { id: string; endpoint: string; p256dh: string; auth: string }

export async function inscrireAppareil(etabId: string, a: { endpoint: string; p256dh: string; auth: string; groupe: string | null }): Promise<boolean> {
  if (!endpointValide(a.endpoint) || a.p256dh.length > 200 || a.auth.length > 100) return false
  await requete(
    `insert into abonnements_push_service (etablissement_id, endpoint, p256dh, auth, groupe) values ($1::uuid, $2, $3, $4, $5)
     on conflict (endpoint) do update set etablissement_id = excluded.etablissement_id, p256dh = excluded.p256dh, auth = excluded.auth, groupe = excluded.groupe`,
    [etabId, a.endpoint, a.p256dh, a.auth, a.groupe?.slice(0, 60) || null],
  )
  return true
}

export async function desinscrireAppareil(etabId: string, endpoint: string): Promise<void> {
  await requete(`delete from abonnements_push_service where etablissement_id = $1::uuid and endpoint = $2`, [etabId, endpoint.slice(0, 1000)])
}

export async function notifierPersonnel(etabId: string, groupe: string | null, message: { titre: string; corps: string; url: string; etiquette: string }): Promise<number> {
  const abonnements = await requete<Abonnement>(
    `select id, endpoint, p256dh, auth from abonnements_push_service
      where etablissement_id = $1::uuid and (groupe is null or $2::text is null or groupe = $2)`,
    [etabId, groupe],
  )
  if (!abonnements.length) return 0
  const { publique, privee } = await clesVapid()
  let reussis = 0
  await Promise.all(
    abonnements.map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, JSON.stringify(message), {
          vapidDetails: { subject: 'https://taporacards.com', publicKey: publique, privateKey: privee },
          TTL: 300,
          urgency: 'high',
          timeout: 8000,
        })
        reussis++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await requete(`delete from abonnements_push_service where id = $1`, [a.id])
      }
    }),
  )
  return reussis
}
