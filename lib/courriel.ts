import 'server-only'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Envoi de courriel par l'API HTTP de Resend — aucune dépendance à installer,
 * un simple `fetch`.
 *
 * Sans clé configurée, le message est écrit dans ./courriels-locaux et
 * l'envoi est journalisé comme « simulé ». Ce repli n'a aucune valeur en
 * production : il existe pour pouvoir essayer le parcours complet sans compte
 * de messagerie, et le journal des envois dit clairement que rien n'est parti.
 */
export type ResultatEnvoi = {
  statut: 'envoye' | 'simule' | 'echec'
  reference: string | null
  erreur: string | null
}

export function messagerieConfiguree(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.COURRIEL_EXPEDITEUR)
}

export async function envoyerCourriel(entree: {
  destinataire: string
  objet: string
  html: string
  texte: string
  repondreA?: string | null
}): Promise<ResultatEnvoi> {
  if (!messagerieConfiguree()) {
    const dossier = path.join(process.cwd(), 'courriels-locaux')
    await mkdir(dossier, { recursive: true })
    const nom = `${Date.now()}-${entree.destinataire.replace(/[^a-z0-9]/gi, '_')}.html`
    await writeFile(
      path.join(dossier, nom),
      `<!-- À : ${entree.destinataire}\n     Objet : ${entree.objet} -->\n${entree.html}`,
    )
    return { statut: 'simule', reference: nom, erreur: null }
  }

  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.COURRIEL_EXPEDITEUR,
        to: [entree.destinataire],
        subject: entree.objet,
        html: entree.html,
        text: entree.texte,
        ...(entree.repondreA ? { reply_to: entree.repondreA } : {}),
      }),
    })
    const corps = (await reponse.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!reponse.ok) {
      return { statut: 'echec', reference: null, erreur: corps.message ?? `HTTP ${reponse.status}` }
    }
    return { statut: 'envoye', reference: corps.id ?? null, erreur: null }
  } catch (e) {
    return {
      statut: 'echec',
      reference: null,
      erreur: e instanceof Error ? e.message : 'Envoi impossible.',
    }
  }
}

/** Échappe le texte inséré dans le HTML du courriel. */
export function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
