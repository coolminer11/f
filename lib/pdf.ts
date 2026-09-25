import 'server-only'
import PDFDocument from 'pdfkit'
import type { Emetteur, VenteComplete } from '@/lib/requetes/ventes'

/**
 * Le document en PDF, dessiné plutôt que photographié.
 *
 * Pourquoi pas un navigateur sans tête qui imprimerait la page HTML : il
 * faudrait embarquer Chromium, soit 300 Mo et autant de mémoire vive. Le
 * forfait gratuit de l'hébergeur en offre 512 en tout. Le PDF se dessine donc
 * directement, à partir des mêmes données que la page imprimable.
 *
 * Les montants ne passent pas par `Intl` : en français, il insère des espaces
 * fines insécables (U+202F) que l'encodage WinAnsi des polices standard ne
 * connaît pas, et le PDF afficherait des caractères de remplacement là où le
 * client attend un prix.
 */

const MARGE = 43 // 0,6 pouce, comme la page imprimable
const LARGEUR = 612 - MARGE * 2
const GRIS = '#555555'
const ENCRE = '#111111'
const TRAIT = '#cccccc'

function argent(valeur: number | string): string {
  const n = Number(valeur)
  const signe = n < 0 ? '−' : ''
  const [entier, decimales] = Math.abs(n).toFixed(2).split('.')
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${signe}${groupe},${decimales} $`
}

function nombre(valeur: number | string): string {
  const n = Number(valeur)
  return (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')).replace(
    /\B(?=(\d{3})+(?!\d),?)/g,
    ' ',
  )
}

function taux(valeur: number | string): string {
  return `${String(Number(valeur)).replace('.', ',')} %`
}

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

function dateLongue(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number)
  return `${j} ${MOIS[m - 1]} ${a}`
}

export async function documentEnPdf(
  doc: VenteComplete,
  societe: Emetteur,
): Promise<Buffer> {
  const { definition, regime } = doc
  const affichePrix = definition.affiche_prix
  const estCredit = definition.signe === -1
  const aDesRemises = doc.lignes.some((l) => Number(l.remise_ht) > 0)
  const sousTotal =
    doc.lignes.reduce((s, l) => s + Number(l.montant_ht), 0) * definition.signe
  // Au Québec, un document de 30 $ ou plus doit porter les numéros
  // d'inscription : sans eux, le client ne peut pas réclamer ses crédits.
  const mentionsObligatoires = Math.abs(doc.montant_ttc) >= 30 && affichePrix

  const pdf = new PDFDocument({
    size: 'LETTER',
    margin: MARGE,
    info: {
      Title: `${definition.libelle} ${doc.numero}`,
      Author: societe.nom_entreprise,
      Subject: doc.client ?? doc.client_nom ?? undefined,
    },
  })

  const morceaux: Buffer[] = []
  pdf.on('data', (m: Buffer) => morceaux.push(m))
  const termine = new Promise<Buffer>((resolve) => {
    pdf.on('end', () => resolve(Buffer.concat(morceaux)))
  })

  const gras = (taille: number, couleur = ENCRE) =>
    pdf.font('Helvetica-Bold').fontSize(taille).fillColor(couleur)
  const normal = (taille: number, couleur = ENCRE) =>
    pdf.font('Helvetica').fontSize(taille).fillColor(couleur)

  // --- En-tête -------------------------------------------------------------
  const hautEntete = pdf.y
  gras(16).text(societe.nom_entreprise, MARGE, hautEntete, { width: 300 })
  normal(9, GRIS)
  for (const ligne of [
    societe.adresse,
    [societe.ville, societe.code_postal].filter(Boolean).join(' ') || null,
    societe.telephone,
    societe.courriel_contact,
    societe.site_web,
  ]) {
    if (ligne) pdf.text(ligne, MARGE, pdf.y, { width: 300 })
  }
  const basGauche = pdf.y

  const droite = { x: MARGE + LARGEUR - 240, width: 240, align: 'right' as const }
  gras(17).text(definition.libelle.toUpperCase(), droite.x, hautEntete, droite)
  gras(12).text(doc.numero, droite.x, pdf.y + 2, droite)
  pdf.moveDown(0.4)
  normal(9, GRIS)
  const entete = (libelle: string, valeur: string) => {
    pdf.text(`${libelle} : ${valeur}`, droite.x, pdf.y, droite)
  }
  entete('Date', dateLongue(doc.date))
  if (
    doc.date_echeance &&
    affichePrix &&
    (definition.attend_paiement || !definition.comptabilise_revenu)
  ) {
    entete(definition.attend_paiement ? 'Échéance' : 'Valide jusqu’au', dateLongue(doc.date_echeance))
  }
  if (doc.numero_origine) {
    entete(estCredit ? 'Facture créditée' : 'Référence', doc.numero_origine)
  }
  if (doc.bon_de_commande) entete('Bon de commande', doc.bon_de_commande)

  let y = Math.max(basGauche, pdf.y) + 10
  pdf.moveTo(MARGE, y).lineTo(MARGE + LARGEUR, y).lineWidth(1.5).strokeColor(ENCRE).stroke()
  y += 16

  // --- Client et numéros d'inscription -------------------------------------
  gras(8, GRIS).text(
    affichePrix ? (estCredit ? 'CRÉDITÉ À' : 'FACTURÉ À') : 'LIVRÉ À',
    MARGE,
    y,
    { width: 260, characterSpacing: 0.6 },
  )
  gras(10, ENCRE).text(doc.client ?? doc.client_nom ?? '—', MARGE, pdf.y + 2, { width: 260 })
  normal(9, GRIS)
  if (doc.adresse_facturation) {
    for (const l of doc.adresse_facturation.split('\n')) pdf.text(l, MARGE, pdf.y, { width: 260 })
  }
  if (doc.courriel_facturation) pdf.text(doc.courriel_facturation, MARGE, pdf.y, { width: 260 })
  if (doc.transporteur || doc.numero_suivi) {
    pdf.moveDown(0.3)
    gras(8, GRIS).text('EXPÉDITION', MARGE, pdf.y, { width: 260, characterSpacing: 0.6 })
    normal(9, GRIS)
    if (doc.transporteur) pdf.text(doc.transporteur, MARGE, pdf.y, { width: 260 })
    if (doc.numero_suivi) pdf.text(`Suivi : ${doc.numero_suivi}`, MARGE, pdf.y, { width: 260 })
  }
  const basClient = pdf.y

  if (mentionsObligatoires && (societe.numero_tps || societe.numero_tvq)) {
    gras(8, GRIS).text('NUMÉROS D’INSCRIPTION', droite.x, y, { ...droite, characterSpacing: 0.6 })
    normal(9, GRIS)
    if (societe.numero_tps) pdf.text(`TPS / TVH : ${societe.numero_tps}`, droite.x, pdf.y + 2, droite)
    if (societe.numero_tvq) pdf.text(`TVQ : ${societe.numero_tvq}`, droite.x, pdf.y, droite)
    if (societe.neq) pdf.text(`NEQ : ${societe.neq}`, droite.x, pdf.y, droite)
  }

  y = Math.max(basClient, pdf.y) + 22

  // --- Tableau des lignes --------------------------------------------------
  const colonnes = affichePrix
    ? aDesRemises
      ? [206, 44, 84, 74, 118]
      : [258, 50, 100, 118]
    : [LARGEUR - 60, 60]
  const xDe = (i: number) => MARGE + colonnes.slice(0, i).reduce((s, c) => s + c, 0)

  const enTetes = affichePrix
    ? aDesRemises
      ? ['Description', 'Qté', `Prix unitaire${doc.prix_avec_taxes ? ' (tx incl.)' : ''}`, 'Remise', 'Montant']
      : ['Description', 'Qté', `Prix unitaire${doc.prix_avec_taxes ? ' (tx incl.)' : ''}`, 'Montant']
    : ['Description', 'Qté']

  const dessinerEnTete = () => {
    gras(8, GRIS)
    enTetes.forEach((t, i) => {
      pdf.text(t.toUpperCase(), xDe(i), y, {
        width: colonnes[i],
        align: i === 0 ? 'left' : 'right',
        characterSpacing: 0.6,
      })
    })
    y += 14
    pdf.moveTo(MARGE, y).lineTo(MARGE + LARGEUR, y).lineWidth(1).strokeColor(ENCRE).stroke()
    y += 7
  }
  dessinerEnTete()

  for (const l of doc.lignes) {
    const description =
      regime.applique_taxes && !l.taxable ? `${l.description}  (non taxable)` : l.description
    normal(9.5, ENCRE)
    const hauteur = Math.max(pdf.heightOfString(description, { width: colonnes[0] }), 12)
    if (y + hauteur > 792 - MARGE - 40) {
      pdf.addPage()
      y = MARGE
      dessinerEnTete()
    }
    pdf.text(description, xDe(0), y, { width: colonnes[0] })
    const cellules = affichePrix
      ? aDesRemises
        ? [
            nombre(l.quantite),
            argent(l.prix_unitaire_ht),
            Number(l.remise_ht) > 0 ? `− ${argent(l.remise_ht)}` : '',
            argent(Number(l.montant_ht) * definition.signe),
          ]
        : [
            nombre(l.quantite),
            argent(l.prix_unitaire_ht),
            argent(Number(l.montant_ht) * definition.signe),
          ]
      : [nombre(l.quantite)]
    cellules.forEach((v, i) => {
      pdf.text(v, xDe(i + 1), y, { width: colonnes[i + 1], align: 'right' })
    })
    y += hauteur + 7
    pdf.moveTo(MARGE, y - 3).lineTo(MARGE + LARGEUR, y - 3).lineWidth(0.5).strokeColor(TRAIT).stroke()
  }

  y += 10

  // --- Totaux --------------------------------------------------------------
  if (affichePrix) {
    const largeurTotaux = 230
    const xTotaux = MARGE + LARGEUR - largeurTotaux
    const ligneTotal = (libelle: string, valeur: string, fort = false) => {
      ;(fort ? gras(11) : normal(9.5, GRIS)).text(libelle, xTotaux, y, { width: 120 })
      ;(fort ? gras(11) : normal(9.5, ENCRE)).text(valeur, xTotaux + 120, y, {
        width: largeurTotaux - 120,
        align: 'right',
      })
      y += fort ? 16 : 13
    }

    ligneTotal(doc.prix_avec_taxes ? 'Sous-total (tx incl.)' : 'Sous-total', argent(sousTotal))
    if (doc.remise_globale > 0) ligneTotal('Remise', `− ${argent(doc.remise_globale)}`)
    ligneTotal('Total hors taxes', argent(doc.montant_ht))
    for (const t of doc.taxes) ligneTotal(`${t.code} ${taux(t.taux)}`, argent(t.montant))
    if (!regime.applique_taxes) ligneTotal(regime.libelle, argent(0))

    y += 3
    pdf.moveTo(xTotaux, y).lineTo(MARGE + LARGEUR, y).lineWidth(1.5).strokeColor(ENCRE).stroke()
    y += 6
    ligneTotal(
      estCredit ? 'Total du crédit' : definition.attend_paiement ? 'Total' : 'Total estimé',
      argent(doc.montant_ttc),
      true,
    )

    if (definition.attend_paiement && doc.montant_paye !== 0) {
      ligneTotal('Paiements reçus', `− ${argent(doc.montant_paye)}`)
      y += 3
      pdf.moveTo(xTotaux, y).lineTo(MARGE + LARGEUR, y).lineWidth(1).strokeColor(ENCRE).stroke()
      y += 6
      ligneTotal('Solde dû', argent(doc.solde), true)
    }
    y += 8
  }

  // --- Mentions ------------------------------------------------------------
  const encadre = (texte: string) => {
    normal(10, ENCRE)
    const hauteur = pdf.heightOfString(texte, { width: LARGEUR - 20 }) + 14
    if (y + hauteur > 792 - MARGE) {
      pdf.addPage()
      y = MARGE
    }
    pdf.rect(MARGE, y, LARGEUR, hauteur).lineWidth(1).strokeColor(ENCRE).stroke()
    gras(10).text(texte, MARGE + 10, y + 7, { width: LARGEUR - 20 })
    y += hauteur + 12
  }

  if (!regime.applique_taxes && affichePrix) {
    normal(8.5, ENCRE)
    const texte = [regime.mention_document, doc.motif_exemption].filter(Boolean).join(' ')
    gras(8, ENCRE).text(regime.libelle.toUpperCase(), MARGE, y, { characterSpacing: 0.6 })
    normal(8.5, ENCRE).text(texte, MARGE, pdf.y + 2, { width: LARGEUR })
    if (doc.numero_certificat_exemption) {
      pdf.text(`Certificat d’exemption n° ${doc.numero_certificat_exemption}`, MARGE, pdf.y, {
        width: LARGEUR,
      })
    }
    y = pdf.y + 12
  }

  if (definition.attend_paiement && doc.paiements.length > 0) {
    gras(8, GRIS).text('PAIEMENTS REÇUS', MARGE, y, { characterSpacing: 0.6 })
    normal(9, GRIS)
    for (const p of doc.paiements) {
      const reference = p.note_credit_id
        ? ` (note de crédit ${p.reference ?? ''})`
        : p.reference
          ? ` (${p.reference})`
          : ''
      pdf.text(`${dateLongue(p.date)} — ${argent(p.montant)}${reference}`, MARGE, pdf.y + 1, {
        width: LARGEUR,
      })
    }
    y = pdf.y + 12
  }

  if (definition.attend_paiement && doc.solde > 0) {
    encadre(
      `Montant à payer : ${argent(doc.solde)}` +
        (doc.conditions_paiement ? ` · ${doc.conditions_paiement}` : '') +
        (doc.date_echeance ? ` · au plus tard le ${dateLongue(doc.date_echeance)}` : ''),
    )
  }

  if (estCredit) {
    encadre(
      `Crédit de ${argent(Math.abs(doc.montant_ttc))}` +
        (doc.numero_origine ? ` porté au compte, en regard de la facture ${doc.numero_origine}` : '') +
        '.',
    )
  }

  if (!affichePrix) {
    normal(8.5, GRIS).text(
      'Ce bon de livraison ne tient pas lieu de facture. Aucun prix n’y figure.',
      MARGE,
      y,
      { width: LARGEUR },
    )
    y = pdf.y + 34
    const signatures: [string, number][] = [
      ['Reçu par (nom en lettres moulées)', 200],
      ['Signature', 190],
      ['Date', 110],
    ]
    let x = MARGE
    for (const [libelle, largeur] of signatures) {
      pdf.moveTo(x, y).lineTo(x + largeur, y).lineWidth(0.8).strokeColor(ENCRE).stroke()
      normal(7.5, GRIS).text(libelle.toUpperCase(), x, y + 4, { width: largeur, characterSpacing: 0.5 })
      x += largeur + 8
    }
    y += 26
  }

  if (doc.notes_facture) {
    gras(8, GRIS).text('NOTE', MARGE, y, { characterSpacing: 0.6 })
    normal(9.5, ENCRE).text(doc.notes_facture, MARGE, pdf.y + 2, { width: LARGEUR })
    y = pdf.y + 10
  }

  if (doc.conditions_generales && affichePrix) {
    gras(8, GRIS).text('CONDITIONS', MARGE, y, { characterSpacing: 0.6 })
    normal(8, GRIS).text(doc.conditions_generales, MARGE, pdf.y + 2, { width: LARGEUR })
    y = pdf.y + 10
  }

  // --- Pied de page, sur la dernière page ----------------------------------
  const pied = [
    societe.pied_facture,
    !mentionsObligatoires && affichePrix
      ? [
          societe.numero_tps && `TPS / TVH : ${societe.numero_tps}`,
          societe.numero_tvq && `TVQ : ${societe.numero_tvq}`,
        ]
          .filter(Boolean)
          .join(' · ')
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  if (pied) {
    const hauteur = pdf.heightOfString(pied, { width: LARGEUR }) + 10
    const yPied = Math.max(y + 10, 792 - MARGE - hauteur)
    pdf.moveTo(MARGE, yPied - 8).lineTo(MARGE + LARGEUR, yPied - 8).lineWidth(0.5).strokeColor(TRAIT).stroke()
    normal(8, GRIS).text(pied, MARGE, yPied, { width: LARGEUR, align: 'center' })
  }

  pdf.end()
  return termine
}

/** Nom de fichier proposé au téléchargement. */
export function nomFichierPdf(doc: VenteComplete): string {
  const client = (doc.client ?? doc.client_nom ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return [doc.numero, client].filter(Boolean).join('_') + '.pdf'
}
