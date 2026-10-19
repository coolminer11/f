/**
 * Logo Tapora — « le sceau soleil » — et la carte arc-en-ciel.
 *
 *   node marque/generer.mjs
 *
 * Écrit les SVG de marque/ : le texte est converti en tracés (aucune police
 * requise pour les afficher). Les polices de marque/polices/ sont Inter et
 * Fraunces (licence SIL OFL), figées à la graisse du logo.
 */
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const fontkit = createRequire(import.meta.url)('fontkit')
const police = (f) => fontkit.openSync(join(ICI, 'polices', f))
const INTER = police('inter-700.ttf')
const INTER_600 = police('inter-600.ttf')
const FRAUNCES = police('fraunces-620.ttf')

export const C = {
  papier: '#f7f1e7', creme: '#fffaf2', sable: '#ede3d3', encre: '#2a211a',
  brique: '#c2552f', miel: '#e4a53a', rose: '#f2d3c4',
}

const n = (v) => +v.toFixed(2)

export function etoile(cx, cy, R, r) {
  const p = []
  for (let i = 0; i < 10; i++) {
    const a = ((-90 + i * 36) * Math.PI) / 180
    const rr = i % 2 ? r : R
    p.push(`${n(cx + rr * Math.cos(a))},${n(cy + rr * Math.sin(a))}`)
  }
  return p.join(' ')
}
/** Étoile aux pointes arrondies (le trait épais, en joints ronds, adoucit les pointes). */
export const douce = (cx, cy, R, couleur, trait) =>
  `<polygon points="${etoile(cx, cy, R, R * 0.44)}" fill="${couleur}" stroke="${couleur}" stroke-width="${trait}" stroke-linejoin="round"/>`

/** Arc de a1 à a2 (degrés ; 0 = à droite, sens horaire à l'écran). */
export function arc(cx, cy, r, a1, a2) {
  const p = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)].map(n)
  const [x1, y1] = p(a1)
  const [x2, y2] = p(a2)
  return `M${x1} ${y1}A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2} ${y2}`
}
export const arcs = (cx, cy, rayons, couleurs, trait, a1, a2) =>
  `<g fill="none" stroke-width="${trait}" stroke-linecap="round">${rayons
    .map((r, i) => `<path d="${arc(cx, cy, r, a1, a2)}" stroke="${couleurs[i]}"/>`)
    .join('')}</g>`

/** Le soleil : l'étoile douce qui se lève dans l'arc-en-ondes. */
const soleil = () =>
  `${arcs(50, 64, [19.5, 28.5, 37.5], [C.rose, C.miel, C.creme], 6, 180, 360)}${douce(50, 61.5, 9.6, C.creme, 3)}`

/**
 * Texte posé sur un cercle de centre (50, 50) : en haut, il se lit dans le
 * sens horaire, lettres vers l'extérieur ; en bas, de gauche à droite, lettres
 * vers le centre. `longueur` étire l'interlettrage pour remplir l'arc.
 */
function texteCercle({ texte, taille, rayon, haut, couleur, longueur, interlettre = 0, font = INTER }) {
  const k = taille / font.unitsPerEm
  const mise = font.layout(texte)
  const avances = mise.positions.map((p) => p.xAdvance * k)
  const brut = avances.reduce((a, b) => a + b, 0)
  const espace = longueur ? (longueur - brut) / (avances.length - 1) : interlettre
  const total = brut + espace * (avances.length - 1)
  let s = 0
  const traces = []
  mise.glyphs.forEach((g, i) => {
    const centre = s + avances[i] / 2 - total / 2
    s += avances[i] + espace
    const d = g.path.toSVG()
    if (!d) return
    const theta = (haut ? -Math.PI / 2 + centre / rayon : Math.PI / 2 - centre / rayon)
    const x = 50 + rayon * Math.cos(theta)
    const y = 50 + rayon * Math.sin(theta)
    const rot = (theta * 180) / Math.PI + (haut ? 90 : -90)
    traces.push(`<path transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)}) translate(${n(-avances[i] / 2)} 0) scale(${+k.toFixed(6)} ${-k.toFixed(6)})" d="${d}"/>`)
  })
  return { svg: `<g fill="${couleur}">${traces.join('')}</g>`, espace }
}

/** Texte horizontal en tracés ; renvoie aussi sa largeur. */
function texteLigne({ texte, taille, x, y, couleur, font, interlettre = 0, aDroite = false }) {
  const k = taille / font.unitsPerEm
  const mise = font.layout(texte)
  const avances = mise.positions.map((p) => p.xAdvance * k)
  const largeur = avances.reduce((a, b) => a + b, 0) + interlettre * (avances.length - 1)
  let cx = aDroite ? x - largeur : x
  const traces = []
  mise.glyphs.forEach((g, i) => {
    const d = g.path.toSVG()
    if (d) traces.push(`<path transform="translate(${n(cx)} ${n(y)}) scale(${+k.toFixed(6)} ${-k.toFixed(6)})" d="${d}"/>`)
    cx += avances[i] + interlettre
  })
  return { svg: `<g fill="${couleur}">${traces.join('')}</g>`, largeur }
}

