import 'server-only'
import { notFound } from 'next/navigation'
import { exigerSession, type Utilisateur } from '@/lib/auth'

/**
 * Tapora Services appartient au propriétaire du logiciel (convention
 * d'associés, article 8) : son back-office n'existe que pour son compte.
 * Pour tout autre compte, la page n'existe pas (404) — pas même un « accès
 * refusé ». Le drapeau ne se règle que dans la base, jamais depuis l'app.
 */
export async function exigerProprietaire(): Promise<Utilisateur> {
  const u = await exigerSession()
  if (!u.proprietaire_logiciel) notFound()
  return u
}
