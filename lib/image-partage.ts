/**
 * L'image d'un palier, dessinée dans le navigateur (canvas) aux couleurs de
 * Tapora : médaille, chiffre, nom du commerce, « merci à nos clients » et
 * taporacards.com. Carré (publication) ou vertical (story).
 *
 * Rien ne part sur un serveur : l'image naît sur le téléphone du commerce,
 * qui la partage ou l'enregistre.
 */
import type { Langue } from '@/lib/langue'

export type Format = 'carre' | 'story'
export type Medaille = { type: 'avis' | 'taps'; valeur: number }

const CREME = '#f7f1e7'
const ENCRE = '#2a211a'
const DOUX = '#6b5d50'
const BRIQUE = '#c2552f'

function polices(): { titre: string; texte: string } {
  const racine = document.querySelector('.theme-client') ?? document.documentElement
  const s = getComputedStyle(racine)
  return {
    titre: s.getPropertyValue('--police-fraunces').trim() || 'Georgia, serif',
    texte: s.getPropertyValue('--police-inter').trim() || 'system-ui, sans-serif',
  }
}

/** Générateur pseudo-aléatoire à graine : la même image à chaque fois. */
function hasard(graine: number) {
  let x = graine || 1
  return () => {
    x = (x * 16807) % 2147483647
    return (x - 1) / 2147483646
  }
}

function texteAjuste(ctx: CanvasRenderingContext2D, texte: string, police: (taille: number) => string, tailleMax: number, largeurMax: number): number {
  let t = tailleMax
  ctx.font = police(t)
  while (ctx.measureText(texte).width > largeurMax && t > 20) {
    t -= 4
    ctx.font = police(t)
  }
  return t
}

