import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import {
  chiffrerSecret,
  dechiffrerSecret,
  empreinteCodeSecours,
  nouveauSecret,
  nouveauxCodesSecours,
  ressembleCodeSecours,
  verifierCode,
} from '@/lib/totp'

/**
 * Double authentification d'un compte : mise en place en deux temps (le
 * secret est d'abord « en attente » tant qu'un premier code n'a pas prouvé
 * que l'application est bien configurée), vérification, codes de secours.
 */

/** Prépare un secret (pas encore actif) et le renvoie pour le code QR. */
export async function preparerDoubleAuth(utilisateurId: string): Promise<string> {
  const secret = nouveauSecret()
  await requete(
    `update utilisateurs set totp_secret = $2, totp_dernier = null where id = $1::uuid and not totp_actif`,
    [utilisateurId, chiffrerSecret(secret)],
  )
  return secret
}

export async function secretEnAttente(utilisateurId: string): Promise<string | null> {
  const ligne = await requeteUne<{ totp_secret: string | null; totp_actif: boolean }>(
    `select totp_secret, totp_actif from utilisateurs where id = $1::uuid`,
    [utilisateurId],
  )
  if (!ligne?.totp_secret || ligne.totp_actif) return null
  return dechiffrerSecret(ligne.totp_secret)
}

/** Active la double authentification si le code est bon ; renvoie les codes de secours. */
export async function activerDoubleAuth(utilisateurId: string, code: string): Promise<string[] | null> {
  const secret = await secretEnAttente(utilisateurId)
  if (!secret) return null
  const pas = verifierCode(secret, code, null)
  if (pas === null) return null
  const codes = nouveauxCodesSecours()
  await requete(
    `update utilisateurs set totp_actif = true, totp_dernier = $2, codes_secours = $3 where id = $1::uuid`,
    [utilisateurId, pas, codes.map(empreinteCodeSecours)],
  )
  return codes
}

export async function desactiverDoubleAuth(utilisateurId: string): Promise<void> {
  await requete(
    `update utilisateurs set totp_actif = false, totp_secret = null, totp_dernier = null, codes_secours = '{}' where id = $1::uuid`,
    [utilisateurId],
  )
}

export async function nouveauxCodes(utilisateurId: string): Promise<string[]> {
  const codes = nouveauxCodesSecours()
  await requete(`update utilisateurs set codes_secours = $2 where id = $1::uuid and totp_actif`, [
    utilisateurId,
    codes.map(empreinteCodeSecours),
  ])
  return codes
}

export async function codesRestants(utilisateurId: string): Promise<number> {
  const ligne = await requeteUne<{ n: number }>(
    `select coalesce(array_length(codes_secours, 1), 0)::int as n from utilisateurs where id = $1::uuid`,
    [utilisateurId],
  )
  return ligne?.n ?? 0
}

/**
 * Vérifie un code à 6 chiffres OU un code de secours, et le consomme.
 * Les mises à jour sont conditionnelles : deux requêtes simultanées avec le
 * même code ne peuvent pas réussir toutes les deux.
 */
export async function verifierCodeCompte(utilisateurId: string, saisi: string): Promise<'totp' | 'secours' | null> {
  const ligne = await requeteUne<{ totp_secret: string | null; totp_dernier: string | null }>(
    `select totp_secret, totp_dernier from utilisateurs where id = $1::uuid and totp_actif`,
    [utilisateurId],
  )
  if (!ligne?.totp_secret) return null

  if (ressembleCodeSecours(saisi) && !/^\d{6}$/.test(saisi.replace(/\s/g, ''))) {
    const consomme = await requeteUne<{ id: string }>(
      `update utilisateurs set codes_secours = array_remove(codes_secours, $2)
        where id = $1::uuid and $2 = any(codes_secours) returning id`,
      [utilisateurId, empreinteCodeSecours(saisi)],
    )
    return consomme ? 'secours' : null
  }

  const secret = dechiffrerSecret(ligne.totp_secret)
  if (!secret) return null
  const dernier = ligne.totp_dernier === null ? null : Number(ligne.totp_dernier)
  const pas = verifierCode(secret, saisi, dernier)
  if (pas === null) return null
  const accepte = await requeteUne<{ id: string }>(
    `update utilisateurs set totp_dernier = $2
      where id = $1::uuid and (totp_dernier is null or totp_dernier < $2) returning id`,
    [utilisateurId, pas],
  )
  return accepte ? 'totp' : null
}
