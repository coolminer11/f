'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { deverrouiller, dossierDuJeton } from '@/lib/lien-stats'
import { requeteUne } from '@/lib/db'
import { emetteur } from '@/lib/requetes/ventes'
import { echapper, envoyerCourriel } from '@/lib/courriel'
import { langueValide, textes } from '@/lib/langue'
import { clesVapid, endpointValide, essai } from '@/lib/push'
import { ETAPES_LANCEMENT } from '@/lib/lancement'
import { accepterPartenaire, enregistrerRecommandation, RABAIS_FILLEUL } from '@/lib/parrainage'
import { baseLiens, contexteRequete } from '@/lib/securite'
import { approuverMaquette, envoyerMessageClient, estSujet } from '@/lib/portail'

export type EtatCommande = { ok: boolean; erreur: string | null }

export type EtatMessage = { ok: boolean; erreur: 'vide' | 'trop' | 'lien' | null; envoye: number }

/** « Écrire à Tapora » depuis le portail : arrive dans le back-office (Messages), avec un courriel. */
export async function ecrireTapora(avant: EtatMessage, donnees: FormData): Promise<EtatMessage> {
  const id = await dossierDuJeton(String(donnees.get('jeton') ?? '').slice(0, 80))
  if (!id) return { ...avant, ok: false, erreur: 'lien' }
  const texte = String(donnees.get('texte') ?? '').trim()
  const sujet = donnees.get('sujet')
  if (!texte || texte.length > 2000 || !estSujet(sujet)) return { ...avant, ok: false, erreur: 'vide' }
  const r = await envoyerMessageClient(id, sujet, texte, await contexteRequete())
  if (r === 'trop') return { ...avant, ok: false, erreur: 'trop' }
  revalidatePath(`/stats/${String(donnees.get('jeton'))}`)
  return { ok: true, erreur: null, envoye: avant.envoye + 1 }
}

/** « J'approuve la maquette » : la commande avance, Tapora est prévenue. */
export async function approuverMaquetteAction(donnees: FormData): Promise<void> {
  const jeton = String(donnees.get('jeton') ?? '').slice(0, 80)
  const id = await dossierDuJeton(jeton)
  if (!id) return
  await approuverMaquette(id, String(donnees.get('commande') ?? ''))
  const l = langueValide(String(donnees.get('l') ?? ''))
  redirect(`/stats/${jeton}?approuvee=1${l ? `&l=${l}` : ''}#commandes`)
}

/**
 * Sans JavaScript seulement (l'écran du cadenas passe d'habitude par la route
 * /stats/[jeton]/deverrouiller, pour jouer son animation) : le bon mot de passe
 * ouvre la page 30 jours sur cet appareil.
 */
export async function deverrouillerPage(donnees: FormData): Promise<void> {
  const jeton = String(donnees.get('jeton') ?? '').slice(0, 80)
  const r = await deverrouiller(jeton, String(donnees.get('mot_de_passe') ?? ''))
  const l = langueValide(String(donnees.get('l') ?? ''))
  redirect(`/stats/${jeton}${l ? `?l=${l}` : ''}${r === 'ok' ? '' : `${l ? '&' : '?'}refus=${r}`}`)
}

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
      // Construit depuis la configuration, jamais depuis l'en-tête Host du visiteur.
      const lien = `${await baseLiens()}/cartes/dossiers/${dossierId}#demandes`
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

// ---------------------------------------------------------------------------
// Parrainage : « Recommandez-nous »
// ---------------------------------------------------------------------------
export type EtatRecommandation = { ok: boolean; erreur: string | null; commerce?: string }

