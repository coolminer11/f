import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import { echapper, envoyerCourriel } from '@/lib/courriel'
import { emetteur } from '@/lib/requetes/ventes'
import { lireEtablissement } from '@/lib/services/donnees'
import { urlPortail } from '@/lib/services/acces'
import { nomLangue } from '@/lib/services/langues'

/**
 * Le rapport mensuel de Tapora Services : le 1er du mois, un courriel au
 * contact de chaque établissement résume le mois écoulé — visites, demandes,
 * temps de réponse, avis, plats les plus regardés, heures de pointe.
 *
 * Même mécanique que le rapport des cartes (lib/rapports.ts) : déclenché par
 * le réveil, une ligne de `rapports_service` posée AVANT l'envoi (jamais deux
 * fois le même mois), de 9 h à 19 h, avec un plafond par jour.
 */
const RAPPORTS_PAR_JOUR = Math.max(1, Number(process.env.RAPPORTS_SERVICES_PAR_JOUR) || 25)

type Langue = 'fr' | 'en'
const MOIS: Record<Langue, string[]> = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}
const JOURS: Record<Langue, string[]> = {
  fr: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
}

export type DonneesRapportService = {
  etab: { id: string; nom: string; type: 'restaurant' | 'hotel'; couleur: string | null; langue: Langue; protege: boolean; version_lien: number }
  mois: string
  visites: number
  visitesPrec: number
  parQr: number
  vuesMenu: number
  demandes: number
  demandesPrec: number
  parType: { libelle: string; n: number }[]
  mediane: number | null
  rapides: number | null
  commandes: number
  ventes: number
  note: number | null
  avis: number
  commentaires: number
  google: number
  plats: { nom: string; vues: number }[]
  lieux: { libelle: string; visites: number }[]
  jourPointe: { jour: number; n: number } | null
  heurePointe: { heure: number; n: number } | null
  langues: { langue: string; n: number }[]
  parJour: number[]
}

/** Le mois écoulé (« 2026-10-01 »), au fuseau donné. */
export async function moisPrecedentService(fuseau = 'America/Toronto'): Promise<string> {
  const l = await requeteUne<{ mois: string }>(
    `select to_char(date_trunc('month', (now() at time zone $1)::date) - interval '1 month', 'YYYY-MM-DD') as mois`,
    [fuseau],
  )
  return l!.mois
}

