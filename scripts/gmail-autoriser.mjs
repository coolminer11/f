#!/usr/bin/env node
/**
 * Autorise l'application à envoyer des courriels depuis le compte Gmail de la
 * société. À faire UNE fois, depuis un Mac, avec un navigateur.
 *
 *   npm run gmail:autoriser -- <CLIENT_ID> <CLIENT_SECRET>
 *
 * Le script ouvre la page de consentement de Google, attend la réponse sur
 * une adresse locale (127.0.0.1), échange le code contre un jeton de
 * rafraîchissement, et affiche les quatre valeurs à coller chez l'hébergeur.
 *
 * Seule la permission « envoyer des courriels » est demandée (gmail.send) :
 * l'application ne peut ni lire la boîte, ni supprimer, ni voir les contacts.
 */
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'

const [clientId, clientSecret] = process.argv.slice(2)
if (!clientId || !clientSecret) {
  console.error(
    [
      '',
      '  Il manque les identifiants Google.',
      '',
      '    npm run gmail:autoriser -- <CLIENT_ID> <CLIENT_SECRET>',
      '',
      '  Ils se trouvent dans Google Cloud → API et services → Identifiants,',
      '  sur le client OAuth de type « Application de bureau ». DEPLOIEMENT.md',
      '  explique comment le créer.',
      '',
    ].join('\n'),
  )
  process.exit(1)
}

const PORTEE = 'https://www.googleapis.com/auth/gmail.send'

const serveur = createServer()
await new Promise((resolve) => serveur.listen(0, '127.0.0.1', resolve))
const { port } = serveur.address()
const retour = `http://127.0.0.1:${port}`

const adresse =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: retour,
    response_type: 'code',
    scope: PORTEE,
    // « offline » et « consent » : sans les deux, Google ne renvoie pas de
    // jeton de rafraîchissement, et l'autorisation meurt au bout d'une heure.
    access_type: 'offline',
    prompt: 'consent',
  })

console.log(
  [
    '',
    '  Votre navigateur va s’ouvrir sur la page de Google.',
    '  Choisissez le compte Gmail de la société, puis acceptez.',
    '',
    '  Si Google affiche « Google n’a pas validé cette application » :',
    '  « Paramètres avancés » → « Accéder à … (non sécurisé) ». C’est votre',
    '  propre application ; Google le dit de toute application non publiée.',
    '',
    '  Si rien ne s’ouvre, copiez cette adresse dans votre navigateur :',
    `  ${adresse}`,
    '',
  ].join('\n'),
)
spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [adresse], {
  stdio: 'ignore',
  detached: true,
}).on('error', () => {})

const code = await new Promise((resolve, rejeter) => {
  serveur.on('request', (requete, reponse) => {
    const u = new URL(requete.url, retour)
    const erreur = u.searchParams.get('error')
    const valeur = u.searchParams.get('code')
    if (!valeur && !erreur) {
      reponse.writeHead(404).end()
      return
    }
    reponse.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    reponse.end(
      erreur
        ? `<p style="font:16px sans-serif">Autorisation refusée (${erreur}). Vous pouvez fermer cet onglet.</p>`
        : '<p style="font:16px sans-serif">C’est fait. Retournez au Terminal ; vous pouvez fermer cet onglet.</p>',
    )
    serveur.close()
    erreur ? rejeter(new Error(`Google a répondu : ${erreur}`)) : resolve(valeur)
  })
})

const reponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: retour,
    grant_type: 'authorization_code',
  }),
})
const jetons = await reponse.json()
if (!reponse.ok || !jetons.refresh_token) {
  console.error('\n  Échange refusé par Google :', jetons.error_description ?? jetons.error ?? reponse.status)
  process.exit(1)
}

// L'adresse du compte, pour remplir GMAIL_EXPEDITEUR sans se tromper.
let compte = null
try {
  const profil = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${jetons.access_token}` },
  })
  if (profil.ok) compte = (await profil.json()).emailAddress ?? null
} catch {}

console.log(
  [
    '',
    '  Autorisation obtenue. Ajoutez ces quatre variables chez l’hébergeur',
    '  (Render → votre service → Environment), puis « Save, rebuild, and deploy » :',
    '',
    `    GMAIL_CLIENT_ID       ${clientId}`,
    `    GMAIL_CLIENT_SECRET   ${clientSecret}`,
    `    GMAIL_REFRESH_TOKEN   ${jetons.refresh_token}`,
    `    GMAIL_EXPEDITEUR      Tapora S.E.N.C. <${compte ?? 'votre-adresse@gmail.com'}>`,
    '',
    '  Ces valeurs permettent d’envoyer des courriels en votre nom : ne les',
    '  collez nulle part ailleurs, et jamais dans le dépôt.',
    '',
  ].join('\n'),
)
