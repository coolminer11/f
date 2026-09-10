#!/usr/bin/env node
/**
 * Prépare tout ce qu'il faut pour essayer l'application sur votre machine.
 *
 *   npm run local
 *
 * Le script cherche une base de données dans cet ordre :
 *   1. DATABASE_URL déjà présent dans .env.local — on l'utilise tel quel ;
 *   2. la CLI Supabase (`supabase start`) — c'est le plus proche de la
 *      production, avec l'entreposage des reçus ;
 *   3. Docker — un simple conteneur PostgreSQL, plus léger.
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
      'Aucune base de données trouvée.',
      '',
      'Trois façons de continuer :',
      '  • installer Docker Desktop, puis relancer « npm run local » ;',
      '  • installer la CLI Supabase (brew install supabase/tap/supabase) ;',
      '  • ou pointer DATABASE_URL vers un PostgreSQL que vous avez déjà,',
      '    dans un fichier .env.local.',
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