export async function donneesRapportService(etabId: string, mois: string): Promise<DonneesRapportService | null> {
  const e = await lireEtablissement(etabId)
  if (!e || !/^\d{4}-\d{2}-01$/.test(mois)) return null
  const fuseau = e.options.fuseau || 'America/Toronto'
  // Le mois, en heure locale de l'établissement : [début, fin[.
  const dans = (col: string) => `(${col} at time zone $3)::date >= $2::date and (${col} at time zone $3)::date < $2::date + interval '1 month'`
  const avant = (col: string) => `(${col} at time zone $3)::date >= $2::date - interval '1 month' and (${col} at time zone $3)::date < $2::date`
  const p = [etabId, mois, fuseau]
  const [t, types, rep, ret, plats, lieux, jour, heure, langues, parJour] = await Promise.all([
    requeteUne<{ visites: number; visites_prec: number; qr: number; menu: number; demandes: number; demandes_prec: number; google: number }>(
      `select count(*) filter (where v.type = 'ouverture' and ${dans('v.cree_le')})::int as visites,
              count(*) filter (where v.type = 'ouverture' and ${avant('v.cree_le')})::int as visites_prec,
              count(*) filter (where v.type = 'ouverture' and v.source = 'qr' and ${dans('v.cree_le')})::int as qr,
              count(*) filter (where v.type = 'menu' and ${dans('v.cree_le')})::int as menu,
              (select count(*) from demandes_service d where d.etablissement_id = $1::uuid and d.statut <> 'annulee' and ${dans('d.cree_le')})::int as demandes,
              (select count(*) from demandes_service d where d.etablissement_id = $1::uuid and d.statut <> 'annulee' and ${avant('d.cree_le')})::int as demandes_prec,
              count(*) filter (where v.type = 'avis_google' and ${dans('v.cree_le')})::int as google
         from evenements_service v
        where v.etablissement_id = $1::uuid and v.cree_le >= ($2::date - interval '1 month' - interval '1 day')`,
      p,
    ),
    requete<{ libelle: string; n: number }>(
      `select max(libelle) as libelle, count(*)::int as n from demandes_service
        where etablissement_id = $1::uuid and statut <> 'annulee' and ${dans('cree_le')}
        group by cle order by n desc limit 4`,
      p,
    ),
    requeteUne<{ mediane: number | null; rapides: number | null; commandes: number; ventes: number }>(
      `select percentile_cont(0.5) within group (order by extract(epoch from prise_le - cree_le)) filter (where prise_le is not null)::float8 as mediane,
              (100.0 * count(*) filter (where prise_le - cree_le <= interval '2 minutes') / nullif(count(*) filter (where prise_le is not null), 0))::float8 as rapides,
              count(*) filter (where cle = 'commande')::int as commandes,
              coalesce(sum(total) filter (where cle = 'commande'), 0)::float8 as ventes
         from demandes_service where etablissement_id = $1::uuid and statut <> 'annulee' and ${dans('cree_le')}`,
      p,
    ),
    requeteUne<{ note: number | null; n: number; commentaires: number }>(
      `select round(avg(note)::numeric, 1)::float8 as note, count(*)::int as n,
              count(*) filter (where commentaire is not null and commentaire <> '')::int as commentaires
         from retours_service where etablissement_id = $1::uuid and ${dans('cree_le')}`,
      p,
    ),
    requete<{ nom: string; vues: number }>(
      `select coalesce(i.nom ->> $4, i.nom ->> 'fr', '') as nom, count(*)::int as vues
         from evenements_service v join menu_items i on i.id::text = v.cible
              join menu_sections s on s.id = i.section_id join menus m on m.id = s.menu_id and m.etablissement_id = $1::uuid
        where v.etablissement_id = $1::uuid and v.type = 'plat' and ${dans('v.cree_le')}
        group by i.id order by vues desc limit 5`,
      [...p, e.langue_defaut],
    ),
    requete<{ libelle: string; visites: number }>(
      `select x.libelle, count(*)::int as visites from evenements_service v join emplacements x on x.id = v.emplacement_id
        where v.etablissement_id = $1::uuid and v.type = 'ouverture' and ${dans('v.cree_le')}
        group by x.id order by visites desc limit 5`,
      p,
    ),
    requeteUne<{ jour: number; n: number }>(
      `select extract(isodow from cree_le at time zone $3)::int as jour, count(*)::int as n from evenements_service
        where etablissement_id = $1::uuid and type = 'ouverture' and ${dans('cree_le')} group by 1 order by n desc limit 1`,
      p,
    ),
    requeteUne<{ heure: number; n: number }>(
      `select extract(hour from cree_le at time zone $3)::int as heure, count(*)::int as n from evenements_service
        where etablissement_id = $1::uuid and type = 'ouverture' and ${dans('cree_le')} group by 1 order by n desc limit 1`,
      p,
    ),
    requete<{ langue: string; n: number }>(
      `select langue, count(*)::int as n from evenements_service
        where etablissement_id = $1::uuid and type = 'ouverture' and langue is not null and ${dans('cree_le')}
        group by langue order by n desc limit 4`,
      p,
    ),
    requete<{ n: number }>(
      `with cal as (select generate_series($2::date, ($2::date + interval '1 month' - interval '1 day')::date, interval '1 day')::date as jour)
       select (select count(*) from evenements_service v where v.etablissement_id = $1::uuid and v.type = 'ouverture'
                  and (v.cree_le at time zone $3)::date = c.jour)::int as n
         from cal c order by c.jour`,
      p,
    ),
  ])
  return {
    etab: { id: e.id, nom: e.nom, type: e.type, couleur: e.couleur, langue: e.langue_defaut === 'en' ? 'en' : 'fr', protege: e.protege, version_lien: e.version_lien },
    mois,
    visites: t?.visites ?? 0,
    visitesPrec: t?.visites_prec ?? 0,
    parQr: t?.qr ?? 0,
    vuesMenu: t?.menu ?? 0,
    demandes: t?.demandes ?? 0,
    demandesPrec: t?.demandes_prec ?? 0,
    parType: types,
    mediane: rep?.mediane ?? null,
    rapides: rep?.rapides ?? null,
    commandes: rep?.commandes ?? 0,
    ventes: rep?.ventes ?? 0,
    note: ret?.note ?? null,
    avis: ret?.n ?? 0,
    commentaires: ret?.commentaires ?? 0,
    google: t?.google ?? 0,
    plats,
    lieux,
    jourPointe: jour ?? null,
    heurePointe: heure ?? null,
    langues,
    parJour: parJour.map((j) => j.n),
  }
}

