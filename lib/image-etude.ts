/**
 * L'image « étude de cas », dessinée dans le navigateur (canvas), au format
 * portrait de LinkedIn (1080 × 1350) : le commerce, les avis gagnés depuis
 * la pose, et les chiffres qui le prouvent. Aux couleurs de Tapora, comme
 * l'image des paliers (lib/image-partage.ts).
 */
import { hasard, logo, polices, texteAjuste } from '@/lib/image-partage'
import type { Langue } from '@/lib/langue'

export type ChiffresEtude = {
  nom: string
  jours: number
  avisPose: number
  avisMaintenant: number
  note: number | null
  taps: number
  avantParMois: number | null
  apresParMois: number
}

const CREME = '#f7f1e7'
const PAPIER = '#fffaf2'
const ENCRE = '#2a211a'
const DOUX = '#6b5d50'
const BRIQUE = '#c2552f'
const MIEL = '#e4a53a'
const LIGNE = '#eadfcd'

function arrondi(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, l, h, r)
}

export async function dessinerEtude(c: ChiffresEtude, langue: Langue): Promise<Blob> {
  const fr = langue === 'fr'
  const nf = new Intl.NumberFormat(fr ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 1 })
  const L = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = L
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const { titre, texte } = polices()
  const fTitre = (t: number, g = 500) => `${g} ${t}px ${titre}`
  const fTexte = (t: number, g = 500) => `${g} ${t}px ${texte}`
  await Promise.all([document.fonts.load(fTitre(100, 600)), document.fonts.load(fTexte(40, 600)), document.fonts.load(fTexte(40, 700))]).catch(() => {})

  const gagnes = c.avisMaintenant - c.avisPose
  const duree = c.jours === 1 ? (fr ? '1 jour' : '1 day') : fr ? `${nf.format(c.jours)} jours` : `${nf.format(c.jours)} days`

  // ---- Fond : papier, halos, fines ondes qui partent du grand chiffre.
  ctx.fillStyle = CREME
  ctx.fillRect(0, 0, L, H)
  const halo = (x: number, y: number, r: number, couleur: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, couleur)
    g.addColorStop(1, 'rgba(247,241,231,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, L, H)
  }
  halo(L * 0.9, 120, 560, 'rgba(240,180,143,0.55)')
  halo(80, H - 160, 600, 'rgba(244,201,120,0.35)')
  ctx.save()
  ctx.strokeStyle = BRIQUE
  ctx.lineWidth = 2
  for (let i = 0; i < 9; i++) {
    ctx.globalAlpha = 0.16 * (1 - i / 9)
    ctx.beginPath()
    ctx.arc(L / 2, 470, 210 + i * 64, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
  const r = hasard(c.nom.length * 7919 + c.avisMaintenant)
  for (let i = 0; i < 6; i++) {
    const x = 90 + r() * (L - 180)
    const y = 260 + r() * 420
    if (Math.abs(x - L / 2) < 300) continue
    const t = 10 + r() * 14
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = i % 2 ? MIEL : BRIQUE
    ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.moveTo(0, -t)
    ctx.bezierCurveTo(t * 0.1, -t * 0.24, t * 0.24, -t * 0.1, t, 0)
    ctx.bezierCurveTo(t * 0.24, t * 0.1, t * 0.1, t * 0.24, 0, t)
    ctx.bezierCurveTo(-t * 0.1, t * 0.24, -t * 0.24, t * 0.1, -t, 0)
    ctx.bezierCurveTo(-t * 0.24, -t * 0.1, -t * 0.1, -t * 0.24, 0, -t)
    ctx.fill()
    ctx.restore()
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // ---- Pastille « Étude de cas ».
  const etiquette = fr ? 'ÉTUDE DE CAS' : 'CASE STUDY'
  ctx.font = fTexte(24, 700)
  const le = ctx.measureText(etiquette).width + 70
  ctx.fillStyle = 'rgba(255,250,242,0.85)'
  arrondi(ctx, L / 2 - le / 2, 78, le, 54, 27)
  ctx.fill()
  ctx.strokeStyle = LIGNE
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = BRIQUE
  ctx.fillText(etiquette.split('').join(String.fromCharCode(8202)), L / 2, 114)

  // ---- Le commerce.
  ctx.fillStyle = ENCRE
  const tNom = texteAjuste(ctx, c.nom, (t) => fTitre(t, 600), 76, L - 160)
  ctx.font = fTitre(tNom, 600)
  ctx.fillText(c.nom, L / 2, 228)

  // ---- Le grand chiffre.
  const grand = gagnes > 0 ? `+${nf.format(gagnes)}` : nf.format(c.avisMaintenant)
  ctx.save()
  ctx.shadowColor = 'rgba(160,60,20,0.25)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 16
  const gr = ctx.createLinearGradient(0, 330, 0, 560)
  gr.addColorStop(0, '#d66b41')
  gr.addColorStop(1, '#a9411b')
  ctx.fillStyle = gr
  const tGrand = texteAjuste(ctx, grand, (t) => fTitre(t, 600), 270, L - 200)
  ctx.font = fTitre(tGrand, 600)
  ctx.fillText(grand, L / 2, 540)
  ctx.restore()

  ctx.fillStyle = ENCRE
  ctx.font = fTitre(54, 500)
  ctx.fillText(gagnes > 0 ? (fr ? `avis Google en ${duree}` : `Google reviews in ${duree}`) : fr ? 'avis Google' : 'Google reviews', L / 2, 628)
  ctx.fillStyle = MIEL
  ctx.font = fTexte(40)
  ctx.fillText('★ ★ ★ ★ ★', L / 2, 690)

  // ---- Trois tuiles de chiffres.
  const tuiles: [string, string][] = [
    [`${nf.format(c.avisPose)} → ${nf.format(c.avisMaintenant)}`, fr ? 'avis Google' : 'Google reviews'],
    c.note !== null ? [`★ ${c.note.toFixed(1).replace('.', fr ? ',' : '.')}`, fr ? 'note Google' : 'Google rating'] : [nf.format(c.jours), fr ? 'jours depuis la pose' : 'days since install'],
    [nf.format(c.taps), fr ? 'taps sur la carte' : 'taps on the card'],
  ]
  const lt = 296
  const ecart = 24
  const x0 = (L - (3 * lt + 2 * ecart)) / 2
  tuiles.forEach(([valeur, libelle], i) => {
    const x = x0 + i * (lt + ecart)
    ctx.save()
    ctx.shadowColor = 'rgba(60,40,20,0.16)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetY = 14
    ctx.fillStyle = PAPIER
    arrondi(ctx, x, 750, lt, 168, 30)
    ctx.fill()
    ctx.restore()
    ctx.strokeStyle = LIGNE
    ctx.lineWidth = 2
    arrondi(ctx, x, 750, lt, 168, 30)
    ctx.stroke()
    ctx.fillStyle = ENCRE
    const tv = texteAjuste(ctx, valeur, (t) => fTitre(t, 600), 52, lt - 40)
    ctx.font = fTitre(tv, 600)
    ctx.fillText(valeur, x + lt / 2, 834)
    ctx.fillStyle = DOUX
    ctx.font = fTexte(25)
    ctx.fillText(libelle, x + lt / 2, 880)
  })

  // ---- Avant / avec Tapora : deux barres, si on connaît le rythme d'avant.
  const y = 990
  if (c.avantParMois !== null && c.apresParMois > 0) {
    const max = Math.max(c.avantParMois, c.apresParMois)
    const lb = 560
    const xb = 340
    const barre = (label: string, valeur: number, couleur: string, yy: number) => {
      ctx.textAlign = 'right'
      ctx.fillStyle = DOUX
      ctx.font = fTexte(28, 600)
      ctx.fillText(label, xb - 26, yy + 30)
      ctx.fillStyle = 'rgba(234,223,205,0.8)'
      arrondi(ctx, xb, yy, lb, 42, 21)
      ctx.fill()
      ctx.fillStyle = couleur
      arrondi(ctx, xb, yy, Math.max(42, (valeur / max) * lb), 42, 21)
      ctx.fill()
      const fin = xb + Math.max(42, (valeur / max) * lb)
      const txt = `${nf.format(valeur)} ${fr ? '/ mois' : '/ month'}`
      ctx.font = fTexte(26, 700)
      const dedans = fin + 16 + ctx.measureText(txt).width > L - 60
      ctx.textAlign = dedans ? 'right' : 'left'
      ctx.fillStyle = dedans ? PAPIER : ENCRE
      ctx.fillText(txt, dedans ? fin - 18 : fin + 16, yy + 30)
    }
    barre(fr ? 'Avant Tapora' : 'Before Tapora', c.avantParMois, '#cdbfb7', y)
    barre(fr ? 'Avec Tapora' : 'With Tapora', c.apresParMois, BRIQUE, y + 66)
    ctx.textAlign = 'center'
    const fois = c.apresParMois / c.avantParMois
    if (fois >= 1.2) {
      ctx.fillStyle = ENCRE
      ctx.font = fTitre(40, 600)
      ctx.fillText(fr ? `${nf.format(fois)} × plus d’avis par mois` : `${nf.format(fois)}× more reviews per month`, L / 2, y + 190)
    }
  } else {
    ctx.fillStyle = DOUX
    ctx.font = fTexte(32)
    ctx.fillText(fr ? 'Une carte sur le comptoir. Un tap avec le téléphone.' : 'One card on the counter. One tap with a phone.', L / 2, 1010)
    ctx.fillText(fr ? 'Aucune application, aucun abonnement.' : 'No app, no subscription.', L / 2, 1056)
  }

  // ---- Signature : logo + taporacards.com.
  ctx.textAlign = 'left'
  ctx.font = fTexte(32, 600)
  const site = 'taporacards.com'
  const ls = ctx.measureText(site).width
  const tl = 50
  const xs = L / 2 - (tl + 16 + ls) / 2
  const yb = H - 64
  logo(ctx, xs, yb - tl * 0.78, tl)
  ctx.fillStyle = ENCRE
  ctx.fillText(site, xs + tl + 16, yb)

  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Image impossible'))), 'image/png'))
}