function logo(ctx: CanvasRenderingContext2D, x: number, y: number, taille: number) {
  const k = taille / 64
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(k, k)
  ctx.fillStyle = BRIQUE
  ctx.beginPath()
  ctx.roundRect(0, 0, 64, 64, 18)
  ctx.fill()
  ctx.strokeStyle = '#fffaf2'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  // Les trois ondes du logo (mêmes arcs que le SVG : extrémités et rayon).
  for (const [x, haut, r, a] of [
    [25, 22, 14, 1],
    [33, 15, 23, 1],
    [41, 9, 31, 0.55],
  ] as const) {
    const demi = 32 - haut
    const decalage = Math.sqrt(r * r - demi * demi)
    const angle = Math.atan2(demi, decalage)
    ctx.globalAlpha = a
    ctx.beginPath()
    ctx.arc(x - decalage, 32, r, -angle, angle)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = '#fffaf2'
  ctx.beginPath()
  ctx.arc(17.5, 32, 4.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export type Contenu = {
  nom: string
  langue: Langue
  /** Grand chiffre au centre de la médaille. */
  chiffre: string
  /** Sous la médaille : « avis Google », « taps »… */
  libelle: string
  /** Au-dessus : « vient de franchir le cap des » … */
  accroche: string
  merci: string
  etoiles?: boolean
  /** Lignes supplémentaires (bilan de l'année), facultatives. */
  lignes?: { valeur: string; libelle: string }[]
}

export function contenuMedaille(m: Medaille, nom: string, langue: Langue): Contenu {
  const fr = langue === 'fr'
  return {
    nom,
    langue,
    chiffre: new Intl.NumberFormat(fr ? 'fr-CA' : 'en-CA').format(m.valeur),
    libelle: m.type === 'avis' ? (fr ? 'avis Google' : 'Google reviews') : fr ? 'taps sur nos cartes' : 'taps on our cards',
    accroche: fr ? 'vient de franchir le cap des' : 'just reached',
    merci: fr ? 'Merci à tous nos clients ♥' : 'Thank you to all our customers ♥',
    etoiles: m.type === 'avis',
  }
}

export async function dessinerImage(c: Contenu, format: Format): Promise<Blob> {
  const L = 1080
  const H = format === 'story' ? 1920 : 1080
  const canvas = document.createElement('canvas')
  canvas.width = L
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const { titre, texte } = polices()
  const fTitre = (t: number, g = 500) => `${g} ${t}px ${titre}`
  const fTexte = (t: number, g = 500) => `${g} ${t}px ${texte}`
  await Promise.all([document.fonts.load(fTitre(100, 600)), document.fonts.load(fTexte(40, 600))]).catch(() => {})

  // ---- Fond : papier crème, deux halos, confettis semés.
  ctx.fillStyle = CREME
  ctx.fillRect(0, 0, L, H)
  const halo = (x: number, y: number, r: number, couleur: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, couleur)
    g.addColorStop(1, 'rgba(247,241,231,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, L, H)
  }
  halo(L * 0.92, H * 0.08, 520, 'rgba(240,180,143,0.55)')
  halo(L * 0.05, H * 0.95, 560, 'rgba(127,196,184,0.40)')
  const r = hasard(c.chiffre.length * 7919 + c.nom.length * 104729)
  const couleurs = [BRIQUE, '#008a7e', '#eda100', '#f0b48f', '#7fc4b8']
  for (let i = 0; i < 46; i++) {
    const x = r() * L
    const y = r() * H
    // Pas de confettis sur la médaille ni sur les textes centraux.
    if (Math.abs(x - L / 2) < 330 && y > H * 0.18 && y < H * 0.82) continue
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(r() * Math.PI)
    ctx.globalAlpha = 0.75
    ctx.fillStyle = couleurs[i % couleurs.length]
    if (r() < 0.35) {
      ctx.beginPath()
      ctx.arc(0, 0, 6 + r() * 5, 0, Math.PI * 2)
      ctx.fill()
    } else ctx.fillRect(-10, -4, 20 + r() * 10, 8)
    ctx.restore()
  }

  const story = format === 'story'
  // En carré, la place ne permet qu'une ligne de plus ; la story les montre
  // toutes, en remontant la médaille pour leur laisser la place.
  const lignes = story ? (c.lignes ?? []) : (c.lignes ?? []).slice(0, c.etoiles ? 0 : 1)
  const serre = story && lignes.length > 0
  const cy = story ? (serre ? 700 : 860) : 462
  const rayon = story ? (serre ? 225 : 250) : 186
  const ruban = story ? 120 : 92

  // ---- En haut : le nom du commerce et l'accroche.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = ENCRE
  const tNom = texteAjuste(ctx, c.nom, (t) => fTitre(t, 600), story ? 84 : 64, L - 160)
  ctx.font = fTitre(tNom, 600)
  ctx.fillText(c.nom, L / 2, story ? (serre ? 270 : 330) : 118)
  ctx.fillStyle = DOUX
  ctx.font = fTexte(story ? 40 : 32)
  ctx.fillText(c.accroche, L / 2, story ? (serre ? 338 : 400) : 170)

  // ---- Rubans sous la médaille.
  ctx.save()
  for (const [sens, couleur] of [
    [-1, BRIQUE],
    [1, '#008a7e'],
  ] as const) {
    ctx.fillStyle = couleur
    ctx.beginPath()
    const x0 = L / 2 + sens * 40
    ctx.moveTo(x0 - 42, cy + rayon * 0.55)
    ctx.lineTo(x0 + 42, cy + rayon * 0.55)
    ctx.lineTo(x0 + 42 + sens * 40, cy + rayon + ruban)
    ctx.lineTo(x0 + sens * 40, cy + rayon + ruban - 32)
    ctx.lineTo(x0 - 42 + sens * 40, cy + rayon + ruban)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // ---- La médaille : ombre, dégradé, anneau, reflet.
  ctx.save()
  ctx.shadowColor = 'rgba(120,50,20,0.35)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 24
  const g = ctx.createRadialGradient(L / 2 - rayon * 0.35, cy - rayon * 0.4, rayon * 0.1, L / 2, cy, rayon)
  g.addColorStop(0, '#ec8b60')
  g.addColorStop(0.55, BRIQUE)
  g.addColorStop(1, '#9c421c')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(L / 2, cy, rayon, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,250,242,0.45)'
  ctx.lineWidth = 6
  ctx.setLineDash([2, 14])
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(L / 2, cy, rayon - 26, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  const reflet = ctx.createLinearGradient(L / 2 - rayon, cy - rayon, L / 2 + rayon * 0.2, cy)
  reflet.addColorStop(0, 'rgba(255,255,255,0.35)')
  reflet.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = reflet
  ctx.beginPath()
  ctx.ellipse(L / 2 - rayon * 0.25, cy - rayon * 0.35, rayon * 0.62, rayon * 0.4, -0.5, 0, Math.PI * 2)
  ctx.fill()

  // ---- Le chiffre.
  ctx.fillStyle = '#fffaf2'
  const tChiffre = texteAjuste(ctx, c.chiffre, (t) => fTitre(t, 600), story ? 200 : 170, rayon * 1.55)
  ctx.font = fTitre(tChiffre, 600)
  ctx.textBaseline = 'middle'
  ctx.fillText(c.chiffre, L / 2, cy + 6)
  ctx.textBaseline = 'alphabetic'

  // ---- Sous la médaille.
  let y = cy + rayon + (story ? (serre ? 200 : 230) : 162)
  ctx.fillStyle = ENCRE
  ctx.font = fTitre(story ? 76 : 58, 500)
  ctx.fillText(c.libelle, L / 2, y)
  if (c.etoiles) {
    y += story ? 80 : 58
    ctx.fillStyle = '#eda100'
    ctx.font = fTexte(story ? 56 : 40)
    ctx.fillText('★ ★ ★ ★ ★', L / 2, y)
  }
  if (lignes.length) {
    for (const ligne of lignes) {
      y += story ? 96 : 70
      ctx.fillStyle = ENCRE
      ctx.font = fTitre(story ? 56 : 42, 600)
      const v = ligne.valeur + '  '
      const lv = ctx.measureText(v).width
      ctx.font = fTexte(story ? 38 : 30)
      const ll = ctx.measureText(ligne.libelle).width
      const x0 = L / 2 - (lv + ll) / 2
      ctx.textAlign = 'left'
      ctx.font = fTitre(story ? 56 : 42, 600)
      ctx.fillText(v, x0, y)
      ctx.fillStyle = DOUX
      ctx.font = fTexte(story ? 38 : 30)
      ctx.fillText(ligne.libelle, x0 + lv, y)
      ctx.textAlign = 'center'
    }
  }
  ctx.fillStyle = DOUX
  ctx.font = fTexte(story ? 42 : 32)
  ctx.fillText(c.merci, L / 2, story ? H - 300 : H - 118)

  // ---- Signature : logo + taporacards.com.
  ctx.font = fTexte(story ? 38 : 30, 600)
  const site = 'taporacards.com'
  const ls = ctx.measureText(site).width
  const tl = story ? 56 : 44
  const x0 = L / 2 - (tl + 16 + ls) / 2
  const yb = story ? H - 170 : H - 50
  logo(ctx, x0, yb - tl * 0.78, tl)
  ctx.fillStyle = ENCRE
  ctx.textAlign = 'left'
  ctx.fillText(site, x0 + tl + 16, yb)

  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Image impossible'))), 'image/png'))
}
