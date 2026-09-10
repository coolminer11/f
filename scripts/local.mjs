#!/usr/bin/env node
/**
 * Prépare tout ce qu'il faut pour essayer l'application sur votre machine.
 *
 *   npm run local
 *
 * Le script cherche une base de données dans cet ordre :
 *   1. DATABASE_URL déjà présent dans .env.local — on l'utilise tel quel ;
 *   2. un PostgreSQL déjà lancé sur le port 5432 — Postgres.app sur Mac, ou
 *      une installation Homebrew. C'est le cas le plus courant et le plus
 *      rapide : rien à télécharger de plus ;
 *   3. la CLI Supabase (`supabase start`) ;
 *   4. Docker — un simple conteneur PostgreSQL.
 *
 * La base `tapora` est créée si elle n'existe pas.
 *
 * Puis il applique les migrations, écrit .env.local s'il manque, et vous rend
 * la main pour `npm run dev`.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { migrer } from './migrer.mjs'

const RACINE = path.resolve(import.meta.dirname, '..')
const ENV = path.join(RACINE, '.env.local')
const CONTENEUR = 'tapora-postgres'
const URL_DOCKER = 'postgresql://postgres:tapora@127.0.0.1:54329/tapora'

/**
 * Cherche un PostgreSQL déjà en marche. Postgres.app crée un rôle au nom de
 * l'utilisateur macOS ; Homebrew fait de même ; une installation classique
 * garde « postgres ». On essaie les trois.
 */
async function postgresLocal() {
  const pg = (await import('pg')).default
  const utilisateur = process.env.USER || process.env.USERNAME || 'postgres'
  const candidats = [
    `postgresql://${encodeURIComponent(utilisateur)}@127.0.0.1:5432/postgres`,
    'postgresql://postgres@127.0.0.1:5432/postgres',
    'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
  ]

  for (const candidat of candidats) {
    const client = new pg.Client({ connectionString: candidat, connectionTimeoutMillis: 2500 })
    try {
      await client.connect()
      const { rows } = await client.query('select 1 from pg_database where datname = $1', ['tapora'])
      if (rows.length === 0) {
        await client.query('create database tapora')
        console.log('Base « tapora » créée.')
      }
      await client.end()
      return candidat.replace(/\/postgres$/, '/tapora')
    } catch {
      await client.end().catch(() => {})
    }
  }
  return null
}

function disponible(commande, args = ['--version']) {
  return spawnSync(commande, args, { stdio: 'ignore' }).status === 0
}

function lireEnv() {
  if (!existsSync(ENV)) return {}
  return Object.fromEntries(
    readFileSync(ENV, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]
      }),
  )
}

function ecrireEnv(valeurs) {
  const contenu = [
    '# Écrit par « npm run local ». Modifiable à la main.',
    `SESSION_SECRET=${valeurs.SESSION_SECRET}`,
    `DATABASE_URL=${valeurs.DATABASE_URL}`,
    'DATABASE_SSL=false',
    '',
    '# Envoi de courriel : sans ces deux valeurs, les envois sont simulés et',
    '# écrits dans ./courriels-locaux.',
    '# RESEND_API_KEY=',
    '# COURRIEL_EXPEDITEUR="Tapora S.E.N.C. <facturation@exemple.ca>"',
    '',
  ].join('\n')
  writeFileSync(ENV, contenu)
}

function demarrerDocker() {
  console.log('Démarrage de PostgreSQL dans Docker…')
  const existe = spawnSync('docker', ['inspect', CONTENEUR], { stdio: 'ignore' }).status === 0
  if (existe) {
    execFileSync('docker', ['start', CONTENEUR], { stdio: 'ignore' })
  } else {
    execFileSync(
      'docker',
      // prettier-ignore
      ['run', '-d', '--name', CONTENEUR,
       '-e', 'POSTGRES_PASSWORD=tapora', '-e', 'POSTGRES_DB=tapora',
       '-p', '54329:5432', 'postgres:16-alpine'],
      { stdio: 'ignore' },
    )
  }
  return URL_DOCKER
}

async function attendreBase(url, essais = 30) {
  const pg = (await import('pg')).default
  for (let i = 0; i < essais; i++) {
    const client = new pg.Client({ connectionString: url })
    try {
      await client.connect()
      await client.end()
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  return false
}

const env = lireEnv()
let url = env.DATABASE_URL || process.env.DATABASE_URL

if (url) {
  console.log('Base de données : celle indiquée par DATABASE_URL.')
} else if ((url = await postgresLocal())) {
  console.log('Base de données : le PostgreSQL déjà installé sur cette machine.')
} else if (disponible('supabase')) {
  console.log('Démarrage de Supabase en local (première fois : quelques minutes)…')
  spawnSync('supabase', ['start'], { stdio: 'inherit', cwd: RACINE })
  const sortie = spawnSync('supabase', ['status', '-o', 'env'], { cwd: RACINE, encoding: 'utf8' })
  const ligne = (sortie.stdout ?? '').split('\n').find((l) => l.startsWith('DB_URL='))
  url = ligne?.split('=')[1]?.replace(/^["']|["']$/g, '')
  if (!url) {
    console.error('Supabase a démarré mais n’a pas donné d’URL de base. Essayez avec Docker.')
    process.exit(1)
  }
} else if (disponible('docker', ['info'])) {
  url = demarrerDocker()
} else {
  console.error(
    [
      '',
      '  Aucune base de données trouvée sur cette machine.',
      '',
      '  Le plus simple sur un Mac : Postgres.app',
      '',
      '    1. Télécharger sur postgresapp.com',
      '    2. Glisser Postgres.app dans Applications',
      '    3. L’ouvrir et cliquer « Initialize »',
      '    4. Relancer cette commande',
      '',
      '  Rien d’autre à configurer : le script trouvera la base tout seul.',
      '',
      '  (Autres possibilités : Docker Desktop, la CLI Supabase, ou un',
      '   DATABASE_URL que vous renseignez vous-même dans .env.local.)',
      '',
    ].join('\n'),
  )
  process.exit(1)
}

process.env.DATABASE_URL = url
process.env.DATABASE_SSL = url.includes('127.0.0.1') || url.includes('localhost') ? 'false' : 'true'

console.log('Attente de la base…')
if (!(await attendreBase(url))) {
  console.error('La base ne répond pas. Vérifiez que Docker ou Supabase est bien démarré.')
  process.exit(1)
}

console.log('Application des migrations…')
await migrer()

ecrireEnv({
  SESSION_SECRET: env.SESSION_SECRET || randomBytes(32).toString('base64url'),
  DATABASE_URL: url,
})

console.log(
  [
    '',
    '  Tout est prêt.',
    '',
    '    npm run dev',
    '',
    '  Puis ouvrez http://localhost:3000 : le premier écran vous propose de',
    '  créer votre compte.',
    '',
  ].join('\n'),
)