export const TEXTES = {
  fr: { haut: 'TAPORA CARDS · UN TAP, UN AVIS', bas: 'QUÉBEC' },
  en: { haut: 'TAPORA CARDS · ONE TAP, ONE REVIEW', bas: 'QUÉBEC' },
}

/** Le sceau complet (viewBox 0 0 100 100). */
export function sceau(langue, centre = soleil()) {
  const t = TEXTES[langue]
  // On garde l'interlettrage lisible : si le texte est long, la taille baisse.
  let taille = 7.4
  let haut = texteCercle({ texte: t.haut, taille, rayon: 34.5, haut: true, couleur: C.creme, longueur: 134 })
  while (haut.espace < 0.7 && taille > 6) {
    taille -= 0.1
    haut = texteCercle({ texte: t.haut, taille, rayon: 34.5, haut: true, couleur: C.creme, longueur: 134 })
  }
  const bas = texteCercle({ texte: t.bas, taille: 7.4, rayon: 40.5, haut: false, couleur: C.creme, interlettre: 1.6 })
  return `<circle cx="50" cy="50" r="49" fill="${C.brique}"/>
<circle cx="50" cy="50" r="44.5" fill="none" stroke="${C.creme}" stroke-width=".9" opacity=".5"/>
${haut.svg}
${bas.svg}
<circle cx="21.3" cy="73.3" r="1.4" fill="${C.miel}"/><circle cx="78.7" cy="73.3" r="1.4" fill="${C.miel}"/>
<g transform="translate(50 52.24) scale(.56) translate(-50 -50)">${centre}</g>`
}

/** L'icône sans texte, pour les petites tailles (onglet, écran d'accueil). */
export const icone = (centre = soleil()) =>
  `<circle cx="50" cy="50" r="49" fill="${C.brique}"/><g transform="translate(50 50) scale(.92) translate(-50 -54)">${centre}</g>`

/** Le logo horizontal : sceau + « Tapora » + « CARDS ». */
export function logo(langue, theme) {
  const sombre = theme === 'sombre'
  const mot = texteLigne({ texte: 'Tapora', taille: 77, x: 120, y: 62, couleur: sombre ? C.creme : C.encre, font: FRAUNCES })
  const droite = 120 + mot.largeur
  const cards = texteLigne({ texte: 'CARDS', taille: 17.7, x: droite, y: 89, couleur: sombre ? C.miel : C.brique, font: INTER_600, interlettre: 7.4, aDroite: true })
  const largeur = Math.ceil(droite + 2)
  return { largeur, corps: `${sceau(langue)}${mot.svg}${cards.svg}` }
}

/** La carte arc-en-ciel : la carte qui « émet » ses ondes rétro. */
export function carte(avecFond = true) {
  const c = `<g transform="rotate(-13 40 62)">
<rect x="20" y="34" width="40" height="56" rx="8.5" fill="${C.brique}"/>
<rect x="27" y="42" width="14" height="3.6" rx="1.8" fill="${C.creme}" opacity=".45"/>
${douce(40, 68, 10.5, C.creme, 3.2)}</g>${arcs(55, 39, [11, 19.5, 28], [C.rose, C.miel, C.brique], 6.2, -92, -2)}`
  return avecFond ? `<rect width="100" height="100" rx="28" fill="${C.sable}"/>${c}` : c
}

const svg = (corps, l = 100, h = 100, titre = 'Tapora Cards') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l} ${h}" role="img" aria-label="${titre}">\n${corps}\n</svg>\n`

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fichiers = {
    'sceau-fr.svg': svg(sceau('fr')),
    'sceau-en.svg': svg(sceau('en')),
    'icone.svg': svg(icone()),
    'carte-arc-en-ciel.svg': svg(carte(), 100, 100, 'Tapora Cards'),
    'carte-arc-en-ciel-sans-fond.svg': svg(carte(false), 100, 100, 'Tapora Cards'),
  }
  for (const langue of ['fr', 'en'])
    for (const theme of ['clair', 'sombre']) {
      const l = logo(langue, theme)
      fichiers[`logo-${langue}-${theme}.svg`] = svg(l.corps, l.largeur, 100)
    }
  for (const [nom, contenu] of Object.entries(fichiers)) writeFileSync(join(ICI, nom), contenu)
  console.log(Object.keys(fichiers).join('\n'))
}
