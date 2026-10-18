'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { dossierDuJeton } from '@/lib/lien-stats'
import { requeteUne } from '@/lib/db'
import { emetteur } from '@/lib/requetes/ventes'
import { echapper, envoyerCourriel } from '@/lib/courriel'
import { langueValide, textes } from '@/lib/langue'
import { clesVapid, endpointValide, essai } from '@/lib/push'
import { ETAPES_LANCEMENT } from '@/lib/lancement'

export type EtatCommande = { ok: boolean; erreur: string | null }

const Saisie = z.object({
  jeton: z.string().max(80),
  quantite: z.coerce.number().int().min(1).max(500),
  message: z.string().trim().max(500).optional(),
  langue: z.string().optional(),
})

/** Au plus trois demandes par commerce et par 24 h : assez pour un vrai client, pas pour un robot. */
const PLAFOND_JOUR = 3

/**
 * « Commander plus de cartes », depuis la page client. Une action serveur
 * s'appelle sans la page : le jeton est donc revérifié ici, comme partout.
 * La demande est enregistrée (elle apparaît dans le dossier) et la société
 * reçoit un courriel ; un courriel qui échoue ne perd pas la demande.
 */
export async function commanderCartes(_: EtatCommande, donnees: FormData): Promise<EtatCommande> {
  const T = textes(langueValide(String(donnees.get('langue') ?? '')) ?? 'fr')
  const a = Saisie.safeParse(Object.fromEntries(donnees))
  if (!a.success) return { ok: false, erreur: T.erreurQte }
  const dossierId = await dossierDuJeton(a.data.jeton)
  if (!dossierId) return { ok: false, erreur: T.erreurLien }

  // Le plafond et l'ajout en un seul ordre : deux clics simultanés ne le dépassent pas.
  const message = a.data.message || null
  const d = await requeteUne<{ nom: string }>(
    `insert into demandes_cartes (dossier_id, quantite, message)
     select $1::uuid, $2, $3
      where (select count(*) from demandes_cartes
              where dossier_id = $1::uuid and cree_le > now() - interval '24 hours') < $4
     returning (select nom from dossiers_cartes where id = $1::uuid) as nom`,
    [dossierId, a.data.quantite, message, PLAFOND_JOUR],
  )
  if (!d) return { ok: false, erreur: T.erreurTrop }

  try {
    const societe = await emetteur()
    if (societe.courriel_contact) {
      const h = await headers()
      const hote = h.get('x-forwarded-host') ?? h.get('host')
      const lien = hote ? `https://${hote}/cartes/dossiers/${dossierId}#demandes` : null
      const nom = d.nom
      const q = a.data.quantite
      await envoyerCourriel({
        destinataire: societe.courriel_contact,
        objet: `🛒 ${nom} veut ${q} carte${q > 1 ? 's' : ''} de plus`,
        html: `<p><strong>${echapper(nom)}</strong> demande <strong>${q} carte${q > 1 ? 's' : ''}</strong> de plus, depuis sa page de statistiques.</p>${
          message ? `<blockquote style="border-left:3px solid #c2552f;margin:0;padding:4px 12px;color:#444">${echapper(message)}</blockquote>` : ''
        }${lien ? `<p><a href="${echapper(lien)}">Ouvrir le dossier</a></p>` : ''}`,
        texte: `${nom} demande ${q} carte(s) de plus, depuis sa page de statistiques.${message ? `\n\n« ${message} »` : ''}${lien ? `\n\n${lien}` : ''}`,
      })
    }
  } catch {
    // La demande est enregistrée : elle s'affiche dans le dossier quoi qu'il arrive.
  }
  return { ok: true, erreur: null }
}


// ---------------------------------------------------------------------------
// Liste de lancement
// ---------------------------------------------------------------------------
/** Coche ou décoche une étape. Le jeton est revérifié ; seules les clés connues passent. */
export async function cocherLancement(jeton: string, cle: string, coche: boolean): Promise<boolean> {
  if (!(ETAPES_LANCEMENT as readonly string[]).includes(cle)) return false
  const id = await dossierDuJeton(jeton)
  if (!id) return false
  await requeteUne(
    coche
      ? `update dossiers_cartes set lancement = array(select distinct unnest(lancement || array[$2::text])) where id = $1::uuid returning 1`
      : `update dossiers_cartes set lancement = array_remove(lancement, $2::text) where id = $1::uuid returning 1`,
    [id, cle],
  )
  return true
}

// ---------------------------------------------------------------------------
// Notifications « Ding ! »
// ---------------------------------------------------------------------------
const Abonnement = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
})

export async function abonnerPush(jeton: string, brut: unknown, langue: string): Promise<boolean> {
  const id = await dossierDuJeton(jeton)
  const a = Abonnement.safeParse(brut)
  if (!id || !a.success || !endpointValide(a.data.endpoint)) return false
  await requeteUne(
    `insert into abonnements_push (dossier_id, endpoint, p256dh, auth, langue) values ($1::uuid, $2, $3, $4, $5)
     on conflict (endpoint) do update set dossier_id = excluded.dossier_id, p256dh = excluded.p256dh, auth = excluded.auth, langue = excluded.langue
     returning 1`,
    [id, a.data.endpoint, a.data.keys.p256dh, a.data.keys.auth, langueValide(langue) ?? 'fr'],
  )
  return true
}

export async function desabonnerPush(jeton: string, endpoint: string): Promise<boolean> {
  const id = await dossierDuJeton(jeton)
  if (!id) return false
  await requeteUne(`delete from abonnements_push where dossier_id = $1::uuid and endpoint = $2 returning 1`, [id, String(endpoint).slice(0, 1000)])
  return true
}

export async function essaiPush(jeton: string, endpoint: string): Promise<boolean> {
  const id = await dossierDuJeton(jeton)
  if (!id) return false
  return essai(id, String(endpoint).slice(0, 1000), `/stats/${jeton}`)
}

export async function clePubliquePush(): Promise<string> {
  return (await clesVapid()).publique
}
