import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { requeteUne } from '@/lib/db'
import { messagerieConfiguree } from '@/lib/courriel'
import { stockageDistant } from '@/lib/stockage'

/**
 * État réel des trois raccordements de l'application.
 *
 * Chaque contrôle fait le vrai geste plutôt que de constater la présence
 * d'une variable : une clé peut exister et être fausse, un seau peut être
 * nommé autrement. C'est précisément le genre de panne qui ne se voit pas —
 * les reçus partent sur le disque du serveur, tout a l'air normal, et ils
 * disparaissent au redéploiement suivant.
 */
export type Verdict = 'ok' | 'attention' | 'panne'

export type Controle = {
  nom: string
  verdict: Verdict
  detail: string
  remede?: string
}

async function controlerBase(): Promise<Controle> {
  try {
    const ligne = await requeteUne<{ migrations: number; derniere: string; version: string }>(`
      select (select count(*)::int from schema_migrations)               as migrations,
             (select max(fichier) from schema_migrations)                as derniere,
             split_part(version(), ' ', 2)                               as version`)
    if (!ligne) return { nom: 'Base de données', verdict: 'panne', detail: 'Aucune réponse.' }
    return {
      nom: 'Base de données',
      verdict: 'ok',
      detail: `PostgreSQL ${ligne.version} · ${ligne.migrations} migrations appliquées (dernière : ${ligne.derniere})`,
    }
  } catch (e) {
    return {
      nom: 'Base de données',
      verdict: 'panne',
      detail: e instanceof Error ? e.message : 'Connexion impossible.',
      remede: 'Vérifiez DATABASE_URL chez l’hébergeur, et que le projet Supabase n’est pas en pause.',
    }
  }
}

async function controlerStockage(): Promise<Controle> {
  if (!stockageDistant()) {
    return {
      nom: 'Photos de reçus',
      verdict: 'attention',
      detail:
        'Écrites sur le disque du serveur. Elles seront effacées au prochain redéploiement.',
      remede:
        'Renseignez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY chez l’hébergeur, puis redéployez.',
    }
  }
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data, error } = await supabase.storage.getBucket('recus')
    if (error) {
      return {
        nom: 'Photos de reçus',
        verdict: 'panne',
        detail: `Supabase répond : ${error.message}`,
        remede:
          'Clé refusée, ou seau absent. Vérifiez la clé « secret » / « service_role », et qu’un seau nommé exactement « recus » existe dans Storage.',
      }
    }
    return {
      nom: 'Photos de reçus',
      verdict: data?.public ? 'attention' : 'ok',
      detail: data?.public
        ? 'Seau « recus » joignable, mais il est PUBLIC : n’importe qui devinant une adresse voit vos reçus.'
        : 'Seau « recus » joignable chez Supabase, privé. Les adresses sont signées et expirent.',
      remede: data?.public
        ? 'Dans Supabase → Storage → recus → Settings, décochez « Public bucket ».'
        : undefined,
    }
  } catch (e) {
    return {
      nom: 'Photos de reçus',
      verdict: 'panne',
      detail: e instanceof Error ? e.message : 'Supabase injoignable.',
    }
  }
}

function controlerCourriel(): Controle {
  return messagerieConfiguree()
    ? {
        nom: 'Envoi des documents',
        verdict: 'ok',
        detail: `Resend configuré · expéditeur ${process.env.COURRIEL_EXPEDITEUR}`,
      }
    : {
        nom: 'Envoi des documents',
        verdict: 'attention',
        detail: 'Les envois sont SIMULÉS : rien ne part, le message est écrit sur disque.',
        remede: 'Renseignez RESEND_API_KEY et COURRIEL_EXPEDITEUR chez l’hébergeur.',
      }
}

async function controlerParametres(): Promise<Controle> {
  const p = await requeteUne<{ tps: string | null; tvq: string | null; nom: string | null }>(
    'select numero_tps as tps, numero_tvq as tvq, nom_entreprise as nom from parametres limit 1',
  )
  const manquants = [
    !p?.tps && 'numéro de TPS',
    !p?.tvq && 'numéro de TVQ',
    !p?.nom && 'nom légal',
  ].filter(Boolean)
  return manquants.length === 0
    ? { nom: 'Renseignements de l’entreprise', verdict: 'ok', detail: `${p?.nom} · TPS et TVQ renseignés` }
    : {
        nom: 'Renseignements de l’entreprise',
        verdict: 'attention',
        detail: `Manque : ${manquants.join(', ')}. Ces valeurs s’impriment sur les factures.`,
        remede: 'Supabase → Table Editor → parametres, ou modifiez la ligne directement.',
      }
}

export async function etatSysteme(): Promise<Controle[]> {
  const [base, stockage, parametres] = await Promise.all([
    controlerBase(),
    controlerStockage(),
    controlerParametres().catch(
      (): Controle => ({
        nom: 'Renseignements de l’entreprise',
        verdict: 'panne',
        detail: 'Table « parametres » illisible.',
      }),
    ),
  ])
  return [base, stockage, controlerCourriel(), parametres]
}
