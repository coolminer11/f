import 'server-only'
import { randomBytes } from 'node:crypto'
import { requete, requeteUne } from '@/lib/db'
import { documentComplet, emetteur, type VenteComplete } from '@/lib/requetes/ventes'
import { echapper, envoyerCourriel, messagerieConfiguree } from '@/lib/courriel'
import { argent, dateLongue, taux } from '@/lib/format'

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

function corpsCourriel(
  doc: VenteComplete,
  societe: Awaited<ReturnType<typeof emetteur>>,
  lien: string,
  message: string | null,
): { html: string; texte: string } {
  const ligneStyle = 'padding:6px 0;border-bottom:1px solid #e4e7ec;font-size:14px;color:#16181d'
  const doux = 'color:#5b6472'

  const lignes = doc.lignes
    .map(
      (l) => `<tr>
        <td style="${ligneStyle}">${echapper(l.description)}</td>
        <td style="${ligneStyle};text-align:right">${l.quantite}</td>
        ${
          doc.definition.affiche_prix
            ? `<td style="${ligneStyle};text-align:right">${argent(Number(l.montant_ht) * doc.definition.signe)}</td>`
            : ''
        }
      </tr>`,
    )
    .join('')

  const taxes = doc.taxes
    .map(
      (t) => `<tr>
        <td style="${ligneStyle};border:0;${doux}">${t.code} ${taux(t.taux)}</td>
        <td style="${ligneStyle};border:0;text-align:right">${argent(t.montant)}</td>
      </tr>`,
    )
    .join('')

  const aPayer =
    doc.definition.attend_paiement && doc.solde > 0
      ? `<p style="margin:20px 0;padding:12px 16px;border:1px solid #16181d;border-radius:6px;font-size:15px;font-weight:600">
           Montant à payer : ${argent(doc.solde)}
           ${doc.date_echeance ? ` — au plus tard le ${dateLongue(doc.date_echeance)}` : ''}
         </p>`
      : ''

  // HTML volontairement simple : tables et styles en ligne, parce que les
  // clients de messagerie ne comprennent ni les variables CSS ni la grille.
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f7f8fa;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e7ec;border-radius:12px;padding:28px">
    <p style="margin:0;font-size:13px;${doux}">${echapper(societe.nom_entreprise)}</p>
    <h1 style="margin:6px 0 0;font-size:20px;color:#16181d">${doc.definition.libelle} ${doc.numero}</h1>
    <p style="margin:4px 0 0;font-size:14px;${doux}">${dateLongue(doc.date)}</p>

    ${message ? `<p style="margin:20px 0;font-size:14px;line-height:1.6;color:#16181d;white-space:pre-line">${echapper(message)}</p>` : ''}

    <table style="width:100%;border-collapse:collapse;margin-top:20px">
      <tr>
        <th style="text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;${doux};padding-bottom:6px">Description</th>
        <th style="text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.04em;${doux};padding-bottom:6px">Qté</th>
        ${doc.definition.affiche_prix ? `<th style="text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.04em;${doux};padding-bottom:6px">Montant</th>` : ''}
      </tr>
      ${lignes}
    </table>

    ${
      doc.definition.affiche_prix
        ? `<table style="width:100%;border-collapse:collapse;margin-top:16px">
             <tr><td style="${ligneStyle};border:0;${doux}">Total hors taxes</td>
                 <td style="${ligneStyle};border:0;text-align:right">${argent(doc.montant_ht)}</td></tr>
             ${taxes}
             <tr><td style="padding:8px 0 0;font-size:16px;font-weight:700;border-top:2px solid #16181d">Total</td>
                 <td style="padding:8px 0 0;font-size:16px;font-weight:700;text-align:right;border-top:2px solid #16181d">${argent(doc.montant_ttc)}</td></tr>
           </table>`
        : ''
    }

    ${aPayer}

    <p style="margin:24px 0 0">
      <a href="${lien}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600">
        Voir le document
      </a>
    </p>
    <p style="margin:12px 0 0;font-size:12px;${doux}">
      Le lien ouvre ${doc.definition.libelle.toLowerCase()} ${doc.numero} et permet de l’imprimer ou de l’enregistrer en PDF.
    </p>

    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e4e7ec;font-size:12px;${doux}">
      ${echapper(societe.nom_entreprise)}${societe.telephone ? ` · ${echapper(societe.telephone)}` : ''}${societe.courriel_contact ? ` · ${echapper(societe.courriel_contact)}` : ''}
    </p>
  </div>
</body></html>`

  const texte = [
    `${doc.definition.libelle} ${doc.numero} — ${societe.nom_entreprise}`,
    dateLongue(doc.date),
    message ?? '',
    doc.definition.affiche_prix ? `Total : ${argent(doc.montant_ttc)}` : '',
    doc.definition.attend_paiement && doc.solde > 0 ? `Montant à payer : ${argent(doc.solde)}` : '',
    '',
    `Voir le document : ${lien}`,
  ]
    .filter(Boolean)
    .join('\n')

  return { html, texte }
}

export async function envoyerDocument(entree: {
  venteId: string
  destinataire: string
  message: string | null
  utilisateurId: string
  origine: string
}): Promise<{ statut: string; erreur: string | null }> {
  const [doc, societe] = await Promise.all([documentComplet(entree.venteId), emetteur()])
  if (!doc) throw new Error('Document introuvable.')

  const jeton = await jetonPublic(entree.venteId)
  const lien = `${entree.origine.replace(/\/$/, '')}/documents/${jeton}`
  const objet = `${doc.definition.libelle} ${doc.numero} — ${societe.nom_entreprise}`
  const { html, texte } = corpsCourriel(doc, societe, lien, entree.message)

  const resultat = await envoyerCourriel({
    destinataire: entree.destinataire,
    objet,
    html,
    texte,
    repondreA: societe.courriel_contact,
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
