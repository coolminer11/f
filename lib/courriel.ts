import 'server-only'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { masquer, secret } from '@/lib/secrets'

/**
 * Envoi de courriel — par Gmail, par Resend, ou simulé.
 *
 * GMAIL passe par l'API HTTP de Google, pas par SMTP. Ce n'est pas un détail :
 * l'hébergeur gratuit bloque les ports SMTP (25, 465, 587), et une connexion
 * « Gmail classique » échouerait en silence une fois en ligne. L'API, elle,
 * passe par HTTPS comme n'importe quelle page. Le courriel part réellement du
 * compte Gmail de la société et apparaît dans ses « Messages envoyés ».
 *
 * RESEND reste possible pour qui a son propre nom de domaine.
 *
 * Sans l'un ni l'autre, le message est écrit dans ./courriels-locaux et
 * l'envoi est journalisé « simulé » — l'écran le dit, rien ne part.
 */
export type ResultatEnvoi = {
  statut: 'envoye' | 'simule' | 'echec'
  reference: string | null
  erreur: string | null
}

export type PieceJointe = { nom: string; contenu: Buffer; type: string }

type Courriel = {
  destinataire: string
  objet: string
  html: string
  texte: string
  repondreA?: string | null
  pieceJointe?: PieceJointe | null
}

export type Transport = 'gmail' | 'resend' | null

export function transport(): Transport {
  if (
    secret('GMAIL_CLIENT_ID') &&
    secret('GMAIL_CLIENT_SECRET') &&
    secret('GMAIL_REFRESH_TOKEN')
  ) {
    return 'gmail'
  }
  if (secret('RESEND_API_KEY') && process.env.COURRIEL_EXPEDITEUR) return 'resend'
  return null
}

export function messagerieConfiguree(): boolean {
  return transport() !== null
}

export async function envoyerCourriel(entree: Courriel): Promise<ResultatEnvoi> {
  try {
    switch (transport()) {
      case 'gmail':
        return await parGmail(entree)
      case 'resend':
        return await parResend(entree)
      default:
        return await simuler(entree)
    }
  } catch (e) {
    return {
      statut: 'echec',
      reference: null,
      erreur: e instanceof Error ? masquer(e.message) : 'Envoi impossible.',
    }
  }
}

// ---------------------------------------------------------------------------
// Gmail
// ---------------------------------------------------------------------------

let jetonAcces: { valeur: string; expire: number } | null = null

/**
 * Le jeton d'accès Google dure une heure ; le jeton de rafraîchissement, lui,
 * ne bouge pas. On le réutilise tant qu'il reste une minute de marge.
 */
async function accesGmail(): Promise<string> {
  if (jetonAcces && jetonAcces.expire > Date.now() + 60_000) return jetonAcces.valeur

  const reponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: secret('GMAIL_CLIENT_ID') as string,
      client_secret: secret('GMAIL_CLIENT_SECRET') as string,
      refresh_token: secret('GMAIL_REFRESH_TOKEN') as string,
      grant_type: 'refresh_token',
    }),
  })
  const corps = (await reponse.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }
  if (!reponse.ok || !corps.access_token) {
    // « invalid_grant » est presque toujours la même histoire : l'écran de
    // consentement est resté en mode Test, et Google révoque le jeton au
    // bout de sept jours. Le dire évite une heure de recherche.
    if (corps.error === 'invalid_grant') {
      throw new Error(
        'Google a révoqué l’autorisation Gmail. Refaites « npm run gmail:autoriser » ' +
          '— et vérifiez que l’application Google est publiée (« En production »), ' +
          'sinon l’autorisation expire tous les sept jours.',
      )
    }
    throw new Error(`Connexion à Gmail refusée : ${corps.error_description ?? corps.error ?? reponse.status}`)
  }
  jetonAcces = {
    valeur: corps.access_token,
    expire: Date.now() + (corps.expires_in ?? 3600) * 1000,
  }
  return jetonAcces.valeur
}

async function parGmail(entree: Courriel): Promise<ResultatEnvoi> {
  const brut = construireMime(entree, process.env.GMAIL_EXPEDITEUR ?? null)
  const reponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await accesGmail()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ raw: Buffer.from(brut).toString('base64url') }),
  })
  const corps = (await reponse.json().catch(() => ({}))) as {
    id?: string
    error?: { message?: string }
  }
  if (!reponse.ok) {
    return { statut: 'echec', reference: null, erreur: corps.error?.message ?? `HTTP ${reponse.status}` }
  }
  return { statut: 'envoye', reference: corps.id ?? null, erreur: null }
}

