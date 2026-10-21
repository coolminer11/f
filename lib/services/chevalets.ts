import 'server-only'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'

/**
 * Les chevalets de table de Tapora Services : deux par feuille Lettre. Chaque
 * bande (4,25 × 11 po) se plie en deux en son milieu et tient debout sur la
 * table ; la face du haut est imprimée à l'envers, pour que les deux faces se
 * lisent à l'endroit une fois pliées. On y voit le nom de l'établissement, la
 * table ou la chambre, un grand code QR, le geste (« Touchez ou scannez ») et
 * ce que la page offre.
 *
 * La carte NFC se colle sous le symbole NFC, sur une des faces.
 */
const POUCE = 72
const L = 8.5 * POUCE
const H = 11 * POUCE
const BANDE = L / 2
const PANNEAU = H / 2

/** Les polices standard du PDF ne connaissent que le latin : on retire le reste plutôt que d'afficher du charabia. */
function latin(texte: string): string {
  return texte.normalize('NFC').replace(/[^\x20-\x7e -ÿŒœ’–—]/g, '')
}

function couleur(c: string | null): string {
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c : '#b5472b'
}

export type Chevalet = { libelle: string; urlQr: string }

type Contexte = {
  nom: string
  type: 'restaurant' | 'hotel'
  couleur: string | null
  /** Une deuxième ligne en anglais quand l'établissement offre l'anglais. */
  anglais: boolean
  appel: boolean
  concierge: boolean
}

function offres(c: Contexte): string[] {
  if (c.type === 'hotel') return ['Demandes', c.concierge ? 'Concierge' : 'Menu', 'Wi-Fi']
  return c.appel ? ['Menu', 'Appeler le serveur', 'L’addition'] : ['Menu', 'Plats du jour', 'Avis']
}
function offresEn(c: Contexte): string[] {
  if (c.type === 'hotel') return ['Requests', c.concierge ? 'Concierge' : 'Menu', 'Wi-Fi']
  return c.appel ? ['Menu', 'Call the server', 'The bill'] : ['Menu', 'Specials', 'Reviews']
}

/** Le symbole NFC : un téléphone et trois ondes. */
function symboleNfc(doc: PDFKit.PDFDocument, x: number, y: number, teinte: string) {
  doc.save()
  doc.lineWidth(1.6).strokeColor(teinte).lineCap('round')
  doc.roundedRect(x, y, 13, 21, 2.5).stroke()
  doc.moveTo(x + 4.5, y + 17.5).lineTo(x + 8.5, y + 17.5).stroke()
  for (let i = 0; i < 3; i++) {
    const r = 6 + i * 4.5
    const cx = x + 17
    const cy = y + 10.5
    doc.path(`M ${cx + r * Math.cos(-0.7)} ${cy + r * Math.sin(-0.7)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(0.7)} ${cy + r * Math.sin(0.7)}`).stroke()
  }
  doc.restore()
}

