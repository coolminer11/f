#!/usr/bin/env node
/**
 * Restaure une sauvegarde.
 *
 *   npm run restaurer -- sauvegardes/tapora-2026-09-10-14-30-00.sql
 *
 * La base visée est VIDÉE avant la restauration : c'est le seul moyen d'obtenir
 * l'état exact de la sauvegarde, plutôt qu'un mélange des deux. Le script le
 * demande donc explicitement avant d'agir.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import path from 'node:path'
import pg from 'pg'

const CONTENEUR = 'tapora-postgres'
const fichier = process.argv[2]

if (!fichier || !existsSync(fichier)) {
  console.error('Indiquez le fichier : npm run restaurer -- sauvegardes/tapora-….sql')
  process.exit(1)
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL est absent.')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: url,
  ssl: process.env.DATABASE_SSL === 'false' ? undefined : { rejectUnauthorized: false },
})
await client.connect()
const { rows } = await client.query(`
  select coalesce((select count(*) from information_schema.tables
                    where table_schema = 'public' and table_type = 'BASE TABLE'), 0)::int as tables`)
await client.end()

const lecture = createInterface({ input: process.stdin, output: process.stdout })
console.log(
  [
    '',
    `  Fichier   : ${path.basename(fichier)}`,
    `  Base      : ${url.replace(/:[^:@/]*@/, ':•••@')}`,
    `  Contenu   : ${rows[0].tables} table(s) qui seront SUPPRIMÉES et remplacées.`,
    '',
  ].join('\n'),
)
const reponse = await lecture.question('  Taper « restaurer » pour continuer : ')
lecture.close()

if (reponse.trim() !== 'restaurer') {
  console.log('  Annulé, rien n’a été touché.')
  process.exit(0)
}

function disponible(commande) {
  return spawnSync(commande, ['--version'], { stdio: 'ignore' }).status === 0
}

const prealable = 'drop schema if exists public cascade; create schema public;'
const contenu = prealable + '\n' + readFileSync(fichier, 'utf8')

let resultat
if (disponible('psql')) {
  resultat = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-q', url], {
    input: contenu,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  })
} else {
  const u = new URL(url)
  resultat = spawnSync(
    'docker',
    ['exec', '-i', CONTENEUR, 'psql', '-v', 'ON_ERROR_STOP=1', '-q',
     '-U', decodeURIComponent(u.username) || 'postgres',
     '-d', u.pathname.replace(/^\//, '') || 'postgres'],
    { input: contenu, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 },
  )
}

if (resultat.status !== 0) {
  console.error(resultat.stderr || 'La restauration a échoué.')
  process.exit(1)
}

console.log('\n  Restauration terminée. Relancez « npm run dev ».\n')
