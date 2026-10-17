import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Lecture des clés, et la garantie qu'elles ne s'affichent jamais.
 *
 * Deux leçons apprises en production :
 *
 * 1. Une clé collée depuis un terminal étroit ou une page web arrive souvent
 *    avec une espace ou un saut de ligne au milieu. Aucune clé ne contient
 *    d'espace : on les retire toutes, plutôt que de laisser la requête
 *    échouer sur « invalid header value ».
 *
 * 2. Le message d'erreur d'une bibliothèque peut citer la clé elle-même —
 *    supabase-js le fait quand l'en-tête est invalide. Tout message destiné
 *    à l'écran passe donc par `masquer`, qui remplace chaque clé connue, et
 *    tout ce qui en a la forme, par des points.
 */
const NOMS_SECRETS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'GMAIL_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
  'RESEND_API_KEY',
  'SESSION_SECRET',
  'DATABASE_URL',
]

export function secret(nom: string): string | undefined {
  const brut = process.env[nom]
  if (!brut) return undefined
  const propre = brut.replace(/\s+/g, '')
  return propre.length ? propre : undefined
}

export function masquer(texte: string): string {
  let sortie = texte
  for (const nom of NOMS_SECRETS) {
    const valeur = process.env[nom]
    if (!valeur) continue
    // La valeur brute, et chacun de ses morceaux si elle contenait des espaces.
    for (const morceau of [valeur, ...valeur.split(/\s+/)]) {
      if (morceau.length >= 8) sortie = sortie.split(morceau).join('•••')
    }
  }
  return sortie
    .replace(/sb_secret_[\w-]+/g, 'sb_secret_•••')
    .replace(/GOCSPX-[\w-]+/g, 'GOCSPX-•••')
    .replace(/\b1\/\/[\w-]{20,}/g, '1//•••')
    .replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]+/g, 'eyJ•••')
}

export function supabaseConfigure(): boolean {
  return Boolean(secret('NEXT_PUBLIC_SUPABASE_URL') && secret('SUPABASE_SERVICE_ROLE_KEY'))
}

/** Le seul endroit qui ouvre un client Supabase côté serveur. */
export function clientSupabase(): SupabaseClient {
  return createClient(
    secret('NEXT_PUBLIC_SUPABASE_URL') as string,
    secret('SUPABASE_SERVICE_ROLE_KEY') as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
