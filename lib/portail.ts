import 'server-only'
import { createHmac } from 'node:crypto'
import { requete, requeteUne } from '@/lib/db'
import { envoyerCourriel } from '@/lib/courriel'
import { emetteur } from '@/lib/requetes/ventes'
import { baseLiens, type Contexte } from '@/lib/securite'
import { urlStats } from '@/lib/lien-stats'
import { courrielClient, courrielInterne } from '@/lib/courriel-portail'
import { ETAPES, noterEtape, type Etape } from '@/lib/commandes'

/**
 * Le portail des entreprises, côté serveur. La page privée du client (son
 * lien, son mot de passe) devient un portail : il y suit ses commandes,
 * approuve sa maquette et écrit à Tapora ; tout arrive dans le
 * back-office (Messages), avec un courriel à la société. Tapora répond du
 * back-office ; le client reçoit la réponse par courriel et sur sa page.
 *
 * Les fonctions qui reçoivent un dossierId supposent que l'appelant l'a
 * obtenu par dossierDuJeton (lien signé + mot de passe) : jamais d'un champ.
 */

export const SUJETS = {
  question: { fr: 'Une question', en: 'A question' },
  destination: { fr: 'Changer où mènent mes cartes', en: 'Change where my cards lead' },
  probleme: { fr: 'Une carte ne marche pas', en: 'A card isn’t working' },
  commande: { fr: 'Ma commande', en: 'My order' },
  design: { fr: 'Le design de mes cartes', en: 'My card design' },
  autre: { fr: 'Autre chose', en: 'Something else' },
} as const
export type Sujet = keyof typeof SUJETS
export const estSujet = (v: unknown): v is Sujet => typeof v === 'string' && v in SUJETS

export type Message = { id: string; auteur: 'client' | 'tapora'; sujet: Sujet; texte: string; cree_le: string; par_nom: string | null; traite_le: string | null }

const MAX_JOUR_DOSSIER = 10
const MAX_HEURE_IP = 20

function empreinte(quoi: string): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) throw new Error('SESSION_SECRET est requis.')
  return createHmac('sha256', s).update(quoi).digest('hex').slice(0, 32)
}

/** Le courriel du client d'un dossier : celui des rapports, sinon celui de sa fiche client. */
async function contactDossier(dossierId: string) {
  return requeteUne<{ id: string; nom: string; langue: 'fr' | 'en'; version_lien: number; lien_actif: boolean; courriel: string | null }>(
    `select d.id, d.nom, d.langue, d.version_lien, d.lien_actif, coalesce(nullif(d.courriel_rapport, ''), nullif(c.courriel, '')) as courriel
       from dossiers_cartes d left join clients c on c.id = d.client_id where d.id = $1::uuid`,
    [dossierId],
  )
}

