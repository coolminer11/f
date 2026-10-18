// Construit le site statique dans dist/ — prêt pour Cloudflare Pages.
//
//   npm run build      → dist/
//   npm run apercu     → dist/ servi sur http://localhost:4321
//   npm run deployer   → envoi sur Cloudflare Pages (projet « taporacards »)
//
// Tout est servi depuis le domaine lui-même : polices, scripts, styles.
// Aucun CDN, aucun traceur — d'où une politique de sécurité (_headers) qui
// n'autorise que 'self'.
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ICI = import.meta.dirname
const SRC = path.join(ICI, 'src')
const DIST = path.join(ICI, 'dist')

await rm(DIST, { recursive: true, force: true })
await mkdir(path.join(DIST, 'js'), { recursive: true })
await mkdir(path.join(DIST, 'fonts'), { recursive: true })

await cp(path.join(ICI, 'public'), DIST, { recursive: true })
await cp(path.join(ICI, 'node_modules/gsap/dist/gsap.min.js'), path.join(DIST, 'js/gsap.min.js'))
await cp(path.join(ICI, 'node_modules/gsap/dist/ScrollTrigger.min.js'), path.join(DIST, 'js/ScrollTrigger.min.js'))
await cp(
  path.join(ICI, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'),
  path.join(DIST, 'fonts/inter.woff2'),
)
for (const style of ['normal', 'italic']) {
  await cp(
    path.join(ICI, `node_modules/@fontsource-variable/fraunces/files/fraunces-latin-soft-${style}.woff2`),
    path.join(DIST, `fonts/fraunces-${style}.woff2`),
  )
}
await cp(path.join(SRC, 'main.js'), path.join(DIST, 'js/main.js'))

execFileSync(
  path.join(ICI, 'node_modules/.bin/tailwindcss'),
  ['-i', path.join(SRC, 'styles.css'), '-o', path.join(DIST, 'styles.css'), '--minify'],
  { stdio: 'inherit', cwd: ICI },
)

// Empreinte des fichiers dans les adresses : on peut les mettre en cache un
// an, et une mise à jour est vue immédiatement.
const empreinte = async (f) => createHash('sha256').update(await readFile(path.join(DIST, f))).digest('hex').slice(0, 10)
const versions = {
  '/styles.css': `/styles.css?v=${await empreinte('styles.css')}`,
  '/js/main.js': `/js/main.js?v=${await empreinte('js/main.js')}`,
}

for (const f of await readdir(SRC)) {
  if (!f.endsWith('.html')) continue
  let html = await readFile(path.join(SRC, f), 'utf8')
  for (const [de, vers] of Object.entries(versions)) html = html.replaceAll(`"${de}"`, `"${vers}"`)
  await writeFile(path.join(DIST, f), html)
}
console.log('Site construit dans', DIST)