/** « de mars », mais « d’octobre », « d’avril », « d’août ». */
const de = (m: string) => (/^[aeiouyhàâéèêîôû]/i.test(m) ? `d’${m}` : `de ${m}`)

const TEXTES = {
  fr: {
    rapport: (m: string) => `rapport ${de(m)}`,
    objet: (nom: string, m: string, v: string) => `${nom} — votre mois ${de(m)} : ${v} visites`,
    visites: (m: string) => `Visites en ${m}`,
    evolution: (p: number) => (p === 0 ? 'stable par rapport au mois précédent' : `${p > 0 ? '+' : '−'}${Math.abs(p)} % par rapport au mois précédent`),
    parJour: 'Visites par jour',
    qr: (p: number) => `${p} % par code QR, le reste par la carte`,
    demandes: 'Demandes',
    reponse: 'Réponse médiane',
    rapides: 'Prises en moins de 2 min',
    note: 'Note des clients',
    commandes: 'Commandes',
    ventes: 'Ventes par commande',
    menu: 'Vues du menu',
    google: 'Clics vers Google',
    plats: 'Les plats les plus regardés',
    lieux: (hotel: boolean) => (hotel ? 'Les chambres et zones les plus actives' : 'Les tables les plus actives'),
    pointe: (j: string, h: number) => `Le plus achalandé : le ${j}, vers ${h} h.`,
    langues: (l: string) => `Langues des visiteurs : ${l}.`,
    commentaires: (n: number) => `${n} commentaire${n > 1 ? 's' : ''} privé${n > 1 ? 's' : ''} à lire dans votre portail.`,
    portail: 'Ouvrir mon portail',
    portailTexte: 'Toutes vos statistiques sont dans votre portail du personnel.',
    pied: 'Vous recevez ce rapport parce que votre établissement utilise Tapora Services. Pour ne plus le recevoir, répondez simplement « stop ».',
    question: (c: string) => `Une question ? Écrivez-nous à ${c}.`,
    vide: 'Aucune visite ce mois-ci.',
  },
  en: {
    rapport: (m: string) => `${m} report`,
    objet: (nom: string, m: string, v: string) => `${nom} — your ${m}: ${v} visits`,
    visites: (m: string) => `Visits in ${m}`,
    evolution: (p: number) => (p === 0 ? 'same as the previous month' : `${p > 0 ? '+' : '−'}${Math.abs(p)}% vs the previous month`),
    parJour: 'Visits per day',
    qr: (p: number) => `${p}% by QR code, the rest by card`,
    demandes: 'Requests',
    reponse: 'Median response',
    rapides: 'Taken within 2 min',
    note: 'Guest rating',
    commandes: 'Orders',
    ventes: 'Order sales',
    menu: 'Menu views',
    google: 'Clicks to Google',
    plats: 'Most viewed dishes',
    lieux: (hotel: boolean) => (hotel ? 'Most active rooms and areas' : 'Most active tables'),
    pointe: (j: string, h: number) => `Busiest: ${j}s, around ${h}:00.`,
    langues: (l: string) => `Visitor languages: ${l}.`,
    commentaires: (n: number) => `${n} private comment${n > 1 ? 's' : ''} to read in your portal.`,
    portail: 'Open my portal',
    portailTexte: 'All your statistics are in your staff portal.',
    pied: 'You receive this report because your business uses Tapora Services. To stop receiving it, simply reply “stop”.',
    question: (c: string) => `Questions? Write to us at ${c}.`,
    vide: 'No visits this month.',
  },
}

