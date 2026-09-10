#!/usr/bin/env node
/**
 * Choisit un port au hasard et le retient dans .env.local.
 *
 *   npm run port          → un port libre tiré au hasard
 *   npm run port -- 48210 → ce port-là, s'il est libre
 *
 * Pourquoi : 3000 est le port par défaut de la moitié des outils de
 * développement. Deux programmes qui le veulent en même temps, et c'est le
 * second qui refuse de démarrer sans expliquer pourquoi. Un port tiré au
 * hasard, retenu une fois pour toutes, écarte le problème.
 *
 * On tire dans 20000–59999 : au-dessus des ports réservés, en dessous de la
 * plage éphémère du système (49152+ sur macOS), donc sans risque de tomber sur
 * un port qu'une autre application vient de se voir attribuer.
 */
import { createServer } from 'node:net'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ENV = path.join(path.resolve(import.meta.dirname, '..'), '.env.local')

/** Le port accepte-t-il une écoute ? C'est la seule vraie preuve qu'il est libre. */
function libre(port) {
  return new Promise((resolve) => {
    const serveur = createServer()
    serveur.once('error', () => resolve(false))
    serveur.once('listening', () => serveur.close(() => resolve(true)))
    serveur.listen(port, '0.0.0.0')
  })
}

const demande = process.argv[2]
let port

if (demande) {
  port = Number(demande)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    console.error(`  « ${demande} » n’est pas un port valide (1024 à 65535).`)
    process.exit(1)
  }
  if (!(await libre(port))) {
    console.error(`  Le port ${port} est déjà pris par un autre programme.`)
    process.exit(1)
  }
} else {
  for (let essai = 0; essai < 50 && !port; essai++) {
    const candidat = 20000 + Math.floor(Math.random() * 40000)
    if (await libre(candidat)) port = candidat
  }
  if (!port) {
    console.error('  Aucun port libre trouvé après 50 essais. Étrange — réessayez.')
    process.exit(1)
  }
}

// On remplace la ligne existante plutôt que d'en ajouter une seconde : deux
// PORT= dans le fichier, et c'est le dernier qui gagne en silence.
const contenu = existsSync(ENV) ? readFileSync(ENV, 'utf8') : ''
const sansPort = contenu
  .split('\n')
  .filter((l) => !/^\s*PORT\s*=/.test(l))
  .join('\n')
  .replace(/\n+$/, '')
writeFileSync(ENV, `${sansPort ? sansPort + '\n' : ''}PORT=${port}\n`)

console.log(
  [
    '',
    `  Port retenu : ${port}`,
    '',
    `  L’application s’ouvrira maintenant sur http://localhost:${port}`,
    '  au prochain démarrage — double-clic compris.',
    '',
    '  Pour revenir à 3000 : npm run port -- 3000',
    '',
  ].join('\n'),
)
