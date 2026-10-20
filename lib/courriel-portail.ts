import 'server-only'
import { echapper } from '@/lib/courriel'
import { emetteur } from '@/lib/requetes/ventes'

/**
 * Les courriels du portail, aux couleurs de la page client : au client
 * (réponse de Tapora, maquette prête, lien d'accès) et à Tapora (nouveau
 * message, demande Entreprise, maquette approuvée). Tableaux et styles en
 * ligne : ce que lisent Gmail et Outlook. Tout texte venu d'ailleurs est
 * échappé.
 */
export async function courrielClient(e: {
  langue: 'fr' | 'en'
  surtitre: string
  titre: string
  paragraphes: string[]
  citation?: string | null
  bouton: { texte: string; lien: string }
}) {
  const societe = await emetteur()
  const fr = e.langue === 'fr'
  const lien = echapper(e.bouton.lien)
  const corps = e.paragraphes.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2a211a">${echapper(p)}</p>`).join('')
  const citation = e.citation
    ? `<div style="margin:4px 0 18px;padding:14px 16px;border-left:3px solid #c2552f;background:#f7f1e7;border-radius:0 12px 12px 0;font-size:15px;line-height:1.6;color:#2a211a">${echapper(e.citation).replace(/\n/g, '<br>')}</div>`
    : ''
  const pied = `${echapper(societe.nom_entreprise)} · ${fr ? 'entreprise québécoise' : 'a Québec business'}${societe.courriel_contact ? ` · ${echapper(societe.courriel_contact)}` : ''}`

  const html = `<!doctype html><html lang="${fr ? 'fr' : 'en'}"><body style="margin:0;padding:0;background:#f7f1e7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f1e7;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<tr><td style="padding:0 4px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:34px;height:34px"><img src="https://taporacards.com/apple-touch-icon.png" width="34" height="34" alt="" style="display:block;border-radius:50%"></td>
    <td style="padding-left:10px;font-family:Georgia,serif;font-size:20px;font-weight:600;color:#2a211a">Tapora</td>
  </tr></table>
</td></tr>
<tr><td style="background:#fffaf2;border-radius:20px;padding:30px 28px;box-shadow:0 18px 40px -26px rgba(60,40,20,.45)">
  <p style="margin:0 0 4px;font-size:13px;color:#6b5d50">${echapper(e.surtitre)}</p>
  <p style="margin:0 0 22px;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#2a211a">${echapper(e.titre)}</p>
  ${corps}${citation}
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 18px"><tr><td style="background:#c2552f;border-radius:999px">
    <a href="${lien}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#fffaf2;text-decoration:none">${echapper(e.bouton.texte)} →</a>
  </td></tr></table>
  <p style="margin:0;font-size:12px;line-height:1.5;color:#6b5d50">${fr ? 'Le bouton ne fonctionne pas ? Copiez cette adresse :' : 'Button not working? Copy this address:'}<br><a href="${lien}" style="color:#c2552f;word-break:break-all">${lien}</a></p>
</td></tr>
<tr><td style="padding:18px 6px 0;font-size:12px;line-height:1.5;color:#6b5d50;text-align:center">${pied}</td></tr>
</table></td></tr></table></body></html>`

  const texte = [...e.paragraphes, e.citation ? `« ${e.citation} »` : null, `${e.bouton.texte} : ${e.bouton.lien}`, `— ${societe.nom_entreprise}`]
    .filter(Boolean)
    .join('\n\n')
  return { html, texte, repondreA: societe.courriel_contact }
}

/** Pour Tapora : un en-tête, quelques lignes « libellé : valeur », la citation, un bouton. */
export function courrielInterne(e: { titre: string; lignes: [string, string | null | undefined][]; citation?: string | null; lien: string; bouton: string }) {
  const lignes = e.lignes
    .filter(([, v]) => v)
    .map(([l, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#6b5d50;white-space:nowrap">${echapper(l)}</td><td style="padding:3px 0;color:#2a211a">${echapper(String(v))}</td></tr>`)
    .join('')
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;color:#2a211a">
<p style="font-size:17px;font-weight:700;margin:0 0 12px">${echapper(e.titre)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 12px">${lignes}</table>
${e.citation ? `<blockquote style="border-left:3px solid #c2552f;margin:0 0 14px;padding:6px 12px;color:#2a211a;background:#f7f1e7">${echapper(e.citation).replace(/\n/g, '<br>')}</blockquote>` : ''}
<p><a href="${echapper(e.lien)}" style="display:inline-block;background:#c2552f;color:#fffaf2;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">${echapper(e.bouton)} →</a></p>
</div>`
  const texte = [e.titre, ...e.lignes.filter(([, v]) => v).map(([l, v]) => `${l} : ${v}`), e.citation ? `« ${e.citation} »` : null, e.lien].filter(Boolean).join('\n')
  return { html, texte }
}