async function prevenirTapora(objet: string, contenu: Parameters<typeof courrielInterne>[0]): Promise<void> {
  try {
    const societe = await emetteur()
    if (!societe.courriel_contact) return
    await envoyerCourriel({ destinataire: societe.courriel_contact, objet, ...courrielInterne(contenu) })
  } catch {
    // Tout est enregistré : le back-office l'affiche, courriel ou pas.
  }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** Le fil d'un dossier, du plus ancien au plus récent (les 60 derniers). */
export async function filMessages(dossierId: string): Promise<Message[]> {
  return requete<Message>(
    `select * from (
       select m.id, m.auteur, m.sujet, m.texte, m.cree_le, m.traite_le, split_part(u.nom, ' ', 1) as par_nom
         from messages_clients m left join utilisateurs u on u.id = m.par
        where m.dossier_id = $1::uuid order by m.cree_le desc limit 60
     ) x order by cree_le`,
    [dossierId],
  )
}

/** Le client écrit. Freiné : 10 messages par jour et par dossier, 20 par heure et par adresse. */
export async function envoyerMessageClient(dossierId: string, sujet: Sujet, texte: string, ctx: Contexte): Promise<'ok' | 'trop'> {
  const t = texte.trim().slice(0, 2000)
  const ligne = await requeteUne<{ id: string }>(
    `insert into messages_clients (dossier_id, auteur, sujet, texte, empreinte)
     select $1::uuid, 'client', $2, $3, $4
      where (select count(*) from messages_clients where dossier_id = $1::uuid and auteur = 'client' and cree_le > now() - interval '24 hours') < $5
        and (select count(*) from messages_clients where empreinte is not distinct from $4 and $4 is not null and cree_le > now() - interval '1 hour') < $6
     returning id`,
    [dossierId, sujet, t, ctx.ipEmpreinte, MAX_JOUR_DOSSIER, MAX_HEURE_IP],
  )
  if (!ligne) return 'trop'
  const d = await contactDossier(dossierId)
  await prevenirTapora(`✉️ ${d?.nom ?? 'Un client'} vous écrit — ${SUJETS[sujet].fr}`, {
    titre: `${d?.nom ?? 'Un client'} vous écrit depuis son portail`,
    lignes: [
      ['Sujet', SUJETS[sujet].fr],
      ['Courriel', d?.courriel],
    ],
    citation: t,
    lien: `${await baseLiens()}/messages#d-${dossierId}`,
    bouton: 'Répondre dans le back-office',
  })
  return 'ok'
}

/** Tapora répond : le fil est réglé, et le client reçoit la réponse par courriel (s'il a une adresse). */
export async function repondreClient(dossierId: string, texte: string, utilisateurId: string): Promise<{ courriel: string | null; statut: string | null }> {
  const t = texte.trim().slice(0, 2000)
  await requete(
    `insert into messages_clients (dossier_id, auteur, sujet, texte, par, traite_le) values ($1::uuid, 'tapora', 'question', $2, $3::uuid, now())`,
    [dossierId, t, utilisateurId],
  )
  await marquerTraite(dossierId)
  const d = await contactDossier(dossierId)
  if (!d?.courriel || !d.lien_actif) return { courriel: null, statut: null }
  const fr = d.langue === 'fr'
  const c = await courrielClient({
    langue: d.langue,
    surtitre: fr ? 'Réponse de Tapora' : 'Reply from Tapora',
    titre: d.nom,
    paragraphes: [fr ? 'Bonjour, voici notre réponse à votre message :' : 'Hello, here is our reply to your message:'],
    citation: t,
    bouton: { texte: fr ? 'Voir la conversation' : 'See the conversation', lien: `${urlStats(d.id, d.version_lien, await baseLiens())}#messages` },
  })
  const r = await envoyerCourriel({ destinataire: d.courriel, objet: fr ? `Tapora vous a répondu` : `Tapora replied to you`, ...c })
  return { courriel: d.courriel, statut: r.statut }
}

export async function marquerTraite(dossierId: string): Promise<void> {
  await requete(`update messages_clients set traite_le = now() where dossier_id = $1::uuid and auteur = 'client' and traite_le is null`, [dossierId])
}

// ---------------------------------------------------------------------------
// Commandes, vues par le client
// ---------------------------------------------------------------------------

export type CommandeClient = {
  id: string
  numero: string
  produit_nom: string
  quantite: number
  etape: Etape
  maquette: boolean
  maquette_approuvee_le: string | null
  cree_le: string
  etapes: Record<string, string>
}

/** Les commandes du dossier (hors annulées), les plus récentes d'abord. */
export async function commandesClient(dossierId: string): Promise<CommandeClient[]> {
  return requete<CommandeClient>(
    `select c.id, c.numero, p.nom as produit_nom, c.quantite, c.etape, c.maquette_url is not null as maquette, c.maquette_approuvee_le, c.cree_le,
            coalesce((select jsonb_object_agg(e.etape, e.fait_le) from commandes_etapes e where e.commande_id = c.id), '{}'::jsonb) as etapes
       from commandes c join produits p on p.id = c.produit_id
      where c.dossier_id = $1::uuid and c.annulee_le is null
      order by c.cree_le desc limit 6`,
    [dossierId],
  )
}

/** « J'approuve la maquette » : l'étape avance toute seule, et Tapora est prévenue. */
export async function approuverMaquette(dossierId: string, commandeId: string): Promise<boolean> {
  const c = await requeteUne<{ numero: string; client_nom: string }>(
    `update commandes set maquette_approuvee_le = now()
      where id = $1::uuid and dossier_id = $2::uuid and maquette_url is not null and annulee_le is null
        and maquette_approuvee_le is null and etape in ('demande', 'maquette')
      returning numero, client_nom`,
    [commandeId, dossierId],
  )
  if (!c) return false
  await noterEtape(commandeId, 'approuvee', null, 'Approuvée par le client depuis son portail')
  await prevenirTapora(`✅ ${c.client_nom} a approuvé la maquette (${c.numero})`, {
    titre: `${c.client_nom} a approuvé sa maquette`,
    lignes: [['Commande', c.numero]],
    lien: `${await baseLiens()}/commandes/${commandeId}`,
    bouton: 'Passer la commande au fournisseur',
  })
  return true
}

/** La maquette est jointe : le client est prévenu, s'il a déjà son portail et une adresse. Vrai si un courriel est parti. */
export async function prevenirMaquettePrete(commandeId: string): Promise<boolean> {
  const c = await requeteUne<{ dossier_id: string | null; numero: string }>(`select dossier_id, numero from commandes where id = $1::uuid`, [commandeId])
  if (!c?.dossier_id) return false
  const d = await contactDossier(c.dossier_id)
  if (!d?.courriel || !d.lien_actif) return false
  const fr = d.langue === 'fr'
  const mail = await courrielClient({
    langue: d.langue,
    surtitre: fr ? `Commande ${c.numero}` : `Order ${c.numero}`,
    titre: fr ? 'Votre maquette est prête' : 'Your design is ready',
    paragraphes: [
      fr
        ? 'Voici la maquette de vos cartes. Regardez-la tranquillement : un clic l’approuve, ou écrivez-nous ce que vous aimeriez changer. La fabrication commence dès votre approbation.'
        : 'Here is the design of your cards. Take your time: one click approves it, or tell us what you would like to change. Production starts as soon as you approve.',
    ],
    bouton: { texte: fr ? 'Voir ma maquette' : 'See my design', lien: `${urlStats(d.id, d.version_lien, await baseLiens())}#commandes` },
  })
  const r = await envoyerCourriel({ destinataire: d.courriel, objet: fr ? `Votre maquette Tapora est prête (${c.numero})` : `Your Tapora design is ready (${c.numero})`, ...mail }).catch(() => null)
  return r?.statut === 'envoye' || r?.statut === 'simule'
}

/** Le fichier de la maquette, seulement s'il appartient à une commande de CE dossier. */
export async function cheminMaquette(dossierId: string, commandeId: string): Promise<string | null> {
  const l = await requeteUne<{ maquette_url: string | null }>(
    `select maquette_url from commandes where id = $1::uuid and dossier_id = $2::uuid and annulee_le is null`,
    [commandeId, dossierId],
  )
  return l?.maquette_url ?? null
}

// ---------------------------------------------------------------------------
// Demandes Entreprise (formulaire du site)
// ---------------------------------------------------------------------------

export type DemandeEntreprise = {
  id: string
  contact_nom: string
  entreprise: string
  courriel: string
  telephone: string | null
  quantite: number
  lieu: 'QC' | 'HORS_QC'
  langue: 'fr' | 'en'
  message: string | null
  cree_le: string
  traitee_le: string | null
  commande_id: string | null
  commande_numero: string | null
}

export type SaisieDemande = Omit<DemandeEntreprise, 'id' | 'cree_le' | 'traitee_le' | 'commande_id' | 'commande_numero'>

/** Enregistrée seulement sous les plafonds : 5 par heure et par adresse IP, 40 par jour au total. */
export async function enregistrerDemandeEntreprise(e: SaisieDemande, ctx: Contexte): Promise<'ok' | 'trop'> {
  const ligne = await requeteUne<{ id: string }>(
    `insert into demandes_entreprise (contact_nom, entreprise, courriel, telephone, quantite, lieu, langue, message, empreinte)
     select $1, $2, $3, $4, $5, $6, $7, $8, $9
      where (select count(*) from demandes_entreprise where empreinte is not distinct from $9 and $9 is not null and cree_le > now() - interval '1 hour') < 5
        and (select count(*) from demandes_entreprise where cree_le > now() - interval '24 hours') < 40
     returning id`,
    [e.contact_nom, e.entreprise, e.courriel, e.telephone, e.quantite, e.lieu, e.langue, e.message, ctx.ipEmpreinte],
  )
  if (!ligne) return 'trop'
  await prevenirTapora(`🏨 Demande Entreprise : ${e.entreprise} — ${e.quantite} cartes`, {
    titre: `Nouvelle demande Entreprise depuis le site`,
    lignes: [
      ['Entreprise', e.entreprise],
      ['Contact', e.contact_nom],
      ['Courriel', e.courriel],
      ['Téléphone', e.telephone],
      ['Cartes', String(e.quantite)],
      ['Posées', e.lieu === 'QC' ? 'Au Québec (français d’abord)' : 'Hors Québec (anglais d’abord)'],
      ['Langue', e.langue === 'fr' ? 'Français' : 'Anglais'],
    ],
    citation: e.message,
    lien: `${await baseLiens()}/messages#demande-${ligne.id}`,
    bouton: 'Ouvrir la demande',
  })
  return 'ok'
}

export async function lireDemande(id: string): Promise<DemandeEntreprise | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  return requeteUne<DemandeEntreprise>(
    `select d.*, c.numero as commande_numero from demandes_entreprise d left join commandes c on c.id = d.commande_id where d.id = $1::uuid`,
    [id],
  )
}

