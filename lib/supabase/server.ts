/**
 * ============================================================================
 *  ACCÈS AUX DONNÉES — À LIRE AVANT DE TOUCHER À QUOI QUE CE SOIT
 * ============================================================================
 *
 *  ⚠  AUCUN APPEL SUPABASE NE PART DU NAVIGATEUR. JAMAIS.  ⚠
 *
 *  Ce back-office n'a pas d'authentification : un mot de passe unique
 *  (BACKOFFICE_PASSWORD) garde l'application. Il n'existe donc aucun
 *  utilisateur Supabase, et aucune politique de sécurité (RLS) ne peut être
 *  écrite pour distinguer qui voit quoi.
 *
 *  Le choix retenu, et il est délibéré : le RLS est activé sur TOUTES les
 *  tables, et il n'existe AUCUNE politique. Rien ne passe, sauf la clé
 *  `service_role`, qui contourne le RLS et ne quitte jamais le serveur.
 *
 *  CE QUE ÇA IMPLIQUE CONCRÈTEMENT
 *  ------------------------------------------------------------------------
 *  1. Tout accès aux données passe par un route handler (`app/api/**`) ou une
 *     server action. Jamais par un client Supabase monté dans un composant
 *     marqué "use client".
 *
 *  2. Il n'y a volontairement PAS de NEXT_PUBLIC_SUPABASE_ANON_KEY dans ce
 *     projet. Si vous êtes tenté d'en ajouter une : ça ne marchera pas, et
 *     ça ne dira pas pourquoi. Le RLS ne renvoie pas d'erreur, il FILTRE.
 *     Une requête depuis le navigateur remonte `[]` et un statut 200. Vous
 *     chercherez le bogue dans votre code pendant une heure.
 *
 *  3. Si un écran est vide, la première question est : « cet appel part-il
 *     bien du serveur ? » — pas « la donnée est-elle en base ? ».
 *
 *  4. SUPABASE_SERVICE_ROLE_KEY ne doit apparaître ni dans un composant
 *     client, ni dans une variable préfixée NEXT_PUBLIC_, ni dans un log.
 *     Elle donne un accès total à la base.
 *
 *  5. Le jour où une vraie authentification arrivera, il suffira d'ajouter des
 *     politiques RLS : la structure des tables n'aura pas à changer, et ce
 *     fichier deviendra un client parmi deux.
 * ============================================================================
 */

import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let client: SupabaseClient | null = null

/**
 * Client Supabase à privilèges complets. Utilisable UNIQUEMENT côté serveur :
 * l'import de `server-only` fait échouer la compilation si ce fichier se
 * retrouve dans un bundle client.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!url || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis. ' +
        'Voir .env.example.',
    )
  }
  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}