function panneau(doc: PDFKit.PDFDocument, x: number, y: number, c: Contexte, ch: Chevalet, qr: Buffer) {
  const teinte = couleur(c.couleur)
  const marge = 22
  const largeur = BANDE - marge * 2

  // Le bandeau de couleur, et un filet doré.
  doc.save().rect(x, y, BANDE, 10).fill(teinte).restore()
  doc.save().rect(x, y + 10, BANDE, 1.2).fill('#e4a53a').restore()

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#16181d')
    .text(latin(c.nom), x + marge, y + 30, { width: largeur, align: 'center', lineBreak: false, ellipsis: true })
  doc.font('Helvetica-Bold').fontSize(9).fillColor(teinte)
    .text(latin(ch.libelle).toUpperCase(), x + marge, y + 54, { width: largeur, align: 'center', characterSpacing: 1.6, lineBreak: false, ellipsis: true })

  // Le code QR, dans un cadre arrondi.
  const cote = 168
  const qx = x + (BANDE - cote) / 2
  const qy = y + 78
  doc.save().lineWidth(1).strokeColor('#e4e0d8').roundedRect(qx - 10, qy - 10, cote + 20, cote + 20, 14).stroke().restore()
  doc.image(qr, qx, qy, { width: cote, height: cote })

  // Le geste.
  const gy = qy + cote + 26
  symboleNfc(doc, x + marge + 14, gy - 2, teinte)
  doc.font('Helvetica-Bold').fontSize(12.5).fillColor('#16181d')
    .text('Touchez ici ou scannez', x + marge + 50, gy, { width: largeur - 54, lineBreak: false })
  doc.font('Helvetica').fontSize(9.5).fillColor('#5b6472')
    .text(c.anglais ? 'Tap your phone here or scan the code' : 'avec l’appareil photo de votre téléphone', x + marge + 50, gy + 15, { width: largeur - 54, lineBreak: false, ellipsis: true })

  // Ce que la page offre, en pastilles.
  const py = gy + 46
  const mots = offres(c)
  doc.font('Helvetica-Bold').fontSize(8.5)
  const largeurs = mots.map((m) => doc.widthOfString(latin(m)) + 18)
  const total = largeurs.reduce((a, b) => a + b, 0) + 6 * (mots.length - 1)
  let px = x + (BANDE - total) / 2
  mots.forEach((m, i) => {
    doc.save().roundedRect(px, py, largeurs[i], 18, 9).fill('#f4f0e8').restore()
    doc.fillColor('#16181d').text(latin(m), px, py + 5, { width: largeurs[i], align: 'center', lineBreak: false })
    px += largeurs[i] + 6
  })
  if (c.anglais) {
    doc.font('Helvetica').fontSize(7.5).fillColor('#8a8f98')
      .text(offresEn(c).join(' · '), x + marge, py + 24, { width: largeur, align: 'center', lineBreak: false })
  }

  doc.font('Helvetica').fontSize(7).fillColor('#a0a4ab')
    .text('Propulsé par Tapora', x + marge, y + PANNEAU - 22, { width: largeur, align: 'center', characterSpacing: 0.6, lineBreak: false })
}

export async function chevaletsPdf(c: Contexte, chevalets: Chevalet[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0, info: { Title: latin(`Chevalets — ${c.nom}`), Author: 'Tapora' } })
  const morceaux: Buffer[] = []
  doc.on('data', (m: Buffer) => morceaux.push(m))
  const fin = new Promise<Buffer>((ok) => doc.on('end', () => ok(Buffer.concat(morceaux))))

  for (let i = 0; i < chevalets.length; i++) {
    const colonne = i % 2
    if (colonne === 0 && i > 0) doc.addPage()
    const ch = chevalets[i]
    const qr = await QRCode.toBuffer(ch.urlQr, { type: 'png', margin: 1, width: 700, errorCorrectionLevel: 'Q', color: { dark: '#16181dff', light: '#ffffffff' } })
    const x = colonne * BANDE
    // Face avant : la moitié du bas, à l'endroit.
    panneau(doc, x, PANNEAU, c, ch, qr)
    // Face arrière : la moitié du haut, tournée d'un demi-tour.
    doc.save()
    doc.rotate(180, { origin: [x + BANDE / 2, PANNEAU / 2] })
    panneau(doc, x, 0, c, ch, qr)
    doc.restore()
    // Pliure (pointillé) et coupe entre les deux bandes.
    doc.save().lineWidth(0.6).strokeColor('#c9c4ba').dash(4, { space: 4 }).moveTo(x + 8, PANNEAU).lineTo(x + BANDE - 8, PANNEAU).stroke().restore()
    doc.font('Helvetica').fontSize(6).fillColor('#b0aaa0').text('pli', x + BANDE - 22, PANNEAU + 3, { lineBreak: false })
    if (colonne === 1) doc.save().lineWidth(0.5).strokeColor('#dedad2').dash(2, { space: 5 }).moveTo(BANDE, 6).lineTo(BANDE, H - 6).stroke().restore()
  }
  if (!chevalets.length) doc.font('Helvetica').fontSize(12).text('Aucun emplacement à imprimer.', 72, 72)
  doc.end()
  return fin
}
