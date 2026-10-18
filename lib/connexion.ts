import 'server-only'
import { ouvrirSession, type Utilisateur } from '@/lib/auth'
import { requeteUne } from '@/lib/db'
import { courrielEssaisBloques, courrielNouvelleConnexion } from '@/lib/courriel-securite'
import {
  alerteSiBloque,
  appareilInconnu,
  baseLiens,
  creerJetonPasMoi,
  noterTentative,
  verrouConnexion,
  type Contexte,
} from '@/lib/securite'

/**
 * Les deux issues d'une tentative de connexion, communes à l'étape « mot de
 * passe » et à l'étape « code ».
 */

export async function idParCourriel(courriel: string): Promise<{ id: string; courriel: string; nom: string } | null> {
  return requeteUne(`select id, courriel, nom from utilisateurs where lower(courriel) = lower($1) and actif`, [courriel.trim()])
}

/** Échec : on le note, et si le compte vient d'être bloqué, son propriétaire est prévenu. */
export async function echecConnexion(e: {
  courriel: string
  compte: { id: string; courriel: string; nom: string } | null
  etape: 'mot_de_passe' | 'code'
  ctx: Contexte
}) {
  await noterTentative({ courriel: e.courriel, utilisateurId: e.compte?.id ?? null, etape: e.etape, reussie: false, ctx: e.ctx })
  const verrou = await verrouConnexion(e.courriel, e.ctx)
  if (verrou.bloque && e.compte && (await alerteSiBloque(e.compte.id))) {
    const lien = `${await baseLiens()}/securite/pas-moi?j=${await creerJetonPasMoi(e.compte.id)}`
    await courrielEssaisBloques(e.compte, e.ctx, lien, e.etape === 'code').catch(() => null)
  }
  return verrou
}

/** Réussite complète (mot de passe, et code s'il y a lieu) : la session s'ouvre. */
export async function reussiteConnexion(u: Utilisateur, ctx: Contexte) {
  const inconnu = await appareilInconnu(u.id, ctx)
  await noterTentative({ courriel: u.courriel, utilisateurId: u.id, etape: u.totp_actif ? 'code' : 'mot_de_passe', reussie: true, ctx })
  await ouvrirSession(u.id, ctx)
  if (inconnu) {
    const lien = `${await baseLiens()}/securite/pas-moi?j=${await creerJetonPasMoi(u.id)}`
    await courrielNouvelleConnexion(u, ctx, lien).catch(() => null)
  }
}
