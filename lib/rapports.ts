import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import { echapper, envoyerCourriel } from '@/lib/courriel'
import { emetteur } from '@/lib/requetes/ventes'
import { dossier as lireDossier } from '@/lib/requetes/dossiers'
import { urlStats } from '@/lib/lien-stats'
import { resumeAvisMois } from '@/lib/avis-google'
import { cleAvis } from '@/lib/avis-manuels'

/**
 * Le rapport mensuel d'un dossier : un courriel le 1er du mois, qui résume le
 * mois écoulé et renvoie vers la page de statistiques du client.
 *
 * Envoi déclenché par le réveil (/api/eveil, toutes les 10 min) — rien à
 * planifier ailleurs. Une ligne de `rapports_mensuels` est posée AVANT
 * l'envoi : deux réveils simultanés, ou un clic sur « Envoyer » pendant le
 * réveil, ne peuvent pas envoyer deux fois le même mois.
 *
 * Aucun courriel ne part si le dossier ne l'a pas demandé (rapport_mensuel).
 */
const FUSEAU = 'America/Toronto'
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export function nomMois(mois: string): string {
  const [a, m] = mois.split('-').map(Number)
  return `${MOIS[m - 1]} ${a}`
}

/** « 2026-10-01 » pour le mois précédant la date donnée (heure du Québec). */
export async function moisPrecedent(): Promise<string> {
  const l = await requeteUne<{ mois: string }>(
    `select to_char(date_trunc('month', (now() at time zone $1)::date) - interval '1 month', 'YYYY-MM-DD') as mois`,
    [FUSEAU],
  )
  return l!.mois
}

export type DonneesRapport = {
  dossier: { id: string; nom: string; version_lien: number; lien_actif: boolean }
  mois: string
  taps: number
  taps_precedent: number
  meilleur_jour: { jour: string; taps: number } | null
  par_jour: { jour: string; taps: number }[]
  cartes: { libelle: string; taps: number }[]
  avis: { gagnes: number | null; total: number | null; note: number | null }
}

export async function donneesRapport(dossierId: string, mois: string): Promise<DonneesRapport | null> {
  const d = await lireDossier(dossierId)
  if (!d || !/^\d{4}-\d{2}-01$/.test(mois)) return null

  const [totaux, parJour, cartes, places] = await Promise.all([
    requeteUne<{ taps: number; taps_precedent: number }>(
      `select count(*) filter (where (t.tape_le at time zone $3)::date >= $2::date
                                 and (t.tape_le at time zone $3)::date <  $2::date + interval '1 month')::int as taps,
              count(*) filter (where (t.tape_le at time zone $3)::date >= $2::date - interval '1 month'
                                 and (t.tape_le at time zone $3)::date <  $2::date)::int as taps_precedent
         from taps t join cartes_nfc c on c.id = t.carte_id
        where c.dossier_id = $1::uuid`,
      [dossierId, mois, FUSEAU],
    ),
    requete<{ jour: string; taps: number }>(
      `select to_char(j, 'YYYY-MM-DD') as jour,
              (select count(*)::int from taps t join cartes_nfc c on c.id = t.carte_id
                where c.dossier_id = $1::uuid and (t.tape_le at time zone $3)::date = j) as taps
         from generate_series($2::date, ($2::date + interval '1 month' - interval '1 day')::date, interval '1 day') j
        order by j`,
      [dossierId, mois, FUSEAU],
    ),
    requete<{ libelle: string; taps: number }>(
      `select c.libelle,
              count(t.id) filter (where (t.tape_le at time zone $3)::date >= $2::date
                                    and (t.tape_le at time zone $3)::date <  $2::date + interval '1 month')::int as taps
         from cartes_nfc c left join taps t on t.carte_id = c.id
        where c.dossier_id = $1::uuid
        group by c.id, c.libelle
        order by taps desc, c.libelle
        limit 12`,
      [dossierId, mois, FUSEAU],
    ),
    requete<{ place_id: string }>(
      `select distinct place_id from cartes_nfc where dossier_id = $1::uuid and place_id is not null`,
      [dossierId],
    ),
  ])
  const meilleur = parJour.reduce<{ jour: string; taps: number } | null>(
    (a, b) => (b.taps > (a?.taps ?? 0) ? b : a),
    null,
  )
  return {
    dossier: { id: d.id, nom: d.nom, version_lien: d.version_lien, lien_actif: d.lien_actif },
    mois,
    taps: totaux?.taps ?? 0,
    taps_precedent: totaux?.taps_precedent ?? 0,
    meilleur_jour: meilleur,
    par_jour: parJour,
    cartes,
    avis: await resumeAvisMois([...places.map((p) => p.place_id), cleAvis({ type: 'dossier', id: dossierId })], mois),
  }
}

