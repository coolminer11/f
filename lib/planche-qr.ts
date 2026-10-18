import 'server-only'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'

/**
 * Planche de codes QR pour l'imprimeur : 3 × 4 par page Lettre, chaque case
 * avec son QR, le nom de la carte et son code. Les QR portent « ?q » : un scan
 * se distingue d'un tap dans les statistiques.
 */
const COLONNES = 3
const LIGNES = 4
const MARGE = 36
const LARGEUR = 612
const HAUTEUR = 792

/** Les polices standard du PDF ne connaissent que le latin : on retire le reste plutôt que d'afficher du charabia. */
function latin(texte: string): string {
  return texte.normalize('NFC').replace(/[^\x20-\x7e -ÿŒœ’–—]/g, '')
}

export async function plancheQr(
  titre: string,
  cartes: { libelle: string; code: string; urlQr: string }[],
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: MARGE, info: { Title: latin(`Codes QR — ${titre}`), Author: 'Tapora' } })
  const morceaux: Buffer[] = []
  doc.on('data', (m: Buffer) => morceaux.push(m))
  const fin = new Promise<Buffer>((ok) => doc.on('end', () => ok(Buffer.concat(morceaux))))

  const caseL = (LARGEUR - MARGE * 2) / COLONNES
  const caseH = (HAUTEUR - MARGE * 2 - 24) / LIGNES
  const qr = Math.min(caseL, caseH) - 52

  for (let i = 0; i < cartes.length; i++) {
    const position = i % (COLONNES * LIGNES)
    if (position === 0) {
      if (i > 0) doc.addPage()
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111')
        .text(latin(`${titre} — codes QR`), MARGE, MARGE - 14, { width: LARGEUR - MARGE * 2 })
    }
    const c = cartes[i]
    const x = MARGE + (position % COLONNES) * caseL
    const y = MARGE + 10 + Math.floor(position / COLONNES) * caseH
    const image = await QRCode.toBuffer(c.urlQr, { type: 'png', margin: 1, width: 600, errorCorrectionLevel: 'M' })
    // Repères de coupe discrets autour de chaque case.
    doc.lineWidth(0.5).strokeColor('#cccccc').rect(x + 4, y + 4, caseL - 8, caseH - 8).stroke()
    doc.image(image, x + (caseL - qr) / 2, y + 12, { width: qr, height: qr })
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111')
      .text(latin(c.libelle), x + 8, y + 16 + qr, { width: caseL - 16, align: 'center', lineBreak: false, ellipsis: true })
    doc.font('Helvetica').fontSize(8).fillColor('#555555')
      .text(c.code, x + 8, y + 30 + qr, { width: caseL - 16, align: 'center' })
  }
  if (!cartes.length) doc.font('Helvetica').fontSize(12).text('Aucune carte dans ce dossier.')
  doc.end()
  return fin
}
