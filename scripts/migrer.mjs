#!/usr/bin/env node
/**
 * Applique les migrations en attente, puis le seed.
 *
 * Chaque fichier est joué en entier, dans une seule requête : PostgreSQL en
 * fait une transaction implicite, et découper le fichier sur les « ; »
 * casserait les corps de fonction délimités par $$. C'est aussi pour cela que
 * les migrations qui ajoutent une valeur d'énumération sont dans un fichier
 * séparé de celles qui l'utilisent — deux fichiers, deux transactions.
 *
 * Les fichiers déjà appliqués sont notés dans `schema_migrations` : relancer
 * la commande ne rejoue rien.
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const RACINE = path.resolve(import.meta.dirname, '..')
const MIGRATIONS = path.join(RACINE, 'supabase', 'migrations')
const SEED = path.join(RACINE, 'supabase', 'seed.sql')

function chaineConnexion() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL est absent. Lancez « npm run local » ou remplissez .env.local.')
    process.exit(1)
  }
  return url
}

export async function migrer({ avecSeed = true, silencieux = false } = {}) {
  const dire = (...a) => !silencieux && console.log(...a)
  const client = new pg.Client({
    connectionString: chaineConnexion(),
    ssl: process.env.DATABASE_SSL === 'false' ? undefined : { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    await client.query(`
      create table if not exists schema_migrations (
        fichier    text primary key,
        applique_le timestamptz not null default now()
      )`)

    const { rows } = await client.query('select fichier from schema_migrations')
    const deja = new Set(rows.map((r) => r.fichier))
    const fichiers = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort()
    const enAttente = fichiers.filter((f) => !deja.has(f))

    if (enAttente.length === 0) {
      dire(`Schéma à jour — ${fichiers.length} migration(s) déjà appliquée(s).`)
    }

    for (const fichier of enAttente) {
      const sql = await readFile(path.join(MIGRATIONS, fichier), 'utf8')
      process.stdout.write(`  ${fichier} … `)
      try {
        await client.query(sql)
        await client.query('insert into schema_migrations (fichier) values ($1)', [fichier])
        console.log('appliquée')
      } catch (e) {
        console.log('ÉCHEC')
        console.error(`\n${e.message}\n`)
        throw e
      }
    }

    if (avecSeed) {
      // Le seed est écrit pour être rejouable : chaque insertion est protégée
      // par un « on conflict do nothing ».
      await client.query(await readFile(SEED, 'utf8'))
      dire('Données de départ en place.')
    }
  } finally {
    await client.end()
  }
}

if (import.meta.filename === process.argv[1]) {
  migrer({ avecSeed: !process.argv.includes('--sans-seed') }).catch(() => process.exit(1))
}