function jourLong(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j)).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

const n = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/** Le courriel : HTML en tableaux et styles en ligne — ce que lisent Gmail et Outlook. */
export async function courrielRapport(r: DonneesRapport, baseRepli: string) {
  const societe = await emetteur()
  const lien = r.dossier.lien_actif ? urlStats(r.dossier.id, r.dossier.version_lien, baseRepli) : null
  const mois = nomMois(r.mois)
  const ecart = r.taps_precedent > 0 ? Math.round(((r.taps - r.taps_precedent) / r.taps_precedent) * 100) : null
  const evolution =
    ecart === null ? '' : ecart === 0 ? 'stable par rapport au mois précédent' : `${ecart > 0 ? '+' : '−'}${Math.abs(ecart)} % par rapport au mois précédent`
  const objet = `${r.dossier.nom} — vos cartes en ${mois} : ${n(r.taps)} tap${r.taps > 1 ? 's' : ''}`

  const max = Math.max(1, ...r.par_jour.map((p) => p.taps))
  const barres = r.par_jour
    .map(
      (p) =>
        `<td valign="bottom" style="padding:0 1px"><div title="${echapper(jourLong(p.jour))} : ${p.taps}" style="width:6px;height:${Math.max(
          p.taps ? 3 : 1,
          Math.round((p.taps / max) * 60),
        )}px;background:${p.taps ? '#2a78d6' : '#e4e7ec'};border-radius:2px 2px 0 0"></div></td>`,
    )
    .join('')

  const lignesCartes = r.cartes
    .map(
      (c) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #eceef2">${echapper(c.libelle)}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #eceef2;font-weight:600">${n(c.taps)}</td></tr>`,
    )
    .join('')

  const avis =
    r.avis.total !== null
      ? `<tr><td style="padding:14px 0 0;font-size:15px">⭐ <strong>${r.avis.gagnes !== null && r.avis.gagnes > 0 ? `+${n(r.avis.gagnes)} avis Google` : 'Avis Google'}</strong> ce mois-ci — ${n(r.avis.total)} au total${
          r.avis.note !== null ? `, note ${String(r.avis.note).replace('.', ',')} / 5` : ''
        }.</td></tr>`
      : ''

  const contact = societe.courriel_contact ? `Une question ? Écrivez-nous à ${echapper(societe.courriel_contact)}.` : ''

  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f7f8fa">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e7ec;border-radius:12px;padding:28px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#16181d">
<tr><td style="font-size:13px;color:#5b6472">${echapper(societe.nom_entreprise)} · rapport de ${mois}</td></tr>
<tr><td style="padding-top:6px;font-size:20px;font-weight:700">${echapper(r.dossier.nom)}</td></tr>
<tr><td style="padding-top:20px;font-size:13px;color:#5b6472">Taps sur vos cartes en ${mois}</td></tr>
<tr><td style="font-size:44px;font-weight:700;letter-spacing:-1px;line-height:1.1">${n(r.taps)}</td></tr>
${evolution ? `<tr><td style="font-size:14px;color:${ecart! > 0 ? '#0f7b52' : ecart! < 0 ? '#b42318' : '#5b6472'}">${ecart! > 0 ? '▲' : ecart! < 0 ? '▼' : '='} ${evolution}</td></tr>` : ''}
<tr><td style="padding-top:18px"><table role="presentation" cellpadding="0" cellspacing="0" style="height:62px"><tr>${barres}</tr></table>
<div style="font-size:11px;color:#5b6472;padding-top:4px">Taps par jour, du 1er au ${r.par_jour.length} ${MOIS[Number(r.mois.slice(5, 7)) - 1]}</div></td></tr>
${r.meilleur_jour && r.meilleur_jour.taps > 0 ? `<tr><td style="padding-top:14px;font-size:15px">📈 Meilleure journée : <strong>${jourLong(r.meilleur_jour.jour)}</strong> (${n(r.meilleur_jour.taps)} taps).</td></tr>` : ''}
${avis}
${r.cartes.length > 1 ? `<tr><td style="padding-top:20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px"><tr><td style="font-size:12px;color:#5b6472;padding-bottom:4px">Carte</td><td align="right" style="font-size:12px;color:#5b6472;padding-bottom:4px">Taps</td></tr>${lignesCartes}</table></td></tr>` : ''}
${lien ? `<tr><td style="padding-top:24px"><a href="${lien}" style="display:inline-block;background:#16181d;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px">Voir toutes vos statistiques</a></td></tr>` : ''}
<tr><td style="padding-top:24px;font-size:12px;line-height:1.5;color:#5b6472">${contact} Vous recevez ce rapport parce que vos cartes Tapora sont suivies par notre équipe.${lien ? ' Pour ne plus le recevoir, utilisez le bouton au bas de votre page de statistiques.' : ' Pour ne plus le recevoir, répondez simplement « stop ».'}</td></tr>
</table></td></tr></table></body></html>`

  const texte = [
    `${r.dossier.nom} — rapport de ${mois}`,
    '',
    `Taps sur vos cartes : ${n(r.taps)}${evolution ? ` (${evolution})` : ''}`,
    r.meilleur_jour && r.meilleur_jour.taps > 0 ? `Meilleure journée : ${jourLong(r.meilleur_jour.jour)} (${n(r.meilleur_jour.taps)} taps)` : '',
    r.avis.total !== null ? `Avis Google : ${r.avis.gagnes !== null && r.avis.gagnes > 0 ? `+${n(r.avis.gagnes)} ce mois-ci, ` : ''}${n(r.avis.total)} au total` : '',
    '',
    ...r.cartes.map((c) => `  ${c.libelle} : ${n(c.taps)}`),
    '',
    lien ? `Toutes vos statistiques : ${lien}` : '',
    '',
    contact,
    `— ${societe.nom_entreprise}`,
  ]
    .filter((l, i, t) => l !== '' || t[i - 1] !== '')
    .join('\n')

  return { objet, html, texte, repondreA: societe.courriel_contact }
}

async function destinataire(dossierId: string): Promise<string | null> {
  const l = await requeteUne<{ courriel: string | null }>(
    `select coalesce(d.courriel_rapport, cl.courriel) as courriel
       from dossiers_cartes d left join clients cl on cl.id = d.client_id
      where d.id = $1::uuid`,
    [dossierId],
  )
  const c = l?.courriel?.trim()
  return c && /^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$/i.test(c) ? c : null
}

export type ResultatRapport = { statut: 'envoye' | 'simule' | 'echec' | 'deja' | 'sans_courriel'; erreur: string | null }

/**
 * Envoie le rapport d'un mois. `forcer` renvoie même si le mois a déjà été
 * envoyé (bouton « Renvoyer » de l'écran du dossier).
 */
export async function envoyerRapport(dossierId: string, mois: string, baseRepli: string, forcer = false): Promise<ResultatRapport> {
  const a = await destinataire(dossierId)
  if (!a) return { statut: 'sans_courriel', erreur: 'Aucun courriel pour ce dossier.' }

  // Le verrou : la ligne est posée avant l'envoi, dans un seul ordre SQL.
  const verrou = await requeteUne<{ ok: number }>(
    forcer
      ? `insert into rapports_mensuels (dossier_id, mois, statut, destinataire)
         values ($1::uuid, $2::date, 'en_cours', $3)
         on conflict (dossier_id, mois) do update set statut = 'en_cours', destinataire = $3, erreur = null, cree_le = now()
          where rapports_mensuels.statut <> 'en_cours' or rapports_mensuels.cree_le < now() - interval '10 minutes'
         returning 1 as ok`
      : `insert into rapports_mensuels (dossier_id, mois, statut, destinataire)
         values ($1::uuid, $2::date, 'en_cours', $3)
         on conflict (dossier_id, mois) do nothing
         returning 1 as ok`,
    [dossierId, mois, a],
  )
  if (!verrou) return { statut: 'deja', erreur: null }

  try {
    const donnees = await donneesRapport(dossierId, mois)
    if (!donnees) throw new Error('Dossier introuvable.')
    const c = await courrielRapport(donnees, baseRepli)
    const r = await envoyerCourriel({ destinataire: a, objet: c.objet, html: c.html, texte: c.texte, repondreA: c.repondreA })
    await requete(
      `update rapports_mensuels set statut = $3, erreur = $4 where dossier_id = $1::uuid and mois = $2::date`,
      [dossierId, mois, r.statut, r.erreur],
    )
    return { statut: r.statut, erreur: r.erreur }
  } catch (e) {
    const erreur = e instanceof Error ? e.message : 'Envoi impossible.'
    await requete(
      `update rapports_mensuels set statut = 'echec', erreur = $3 where dossier_id = $1::uuid and mois = $2::date`,
      [dossierId, mois, erreur],
    )
    return { statut: 'echec', erreur }
  }
}

export async function historiqueRapports(dossierId: string) {
  return requete<{ mois: string; statut: string; destinataire: string | null; erreur: string | null; cree_le: string }>(
    `select to_char(mois, 'YYYY-MM-DD') as mois, statut, destinataire, erreur, cree_le
       from rapports_mensuels where dossier_id = $1::uuid order by mois desc limit 12`,
    [dossierId],
  )
}

const globale = globalThis as typeof globalThis & { __rapports?: number }

/**
 * Plafond d'envois de rapports par jour. Le forfait gratuit de Resend
 * permet 100 courriels par jour, tous envois confondus : on en garde une
 * marge pour les factures, documents et demandes de cartes. Avec plus de
 * dossiers que le plafond, les rapports s'étalent sur les jours suivants.
 */
const RAPPORTS_PAR_JOUR = Math.max(1, Number(process.env.RAPPORTS_PAR_JOUR) || 60)

/**
 * Appelé à chaque réveil. À partir du 1er du mois, de 9 h à 19 h (heure du
 * Québec), envoie le rapport du mois écoulé aux dossiers qui l'ont demandé et
 * ne l'ont pas encore reçu, sans dépasser le plafond du jour. Vérifie au plus
 * toutes les 30 minutes.
 */
export async function envoyerRapportsDus(baseRepli: string): Promise<void> {
  const maintenant = Date.now()
  if (globale.__rapports && maintenant - globale.__rapports < 30 * 60 * 1000) return
  globale.__rapports = maintenant

  const ici = await requeteUne<{ h: number; deja: number }>(
    `select extract(hour from now() at time zone $1)::int as h,
            (select count(*)::int from rapports_mensuels
              where (cree_le at time zone $1)::date = (now() at time zone $1)::date) as deja`,
    [FUSEAU],
  )
  if (!ici || ici.h < 9 || ici.h >= 19) return
  const restant = RAPPORTS_PAR_JOUR - ici.deja
  if (restant <= 0) return

  const mois = await moisPrecedent()
  const dus = await requete<{ id: string }>(
    `select d.id from dossiers_cartes d
      where d.rapport_mensuel
        and d.cree_le < $1::date + interval '1 month'
        and exists (select 1 from cartes_nfc c where c.dossier_id = d.id)
        and not exists (select 1 from rapports_mensuels r where r.dossier_id = d.id and r.mois = $1::date)
      order by d.cree_le
      limit $2`,
    [mois, Math.min(25, restant)],
  )
  for (const d of dus) {
    await envoyerRapport(d.id, mois, baseRepli).catch(() => {})
  }
}
