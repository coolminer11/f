'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { dossierDuJeton } from '@/lib/lien-stats'
import { requeteUne } from '@/lib/db'
import { emetteur } from '@/lib/requetes/ventes'
import { echapper, envoyerCourriel } from '@/lib/courriel'
import { langueValide, textes } from '@/lib/langue'

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