export async function marquerDemande(id: string, traitee: boolean, commandeId: string | null = null): Promise<void> {
  await requete(
    `update demandes_entreprise set traitee_le = case when $2 then coalesce(traitee_le, now()) else null end, commande_id = coalesce($3::uuid, commande_id)
      where id = $1::uuid`,
    [id, traitee, commandeId],
  )
}

// ---------------------------------------------------------------------------
// Le compte rendu du back-office
// ---------------------------------------------------------------------------

export type Conversation = {
  dossier_id: string
  nom: string
  a_traiter: number
  dernier_texte: string
  dernier_sujet: Sujet
  dernier_auteur: 'client' | 'tapora'
  dernier_le: string
  attente_depuis: string | null
  courriel: string | null
}

export type CompteRendu = {
  conversations: Conversation[]
  demandes: DemandeEntreprise[]
  cartes: { id: string; dossier_id: string; nom: string; quantite: number; message: string | null; cree_le: string }[]
  maquettes: { id: string; numero: string; client_nom: string; depuis: string }[]
  bloquees: { id: string; numero: string; client_nom: string; etape: Etape; depuis: string }[]
}

/** Tout ce qui attend une réponse ou un geste, en un écran. */
export async function compteRendu(): Promise<CompteRendu> {
  const [conversations, demandes, cartes, maquettes, bloquees] = await Promise.all([
    requete<Conversation>(
      `select d.id as dossier_id, d.nom,
              count(*) filter (where m.auteur = 'client' and m.traite_le is null)::int as a_traiter,
              (array_agg(m.texte order by m.cree_le desc))[1] as dernier_texte,
              (array_agg(m.sujet order by m.cree_le desc))[1] as dernier_sujet,
              (array_agg(m.auteur order by m.cree_le desc))[1] as dernier_auteur,
              max(m.cree_le) as dernier_le,
              min(m.cree_le) filter (where m.auteur = 'client' and m.traite_le is null) as attente_depuis,
              coalesce(nullif(d.courriel_rapport, ''), nullif(c.courriel, '')) as courriel
         from messages_clients m join dossiers_cartes d on d.id = m.dossier_id left join clients c on c.id = d.client_id
        where m.cree_le > now() - interval '90 days'
        group by d.id, c.courriel
        order by count(*) filter (where m.auteur = 'client' and m.traite_le is null) > 0 desc, max(m.cree_le) desc
        limit 40`,
    ),
    requete<DemandeEntreprise>(
      `select d.*, c.numero as commande_numero from demandes_entreprise d left join commandes c on c.id = d.commande_id
        where d.traitee_le is null or d.cree_le > now() - interval '30 days'
        order by d.traitee_le is null desc, d.cree_le desc limit 30`,
    ),
    requete<CompteRendu['cartes'][number]>(
      `select q.id, q.dossier_id, d.nom, q.quantite, q.message, q.cree_le
         from demandes_cartes q join dossiers_cartes d on d.id = q.dossier_id
        where q.traitee_le is null order by q.cree_le desc limit 20`,
    ),
    requete<CompteRendu['maquettes'][number]>(
      `select c.id, c.numero, c.client_nom, coalesce((select fait_le from commandes_etapes e where e.commande_id = c.id and e.etape = 'maquette'), c.maj_le) as depuis
         from commandes c
        where c.annulee_le is null and c.etape = 'maquette' and c.maquette_url is not null and c.maquette_approuvee_le is null
        order by depuis`,
    ),
    requete<CompteRendu['bloquees'][number]>(
      `select c.id, c.numero, c.client_nom, c.etape, coalesce(max(e.fait_le), c.cree_le) as depuis
         from commandes c left join commandes_etapes e on e.commande_id = c.id
        where c.annulee_le is null and c.etape not in ('facturee', 'maquette')
        group by c.id
       having coalesce(max(e.fait_le), c.cree_le) < now() - interval '7 days'
        order by depuis`,
    ),
  ])
  return { conversations, demandes, cartes, maquettes, bloquees }
}

