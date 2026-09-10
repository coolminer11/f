#!/usr/bin/env node
/**
 * Sauvegarde complète de la base, dans ./sauvegardes.
 *
 *   npm run sauvegarde
 *
 * Tant que la comptabilité vit sur une seule machine, c'est le seul filet.
 * Un portable qui meurt emporte l'exercice au complet — et il n'y a pas de
 * version antérieure à aller rechercher.
 *
 * On s'appuie sur `pg_dump` plutôt que sur un exporteur maison : c'est l'outil
 * de PostgreSQL, il connaît les séquences, les contraintes et l'ordre des
 * tables mieux que ce que l'on écrirait ici. S'il n'est pas sur le PATH, on le
 * cherche dans le conteneur Docker monté par « npm run local ».
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, statSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const RACINE = path.resolve(import.meta.dirname, '..')
const DOSSIER = path.join(RACINE, 'sauvegardes')
const CONTENEUR = 'tapora-postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL est absent. Lancez « npm run local » d’abord.')
  process.exit(1)
}

function coordonnees(chaine) {
  try {
    const u = new URL(chaine)
    return {
      utilisateur: decodeURIComponent(u.username) || 'postgres',
      base: u.pathname.replace(/^\//, '') || 'postgres',
    }
  } catch {
    return { utilisateur: 'postgres', base: 'postgres' }
  }
}

function disponible(commande) {
  return spawnSync(commande, ['--version'], { stdio: 'ignore' }).status === 0
}

function conteneurDebout() {
  const r = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', CONTENEUR], {
    encoding: 'utf8',
  })
  return r.status === 0 && r.stdout.trim() === 'true'
}

const { utilisateur, base } = coordonnees(url)
let resultat

if (disponible('pg_dump')) {
  resultat = spawnSync('pg_dump', ['--no-owner', '--no-privileges', url], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  })
} else if (conteneurDebout()) {
  console.log('pg_dump absent de la machine — utilisation de celui du conteneur Docker.')
  resultat = spawnSync(
    'docker',
    ['exec', CONTENEUR, 'pg_dump', '--no-owner', '--no-privileges', '-U', utilisateur, '-d', base],
    { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 },
  )
} else {
  console.error(
    [
      'Impossible de trouver pg_dump.',
      '',
      'Deux façons de le régler :',
      '  • installer les outils clients PostgreSQL',
      '    (macOS : brew install libpq && brew link --force libpq)',
      '  • ou lancer la base avec Docker : « npm run local » s’en charge,',
      '    et pg_dump se trouve alors dans le conteneur.',
    ].join('\n'),
  )
  process.exit(1)
}

if (resultat.status !== 0) {
  console.error(resultat.stderr || 'pg_dump a échoué.')
  process.exit(1)
}

mkdirSync(DOSSIER, { recursive: true })
const horodatage = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
const fichier = path.join(DOSSIER, `tapora-${horodatage}.sql`)
writeFileSync(fichier, resultat.stdout)

const taille = statSync(fichier).size
const nb = readdirSync(DOSSIER).filter((f) => f.endsWith('.sql')).length

console.log(
  [
    '',
    `  Sauvegarde écrite : sauvegardes/${path.basename(fichier)}`,
    `  ${(taille / 1024).toFixed(0)} Ko · ${nb} sauvegarde${nb > 1 ? 's' : ''} en tout`,
    '',
    '  Copiez ce fichier ailleurs que sur cette machine — un disque externe,',
    '  un nuage, une clé USB. Une sauvegarde qui vit à côté de l’original ne',
    '  protège de rien.',
    '',
    `  Pour la restaurer : npm run restaurer -- sauvegardes/${path.basename(fichier)}`,
    '',
  ].join('\n'),
)
