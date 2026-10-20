import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import { echapper, envoyerCourriel } from '@/lib/courriel'
import { emetteur } from '@/lib/requetes/ventes'
import { baseCartesConfiguree } from '@/lib/cartes-url'
import { alertesStock } from '@/lib/stock'
import { compteRendu } from '@/lib/portail'

/**
 * Les cartes qui dorment : actives, posées depuis au moins une semaine, et
 * sans tap depuis 7 jours. Une carte qui se tait est presque toujours une
 * carte cachée, tombée ou oubliée par l'équipe : un appel règle ça, et c'est
 * souvent l'occasion d'en proposer une deuxième.
 *
 * « C'est réglé » la retire de la liste pour 7 jours (sommeil_vu_le) : si elle
 * dort encore après, elle revient.
 */
export const JOURS_SOMMEIL = 7
const FUSEAU = 'America/Toronto'

export type CarteEndormie = {
  id: string
  libelle: string
  code: string
  dossier_id: string | null
  dossier_nom: string | null
  client_nom: string | null
  telephone: string | null
  courriel: string | null
  total: number
  dernier_tap: string | null
  /** Jours depuis le dernier tap, ou depuis la création si la carte n'a jamais été tapée. */
  jours: number
}

export async function cartesEndormies(): Promise<CarteEndormie[]> {
  return requete<CarteEndormie>(
    `select c.id, c.libelle, c.code, c.dossier_id, d.nom as dossier_nom,
            cl.nom as client_nom, cl.telephone, cl.courriel,
            s.total, s.dernier as dernier_tap,
            ((now() at time zone $1)::date - (coalesce(s.dernier, c.cree_le) at time zone $1)::date)::int as jours
       from cartes_nfc c
       left join dossiers_cartes d on d.id = c.dossier_id
       left join clients cl on cl.id = coalesce(d.client_id, c.client_id)
       cross join lateral (
         select count(*)::int as total, max(t.tape_le) as dernier from taps t where t.carte_id = c.id
       ) s
      where c.actif
        and c.cree_le < now() - make_interval(days => $2::int)
        and coalesce(s.dernier, c.cree_le) < now() - make_interval(days => $2::int)
        and (c.sommeil_vu_le is null or c.sommeil_vu_le < now() - make_interval(days => $2::int))
      order by (s.total > 0) desc, jours desc, lower(coalesce(d.nom, c.libelle))`,
    [FUSEAU, JOURS_SOMMEIL],
  )
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** « C'est réglé » : la carte quitte la liste pour une semaine. */
export async function reglerSommeil(id: string): Promise<void> {
  if (!UUID.test(id)) return
  await requete(`update cartes_nfc set sommeil_vu_le = now() where id = $1::uuid`, [id])
}

// ---------------------------------------------------------------------------
// Le courriel du lundi
// ---------------------------------------------------------------------------
const globale = globalThis as typeof globalThis & { __sommeil?: number }

/**
 * Appelé à chaque réveil (/api/eveil). Le lundi, à partir de 8 h (heure du
 * Québec), envoie UNE fois la liste des cartes qui dorment à l'adresse de
 * contact de la société. La semaine est réservée avant l'envoi : deux
 * réveils simultanés n'envoient pas deux courriels. Rien à signaler, rien
 * d'envoyé.
 */
export async function envoyerAlerteSommeil(baseRepli: string): Promise<void> {
  const maintenant = Date.now()
  if (globale.__sommeil && maintenant - globale.__sommeil < 30 * 60 * 1000) return
  globale.__sommeil = maintenant

  const ici = await requeteUne<{ jour: number; h: number; semaine: string }>(
    `select extract(isodow from now() at time zone $1)::int as jour,
            extract(hour from now() at time zone $1)::int as h,
            to_char(date_trunc('week', now() at time zone $1), 'YYYY-MM-DD') as semaine`,
    [FUSEAU],
  )
  if (!ici || ici.jour !== 1 || ici.h < 8 || ici.h >= 19) return

  const [cartes, alertes, rendu] = await Promise.all([cartesEndormies(), alertesStock(), compteRendu()])
  const stockBas = alertes.length > 0
  const attente: ATraiter = {
    messages: rendu.conversations.filter((c) => c.a_traiter > 0).length,
    demandes: rendu.demandes.filter((d) => !d.traitee_le).length,
    cartes: rendu.cartes.length,
    maquettes: rendu.maquettes.length,
    bloquees: rendu.bloquees.length,
  }
  const rienEnAttente = Object.values(attente).every((v) => v === 0)
  const reservee = await requeteUne<{ semaine: string }>(
    `insert into alertes_sommeil (semaine, nb_cartes, statut) values ($1::date, $2, 'rien')
     on conflict (semaine) do nothing returning semaine`,
    [ici.semaine, cartes.length],
  )
  if (!reservee || (!cartes.length && !stockBas && rienEnAttente)) return

  const societe = await emetteur()
  if (!societe.courriel_contact) return
  const base = (process.env.URL_APP?.trim() || baseCartesConfiguree() || baseRepli).replace(/\/+$/, '')
  const c = courrielSommeil(
    cartes,
    `${base}/cartes#sommeil`,
    societe.nom_entreprise,
    alertes.map((a) => ({
      nom: a.nom ?? 'Cartes',
      quantite: a.quantite,
      semaines: a.rythme_semaine > 0 && a.quantite > 0 && a.quantite / a.rythme_semaine <= 52 ? Math.floor(a.quantite / a.rythme_semaine) : null,
      lien: `${base}/cartes/stock`,
    })),
    rienEnAttente ? null : { ...attente, lien: `${base}/messages` },
  )
  const r = await envoyerCourriel({ destinataire: societe.courriel_contact, ...c })
  await requete(`update alertes_sommeil set statut = $2 where semaine = $1::date`, [ici.semaine, r.statut])
}

function depuisTexte(c: CarteEndormie): string {
  return c.total === 0 ? `jamais tapée (posée il y a ${c.jours} jours)` : `aucun tap depuis ${c.jours} jours`
}

export type AlerteStock = { nom: string; quantite: number; semaines: number | null; lien: string }

function texteStock(a: AlerteStock): string {
  return a.quantite < 0
    ? `${a.nom} : stock négatif (${a.quantite}), des cartes vendues n’ont pas de réception inscrite.`
    : `${a.nom} : plus que ${a.quantite} carte${a.quantite > 1 ? 's' : ''} en stock${a.semaines !== null ? `, environ ${a.semaines} semaine${a.semaines > 1 ? 's' : ''} au rythme actuel` : ''} — pensez à commander.`
}

export type ATraiter = { messages: number; demandes: number; cartes: number; maquettes: number; bloquees: number }

function lignesATraiter(a: ATraiter): string[] {
  const p = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`
  return [
    a.messages && `✉️ ${p(a.messages, 'client attend une réponse', 'clients attendent une réponse')}`,
    a.demandes && `🏨 ${p(a.demandes, 'demande Entreprise à rappeler', 'demandes Entreprise à rappeler')}`,
    a.cartes && `🛒 ${p(a.cartes, 'demande de cartes', 'demandes de cartes')}`,
    a.maquettes && `🎨 ${p(a.maquettes, 'maquette attend l’approbation du client', 'maquettes attendent l’approbation du client')}`,
    a.bloquees && `⏳ ${p(a.bloquees, 'commande immobile depuis 7 jours', 'commandes immobiles depuis 7 jours')}`,
  ].filter((l): l is string => Boolean(l))
}

export function courrielSommeil(cartes: CarteEndormie[], lien: string, societe: string, stocks: AlerteStock[] = [], attente: (ATraiter & { lien: string }) | null = null) {
  const n = cartes.length
  const aFaire = attente ? lignesATraiter(attente) : []
  const objet = n
    ? `😴 ${n} carte${n > 1 ? 's' : ''} qui dor${n > 1 ? 'ment' : 't'} cette semaine${stocks.length ? ' · stock bas' : ''}${aFaire.length ? ' · clients en attente' : ''}`
    : stocks.length
      ? `📦 ${stocks.length === 1 && stocks[0].quantite >= 0 ? `${stocks[0].nom} : plus que ${stocks[0].quantite} carte${stocks[0].quantite > 1 ? 's' : ''} en stock` : 'Stock de cartes à surveiller'}${aFaire.length ? ' · clients en attente' : ''}`
      : `📬 Le point du lundi : ${aFaire.length} chose${aFaire.length > 1 ? 's' : ''} attend${aFaire.length > 1 ? 'ent' : ''} un geste`
  const lignes = cartes
    .slice(0, 25)
    .map((c) => {
      const qui = c.dossier_nom ?? c.libelle
      const joindre = [c.telephone, c.courriel].filter(Boolean).join(' · ')
      return `<tr>
  <td style="padding:12px 0;border-top:1px solid #eadfcd;vertical-align:top">
    <div style="font-size:15px;font-weight:700;color:#2a211a">${echapper(qui)}</div>
    <div style="font-size:13px;color:#6b5d50;margin-top:2px">${echapper(c.dossier_nom ? c.libelle : `carte ${c.code}`)} · ${echapper(depuisTexte(c))}</div>
    ${joindre ? `<div style="font-size:13px;color:#2a211a;margin-top:2px">${echapper(joindre)}</div>` : ''}
  </td>
  <td style="padding:12px 0 12px 12px;border-top:1px solid #eadfcd;vertical-align:top;text-align:right;white-space:nowrap">
    <span style="display:inline-block;background:${c.total === 0 ? '#fbebe4' : '#fdf3dc'};color:${c.total === 0 ? '#b0402a' : '#8a5a00'};border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700">${c.jours} j</span>
  </td>
</tr>`
    })
    .join('')
  const reste = n > 25 ? `<p style="margin:10px 0 0;font-size:13px;color:#6b5d50">… et ${n - 25} autre${n - 25 > 1 ? 's' : ''}.</p>` : ''
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f7f1e7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f1e7;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<tr><td style="padding:0 4px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:34px;height:34px"><img src="https://taporacards.com/apple-touch-icon.png" width="34" height="34" alt="" style="display:block;border-radius:50%"></td>
    <td style="padding-left:10px;font-family:Georgia,serif;font-size:20px;font-weight:600;color:#2a211a">Tapora</td>
  </tr></table>
</td></tr>
<tr><td style="background:#fffaf2;border-radius:20px;padding:28px 26px;box-shadow:0 18px 40px -26px rgba(60,40,20,.45)">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#c2552f;font-weight:700">Le point du lundi</p>
  ${aFaire.length ? `<div style="margin:6px 0 ${n || stocks.length ? '22px' : '0'};padding:16px 18px;border-radius:14px;background:#f3ebdf;color:#2a211a">
    <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:20px">Vos clients attendent</p>
    ${aFaire.map((l) => `<p style="margin:0 0 4px;font-size:15px">${echapper(l)}</p>`).join('')}
    <p style="margin:10px 0 0;font-size:14px"><a href="${echapper(attente!.lien)}" style="color:#c2552f;font-weight:700">Ouvrir Messages</a> — chaque ligne a son bouton.</p>
  </div>` : ''}
  ${n ? `<p style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;line-height:1.25;color:#2a211a">${n} carte${n > 1 ? 's' : ''} à réveiller</p>
  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#2a211a">Aucun tap depuis au moins ${JOURS_SOMMEIL} jours. Le plus souvent : la carte est cachée, tombée, ou l’équipe a oublié d’en parler. Un appel de deux minutes suffit — et c’est le bon moment pour proposer une deuxième carte.</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:8px">${lignes}</table>
  ${reste}
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0"><tr><td style="background:#c2552f;border-radius:999px">
    <a href="${echapper(lien)}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:700;color:#fffaf2;text-decoration:none">Ouvrir la liste</a>
  </td></tr></table>` : ''}
  ${stocks.length ? `<div style="margin:${n ? '22px' : '0'} 0 0;padding:16px 18px;border-radius:14px;background:#fdf3dc;color:#6b4a05">
    ${stocks.map((a) => `<p style="margin:0 0 6px;font-size:15px;font-weight:700">📦 ${echapper(texteStock(a))}</p>`).join('')}
    <p style="margin:8px 0 0;font-size:14px"><a href="${echapper(stocks[0].lien)}" style="color:#c2552f;font-weight:700">Voir le stock</a> — à la réception, deux chiffres suffisent : cartes reçues, total payé.</p>
  </div>` : ''}
</td></tr>
<tr><td style="padding:18px 6px 0;font-size:12px;line-height:1.5;color:#6b5d50;text-align:center">Courriel automatique du lundi · ${echapper(societe)}</td></tr>
</table></td></tr></table></body></html>`
  const texte = [
    ...(aFaire.length ? ['Vos clients attendent :', ...aFaire, attente!.lien, ''] : []),
    ...(n
      ? [
          `${n} carte${n > 1 ? 's' : ''} à réveiller (aucun tap depuis au moins ${JOURS_SOMMEIL} jours) :`,
          '',
          ...cartes.slice(0, 25).map((c) => `- ${c.dossier_nom ?? c.libelle} (${c.libelle}) : ${depuisTexte(c)}${c.telephone ? ` · ${c.telephone}` : ''}`),
          '',
          lien,
        ]
      : []),
    ...(stocks.length ? ['', ...stocks.map(texteStock), stocks[0].lien] : []),
  ].join('\n')
  return { objet, html, texte }
}