function nombre(v: number, l: Langue): string {
  return new Intl.NumberFormat(l === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 1 }).format(v)
}
function argent(v: number, l: Langue): string {
  return new Intl.NumberFormat(l === 'en' ? 'en-CA' : 'fr-CA', { style: 'currency', currency: 'CAD' }).format(v)
}
function duree(s: number | null, l: Langue): string {
  if (s === null) return '—'
  const m = Math.floor(s / 60)
  const r = Math.round(s % 60)
  return m ? `${m} min ${String(r).padStart(2, '0')} s` : l === 'en' ? `${r} s` : `${r} s`
}
/** Une couleur de marque lisible sur blanc, sinon le noir Tapora. */
function teinte(c: string | null): string {
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c : '#16181d'
}

/** Le courriel : tableaux et styles en ligne — ce que lisent Gmail et Outlook. */
export async function courrielRapportService(r: DonneesRapportService, baseRepli: string) {
  const l = r.etab.langue
  const T = TEXTES[l]
  const societe = await emetteur()
  const [a, mm] = r.mois.split('-').map(Number)
  const mois = `${MOIS[l][mm - 1]} ${a}`
  const accent = teinte(r.etab.couleur)
  const ecart = r.visitesPrec > 0 ? Math.round(((r.visites - r.visitesPrec) / r.visitesPrec) * 100) : null
  // Le lien du portail n'est mis que s'il est protégé par un mot de passe : un courriel se transfère.
  const lien = r.etab.protege ? `${urlPortail(r.etab.id, r.etab.version_lien, baseRepli)}?v=stats&p=30` : null

  const max = Math.max(1, ...r.parJour)
  const barres = r.parJour
    .map((n, i) => `<td valign="bottom" style="padding:0 1px"><div title="${i + 1} : ${n}" style="width:7px;height:${Math.max(n ? 3 : 1, Math.round((n / max) * 64))}px;background:${n ? accent : '#e4e7ec'};border-radius:2px 2px 0 0"></div></td>`)
    .join('')

  const tuile = (titre: string, valeur: string) =>
    `<td width="50%" style="padding:6px"><div style="border:1px solid #eceef2;border-radius:10px;padding:12px 14px"><div style="font-size:12px;color:#5b6472">${echapper(titre)}</div><div style="font-size:22px;font-weight:700;padding-top:2px">${echapper(valeur)}</div></div></td>`
  const tuiles: [string, string][] = [
    [T.demandes, nombre(r.demandes, l)],
    [T.reponse, duree(r.mediane, l)],
    ...(r.rapides !== null ? ([[T.rapides, `${Math.round(r.rapides)} %`]] as [string, string][]) : []),
    ...(r.note !== null ? ([[T.note, `${nombre(r.note, l)} / 5 (${r.avis})`]] as [string, string][]) : []),
    ...(r.commandes ? ([[T.commandes, nombre(r.commandes, l)], [T.ventes, argent(r.ventes, l)]] as [string, string][]) : []),
    [T.menu, nombre(r.vuesMenu, l)],
    [T.google, nombre(r.google, l)],
  ]
  const grille = Array.from({ length: Math.ceil(tuiles.length / 2) }, (_, i) => `<tr>${tuiles.slice(i * 2, i * 2 + 2).map(([t, v]) => tuile(t, v)).join('')}</tr>`).join('')

  const liste = (titre: string, lignes: { a: string; b: string }[]) =>
    lignes.length
      ? `<tr><td style="padding-top:20px"><div style="font-size:12px;color:#5b6472;padding-bottom:4px">${echapper(titre)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${lignes
          .map((x) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eceef2">${echapper(x.a)}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #eceef2;font-weight:600">${echapper(x.b)}</td></tr>`)
          .join('')}</table></td></tr>`
      : ''

  const total = r.langues.reduce((s, x) => s + x.n, 0)
  const langues = total && r.langues.length > 1 ? r.langues.map((x) => `${nomLangue(x.langue)} ${Math.round((x.n / total) * 100)} %`).join(', ') : ''
  const pointe = r.jourPointe && r.heurePointe ? T.pointe(JOURS[l][r.jourPointe.jour - 1], r.heurePointe.heure) : ''
  const qr = r.visites && r.parQr ? T.qr(Math.round((r.parQr / r.visites) * 100)) : ''
  const contact = societe.courriel_contact ? T.question(societe.courriel_contact) : ''

  const html = `<!doctype html><html lang="${l}"><body style="margin:0;padding:0;background:#f7f8fa">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e7ec;border-radius:14px;overflow:hidden;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#16181d">
