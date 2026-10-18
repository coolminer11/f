import 'server-only'
import { requete } from '@/lib/db'

export type Tentative = {
  id: string
  courriel: string
  etape: 'mot_de_passe' | 'code'
  reussie: boolean
  ip_masquee: string | null
  appareil: string | null
  cree_le: string
  nom: string | null
}

/** Les dernières tentatives d'un compte (réussies et ratées). */
export async function journalCompte(utilisateurId: string, limite = 20): Promise<Tentative[]> {
  return requete<Tentative>(
    `select t.id::text, t.courriel, t.etape, t.reussie, t.ip_masquee, t.appareil, t.cree_le, null as nom
       from tentatives_connexion t
      where t.utilisateur_id = $1::uuid
      order by t.cree_le desc limit $2`,
    [utilisateurId, limite],
  )
}

/** Les échecs récents, tous comptes confondus — y compris les courriels inconnus (balayages). */
export async function echecsRecents(limite = 15): Promise<Tentative[]> {
  return requete<Tentative>(
    `select t.id::text, t.courriel, t.etape, t.reussie, t.ip_masquee, t.appareil, t.cree_le, u.nom
       from tentatives_connexion t left join utilisateurs u on u.id = t.utilisateur_id
      where not t.reussie and t.cree_le > now() - interval '30 days'
      order by t.cree_le desc limit $1`,
    [limite],
  )
}

export type EtatEquipe = { id: string; nom: string; courriel: string; totp_actif: boolean; actif: boolean; echecs_7j: number; derniere_connexion: string | null }

export async function etatEquipe(): Promise<EtatEquipe[]> {
  return requete<EtatEquipe>(
    `select u.id, u.nom, u.courriel, u.totp_actif, u.actif, u.derniere_connexion,
            (select count(*)::int from tentatives_connexion t
              where t.utilisateur_id = u.id and not t.reussie and t.cree_le > now() - interval '7 days') as echecs_7j
       from utilisateurs u order by u.cree_le`,
  )
}