/** Une en-tête non ASCII doit être encodée (RFC 2047), sinon les accents de l'objet arrivent en charpie. */
function entete(valeur: string): string {
  return /^[\x20-\x7e]*$/.test(valeur)
    ? valeur
    : `=?UTF-8?B?${Buffer.from(valeur, 'utf8').toString('base64')}?=`
}

/** « Nom <adresse> » : seul le nom est encodé, l'adresse doit rester lisible. */
function adresse(valeur: string): string {
  const m = valeur.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  if (!m) return valeur.trim()
  const nom = m[1].replace(/^"|"$/g, '')
  return nom ? `${entete(nom)} <${m[2]}>` : `<${m[2]}>`
}

function base64Lignes(contenu: Buffer): string {
  return contenu.toString('base64').replace(/.{1,76}/g, '$&\r\n').trimEnd()
}

function construireMime(entree: Courriel, expediteur: string | null): string {
  const mixte = `mixte_${crypto.randomUUID()}`
  const variante = `variante_${crypto.randomUUID()}`
  const CRLF = '\r\n'

  const enTetes = [
    expediteur ? `From: ${adresse(expediteur)}` : null,
    `To: ${entree.destinataire}`,
    entree.repondreA ? `Reply-To: ${entree.repondreA}` : null,
    `Subject: ${entete(entree.objet)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixte}"`,
  ].filter(Boolean)

  const parties = [
    `--${mixte}`,
    `Content-Type: multipart/alternative; boundary="${variante}"`,
    '',
    `--${variante}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lignes(Buffer.from(entree.texte, 'utf8')),
    `--${variante}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lignes(Buffer.from(entree.html, 'utf8')),
    `--${variante}--`,
  ]

  if (entree.pieceJointe) {
    const nom = entree.pieceJointe.nom.replace(/"/g, '')
    parties.push(
      `--${mixte}`,
      `Content-Type: ${entree.pieceJointe.type}; name="${nom}"`,
      `Content-Disposition: attachment; filename="${nom}"`,
      'Content-Transfer-Encoding: base64',
      '',
      base64Lignes(entree.pieceJointe.contenu),
    )
  }
  parties.push(`--${mixte}--`)

  return [...enTetes, '', ...parties, ''].join(CRLF)
}

// ---------------------------------------------------------------------------
// Resend
// ---------------------------------------------------------------------------

async function parResend(entree: Courriel): Promise<ResultatEnvoi> {
  const reponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.COURRIEL_EXPEDITEUR,
      to: [entree.destinataire],
      subject: entree.objet,
      html: entree.html,
      text: entree.texte,
      ...(entree.repondreA ? { reply_to: entree.repondreA } : {}),
      ...(entree.pieceJointe
        ? {
            attachments: [
              {
                filename: entree.pieceJointe.nom,
                content: entree.pieceJointe.contenu.toString('base64'),
              },
            ],
          }
        : {}),
    }),
  })
  const corps = (await reponse.json().catch(() => ({}))) as { id?: string; message?: string }
  if (!reponse.ok) {
    return { statut: 'echec', reference: null, erreur: corps.message ?? `HTTP ${reponse.status}` }
  }
  return { statut: 'envoye', reference: corps.id ?? null, erreur: null }
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

async function simuler(entree: Courriel): Promise<ResultatEnvoi> {
  const dossier = path.join(process.cwd(), 'courriels-locaux')
  await mkdir(dossier, { recursive: true })
  const base = `${Date.now()}-${entree.destinataire.replace(/[^a-z0-9]/gi, '_')}`
  await writeFile(
    path.join(dossier, `${base}.html`),
    `<!-- À : ${entree.destinataire}\n     Objet : ${entree.objet} -->\n${entree.html}`,
  )
  if (entree.pieceJointe) {
    await writeFile(path.join(dossier, `${base}-${entree.pieceJointe.nom}`), entree.pieceJointe.contenu)
  }
  return { statut: 'simule', reference: `${base}.html`, erreur: null }
}

/** Échappe le texte inséré dans le HTML du courriel. */
export function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
