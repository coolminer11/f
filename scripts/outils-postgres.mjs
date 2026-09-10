/**
 * Retrouver psql et pg_dump quand ils ne sont pas sur le PATH.
 *
 * Sur un Mac, c'est la règle plutôt que l'exception :
 *   • Homebrew garde postgresql@16 « keg-only » — ses binaires restent dans
 *     /opt/homebrew/opt/postgresql@16/bin et ne sont liés nulle part ;
 *   • Postgres.app range les siens dans le paquet de l'application ;
 *   • un script lancé depuis le Finder n'hérite pas du PATH du shell.
 *
 * Abandonner là-dessus reviendrait à dire « pas de sauvegarde possible » à
 * quelqu'un dont la machine a pourtant tout ce qu'il faut.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'

export const CONTENEUR = 'tapora-postgres'

const DOSSIERS_POSSIBLES = [
  '/opt/homebrew/opt/postgresql@18/bin',
  '/usr/local/opt/postgresql@18/bin',
  '/opt/homebrew/opt/postgresql@17/bin',
  '/usr/local/opt/postgresql@17/bin',
  '/opt/homebrew/opt/postgresql@16/bin',
  '/usr/local/opt/postgresql@16/bin',
  '/Applications/Postgres.app/Contents/Versions/latest/bin',
  '/Applications/Postgres.app/Contents/Versions/18/bin',
  '/Applications/Postgres.app/Contents/Versions/17/bin',
  '/Applications/Postgres.app/Contents/Versions/16/bin',
  '/opt/homebrew/bin',
  '/usr/local/bin',
]

/** Chemin utilisable vers `commande`, ou null. */
export function trouver(commande) {
  if (spawnSync(commande, ['--version'], { stdio: 'ignore' }).status === 0) return commande
  for (const dossier of DOSSIERS_POSSIBLES) {
    const chemin = path.join(dossier, commande)
    if (spawnSync(chemin, ['--version'], { stdio: 'ignore' }).status === 0) return chemin
  }
  return null
}

/** Le conteneur Docker monté par « npm run local » tourne-t-il ? */
export function conteneurDebout() {
  const r = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', CONTENEUR], {
    encoding: 'utf8',
  })
  return r.status === 0 && r.stdout.trim() === 'true'
}

/** Coordonnées de connexion tirées de l'URL, pour l'appel via Docker. */
export function coordonnees(chaine) {
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

/** Message unique : les outils PostgreSQL sont introuvables. */
export function messageOutilsAbsents(commande) {
  return [
    `Impossible de trouver ${commande}.`,
    '',
    'Deux façons de le régler :',
    '  • sur un Mac : brew install postgresql@16',
    '  • ou lancer la base avec Docker : « npm run local » s’en charge,',
    `    et ${commande} se trouve alors dans le conteneur.`,
  ].join('\n')
}
