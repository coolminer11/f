#!/usr/bin/env node
/**
 * Charge un jeu d'essai : un trimestre de ventes, de dépenses et de mouvements
 * d'associés, avec des dates relatives à aujourd'hui pour que les écrans
 * mensuels aient quelque chose à montrer.
 *
 * Refuse de s'exécuter si la base contient déjà des transactions : ces données
 * sont fausses et n'ont rien à faire dans une comptabilité réelle.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL est absent. Lancez « npm run local » d’abord.')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: url,
  ssl: process.env.DATABASE_SSL === 'false' ? undefined : { rejectUnauthorized: false },
})
await client.connect()

const { rows } = await client.query('select count(*)::int as n from transactions')
if (rows[0].n > 0 && !process.argv.includes('--forcer')) {
  console.error(
    [
      `La base contient déjà ${rows[0].n} écriture(s).`,
      'Le jeu d’essai est fait pour une base vide : ces données sont fausses.',
      'Pour l’ajouter quand même : npm run db:demo -- --forcer',
    ].join('\n'),
  )
  await client.end()
  process.exit(1)
}

const sql = await readFile(
  path.join(import.meta.dirname, '..', 'supabase', 'demo.sql'),
  'utf8',
)
await client.query(sql)

const resume = await client.query(`
  select (select count(*) from transactions) as ecritures,
         (select count(*) from ventes) as documents,
         (select count(*) from mouvements_associes) as mouvements`)
const r = resume.rows[0]
console.log(
  `Jeu d’essai chargé : ${r.ecritures} écritures, ${r.documents} documents, ${r.mouvements} mouvements d’associés.`,
)
await client.end()
