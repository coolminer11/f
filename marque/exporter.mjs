/**
 * Les images du logo, à partir des SVG de generer.mjs :
 *
 *   node marque/generer.mjs && node marque/exporter.mjs
 *
 * PNG de marque/png/ (fond transparent), icônes du site et de la page client.
 * Chromium : celui de Playwright, ou le chemin donné par CHROMIUM.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { C, icone, logo, sceau, carte } from './generer.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = join(ICI, '..')
mkdirSync(join(ICI, 'png'), { recursive: true })

const svg = (corps, l = 100, h = 100) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l} ${h}" width="100%" height="100%">${corps}</svg>`
/** Une icône d'app : fond papier plein, le sceau sans texte au centre. */
const app = (part) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="${C.papier}"/><g transform="translate(50 50) scale(${part}) translate(-50 -50)">${icone()}</g></svg>`

const images = [
  ['marque/png/sceau-fr.png', svg(sceau('fr')), 1024, 1024],
  ['marque/png/sceau-en.png', svg(sceau('en')), 1024, 1024],
  ['marque/png/icone.png', svg(icone()), 1024, 1024],
  ['marque/png/carte-arc-en-ciel.png', svg(carte()), 1024, 1024],
  ['site/public/logo.png', svg(sceau('fr')), 512, 512],
  ['site/public/logo-en.png', svg(sceau('en')), 512, 512],
  ['site/public/apple-touch-icon.png', app(0.84), 180, 180],
  ['public/icones/apple-touch-icon.png', app(0.84), 180, 180],
  ['public/icones/icone-192.png', svg(icone()), 192, 192],
  ['public/icones/icone-512.png', svg(icone()), 512, 512],
  ['public/icones/icone-masquable-512.png', app(0.7), 512, 512],
]
for (const langue of ['fr', 'en'])
  for (const theme of ['clair', 'sombre']) {
    const l = logo(langue, theme)
    images.push([`marque/png/logo-${langue}-${theme}.png`, svg(l.corps, l.largeur, 100), Math.round((l.largeur / 100) * 400), 400])
  }

const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
for (const [fichier, contenu, l, h] of images) {
  const p = await nav.newPage({ viewport: { width: l, height: h } })
  await p.setContent(`<html><body style="margin:0;background:transparent">${contenu}</body></html>`)
  writeFileSync(join(RACINE, fichier), await p.screenshot({ omitBackground: true }))
  await p.close()
  console.log(fichier)
}
await nav.close()

// Les SVG servis tels quels par le site.
writeFileSync(join(RACINE, 'site/public/favicon.svg'), readFileSync(join(ICI, 'icone.svg')))
mkdirSync(join(RACINE, 'site/public/marque'), { recursive: true })
for (const f of ['sceau-fr.svg', 'sceau-en.svg', 'carte-arc-en-ciel-sans-fond.svg'])
  writeFileSync(join(RACINE, 'site/public/marque', f), readFileSync(join(ICI, f)))
