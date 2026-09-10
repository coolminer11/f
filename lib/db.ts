/**
 * ============================================================================
 *  ACCÈS AUX DONNÉES — À LIRE AVANT DE TOUCHER À QUOI QUE CE SOIT
 * ============================================================================
 *
 *  ⚠  AUCUN ACCÈS À LA BASE NE PART DU NAVIGATEUR. JAMAIS.  ⚠
 *
 *  Ce back-office n'a pas d'authentification : un mot de passe unique
 *  (BACKOFFICE_PASSWORD) garde l'application. Il n'existe donc aucun
 *  utilisateur Supabase, et aucune politique de sécurité (RLS) ne peut être
 *  écrite pour distinguer qui voit quoi.
 *
 *  Le choix retenu, délibérément : le RLS est activé sur TOUTES les tables et
 *  il n'existe AUCUNE politique. Les rôles publics de Supabase (`anon`,
 *  `authenticated`) ne lisent rien, n'écrivent rien, ne comptent rien — même
 *  si une clé fuite dans le bundle du navigateur. Seul le rôle propriétaire
 *  des tables, avec lequel ce module se connecte depuis le serveur, accède
 *  aux données.
 *
 *  CE QUE ÇA IMPLIQUE CONCRÈTEMENT
 *  ------------------------------------------------------------------------
 *  1. Toute lecture ou écriture passe par ce module, donc par un composant
 *     serveur, une server action ou un route handler. Jamais par du code
 *     marqué "use client".
 *
 *  2. Il n'y a volontairement PAS de clé Supabase publique dans ce projet
 *     pour les données. Si vous êtes tenté d'en ajouter une : ça ne marchera
 *     pas, et ça ne dira pas pourquoi. Le RLS ne renvoie pas d'erreur, il
 *     FILTRE. Une requête depuis le navigateur remonte `[]` avec un statut
 *     200. Vous chercherez le bogue dans votre code pendant une heure.
 *
 *  3. Si un écran est vide, la première question est « cet appel part-il bien
 *     du serveur ? », pas « la donnée est-elle en base ? ».
 *
 *  4. DATABASE_URL donne un accès total à la base. Ni dans un composant
 *     client, ni dans une variable NEXT_PUBLIC_, ni dans un log.
 *
 *  5. Le jour où une vraie authentification arrivera, il suffira d'ajouter des
 *     politiques RLS : la structure des tables n'aura pas à changer.
 *
 *  POURQUOI `pg` ET NON `@supabase/supabase-js` POUR LES DONNÉES
 *  ------------------------------------------------------------------------
 *  Toute l'intelligence du modèle vit dans des vues et des fonctions SQL
 *  (`v_resultats_mensuels`, `rapport_taxes()`, `enregistrer_depense()`...).
 *  Les interroger en SQL direct est plus simple et plus lisible qu'à travers
 *  le constructeur de requêtes de PostgREST, et permet d'enchaîner plusieurs
 *  écritures dans une seule transaction. `@supabase/supabase-js` reste utilisé
 *  pour l'entreposage des reçus (voir lib/stockage.ts).
 * ============================================================================
 */

import 'server-only'
import { Pool, types } from 'pg'

// Les colonnes numeric arrivent en texte par défaut (précision arbitraire).
// On les convertit en nombre pour l'affichage uniquement : TOUT le calcul
// monétaire est fait par PostgreSQL, jamais en JavaScript.
types.setTypeParser(types.builtins.NUMERIC, (valeur) => Number(valeur))
types.setTypeParser(types.builtins.INT8, (valeur) => Number(valeur))
// Les dates restent des chaînes AAAA-MM-JJ : pas de décalage de fuseau.
types.setTypeParser(types.builtins.DATE, (valeur) => valeur)
// Les horodatages aussi : par défaut `pg` les convertit en objets Date, ce qui
// oblige chaque appelant à se souvenir du type et casse au premier `.slice()`.
// Une chaîne ISO partout est plus simple à manipuler et à sérialiser.
const versIso = (valeur: string) => new Date(valeur).toISOString()
types.setTypeParser(types.builtins.TIMESTAMPTZ, versIso)
types.setTypeParser(types.builtins.TIMESTAMP, versIso)

let pool: Pool | null = null

function obtenirPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL est requis. Voir .env.example.')
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      ssl: process.env.DATABASE_SSL === 'false' ? undefined : { rejectUnauthorized: false },
    })
  }
  return pool
}

/** Exécute une requête paramétrée et renvoie les lignes typées. */
export async function requete<T = Record<string, unknown>>(
  sql: string,
  valeurs: unknown[] = [],
): Promise<T[]> {
  const resultat = await obtenirPool().query(sql, valeurs)
  return resultat.rows as T[]
}

/** Variante pour une requête qui doit renvoyer exactement une ligne. */
export async function requeteUne<T = Record<string, unknown>>(
  sql: string,
  valeurs: unknown[] = [],
): Promise<T | null> {
  const lignes = await requete<T>(sql, valeurs)
  return lignes[0] ?? null
}
