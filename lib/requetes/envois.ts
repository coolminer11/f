import 'server-only'
import { randomBytes } from 'node:crypto'
import { requete, requeteUne } from '@/lib/db'
import { documentComplet, emetteur, type VenteComplete } from '@/lib/requetes/ventes'
import { echapper, envoyerCourriel, messagerieConfiguree } from '@/lib/courriel'
import { documentEnPdf, nomFichierPdf } from '@/lib/pdf'
import { argent, dateLongue } from '@/lib/format'

export type Envoi = {
  id: string
  destinataire: string
  objet: string
  statut: 'envoye' | 'echec' | 'simule'
  erreur: string | null
  reference: string | null
  envoye_le: string
  envoye_par_nom: string | null
}

export async function listerEnvois(venteId: string): Promise<Envoi[]> {
  return requete<Envoi>(
    `select e.id, e.destinataire, e.objet, e.statut, e.erreur, e.reference, e.envoye_le,
            u.nom as envoye_par_nom
       from envois_document e
       left join utilisateurs u on u.id = e.envoye_par
      where e.vente_id = $1::uuid
      order by e.envoye_le desc`,
    [venteId],
  )
}

/** Crée le jeton public au premier envoi, puis le réutilise. */
async function jetonPublic(venteId: string): Promise<string> {
  const existant = await requeteUne<{ jeton_public: string | null }>(
    `select jeton_public from ventes where id = $1::uuid`,
    [venteId],
  )
  if (existant?.jeton_public) return existant.jeton_public

  const jeton = randomBytes(24).toString('base64url')
  await requete(`update ventes set jeton_public = $2 where id = $1::uuid`, [venteId, jeton])
  return jeton
}

export async function revoquerLienPublic(venteId: string): Promise<void> {
  await requete(`update ventes set jeton_public = null where id = $1::uuid`, [venteId])
}

export async function documentParJeton(jeton: string): Promise<VenteComplete | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(jeton)) return null
  const ligne = await requeteUne<{ id: string }>(
    `select id from ventes where jeton_public = $1 and statut <> 'annulee'`,
    [jeton],
  )
  return ligne ? documentComplet(ligne.id) : null
}

/**
 * Le courriel, dans la voix des associés.
 *
 * Quelques lignes et le PDF en pièce jointe, comme un message écrit à la main
 * — mais concrètes. « Voici votre reçu » sans date ni montant, avec un PDF
 * joint et un expéditeur neuf, c'est trait pour trait le gabarit des fausses
 * factures, et Gmail le classe en indésirables. La date et le montant dans
 * la phrase disent au filtre — et au client — qu'il s'agit d'un vrai achat.
 */
/**
 * L'adresse à laquelle le client peut écrire : celle de la société si elle
 * est renseignée, sinon celle qui envoie — un client ne doit jamais lire
 * « écrivez-nous à » suivi de rien.
 */
function adresseContact(courrielContact: string | null): string {
  if (courrielContact?.trim()) return courrielContact.trim()
  const expediteur = process.env.COURRIEL_EXPEDITEUR ?? process.env.GMAIL_EXPEDITEUR ?? ''
  return expediteur.match(/<([^>]+)>/)?.[1] ?? expediteur.trim()
}

function corpsCourriel(
  doc: VenteComplete,
  societe: Awaited<ReturnType<typeof emetteur>>,
  message: string | null,
): { html: string; texte: string } {
  const remplacer = (modele: string) =>
    modele
      .replaceAll('{document}', doc.definition.libelle.toLowerCase())
      .replaceAll('{numero}', doc.numero)
      .replaceAll('{client}', doc.client ?? doc.client_nom ?? '')
      .replaceAll('{entreprise}', societe.nom_entreprise)
      .replaceAll('{contact}', adresseContact(societe.courriel_contact))
      .replaceAll('{date}', dateLongue(doc.date))
      .replaceAll('{total}', argent(doc.montant_ttc))
      // {details} s'adapte au document : un bon de livraison n'a pas de montant.
      .replaceAll(
        '{details}',
        doc.definition.affiche_prix
          ? ` du ${dateLongue(doc.date)}, d’un montant de ${argent(Math.abs(doc.montant_ttc))}`
          : ` du ${dateLongue(doc.date)}`,
      )

  const texte = remplacer(message ?? societe.modele_courriel).trim()

  // Un paragraphe par bloc séparé d'une ligne vide, des sauts de ligne
  // simples à l'intérieur — c'est ainsi que le texte a été tapé.
  const paragraphes = texte
    .split(/\n\s*\n/)
    .map((bloc) => `<p style="margin:0 0 14px">${echapper(bloc).replace(/\n/g, '<br>')}</p>`)
    .join('')

  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:16px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#16181d">${paragraphes}</body></html>`

  return { html, texte }
}

export async function envoyerDocument(entree: {
  venteId: string
  destinataire: string
  message: string | null
  utilisateurId: string | null
}): Promise<{ statut: string; erreur: string | null }> {
  const [doc, societe] = await Promise.all([documentComplet(entree.venteId), emetteur()])
  if (!doc) throw new Error('Document introuvable.')

  // Le lien public reste créé : l'écran du document le propose à copier,
  // pour qui préfère l'envoyer par texto.
  await jetonPublic(entree.venteId)
  const objet = `${doc.definition.libelle} ${doc.numero} — ${societe.nom_entreprise}`
  const { html, texte } = corpsCourriel(doc, societe, entree.message)

  const resultat = await envoyerCourriel({
    destinataire: entree.destinataire,
    objet,
    html,
    texte,
    repondreA: societe.courriel_contact,
    pieceJointe: {
      nom: nomFichierPdf(doc),
      contenu: await documentEnPdf(doc, societe),
      type: 'application/pdf',
    },
  })

  await requete(
    `insert into envois_document
       (vente_id, destinataire, objet, message, statut, erreur, reference, envoye_par)
     values ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid)`,
    [
      entree.venteId,
      entree.destinataire,
      objet,
      entree.message,
      resultat.statut,
      resultat.erreur,
      resultat.reference,
      entree.utilisateurId,
    ],
  )

  if (resultat.statut !== 'echec') {
    await requete(
      `update ventes
          set derniere_expedition = now(),
              destinataire_expedition = $2,
              date_envoi = coalesce(date_envoi, current_date),
              statut = case when statut = 'brouillon' then 'envoyee'::statut_vente else statut end
        where id = $1::uuid`,
      [entree.venteId, entree.destinataire],
    )
  }

  return { statut: resultat.statut, erreur: resultat.erreur }
}

export { messagerieConfiguree }
