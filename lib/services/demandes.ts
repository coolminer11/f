import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import type { Contexte } from '@/lib/securite'
import { texte } from '@/lib/services/langues'
import { menus, parCode } from '@/lib/services/donnees'
import { formaterPrix, ui } from '@/lib/services/ui'
import { notifierPersonnel } from '@/lib/services/notifications'
import { noterEvenement } from '@/lib/services/evenements'
import { jetonPortail } from '@/lib/services/acces'
import type { Demande, Etablissement, LigneCommande, Menu, StatutDemande } from '@/lib/services/types'

/**
 * Les demandes des clients (appeler le serveur, l'addition, des serviettes…).
 *
 * Contre les abus : la même demande au même emplacement, encore en attente,
 * n'est pas recréée (on rend la première) ; 30 demandes par heure et par
 * adresse, 400 par heure pour l'établissement.
 */
export type ResultatDemande = { etat: 'ok'; id: string; avis: boolean; deja: boolean } | { etat: 'trop' } | { etat: 'invalide' }

export async function creerDemande(code: string, cle: string, note: string | null, langue: string, ctx: Contexte): Promise<ResultatDemande> {
  const lieu = await parCode(code)
  if (!lieu || !lieu.etab.options.appel) return { etat: 'invalide' }
  const { etab, emplacement } = lieu
  const type = await requeteUne<{ id: string; libelle: Record<string, string>; icone: string | null; avec_note: boolean; avis_apres: boolean }>(
    `select id, libelle, icone, avec_note, avis_apres from types_demandes where etablissement_id = $1::uuid and cle = $2 and actif`,
    [etab.id, cle],
  )
  if (!type) return { etat: 'invalide' }

  const deja = await requeteUne<{ id: string }>(
    `select id from demandes_service where emplacement_id = $1::uuid and cle = $2 and statut in ('nouvelle', 'prise') and cree_le > now() - interval '10 minutes'
      order by cree_le desc limit 1`,
    [emplacement.id, cle],
  )
  if (deja) return { etat: 'ok', id: deja.id, avis: type.avis_apres && etab.options.avis, deja: true }

  const libelle = texte(type.libelle, etab.langue_defaut, etab.langue_defaut) || cle
  const ligne = await requeteUne<{ id: string }>(
    `insert into demandes_service (etablissement_id, emplacement_id, type_id, cle, libelle, note, langue, empreinte)
     select $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8
      where (select count(*) from demandes_service where empreinte is not distinct from $8 and $8 is not null and cree_le > now() - interval '1 hour') < 30
        and (select count(*) from demandes_service where etablissement_id = $1::uuid and cree_le > now() - interval '1 hour') < 400
     returning id`,
    [etab.id, emplacement.id, type.id, cle, libelle.slice(0, 120), type.avec_note ? note?.trim().slice(0, 500) || null : null, langue.slice(0, 5), ctx.ipEmpreinte],
  )
  if (!ligne) return { etat: 'trop' }

  void noterEvenement(etab.id, emplacement.id, 'demandes', cle, langue)
  void notifierPersonnel(etab.id, emplacement.groupe, {
    titre: `${type.icone ?? '🔔'} ${emplacement.libelle} — ${libelle}`,
    // Dans la langue de l'établissement : l'équipe d'un hôtel anglophone lit l'anglais.
    corps: note?.trim()
      ? note.trim().slice(0, 140)
      : etab.langue_defaut === 'en'
        ? etab.type === 'hotel' ? 'New request from a guest.' : 'A guest is waiting for you.'
        : etab.type === 'hotel' ? 'Nouvelle demande d’un client.' : 'Un client vous attend.',
    url: `/service/${jetonPortail(etab.id, etab.version_lien)}`,
    etiquette: `demande-${ligne.id}`,
  }).catch(() => 0)
  return { etat: 'ok', id: ligne.id, avis: type.avis_apres && etab.options.avis, deja: false }
}

// ---------------------------------------------------------------------------
// Commandes (à la table, ou le service aux chambres)
// ---------------------------------------------------------------------------

