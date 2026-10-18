import 'server-only'
import { requete } from '@/lib/db'
import { echapper } from '@/lib/courriel'
import { emetteur } from '@/lib/requetes/ventes'
import { BOUTON } from '@/lib/modeles-lien'

/**
 * Le courriel qui porte le lien privé, aux couleurs de la page client (papier
 * crème, terre cuite). Le message écrit dans l'app devient des paragraphes ;
 * le lien est ajouté en bouton, puis en clair pour les messageries qui
 * bloquent les boutons. Tableaux et styles en ligne : ce que lisent Gmail et
 * Outlook.
 */
export async function courrielLien(e: { commerce: string; lien: string; message: string; langue: 'fr' | 'en' }) {
  const societe = await emetteur()
  const fr = e.langue === 'fr'
  const paragraphes = e.message
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2a211a">${echapper(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
  const pied = fr
    ? `${echapper(societe.nom_entreprise)} · entreprise québécoise${societe.courriel_contact ? ` · ${echapper(societe.courriel_contact)}` : ''}`
    : `${echapper(societe.nom_entreprise)} · a Québec business${societe.courriel_contact ? ` · ${echapper(societe.courriel_contact)}` : ''}`
  const lien = echapper(e.lien)

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
  <p style="margin:0 0 4px;font-size:13px;color:#6b5d50">${fr ? 'Votre page privée' : 'Your private page'}</p>
  <p style="margin:0 0 22px;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#2a211a">${echapper(e.commerce)}</p>
  ${paragraphes}
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 18px"><tr><td style="background:#c2552f;border-radius:999px">
    <a href="${lien}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#fffaf2;text-decoration:none">${BOUTON[e.langue]} →</a>
  </td></tr></table>
  <p style="margin:0;font-size:12px;line-height:1.5;color:#6b5d50">${fr ? 'Le bouton ne fonctionne pas ? Copiez cette adresse :' : 'Button not working? Copy this address:'}<br><a href="${lien}" style="color:#c2552f;word-break:break-all">${lien}</a></p>
</td></tr>
<tr><td style="padding:18px 6px 0;font-size:12px;line-height:1.5;color:#6b5d50;text-align:center">${pied}</td></tr>
</table></td></tr></table></body></html>`

  const texte = `${e.message.trim()}\n\n${BOUTON[e.langue]} : ${e.lien}\n\n— ${societe.nom_entreprise}`
  return { html, texte, repondreA: societe.courriel_contact }
}

export async function noterEnvoiLien(e: {
  dossierId: string
  destinataire: string
  modele: string
  langue: 'fr' | 'en'
  statut: 'envoye' | 'simule' | 'echec'
  erreur: string | null
  par: string
}) {
  await requete(
    `insert into envois_liens (dossier_id, destinataire, modele, langue, statut, erreur, envoye_par)
     values ($1::uuid, $2, $3, $4, $5, $6, $7::uuid)`,
    [e.dossierId, e.destinataire, e.modele, e.langue, e.statut, e.erreur?.slice(0, 500) ?? null, e.par],
  )
}

export async function historiqueEnvoisLien(dossierId: string) {
  return requete<{ id: string; destinataire: string; modele: string; langue: string; statut: string; erreur: string | null; cree_le: string }>(
    `select id, destinataire, modele, langue, statut, erreur, cree_le
       from envois_liens where dossier_id = $1::uuid order by cree_le desc limit 5`,
    [dossierId],
  )
}