const vide = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const Recommandation = z
  .object({
    jeton: z.string().max(80),
    commerce: z.string().trim().min(1).max(120),
    contact: z.preprocess(vide, z.string().trim().max(120).optional()),
    courriel: z.preprocess(vide, z.string().trim().max(254).regex(/^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$/i).optional()),
    telephone: z.preprocess(vide, z.string().trim().max(40).regex(/^[\d\s()+.\-]{7,40}$/).optional()),
    message: z.preprocess(vide, z.string().trim().max(500).optional()),
    partenaire: z.literal('on').optional(),
    site_web: z.preprocess(
      vide,
      z
        .string()
        .trim()
        .max(300)
        .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
        .refine((v) => /^https?:\/\/[^\s<>"']+\.[^\s<>"']+$/i.test(v))
        .optional(),
    ),
  })
  .refine((v) => v.courriel || v.telephone, { path: ['courriel'] })

const TEXTES_RECO = {
  fr: {
    commerce: 'Donnez-nous au moins le nom du commerce.',
    joindre: 'Ajoutez un courriel ou un téléphone pour qu’on puisse le joindre.',
    courriel: 'Ce courriel ne semble pas valide.',
    telephone: 'Ce numéro de téléphone ne semble pas valide.',
    site: 'Votre site web : une adresse comme lecafe.ca.',
    trop: 'Merci ! Vous avez déjà fait plusieurs recommandations aujourd’hui : réessayez demain.',
    lien: 'Ce lien n’est plus valide.',
  },
  en: {
    commerce: 'Please give us at least the business name.',
    joindre: 'Add an email or a phone number so we can reach them.',
    courriel: 'This email does not look valid.',
    telephone: 'This phone number does not look valid.',
    site: 'Your website: an address like mycafe.ca.',
    trop: 'Thank you! You already sent several recommendations today: try again tomorrow.',
    lien: 'This link is no longer valid.',
  },
}

/**
 * Un commerce en recommande un autre. Le jeton est revérifié ; au plus cinq
 * recommandations par 24 h. La société est prévenue par courriel ; un
 * courriel qui échoue ne perd pas la recommandation (elle est dans le
 * back-office).
 */
export async function recommander(_: EtatRecommandation, donnees: FormData): Promise<EtatRecommandation> {
  const langue = langueValide(String(donnees.get('langue') ?? '')) ?? 'fr'
  const E = TEXTES_RECO[langue]
  const a = Recommandation.safeParse(Object.fromEntries(donnees))
  if (!a.success) {
    const champs = new Set(a.error.issues.map((i) => String(i.path[0] ?? '')))
    const rempli = (k: string) => String(donnees.get(k) ?? '').trim() !== ''
    const erreur = champs.has('commerce')
      ? E.commerce
      : champs.has('site_web')
        ? E.site
        : champs.has('telephone')
          ? E.telephone
          : champs.has('courriel') && rempli('courriel')
            ? E.courriel
            : E.joindre
    return { ok: false, erreur }
  }
  const v = a.data
  const parrainId = await dossierDuJeton(v.jeton)
  if (!parrainId) return { ok: false, erreur: E.lien }

  const r = await enregistrerRecommandation(parrainId, {
    commerce: v.commerce,
    contact: v.contact ?? null,
    courriel: v.courriel ?? null,
    telephone: v.telephone ?? null,
    message: v.message ?? null,
  })
  if (!r) return { ok: false, erreur: E.trop }
  if (v.partenaire === 'on') await accepterPartenaire(parrainId, v.site_web ?? null)

  try {
    const societe = await emetteur()
    if (societe.courriel_contact) {
      const lien = `${await baseLiens()}/cartes/parrainages`
      const lignes: [string, string | undefined][] = [
        ['Commerce', v.commerce],
        ['Contact', v.contact],
        ['Courriel', v.courriel],
        ['Téléphone', v.telephone],
        ['Message', v.message],
      ]
      const html = `<p><strong>${echapper(r.parrain_nom)}</strong> vous recommande un commerce, depuis sa page de statistiques.</p>
<table style="border-collapse:collapse;font-size:14px">${lignes
        .filter(([, x]) => x)
        .map(([k, x]) => `<tr><td style="padding:4px 14px 4px 0;color:#6b5d50">${k}</td><td style="padding:4px 0;font-weight:600">${echapper(x!)}</td></tr>`)
        .join('')}</table>
<p>Rappel : <strong>${RABAIS_FILLEUL} % sur sa première commande</strong>, de la part de ${echapper(r.parrain_nom)}.${v.partenaire === 'on' ? ` ${echapper(r.parrain_nom)} accepte de paraître sur la page Partenaires.` : ''}</p>
<p><a href="${echapper(lien)}">Ouvrir les recommandations</a></p>`
      await envoyerCourriel({
        destinataire: societe.courriel_contact,
        objet: `🤝 ${r.parrain_nom} vous recommande ${v.commerce}`,
        html,
        texte: `${r.parrain_nom} vous recommande un commerce :\n\n${lignes
          .filter(([, x]) => x)
          .map(([k, x]) => `${k} : ${x}`)
          .join('\n')}\n\nRappel : ${RABAIS_FILLEUL} % sur sa première commande.\n\n${lien}`,
      })
    }
  } catch {
    // La recommandation est enregistrée : elle s'affiche dans le back-office quoi qu'il arrive.
  }
  return { ok: true, erreur: null, commerce: v.commerce }
}