/** Ce que le téléphone envoie : seulement QUOI et COMBIEN. Les noms et les prix viennent du menu. */
export type SaisieCommande = { plat_id: string; variante: number | null; quantite: number; note?: string | null }
export type ResultatCommande =
  | { etat: 'ok'; id: string; deja: boolean; total: number | null; articles: number }
  | { etat: 'trop' }
  | { etat: 'invalide' }
  /** Le menu n'est plus servi (ou les commandes sont coupées) : rien n'est envoyé. */
  | { etat: 'ferme' }
  /** Des plats épuisés ou retirés depuis l'affichage : le client les enlève et renvoie. */
  | { etat: 'indisponible'; plats: string[] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_LIGNES = 30
export const MAX_QUANTITE = 20

/** Les menus d'où l'on peut commander EN CE MOMENT : servis maintenant ; à l'hôtel, seulement le service aux chambres. */
export function menusCommandables(etab: Etablissement, liste: Menu[]): Menu[] {
  if (!etab.options.commande || !etab.options.menu) return []
  return liste.filter((m) => m.actif && m.en_service && (etab.type === 'restaurant' || m.type === 'room_service'))
}

const arrondi = (n: number) => Math.round(n * 100) / 100

/**
 * Une commande : chaque ligne est revérifiée contre le menu (plat servi en ce
 * moment, disponible, format existant) et son prix recalculé ici. Un double
 * envoi (même contenu, même table, encore en attente) rend la première ;
 * mêmes plafonds que les demandes (30 par heure et par adresse, 400 pour
 * l'établissement).
 */
export async function creerCommande(code: string, saisie: SaisieCommande[], note: string | null, langue: string, ctx: Contexte): Promise<ResultatCommande> {
  if (!Array.isArray(saisie) || saisie.length < 1 || saisie.length > MAX_LIGNES) return { etat: 'invalide' }
  const lieu = await parCode(code)
  if (!lieu) return { etat: 'invalide' }
  const { etab, emplacement } = lieu
  if (!etab.options.commande || !etab.options.menu) return { etat: 'ferme' }

  // Les mêmes plat et format, envoyés deux fois, ne font qu'une ligne.
  const regroupees = new Map<string, SaisieCommande>()
  for (const x of saisie) {
    if (!x || typeof x.plat_id !== 'string' || !UUID.test(x.plat_id)) return { etat: 'invalide' }
    const quantite = Number(x.quantite)
    const variante = x.variante === null || x.variante === undefined ? null : Number(x.variante)
    if (!Number.isInteger(quantite) || quantite < 1 || quantite > MAX_QUANTITE) return { etat: 'invalide' }
    if (variante !== null && (!Number.isInteger(variante) || variante < 0 || variante > 50)) return { etat: 'invalide' }
    const precisionPlat = typeof x.note === 'string' ? x.note.replace(/\s+/g, ' ').trim().slice(0, 140) || null : null
    const cle = `${x.plat_id.toLowerCase()}:${variante ?? ''}:${precisionPlat ?? ''}`
    const avant = regroupees.get(cle)
    regroupees.set(cle, { plat_id: x.plat_id.toLowerCase(), variante, quantite: Math.min(MAX_QUANTITE, (avant?.quantite ?? 0) + quantite), note: precisionPlat })
  }

  const ouverts = menusCommandables(etab, await menus(etab.id, etab.options.fuseau))
  if (!ouverts.length) return { etat: 'ferme' }
  const plats = new Map(ouverts.flatMap((m) => m.sections.flatMap((s) => s.plats.map((p) => [p.id, p] as const))))
  const d = etab.langue_defaut
  const indisponibles: string[] = []
  const details: LigneCommande[] = []
  for (const x of regroupees.values()) {
    const p = plats.get(x.plat_id)
    const v = p && x.variante !== null ? p.variantes?.[x.variante] : undefined
    // Un plat à formats se commande avec son format ; un plat sans format, sans.
    const formatOk = p ? (p.variantes?.length ? Boolean(v) : x.variante === null) : false
    if (!p || !p.disponible || !formatOk) {
      indisponibles.push(x.plat_id)
      continue
    }
    const nom = texte(p.nom, d, d) || texte(p.nom, langue, d)
    const nomClient = texte(p.nom, langue, d)
    const variante = v ? texte(v.nom, d, d) || null : null
    const varianteClient = v ? texte(v.nom, langue, d) || null : null
    details.push({
      plat_id: p.id,
      nom: nom.slice(0, 160),
      nom_client: nomClient && nomClient !== nom ? nomClient.slice(0, 160) : null,
      variante: variante?.slice(0, 80) ?? null,
      variante_client: varianteClient && varianteClient !== variante ? varianteClient.slice(0, 80) : null,
      prix: v?.prix ?? p.prix ?? null,
      quantite: x.quantite,
      note: x.note ?? null,
    })
  }
  if (indisponibles.length) return { etat: 'indisponible', plats: [...new Set(indisponibles)] }
  if (!details.length) return { etat: 'invalide' }

  const avecPrix = details.filter((l) => l.prix !== null)
  const total = avecPrix.length ? arrondi(avecPrix.reduce((t, l) => t + (l.prix as number) * l.quantite, 0)) : null
  const articles = details.reduce((t, l) => t + l.quantite, 0)
  const precision = note?.trim().slice(0, 500) || null
  const corps = JSON.stringify(details)

  const deja = await requeteUne<{ id: string }>(
    `select id from demandes_service
      where emplacement_id = $1::uuid and cle = 'commande' and statut = 'nouvelle' and cree_le > now() - interval '10 minutes'
        and details = $2::jsonb and note is not distinct from $3
      order by cree_le desc limit 1`,
    [emplacement.id, corps, precision],
  )
  if (deja) return { etat: 'ok', id: deja.id, deja: true, total, articles }

  const libelle = ui(d, 'commande')
  const ligne = await requeteUne<{ id: string }>(
    `insert into demandes_service (etablissement_id, emplacement_id, type_id, cle, libelle, note, langue, empreinte, details, total)
     select $1::uuid, $2::uuid, null, 'commande', $3, $4, $5, $6, $7::jsonb, $8
      where (select count(*) from demandes_service where empreinte is not distinct from $6 and $6 is not null and cree_le > now() - interval '1 hour') < 30
        and (select count(*) from demandes_service where etablissement_id = $1::uuid and cree_le > now() - interval '1 hour') < 400
     returning id`,
    [etab.id, emplacement.id, libelle.slice(0, 120), precision, langue.slice(0, 5), ctx.ipEmpreinte, corps, total],
  )
  if (!ligne) return { etat: 'trop' }

  void noterEvenement(etab.id, emplacement.id, 'demandes', 'commande', langue)
  const montant = total !== null ? ` · ${formaterPrix(total, etab.devise, d)}` : ''
  const resume = details
    .map((l) => `${l.quantite} × ${l.nom}${l.variante ? ` (${l.variante})` : ''}${l.note ? ` [${l.note}]` : ''}`)
    .join(', ')
  void notifierPersonnel(etab.id, emplacement.groupe, {
    titre: `🍽️ ${emplacement.libelle} · ${libelle} · ${ui(d, articles === 1 ? 'article' : 'articles', { n: articles })}${montant}`,
    corps: `${resume}${precision ? ` — « ${precision} »` : ''}`.slice(0, 180),
    url: `/service/${jetonPortail(etab.id, etab.version_lien)}`,
    etiquette: `demande-${ligne.id}`,
  }).catch(() => 0)
  return { etat: 'ok', id: ligne.id, deja: false, total, articles }
}

/** Les lignes et le total des commandes d'une liste de demandes (l'historique du back-office). */
export async function detailsCommandes(etabId: string, ids: string[]): Promise<Map<string, { details: LigneCommande[]; total: number | null }>> {
  const valides = ids.filter((x) => UUID.test(x))
  if (!valides.length) return new Map()
  const l = await requete<{ id: string; details: LigneCommande[] | null; total: number | null }>(
    `select id, details, total::float8 as total from demandes_service where etablissement_id = $1::uuid and id = any($2::uuid[]) and details is not null`,
    [etabId, valides],
  )
  return new Map(l.map((x) => [x.id, { details: x.details ?? [], total: x.total }]))
}

/** Où en est la demande, pour l'écran du client (seulement s'il est à l'emplacement de la demande). */
export async function etatPourClient(code: string, id: string): Promise<{ statut: StatutDemande; prise_par: string | null; cree_le: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  return requeteUne(
    `select d.statut, d.prise_par, d.cree_le from demandes_service d join emplacements e on e.id = d.emplacement_id
      where d.id = $1::uuid and e.code = $2`,
    [id, code.toUpperCase()],
  )
}

export async function annulerParClient(code: string, id: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false
  const l = await requeteUne<{ id: string }>(
    `update demandes_service d set statut = 'annulee' from emplacements e
      where d.id = $1::uuid and e.id = d.emplacement_id and e.code = $2 and d.statut = 'nouvelle' returning d.id`,
    [id, code.toUpperCase()],
  )
  return Boolean(l)
}

const SELECT = `select d.id, d.emplacement_id, e.libelle as emplacement, e.groupe, d.cle, d.libelle,
                       coalesce(t.icone, case when d.cle = 'commande' then '🍽️' end) as icone, d.note, d.langue, d.statut, d.prise_par,
                       d.cree_le, d.prise_le, d.faite_le, d.details, d.total::float8 as total
                  from demandes_service d left join emplacements e on e.id = d.emplacement_id left join types_demandes t on t.id = d.type_id`

/** La file du personnel : tout ce qui attend, puis ce qui a été fait aujourd'hui. */
export async function fileDuPersonnel(etabId: string): Promise<{ ouvertes: Demande[]; faites: Demande[] }> {
  const [ouvertes, faites] = await Promise.all([
    requete<Demande>(`${SELECT} where d.etablissement_id = $1::uuid and d.statut in ('nouvelle', 'prise') order by d.cree_le`, [etabId]),
    requete<Demande>(
      `${SELECT} where d.etablissement_id = $1::uuid and d.statut in ('faite', 'annulee') and d.cree_le > now() - interval '18 hours' order by coalesce(d.faite_le, d.cree_le) desc limit 30`,
      [etabId],
    ),
  ])
  return { ouvertes, faites }
}

export async function prendreDemande(etabId: string, id: string, par: string | null): Promise<boolean> {
  const l = await requeteUne<{ id: string }>(
    `update demandes_service set statut = 'prise', prise_le = coalesce(prise_le, now()), prise_par = coalesce($3, prise_par)
      where id = $2::uuid and etablissement_id = $1::uuid and statut in ('nouvelle', 'prise') returning id`,
    [etabId, id, par?.trim().slice(0, 60) || null],
  )
  return Boolean(l)
}

export async function terminerDemande(etabId: string, id: string, par: string | null): Promise<boolean> {
  const l = await requeteUne<{ id: string }>(
    `update demandes_service set statut = 'faite', prise_le = coalesce(prise_le, now()), faite_le = now(), prise_par = coalesce(prise_par, $3)
      where id = $2::uuid and etablissement_id = $1::uuid and statut in ('nouvelle', 'prise') returning id`,
    [etabId, id, par?.trim().slice(0, 60) || null],
  )
  return Boolean(l)
}

export async function rouvrirDemande(etabId: string, id: string): Promise<boolean> {
  const l = await requeteUne<{ id: string }>(
    `update demandes_service set statut = 'nouvelle', prise_le = null, faite_le = null, prise_par = null
      where id = $2::uuid and etablissement_id = $1::uuid and statut in ('faite', 'annulee') and cree_le > now() - interval '18 hours' returning id`,
    [etabId, id],
  )
  return Boolean(l)
}

// ---------------------------------------------------------------------------
// Retours (la note donnée juste après une demande, ou depuis l'accueil)
// ---------------------------------------------------------------------------

export async function enregistrerRetour(
  code: string,
  e: { demandeId: string | null; note: number; commentaire: string | null; langue: string },
  ctx: Contexte,
): Promise<{ id: string; avisUrl: string | null } | null> {
  const lieu = await parCode(code)
  if (!lieu || !Number.isInteger(e.note) || e.note < 1 || e.note > 5) return null
  const ligne = await requeteUne<{ id: string }>(
    `insert into retours_service (etablissement_id, emplacement_id, demande_id, note, commentaire, langue, empreinte)
     select $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7
      where (select count(*) from retours_service where empreinte is not distinct from $7 and $7 is not null and cree_le > now() - interval '1 hour') < 10
     returning id`,
    [
      lieu.etab.id,
      lieu.emplacement.id,
      e.demandeId && /^[0-9a-f-]{36}$/i.test(e.demandeId) ? e.demandeId : null,
      e.note,
      e.commentaire?.trim().slice(0, 1000) || null,
      e.langue.slice(0, 5),
      ctx.ipEmpreinte,
    ],
  )
  if (!ligne) return null
  // Une note basse avec un commentaire : le personnel le sait tout de suite, pendant que le client est encore là.
  if (e.note <= 3 && e.commentaire?.trim()) {
    void notifierPersonnel(lieu.etab.id, lieu.emplacement.groupe, {
      titre: `${'★'.repeat(e.note)}${'☆'.repeat(5 - e.note)} ${lieu.emplacement.libelle}`,
      corps: e.commentaire.trim().slice(0, 140),
      url: `/service/${jetonPortail(lieu.etab.id, lieu.etab.version_lien)}`,
      etiquette: `retour-${ligne.id}`,
    }).catch(() => 0)
  }
  // Le lien d'avis Google est offert à TOUS, quelle que soit la note : Google interdit de trier.
  return { id: ligne.id, avisUrl: lieu.etab.avis_url }
}

export async function retourVersGoogle(code: string, retourId: string | null, langue: string): Promise<string | null> {
  const lieu = await parCode(code)
  if (!lieu?.etab.avis_url) return null
  if (retourId && /^[0-9a-f-]{36}$/i.test(retourId)) {
    await requete(`update retours_service set google = true where id = $1::uuid and etablissement_id = $2::uuid`, [retourId, lieu.etab.id])
  }
  void noterEvenement(lieu.etab.id, lieu.emplacement.id, 'avis_google', null, langue)
  return lieu.etab.avis_url
}