<tr><td style="height:6px;background:${accent}"></td></tr>
<tr><td style="padding:26px 28px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5b6472">Tapora Services · ${echapper(T.rapport(mois))}</td></tr>
<tr><td style="padding-top:6px;font-size:22px;font-weight:700">${echapper(r.etab.nom)}</td></tr>
<tr><td style="padding-top:22px;font-size:13px;color:#5b6472">${echapper(T.visites(mois))}</td></tr>
<tr><td style="font-size:46px;font-weight:700;letter-spacing:-1px;line-height:1.1">${nombre(r.visites, l)}</td></tr>
${ecart !== null ? `<tr><td style="font-size:14px;color:${ecart > 0 ? '#0f7b52' : ecart < 0 ? '#b42318' : '#5b6472'}">${ecart > 0 ? '▲' : ecart < 0 ? '▼' : '='} ${echapper(T.evolution(ecart))}</td></tr>` : ''}
${r.visites ? `<tr><td style="padding-top:18px"><table role="presentation" cellpadding="0" cellspacing="0" style="height:66px"><tr>${barres}</tr></table><div style="font-size:11px;color:#5b6472;padding-top:4px">${echapper(T.parJour)}${qr ? ` · ${echapper(qr)}` : ''}</div></td></tr>` : `<tr><td style="padding-top:8px;color:#5b6472">${echapper(T.vide)}</td></tr>`}
<tr><td style="padding-top:16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -6px">${grille}</table></td></tr>
${pointe ? `<tr><td style="padding-top:14px;font-size:15px">📈 ${echapper(pointe)}</td></tr>` : ''}
${langues ? `<tr><td style="padding-top:8px;font-size:15px">🌍 ${echapper(T.langues(langues))}</td></tr>` : ''}
${r.commentaires ? `<tr><td style="padding-top:8px;font-size:15px">💬 ${echapper(T.commentaires(r.commentaires))}</td></tr>` : ''}
${liste(T.plats, r.plats.map((p) => ({ a: p.nom, b: nombre(p.vues, l) })))}
${liste(T.lieux(r.etab.type === 'hotel'), r.lieux.map((x) => ({ a: x.libelle, b: nombre(x.visites, l) })))}
${lien ? `<tr><td style="padding-top:24px"><a href="${echapper(lien)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:9px">${echapper(T.portail)}</a></td></tr>` : `<tr><td style="padding-top:20px;font-size:14px;color:#5b6472">${echapper(T.portailTexte)}</td></tr>`}
<tr><td style="padding-top:24px;font-size:12px;line-height:1.5;color:#5b6472">${echapper(contact)} ${echapper(T.pied)}</td></tr>
</table></td></tr></table></td></tr></table></body></html>`

  const texte = [
    `${r.etab.nom} — Tapora Services, ${T.rapport(mois)}`,
    '',
    `${T.visites(mois)} : ${nombre(r.visites, l)}${ecart !== null ? ` (${T.evolution(ecart)})` : ''}`,
    ...tuiles.map(([t, v]) => `${t} : ${v}`),
    pointe,
    langues ? T.langues(langues) : '',
    r.commentaires ? T.commentaires(r.commentaires) : '',
    '',
    ...(r.plats.length ? [T.plats, ...r.plats.map((p) => `  ${p.nom} : ${nombre(p.vues, l)}`), ''] : []),
    lien ? `${T.portail} : ${lien}` : T.portailTexte,
    '',
    contact,
    `— ${societe.nom_entreprise}`,
  ]
    .filter((x, i, t) => x !== '' || t[i - 1] !== '')
    .join('\n')

  return { objet: T.objet(r.etab.nom, mois, nombre(r.visites, l)), html, texte, repondreA: societe.courriel_contact }
}

async function destinataire(etabId: string): Promise<string | null> {
  const l = await requeteUne<{ courriel: string | null }>(`select contact_courriel as courriel from etablissements where id = $1::uuid`, [etabId])
  const c = l?.courriel?.trim()
  return c && /^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$/i.test(c) ? c : null
}

export type ResultatRapportService = { statut: 'envoye' | 'simule' | 'echec' | 'deja' | 'sans_courriel'; erreur: string | null }

/** Envoie le rapport d'un mois. `forcer` renvoie un mois déjà envoyé (bouton du back-office). */
export async function envoyerRapportService(etabId: string, mois: string, baseRepli: string, forcer = false): Promise<ResultatRapportService> {
  const a = await destinataire(etabId)
  if (!a) return { statut: 'sans_courriel', erreur: 'Aucun courriel de contact pour cet établissement.' }
  const verrou = await requeteUne<{ ok: number }>(
    forcer
      ? `insert into rapports_service (etablissement_id, mois, statut, destinataire) values ($1::uuid, $2::date, 'en_cours', $3)
         on conflict (etablissement_id, mois) do update set statut = 'en_cours', destinataire = $3, erreur = null, cree_le = now()
          where rapports_service.statut <> 'en_cours' or rapports_service.cree_le < now() - interval '10 minutes'
         returning 1 as ok`
      : `insert into rapports_service (etablissement_id, mois, statut, destinataire) values ($1::uuid, $2::date, 'en_cours', $3)
         on conflict (etablissement_id, mois) do nothing returning 1 as ok`,
    [etabId, mois, a],
  )
  if (!verrou) return { statut: 'deja', erreur: null }
  try {
    const d = await donneesRapportService(etabId, mois)
    if (!d) throw new Error('Établissement introuvable.')
    const c = await courrielRapportService(d, baseRepli)
    const r = await envoyerCourriel({ destinataire: a, objet: c.objet, html: c.html, texte: c.texte, repondreA: c.repondreA })
    await requete(`update rapports_service set statut = $3, erreur = $4 where etablissement_id = $1::uuid and mois = $2::date`, [etabId, mois, r.statut, r.erreur])
    return { statut: r.statut, erreur: r.erreur }
  } catch (e) {
    const erreur = e instanceof Error ? e.message.slice(0, 400) : 'Envoi impossible.'
    await requete(`update rapports_service set statut = 'echec', erreur = $3 where etablissement_id = $1::uuid and mois = $2::date`, [etabId, mois, erreur])
    return { statut: 'echec', erreur }
  }
}

export async function historiqueRapportsService(etabId: string) {
  return requete<{ mois: string; statut: string; destinataire: string | null; erreur: string | null; cree_le: string }>(
    `select to_char(mois, 'YYYY-MM-DD') as mois, statut, destinataire, erreur, cree_le
       from rapports_service where etablissement_id = $1::uuid order by mois desc limit 12`,
    [etabId],
  )
}

const globale = globalThis as typeof globalThis & { __rapportsServices?: number }

/**
 * Appelé à chaque réveil. À partir du 1er du mois, de 9 h à 19 h (heure du
 * Québec), envoie le rapport du mois écoulé aux établissements actifs (ou en
 * essai) qui ont un courriel de contact, l'ont accepté et ont eu au moins une
 * visite ce mois-là. Vérifie au plus toutes les 30 minutes.
 */
export async function envoyerRapportsServicesDus(baseRepli: string): Promise<void> {
  const maintenant = Date.now()
  if (globale.__rapportsServices && maintenant - globale.__rapportsServices < 30 * 60 * 1000) return
  globale.__rapportsServices = maintenant

  const ici = await requeteUne<{ h: number; deja: number }>(
    `select extract(hour from now() at time zone 'America/Toronto')::int as h,
            (select count(*)::int from rapports_service
              where (cree_le at time zone 'America/Toronto')::date = (now() at time zone 'America/Toronto')::date) as deja`,
  )
  if (!ici || ici.h < 9 || ici.h >= 19) return
  const restant = RAPPORTS_PAR_JOUR - ici.deja
  if (restant <= 0) return

  const mois = await moisPrecedentService()
  const dus = await requete<{ id: string }>(
    `select e.id from etablissements e
      where e.actif and e.rapport_mensuel and e.formule in ('actif', 'essai')
        and e.contact_courriel is not null and e.cree_le < $1::date + interval '1 month'
        and exists (select 1 from evenements_service v where v.etablissement_id = e.id and v.type = 'ouverture'
                     and v.cree_le >= $1::date - interval '1 day' and v.cree_le < $1::date + interval '1 month' + interval '1 day')
        and not exists (select 1 from rapports_service r where r.etablissement_id = e.id and r.mois = $1::date)
      order by e.cree_le limit $2`,
    [mois, Math.min(15, restant)],
  )
  for (const e of dus) await envoyerRapportService(e.id, mois, baseRepli).catch(() => {})
}