/** Pour la pastille du menu : ce qui attend une réponse. */
export async function nombreATraiter(): Promise<number> {
  const l = await requeteUne<{ n: number }>(
    `select ((select count(distinct dossier_id) from messages_clients where auteur = 'client' and traite_le is null)
           + (select count(*) from demandes_entreprise where traitee_le is null)
           + (select count(*) from demandes_cartes where traitee_le is null))::int as n`,
  )
  return l?.n ?? 0
}

// ---------------------------------------------------------------------------
// Accès au portail par courriel
// ---------------------------------------------------------------------------

/**
 * « Recevoir mon lien » : si l'adresse est celle d'un dossier actif, le lien
 * lui est envoyé ; sinon, rien. La réponse à l'écran est la même dans les
 * deux cas (on ne révèle pas qui est client). Freiné : 3 par heure et par
 * adresse courriel, 6 par heure et par adresse IP.
 */
export async function envoyerAccesPortail(courriel: string, ctx: Contexte): Promise<void> {
  const adresse = courriel.trim().toLowerCase().slice(0, 254)
  const cle = empreinte(`portail:${adresse}`)
  const permis = await requeteUne<{ ok: number }>(
    `insert into demandes_acces_portail (courriel_empreinte, empreinte)
     select $1, $2
      where (select count(*) from demandes_acces_portail where courriel_empreinte = $1 and cree_le > now() - interval '1 hour') < 3
        and (select count(*) from demandes_acces_portail where empreinte is not distinct from $2 and $2 is not null and cree_le > now() - interval '1 hour') < 6
     returning 1 as ok`,
    [cle, ctx.ipEmpreinte],
  )
  await requete(`delete from demandes_acces_portail where cree_le < now() - interval '2 days'`)
  if (!permis) return
  const dossiers = await requete<{ id: string; nom: string; langue: 'fr' | 'en'; version_lien: number }>(
    `select d.id, d.nom, d.langue, d.version_lien
       from dossiers_cartes d left join clients c on c.id = d.client_id
      where d.lien_actif and (lower(btrim(d.courriel_rapport)) = $1 or lower(btrim(c.courriel)) = $1)
      order by d.nom limit 5`,
    [adresse],
  )
  const base = await baseLiens()
  for (const d of dossiers) {
    const fr = d.langue === 'fr'
    const c = await courrielClient({
      langue: d.langue,
      surtitre: fr ? 'Votre espace client' : 'Your client area',
      titre: d.nom,
      paragraphes: [
        fr
          ? 'Voici le lien de votre espace Tapora : vos statistiques, vos commandes et vos messages. Gardez-le pour vous ; si la page est protégée, votre mot de passe vous sera demandé.'
          : 'Here is the link to your Tapora area: your stats, your orders and your messages. Keep it to yourself; if the page is protected, you will be asked for your password.',
        fr ? 'Vous n’avez rien demandé ? Ignorez ce courriel : rien n’a changé.' : 'Didn’t ask for this? Just ignore this email: nothing has changed.',
      ],
      bouton: { texte: fr ? 'Ouvrir mon espace' : 'Open my area', lien: `${urlStats(d.id, d.version_lien, base)}?bienvenue=1` },
    })
    await envoyerCourriel({ destinataire: adresse, objet: fr ? `Votre espace Tapora — ${d.nom}` : `Your Tapora area — ${d.nom}`, ...c }).catch(() => null)
  }
}

export const ETAPES_CLIENT: Record<Etape, { fr: string; en: string }> = {
  demande: { fr: 'Demande reçue', en: 'Request received' },
  maquette: { fr: 'Maquette', en: 'Design' },
  approuvee: { fr: 'Approuvée', en: 'Approved' },
  commandee: { fr: 'En fabrication', en: 'In production' },
  recue: { fr: 'Reçue chez Tapora', en: 'Received by Tapora' },
  posee: { fr: 'Posée', en: 'Installed' },
  facturee: { fr: 'Terminée', en: 'Complete' },
}
export const ORDRE_ETAPES = ETAPES.map(([c]) => c)
