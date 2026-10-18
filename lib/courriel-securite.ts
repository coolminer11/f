import 'server-only'
import { echapper, envoyerCourriel } from '@/lib/courriel'
import { emetteur } from '@/lib/requetes/ventes'
import type { Contexte } from '@/lib/securite'

/**
 * Les courriels de sécurité : nouvelle connexion, essais bloqués, double
 * authentification désactivée. Même papier crème que les autres courriels
 * Tapora, mais un message court et un seul bouton : « Ce n'était pas moi ».
 */

type Ligne = [string, string]

function quand(): string {
  return new Date().toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Toronto' })
}

async function gabarit(e: {
  surtitre: string
  titre: string
  intro: string
  lignes: Ligne[]
  conseil: string
  bouton?: { texte: string; url: string }
  sousBouton?: string
}) {
  const societe = await emetteur()
  const lignes = e.lignes
    .map(
      ([k, v]) =>
        `<tr><td style="padding:7px 0;font-size:13px;color:#6b5d50;width:120px;vertical-align:top">${echapper(k)}</td><td style="padding:7px 0;font-size:14px;color:#2a211a;font-weight:600">${echapper(v)}</td></tr>`,
    )
    .join('')
  const bouton = e.bouton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 10px"><tr><td style="background:#c2552f;border-radius:999px">
        <a href="${echapper(e.bouton.url)}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:700;color:#fffaf2;text-decoration:none">${echapper(e.bouton.texte)}</a>
       </td></tr></table>${e.sousBouton ? `<p style="margin:0;font-size:12px;line-height:1.5;color:#6b5d50">${echapper(e.sousBouton)}</p>` : ''}`
    : ''
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f7f1e7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f1e7;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<tr><td style="padding:0 4px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:34px;height:34px"><img src="https://taporacards.com/apple-touch-icon.png" width="34" height="34" alt="" style="display:block;border-radius:50%"></td>
    <td style="padding-left:10px;font-family:Georgia,serif;font-size:20px;font-weight:600;color:#2a211a">Tapora</td>
  </tr></table>
</td></tr>
<tr><td style="background:#fffaf2;border-radius:20px;padding:28px 26px;box-shadow:0 18px 40px -26px rgba(60,40,20,.45)">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#c2552f;font-weight:700">${echapper(e.surtitre)}</p>
  <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;line-height:1.25;color:#2a211a">${echapper(e.titre)}</p>
  <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#2a211a">${echapper(e.intro)}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #eadfcd;border-bottom:1px solid #eadfcd;margin:6px 0 14px">${lignes}</table>
  <p style="margin:0;font-size:14px;line-height:1.6;color:#2a211a">${echapper(e.conseil)}</p>
  ${bouton}
</td></tr>
<tr><td style="padding:18px 6px 0;font-size:12px;line-height:1.5;color:#6b5d50;text-align:center">Courriel de sécurité automatique · ${echapper(societe.nom_entreprise)}</td></tr>
</table></td></tr></table></body></html>`
  const texte = [
    e.titre,
    '',
    e.intro,
    '',
    ...e.lignes.map(([k, v]) => `${k} : ${v}`),
    '',
    e.conseil,
    ...(e.bouton ? ['', `${e.bouton.texte} : ${e.bouton.url}`] : []),
  ].join('\n')
  return { html, texte }
}

const lignesContexte = (ctx: Contexte): Ligne[] => [
  ['Quand', quand()],
  ['Appareil', ctx.appareil],
  ['Réseau', ctx.ipMasquee ?? 'inconnu'],
]

export async function courrielNouvelleConnexion(u: { courriel: string; nom: string }, ctx: Contexte, lienPasMoi: string) {
  const c = await gabarit({
    surtitre: 'Nouvelle connexion',
    titre: `${u.nom.split(' ')[0]}, quelqu’un vient d’ouvrir votre back-office`,
    intro: 'Une connexion à votre compte Tapora vient d’avoir lieu depuis un appareil ou un réseau que nous ne connaissions pas.',
    lignes: lignesContexte(ctx),
    conseil: 'C’était vous ? Il n’y a rien à faire. Sinon, cliquez ci-dessous : toutes les sessions seront fermées et vous choisirez un nouveau mot de passe.',
    bouton: { texte: 'Ce n’était pas moi', url: lienPasMoi },
    sousBouton: 'Le lien est valable 24 heures et ne sert qu’une fois.',
  })
  return envoyerCourriel({ destinataire: u.courriel, objet: 'Nouvelle connexion à votre back-office Tapora', ...c })
}

export async function courrielEssaisBloques(u: { courriel: string; nom: string }, ctx: Contexte, lienPasMoi: string, motDePasseConnu = false) {
  const c = await gabarit({
    surtitre: 'Alerte de sécurité',
    titre: motDePasseConnu ? 'Votre mot de passe a été saisi, mais pas le bon code' : 'Plusieurs essais de connexion ont échoué',
    intro: motDePasseConnu
      ? 'Quelqu’un a entré le bon mot de passe de votre compte, puis plusieurs codes de double authentification erronés. La double authentification l’a arrêté, et ces essais sont maintenant bloqués.'
      : 'Quelqu’un a essayé plusieurs mots de passe sur votre compte. Nous avons bloqué ces essais pour un moment.',
    lignes: lignesContexte(ctx),
    conseil: motDePasseConnu
      ? 'Si ce n’était pas vous, votre mot de passe est connu de quelqu’un d’autre : changez-le tout de suite avec le bouton ci-dessous.'
      : 'Si c’était vous, attendez quelques minutes et réessayez. Sinon, votre mot de passe tient bon — mais si vous pensez qu’il a pu être vu ou réutilisé ailleurs, changez-le maintenant.',
    bouton: { texte: 'Sécuriser mon compte', url: lienPasMoi },
    sousBouton: 'Le lien est valable 24 heures et ne sert qu’une fois.',
  })
  return envoyerCourriel({ destinataire: u.courriel, objet: 'Alerte : essais de connexion bloqués sur votre compte Tapora', ...c })
}

export async function courrielDoubleAuth(u: { courriel: string; nom: string }, ctx: Contexte, activee: boolean) {
  const c = await gabarit({
    surtitre: 'Double authentification',
    titre: activee ? 'La double authentification est activée' : 'La double authentification a été désactivée',
    intro: activee
      ? 'Bravo : un code de votre téléphone sera maintenant demandé à chaque connexion. Gardez vos codes de secours en lieu sûr.'
      : 'Votre compte ne demande plus de code à la connexion. Seul votre mot de passe le protège maintenant.',
    lignes: lignesContexte(ctx),
    conseil: activee
      ? 'Ce n’était pas vous ? Changez votre mot de passe et prévenez votre associé.'
      : 'Ce n’était pas vous ? Connectez-vous, changez votre mot de passe et réactivez la double authentification, ou demandez à votre associé de désactiver votre compte.',
  })
  return envoyerCourriel({
    destinataire: u.courriel,
    objet: activee ? 'Double authentification activée — Tapora' : 'Double authentification désactivée — Tapora',
    ...c,
  })
}
