import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import { LANGUES, manquantes, type Texte } from '@/lib/services/langues'
import { DEMANDES_PAR_DEFAUT, optionsParDefaut, type Options, type StatutDemande, type TypeEtablissement, type Variante } from '@/lib/services/types'

/**
 * Le back-office de Tapora Services : toutes les écritures. Chaque fonction
 * reçoit l'établissement et ne touche QUE ses lignes (un id venu d'un
 * formulaire n'est jamais cru sans le filtre de l'établissement). Les
 * appelants (actions serveur) ont déjà vérifié le propriétaire.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODES_LANGUES = LANGUES.map((l) => l.code) as string[]

function verifierId(id: string, quoi = 'Élément'): string {
  if (!UUID.test(id)) throw new Error(`${quoi} introuvable.`)
  return id
}

/** Un texte par langue, nettoyé : seules les langues connues, chaque valeur coupée à `max`. */
export function nettoyerTexte(t: Record<string, unknown> | null | undefined, max = 300): Texte {
  const sortie: Record<string, string> = {}
  for (const [l, v] of Object.entries(t ?? {})) {
    if (!CODES_LANGUES.includes(l) || typeof v !== 'string') continue
    const x = v.trim().slice(0, max)
    if (x) sortie[l] = x
  }
  return sortie as Texte
}

const j = (v: unknown) => JSON.stringify(v ?? {})

// ---------------------------------------------------------------------------
// Établissements
// ---------------------------------------------------------------------------

export type NouvelEtablissement = { type: TypeEtablissement; nom: string; langues: string[]; langue_defaut: string }

export function languesValides(langues: string[], defaut: string): { langues: string[]; defaut: string } {
  const propres = [...new Set(langues.filter((l) => CODES_LANGUES.includes(l)))]
  if (!propres.length) propres.push('fr')
  const d = propres.includes(defaut) ? defaut : propres[0]
  // La langue par défaut passe en tête de liste (au Québec : le français).
  return { langues: [d, ...propres.filter((l) => l !== d)].slice(0, 12), defaut: d }
}

/** Crée l'établissement avec ses demandes par défaut (et, pour un hôtel, l'ossature du concierge). */
export async function creerEtablissement(e: NouvelEtablissement): Promise<string> {
  const nom = e.nom.trim().slice(0, 120)
  if (!nom) throw new Error('Donnez un nom à l’établissement.')
  const { langues, defaut } = languesValides(e.langues, e.langue_defaut)
  const l = await requeteUne<{ id: string }>(
    `insert into etablissements (type, nom, langues, langue_defaut, options) values ($1, $2, $3::text[], $4, $5::jsonb) returning id`,
    [e.type, nom, langues, defaut, j(optionsParDefaut(e.type))],
  )
  const id = l!.id
  await semerDemandes(id, e.type)
  if (e.type === 'hotel') await semerConcierge(id)
  return id
}

export async function semerDemandes(etabId: string, type: TypeEtablissement): Promise<void> {
  for (const d of DEMANDES_PAR_DEFAUT[type]) {
    await requete(
      `insert into types_demandes (etablissement_id, cle, libelle, icone, avec_note, avis_apres, ordre)
       values ($1::uuid, $2, $3::jsonb, $4, $5, $6, $7) on conflict (etablissement_id, cle) do nothing`,
      [etabId, d.cle, j(d.libelle), d.icone, d.avec_note, d.avis_apres, d.ordre],
    )
  }
}

async function semerConcierge(etabId: string): Promise<void> {
  const base: [string, string, Texte, Texte][] = [
    ['horaires', '🕐', { fr: 'Arrivée et départ', en: 'Check-in and check-out' }, { fr: 'Arrivée dès 15 h · départ avant 11 h.', en: 'Check-in from 3 p.m. · check-out by 11 a.m.' }],
    ['service', '🛎️', { fr: 'Réception', en: 'Front desk' }, { fr: 'Ouverte 24 heures sur 24.', en: 'Open 24 hours a day.' }],
    ['urgence', '🚨', { fr: 'Urgences', en: 'Emergencies' }, { fr: 'Composez le 911. Pour la réception : le 0 depuis le téléphone de la chambre.', en: 'Dial 911. For the front desk: dial 0 from the room phone.' }],
  ]
  let ordre = 1
  for (const [type, icone, titre, texte] of base) {
    await requete(
      `insert into rubriques_concierge (etablissement_id, type, icone, titre, texte, ordre) values ($1::uuid, $2, $3, $4::jsonb, $5::jsonb, $6)`,
      [etabId, type, icone, j(titre), j(texte), ordre++],
    )
  }
}

export async function modifierIdentite(id: string, e: { nom: string; type: TypeEtablissement }): Promise<void> {
  const nom = e.nom.trim().slice(0, 120)
  if (!nom) throw new Error('Le nom est requis.')
  await requete(`update etablissements set nom = $2, type = $3, maj_le = now() where id = $1::uuid`, [verifierId(id), nom, e.type])
}

export async function modifierApparence(id: string, couleur: string): Promise<void> {
  if (!/^#[0-9a-fA-F]{6}$/.test(couleur)) throw new Error('Couleur invalide.')
  await requete(`update etablissements set couleur = $2, maj_le = now() where id = $1::uuid`, [verifierId(id), couleur])
}

export async function definirImage(id: string, quoi: 'logo' | 'couverture', chemin: string | null): Promise<void> {
  await requete(`update etablissements set ${quoi === 'logo' ? 'logo' : 'couverture'} = $2, maj_le = now() where id = $1::uuid`, [verifierId(id), chemin])
}

export async function modifierLangues(id: string, langues: string[], defaut: string): Promise<void> {
  const v = languesValides(langues, defaut)
  await requete(`update etablissements set langues = $2::text[], langue_defaut = $3, maj_le = now() where id = $1::uuid`, [verifierId(id), v.langues, v.defaut])
}

export async function modifierAccueil(id: string, accueil: Texte): Promise<void> {
  await requete(`update etablissements set accueil = $2::jsonb, maj_le = now() where id = $1::uuid`, [verifierId(id), j(nettoyerTexte(accueil, 400))])
}

export async function modifierOptions(id: string, options: Options): Promise<void> {
  await requete(`update etablissements set options = $2::jsonb, maj_le = now() where id = $1::uuid`, [verifierId(id), j(options)])
}

const https = (v: string | null) => {
  const x = v?.trim() || null
  if (!x) return null
  const u = /^https?:\/\//i.test(x) ? x.replace(/^http:\/\//i, 'https://') : `https://${x}`
  try {
    const url = new URL(u)
    if (url.protocol !== 'https:' || !url.hostname.includes('.')) throw new Error()
    return url.toString().slice(0, 600)
  } catch {
    throw new Error(`Adresse web invalide : ${x}`)
  }
}

export async function modifierCoordonnees(
  id: string,
  e: { adresse: string | null; telephone: string | null; site_web: string | null; avis_url: string | null; wifi_nom: string | null; wifi_mdp: string | null },
): Promise<void> {
  await requete(
    `update etablissements set adresse = $2, telephone = $3, site_web = $4, avis_url = $5, wifi_nom = $6, wifi_mdp = $7, maj_le = now() where id = $1::uuid`,
    [
      verifierId(id),
      e.adresse?.trim().slice(0, 300) || null,
      e.telephone?.trim().slice(0, 40) || null,
      https(e.site_web),
      https(e.avis_url),
      e.wifi_nom?.trim().slice(0, 64) || null,
      e.wifi_mdp?.trim().slice(0, 64) || null,
    ],
  )
}

export async function modifierWifi(id: string, nom: string | null, mdp: string | null): Promise<void> {
  await requete(`update etablissements set wifi_nom = $2, wifi_mdp = $3, maj_le = now() where id = $1::uuid`, [
    verifierId(id),
    nom?.trim().slice(0, 64) || null,
    mdp?.trim().slice(0, 64) || null,
  ])
}

export async function modifierFormule(
  id: string,
  e: { formule: 'essai' | 'actif' | 'suspendu'; essai_jusqua: string | null; prix_mensuel: number | null; contact_nom: string | null; contact_courriel: string | null; notes: string | null },
): Promise<void> {
  if (e.essai_jusqua && !/^\d{4}-\d{2}-\d{2}$/.test(e.essai_jusqua)) throw new Error('Date de fin d’essai invalide.')
  if (e.prix_mensuel !== null && (!Number.isFinite(e.prix_mensuel) || e.prix_mensuel < 0 || e.prix_mensuel > 100000)) throw new Error('Prix mensuel invalide.')
  const courriel = e.contact_courriel?.trim() || null
  if (courriel && !/^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$/i.test(courriel)) throw new Error('Courriel du contact invalide.')
  await requete(
    `update etablissements set formule = $2, essai_jusqua = $3::date, prix_mensuel = $4, contact_nom = $5, contact_courriel = $6, notes = $7, maj_le = now()
      where id = $1::uuid`,
    [verifierId(id), e.formule, e.essai_jusqua, e.prix_mensuel, e.contact_nom?.trim().slice(0, 120) || null, courriel, e.notes?.trim().slice(0, 4000) || null],
  )
}

export async function basculerEtablissement(id: string, actif: boolean): Promise<void> {
  await requete(`update etablissements set actif = $2, maj_le = now() where id = $1::uuid`, [verifierId(id), actif])
}

export async function supprimerEtablissement(id: string): Promise<void> {
  await requete(`delete from etablissements where id = $1::uuid`, [verifierId(id)])
}

// ---------------------------------------------------------------------------
// Ordre : monter / descendre parmi ses frères
// ---------------------------------------------------------------------------

type TableOrdonnee = 'emplacements' | 'menus' | 'menu_sections' | 'menu_items' | 'annonces_service' | 'rubriques_concierge' | 'types_demandes'
const PARENT: Record<TableOrdonnee, string> = {
  emplacements: 'etablissement_id',
  menus: 'etablissement_id',
  menu_sections: 'menu_id',
  menu_items: 'section_id',
  annonces_service: 'etablissement_id',
  rubriques_concierge: 'etablissement_id',
  types_demandes: 'etablissement_id',
}

async function deplacer(table: TableOrdonnee, parentId: string, id: string, sens: -1 | 1): Promise<void> {
  const col = PARENT[table]
  const freres = await requete<{ id: string }>(`select id from ${table} where ${col} = $1::uuid order by ordre, id`, [parentId])
  const i = freres.findIndex((f) => f.id === id)
  const k = i + sens
  if (i < 0 || k < 0 || k >= freres.length) return
  ;[freres[i], freres[k]] = [freres[k], freres[i]]
  await requete(
    `update ${table} t set ordre = x.o from unnest($1::uuid[]) with ordinality as x(id, o) where t.id = x.id and t.${col} = $2::uuid`,
    [freres.map((f) => f.id), parentId],
  )
}

async function prochainOrdre(table: TableOrdonnee, parentId: string): Promise<number> {
  const l = await requeteUne<{ n: number }>(`select coalesce(max(ordre), 0)::int + 1 as n from ${table} where ${PARENT[table]} = $1::uuid`, [parentId])
  return l?.n ?? 1
}

// ---------------------------------------------------------------------------
// Emplacements
// ---------------------------------------------------------------------------

type TypeEmplacement = 'table' | 'chambre' | 'zone' | 'comptoir'

/** « Table 1 » à « Table 24 » en un geste (300 au plus). */
export async function creerEmplacements(etabId: string, e: { prefixe: string; de: number; a: number; type: TypeEmplacement; groupe: string | null }): Promise<number> {
  const prefixe = e.prefixe.trim().slice(0, 40)
  if (!prefixe) throw new Error('Donnez un nom de base (ex. « Table » ou « Chambre »).')
  if (!Number.isInteger(e.de) || !Number.isInteger(e.a) || e.de < 0 || e.a < e.de || e.a - e.de >= 300 || e.a > 99999) throw new Error('De 1 à 300 emplacements à la fois.')
  const depart = await prochainOrdre('emplacements', verifierId(etabId))
  const libelles = Array.from({ length: e.a - e.de + 1 }, (_, i) => `${prefixe} ${e.de + i}`)
  await requete(
    `insert into emplacements (etablissement_id, type, libelle, groupe, ordre)
     select $1::uuid, $2, l, $3, $4 + o - 1 from unnest($5::text[]) with ordinality as x(l, o)`,
    [etabId, e.type, e.groupe?.trim().slice(0, 60) || null, depart, libelles],
  )
  return libelles.length
}

export async function creerEmplacement(etabId: string, e: { libelle: string; type: TypeEmplacement; groupe: string | null }): Promise<void> {
  const libelle = e.libelle.trim().slice(0, 60)
  if (!libelle) throw new Error('Le nom est requis.')
  await requete(`insert into emplacements (etablissement_id, type, libelle, groupe, ordre) values ($1::uuid, $2, $3, $4, $5)`, [
    verifierId(etabId),
    e.type,
    libelle,
    e.groupe?.trim().slice(0, 60) || null,
    await prochainOrdre('emplacements', etabId),
  ])
}

export async function modifierEmplacement(etabId: string, id: string, e: { libelle: string; type: TypeEmplacement; groupe: string | null }): Promise<void> {
  const libelle = e.libelle.trim().slice(0, 60)
  if (!libelle) throw new Error('Le nom est requis.')
  await requete(`update emplacements set libelle = $3, type = $4, groupe = $5 where id = $2::uuid and etablissement_id = $1::uuid`, [
    verifierId(etabId),
    verifierId(id),
    libelle,
    e.type,
    e.groupe?.trim().slice(0, 60) || null,
  ])
}

export async function basculerEmplacement(etabId: string, id: string, actif: boolean): Promise<void> {
  await requete(`update emplacements set actif = $3 where id = $2::uuid and etablissement_id = $1::uuid`, [verifierId(etabId), verifierId(id), actif])
}

export async function supprimerEmplacement(etabId: string, id: string): Promise<void> {
  await requete(`delete from emplacements where id = $2::uuid and etablissement_id = $1::uuid`, [verifierId(etabId), verifierId(id)])
}

export async function deplacerEmplacement(etabId: string, id: string, sens: -1 | 1): Promise<void> {
  await deplacer('emplacements', verifierId(etabId), verifierId(id), sens)
}

// ---------------------------------------------------------------------------
// Menus, sections, plats
// ---------------------------------------------------------------------------

type TypeMenu = 'carte' | 'boissons' | 'room_service' | 'dejeuner' | 'autre'

async function menuDe(etabId: string, menuId: string): Promise<void> {
  const l = await requeteUne(`select 1 from menus where id = $2::uuid and etablissement_id = $1::uuid`, [verifierId(etabId), verifierId(menuId, 'Menu')])
  if (!l) throw new Error('Menu introuvable.')
}

async function sectionDe(etabId: string, sectionId: string): Promise<string> {
  const l = await requeteUne<{ menu_id: string }>(
    `select s.menu_id from menu_sections s join menus m on m.id = s.menu_id where s.id = $2::uuid and m.etablissement_id = $1::uuid`,
    [verifierId(etabId), verifierId(sectionId, 'Section')],
  )
  if (!l) throw new Error('Section introuvable.')
  return l.menu_id
}

async function platDe(etabId: string, platId: string): Promise<string> {
  const l = await requeteUne<{ section_id: string }>(
    `select i.section_id from menu_items i join menu_sections s on s.id = i.section_id join menus m on m.id = s.menu_id
      where i.id = $2::uuid and m.etablissement_id = $1::uuid`,
    [verifierId(etabId), verifierId(platId, 'Plat')],
  )
  if (!l) throw new Error('Plat introuvable.')
  return l.section_id
}

export type ChampsMenu = { type: TypeMenu; nom: Texte; description: Texte; heure_debut: string | null; heure_fin: string | null; jours: number[]; actif: boolean }

function verifierHoraires(e: Pick<ChampsMenu, 'heure_debut' | 'heure_fin' | 'jours'>): void {
  for (const h of [e.heure_debut, e.heure_fin]) if (h && !/^([01]\d|2[0-3]):[0-5]\d$/.test(h)) throw new Error('Heure invalide (format 11:30).')
  if (Boolean(e.heure_debut) !== Boolean(e.heure_fin)) throw new Error('Donnez l’heure de début ET de fin, ou aucune.')
  if (!e.jours.length || e.jours.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) throw new Error('Choisissez au moins un jour.')
}

export async function creerMenu(etabId: string, type: TypeMenu, nom: Texte): Promise<string> {
  const n = nettoyerTexte(nom, 80)
  if (!Object.keys(n).length) throw new Error('Donnez un nom au menu.')
  const l = await requeteUne<{ id: string }>(`insert into menus (etablissement_id, type, nom, ordre) values ($1::uuid, $2, $3::jsonb, $4) returning id`, [
    verifierId(etabId),
    type,
    j(n),
    await prochainOrdre('menus', etabId),
  ])
  return l!.id
}

export async function modifierMenu(etabId: string, menuId: string, e: ChampsMenu): Promise<void> {
  await menuDe(etabId, menuId)
  verifierHoraires(e)
  const nom = nettoyerTexte(e.nom, 80)
  if (!Object.keys(nom).length) throw new Error('Le menu doit avoir un nom.')
  await requete(
    `update menus set type = $3, nom = $4::jsonb, description = $5::jsonb, heure_debut = $6::time, heure_fin = $7::time, jours = $8::smallint[], actif = $9
      where id = $2::uuid and etablissement_id = $1::uuid`,
    [etabId, menuId, e.type, j(nom), j(nettoyerTexte(e.description, 400)), e.heure_debut, e.heure_fin, [...new Set(e.jours)].sort(), e.actif],
  )
}

export async function definirPdfMenu(etabId: string, menuId: string, langue: string, chemin: string | null): Promise<void> {
  await menuDe(etabId, menuId)
  if (!CODES_LANGUES.includes(langue)) throw new Error('Langue inconnue.')
  await requete(
    chemin
      ? `update menus set pdf = pdf || jsonb_build_object($3::text, $4::text) where id = $2::uuid and etablissement_id = $1::uuid`
      : `update menus set pdf = pdf - $3::text where id = $2::uuid and etablissement_id = $1::uuid`,
    chemin ? [etabId, menuId, langue, chemin] : [etabId, menuId, langue],
  )
}

export async function supprimerMenu(etabId: string, menuId: string): Promise<void> {
  await requete(`delete from menus where id = $2::uuid and etablissement_id = $1::uuid`, [verifierId(etabId), verifierId(menuId)])
}

export async function deplacerMenu(etabId: string, menuId: string, sens: -1 | 1): Promise<void> {
  await deplacer('menus', verifierId(etabId), verifierId(menuId), sens)
}

export async function creerSection(etabId: string, menuId: string, nom: Texte): Promise<string> {
  await menuDe(etabId, menuId)
  const n = nettoyerTexte(nom, 80)
  if (!Object.keys(n).length) throw new Error('Donnez un nom à la section.')
  const l = await requeteUne<{ id: string }>(`insert into menu_sections (menu_id, nom, ordre) values ($1::uuid, $2::jsonb, $3) returning id`, [
    menuId,
    j(n),
    await prochainOrdre('menu_sections', menuId),
  ])
  return l!.id
}

export async function modifierSection(etabId: string, sectionId: string, nom: Texte, description: Texte): Promise<void> {
  await sectionDe(etabId, sectionId)
  const n = nettoyerTexte(nom, 80)
  if (!Object.keys(n).length) throw new Error('La section doit avoir un nom.')
  await requete(`update menu_sections set nom = $2::jsonb, description = $3::jsonb where id = $1::uuid`, [sectionId, j(n), j(nettoyerTexte(description, 300))])
}

export async function supprimerSection(etabId: string, sectionId: string): Promise<void> {
  await sectionDe(etabId, sectionId)
  await requete(`delete from menu_sections where id = $1::uuid`, [sectionId])
}

export async function deplacerSection(etabId: string, sectionId: string, sens: -1 | 1): Promise<void> {
  const menuId = await sectionDe(etabId, sectionId)
  await deplacer('menu_sections', menuId, sectionId, sens)
}

export type ChampsPlat = {
  nom: Texte
  description: Texte
  prix: number | null
  variantes: Variante[]
  allergenes: string[]
  etiquettes: string[]
  disponible: boolean
}

function verifierPlat(e: ChampsPlat): ChampsPlat {
  const nom = nettoyerTexte(e.nom, 120)
  if (!Object.keys(nom).length) throw new Error('Le plat doit avoir un nom.')
  if (e.prix !== null && (!Number.isFinite(e.prix) || e.prix < 0 || e.prix > 100000)) throw new Error('Prix invalide.')
  return {
    nom,
    description: nettoyerTexte(e.description, 600),
    prix: e.prix === null ? null : Math.round(e.prix * 100) / 100,
    variantes: e.variantes
      .map((v) => ({ nom: nettoyerTexte(v.nom as Record<string, unknown>, 60), prix: v.prix === null || !Number.isFinite(v.prix) ? null : Math.round(v.prix * 100) / 100 }))
      .filter((v) => Object.keys(v.nom).length)
      .slice(0, 12),
    allergenes: [...new Set(e.allergenes)].filter((a) => /^[a-z_]{2,20}$/.test(a)).slice(0, 15),
    etiquettes: [...new Set(e.etiquettes)].filter((a) => /^[a-z_]{2,20}$/.test(a)).slice(0, 12),
    disponible: e.disponible,
  }
}

export async function creerPlat(etabId: string, sectionId: string, e: ChampsPlat): Promise<string> {
  await sectionDe(etabId, sectionId)
  const p = verifierPlat(e)
  const l = await requeteUne<{ id: string }>(
    `insert into menu_items (section_id, nom, description, prix, variantes, allergenes, etiquettes, disponible, ordre)
     values ($1::uuid, $2::jsonb, $3::jsonb, $4, $5::jsonb, $6::text[], $7::text[], $8, $9) returning id`,
    [sectionId, j(p.nom), j(p.description), p.prix, JSON.stringify(p.variantes), p.allergenes, p.etiquettes, p.disponible, await prochainOrdre('menu_items', sectionId)],
  )
  return l!.id
}

export async function modifierPlat(etabId: string, platId: string, e: ChampsPlat & { section_id?: string }): Promise<void> {
  const sectionActuelle = await platDe(etabId, platId)
  const p = verifierPlat(e)
  let section = sectionActuelle
  if (e.section_id && e.section_id !== sectionActuelle) {
    await sectionDe(etabId, e.section_id)
    section = e.section_id
  }
  await requete(
    `update menu_items set section_id = $2::uuid, nom = $3::jsonb, description = $4::jsonb, prix = $5, variantes = $6::jsonb,
            allergenes = $7::text[], etiquettes = $8::text[], disponible = $9 where id = $1::uuid`,
    [platId, section, j(p.nom), j(p.description), p.prix, JSON.stringify(p.variantes), p.allergenes, p.etiquettes, p.disponible],
  )
}

export async function basculerDisponible(etabId: string, platId: string, disponible: boolean): Promise<void> {
  await platDe(etabId, platId)
  await requete(`update menu_items set disponible = $2 where id = $1::uuid`, [platId, disponible])
}

export async function definirPhotoPlat(etabId: string, platId: string, chemin: string | null): Promise<void> {
  await platDe(etabId, platId)
  await requete(`update menu_items set photo = $2 where id = $1::uuid`, [platId, chemin])
}

export async function dupliquerPlat(etabId: string, platId: string): Promise<string> {
  const section = await platDe(etabId, platId)
  const l = await requeteUne<{ id: string }>(
    `insert into menu_items (section_id, nom, description, prix, variantes, photo, allergenes, etiquettes, disponible, ordre)
     select section_id,
            (select coalesce(jsonb_object_agg(k, v || ' (copie)'), '{}'::jsonb) from jsonb_each_text(nom) as e(k, v)),
            description, prix, variantes, photo, allergenes, etiquettes, disponible, $2
       from menu_items where id = $1::uuid returning id`,
    [platId, await prochainOrdre('menu_items', section)],
  )
  return l!.id
}

export async function supprimerPlat(etabId: string, platId: string): Promise<void> {
  await platDe(etabId, platId)
  await requete(`delete from menu_items where id = $1::uuid`, [platId])
}

export async function deplacerPlat(etabId: string, platId: string, sens: -1 | 1): Promise<void> {
  const section = await platDe(etabId, platId)
  await deplacer('menu_items', section, platId, sens)
}

/** « 12,50 $ », « 12.5 », « 12 » → 12.5 ; sinon null. */
export function lirePrix(v: string | null | undefined): number | null {
  const x = (v ?? '').replace(/[\s$€£]|CAD/gi, '').replace(',', '.')
  if (!x) return null
  const n = Number(x)
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? Math.round(n * 100) / 100 : null
}

/**
 * Importer un menu collé en texte, dans la langue par défaut :
 *   ## Entrées
 *   Soupe du jour | Selon l'humeur du chef | 7
 *   Frites | 5,50
 * Une ligne « ## … » ouvre une section ; chaque autre ligne est un plat
 * (nom | description | prix, ou nom | prix, ou nom seul).
 */
export async function importerTexte(etabId: string, menuId: string, brut: string, langue: string): Promise<{ sections: number; plats: number }> {
  await menuDe(etabId, menuId)
  const lignes = brut.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 600)
  let section: string | null = null
  let sections = 0
  let plats = 0
  for (const ligne of lignes) {
    const titre = /^#{1,3}\s*(.+)$/.exec(ligne)
    if (titre) {
      section = await creerSection(etabId, menuId, { [langue]: titre[1].trim() } as Texte)
      sections++
      continue
    }
    if (!section) {
      section = await creerSection(etabId, menuId, { [langue]: langue === 'fr' ? 'Menu' : 'Menu' } as Texte)
      sections++
    }
    const parts = ligne.split('|').map((p) => p.trim())
    const nom = parts[0]
    if (!nom) continue
    let description = ''
    let prix: number | null = null
    if (parts.length >= 3) {
      description = parts[1]
      prix = lirePrix(parts[2])
    } else if (parts.length === 2) {
      const p = lirePrix(parts[1])
      if (p !== null) prix = p
      else description = parts[1]
    }
    await creerPlat(etabId, section, {
      nom: { [langue]: nom } as Texte,
      description: description ? ({ [langue]: description } as Texte) : {},
      prix,
      variantes: [],
      allergenes: [],
      etiquettes: [],
      disponible: true,
    })
    plats++
  }
  return { sections, plats }
}

// ---------------------------------------------------------------------------
// Annonces
// ---------------------------------------------------------------------------

export type ChampsAnnonce = { type: 'plat_du_jour' | 'promo' | 'info' | 'evenement'; titre: Texte; texte: Texte; prix: number | null; debut: string | null; fin: string | null; actif: boolean }

function verifierAnnonce(e: ChampsAnnonce): ChampsAnnonce {
  const titre = nettoyerTexte(e.titre, 120)
  if (!Object.keys(titre).length) throw new Error('L’annonce doit avoir un titre.')
  for (const d of [e.debut, e.fin]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Date invalide.')
  if (e.debut && e.fin && e.fin < e.debut) throw new Error('La fin est avant le début.')
  return { ...e, titre, texte: nettoyerTexte(e.texte, 600), prix: e.prix === null ? null : Math.round(e.prix * 100) / 100 }
}

export async function creerAnnonce(etabId: string, e: ChampsAnnonce): Promise<void> {
  const a = verifierAnnonce(e)
  await requete(
    `insert into annonces_service (etablissement_id, type, titre, texte, prix, debut, fin, actif, ordre) values ($1::uuid, $2, $3::jsonb, $4::jsonb, $5, $6::date, $7::date, $8, $9)`,
    [verifierId(etabId), a.type, j(a.titre), j(a.texte), a.prix, a.debut, a.fin, a.actif, await prochainOrdre('annonces_service', etabId)],
  )
}

export async function modifierAnnonce(etabId: string, id: string, e: ChampsAnnonce): Promise<void> {
  const a = verifierAnnonce(e)
  await requete(
    `update annonces_service set type = $3, titre = $4::jsonb, texte = $5::jsonb, prix = $6, debut = $7::date, fin = $8::date, actif = $9
      where id = $2::uuid and etablissement_id = $1::uuid`,
    [verifierId(etabId), verifierId(id), a.type, j(a.titre), j(a.texte), a.prix, a.debut, a.fin, a.actif],
  )
}

export async function supprimerAnnonce(etabId: string, id: string): Promise<void> {
  await requete(`delete from annonces_service where id = $2::uuid and etablissement_id = $1::uuid`, [verifierId(etabId), verifierId(id)])
}

export async function deplacerAnnonce(etabId: string, id: string, sens: -1 | 1): Promise<void> {
  await deplacer('annonces_service', verifierId(etabId), verifierId(id), sens)
}

// ---------------------------------------------------------------------------
// Concierge
// ---------------------------------------------------------------------------

export type ChampsRubrique = { type: string; icone: string | null; titre: Texte; texte: Texte; lien: string | null; telephone: string | null; actif: boolean }

const TYPES_RUBRIQUES = ['horaires', 'service', 'restauration', 'activite', 'recommandation', 'transport', 'urgence', 'regle', 'autre']

function verifierRubrique(e: ChampsRubrique): ChampsRubrique {
  const titre = nettoyerTexte(e.titre, 120)
  if (!Object.keys(titre).length) throw new Error('La rubrique doit avoir un titre.')
  if (!TYPES_RUBRIQUES.includes(e.type)) throw new Error('Type de rubrique inconnu.')
  return {
    ...e,
    titre,
    texte: nettoyerTexte(e.texte, 2000),
    icone: e.icone?.trim().slice(0, 16) || null,
    lien: https(e.lien),
    telephone: e.telephone?.trim().slice(0, 40) || null,
  }
}

export async function creerRubrique(etabId: string, e: ChampsRubrique): Promise<void> {
  const r = verifierRubrique(e)
  await requete(
    `insert into rubriques_concierge (etablissement_id, type, icone, titre, texte, lien, telephone, actif, ordre)
     values ($1::uuid, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9)`,
    [verifierId(etabId), r.type, r.icone, j(r.titre), j(r.texte), r.lien, r.telephone, r.actif, await prochainOrdre('rubriques_concierge', etabId)],
  )
}

export async function modifierRubrique(etabId: string, id: string, e: ChampsRubrique): Promise<void> {
  const r = verifierRubrique(e)
  await requete(
    `update rubriques_concierge set type = $3, icone = $4, titre = $5::jsonb, texte = $6::jsonb, lien = $7, telephone = $8, actif = $9
      where id = $2::uuid and etablissement_id = $1::uuid`,
    [verifierId(etabId), verifierId(id), r.type, r.icone, j(r.titre), j(r.texte), r.lien, r.telephone, r.actif],
  )
}

export async function supprimerRubrique(etabId: string, id: string): Promise<void> {
  await requete(`delete from rubriques_concierge where id = $2::uuid and etablissement_id = $1::uuid`, [verifierId(etabId), verifierId(id)])
}

export async function deplacerRubrique(etabId: string, id: string, sens: -1 | 1): Promise<void> {
  await deplacer('rubriques_concierge', verifierId(etabId), verifierId(id), sens)
}

// ---------------------------------------------------------------------------
// Types de demandes
// ---------------------------------------------------------------------------

export type ChampsTypeDemande = { libelle: Texte; icone: string | null; avec_note: boolean; avis_apres: boolean; actif: boolean }

/** « Couverture chauffante » → « couverture_chauffante » (unique dans l'établissement). */
function cleDe(libelle: string): string {
  const base =
    libelle
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 24) || 'demande'
  return base.length >= 2 ? base : `${base}_x`
}

export async function creerTypeDemande(etabId: string, e: ChampsTypeDemande): Promise<void> {
  const libelle = nettoyerTexte(e.libelle, 60)
  const premier = Object.values(libelle)[0]
  if (!premier) throw new Error('Donnez un libellé à la demande.')
  let cle = cleDe(premier)
  for (let i = 2; i < 50; i++) {
    const pris = await requeteUne(`select 1 from types_demandes where etablissement_id = $1::uuid and cle = $2`, [verifierId(etabId), cle])
    if (!pris) break
    cle = `${cleDe(premier).slice(0, 26)}_${i}`
  }
  await requete(
    `insert into types_demandes (etablissement_id, cle, libelle, icone, avec_note, avis_apres, actif, ordre) values ($1::uuid, $2, $3::jsonb, $4, $5, $6, $7, $8)`,
    [etabId, cle, j(libelle), e.icone?.trim().slice(0, 16) || null, e.avec_note, e.avis_apres, e.actif, await prochainOrdre('types_demandes', etabId)],
  )
}

export async function modifierTypeDemande(etabId: string, id: string, e: ChampsTypeDemande): Promise<void> {
  const libelle = nettoyerTexte(e.libelle, 60)
  if (!Object.keys(libelle).length) throw new Error('Le libellé est requis.')
  await requete(
    `update types_demandes set libelle = $3::jsonb, icone = $4, avec_note = $5, avis_apres = $6, actif = $7 where id = $2::uuid and etablissement_id = $1::uuid`,
    [verifierId(etabId), verifierId(id), j(libelle), e.icone?.trim().slice(0, 16) || null, e.avec_note, e.avis_apres, e.actif],
  )
}

export async function supprimerTypeDemande(etabId: string, id: string): Promise<void> {
  await requete(`delete from types_demandes where id = $2::uuid and etablissement_id = $1::uuid`, [verifierId(etabId), verifierId(id)])
}

export async function deplacerTypeDemande(etabId: string, id: string, sens: -1 | 1): Promise<void> {
  await deplacer('types_demandes', verifierId(etabId), verifierId(id), sens)
}

// ---------------------------------------------------------------------------
// Historique et traductions
// ---------------------------------------------------------------------------

export type LigneHistorique = {
  id: string
  cree_le: string
  emplacement: string | null
  groupe: string | null
  cle: string
  libelle: string
  icone: string | null
  note: string | null
  langue: string
  statut: StatutDemande
  prise_par: string | null
  attente_sec: number | null
  duree_sec: number | null
}

export async function historiqueDemandes(
  etabId: string,
  f: { cle?: string | null; statut?: string | null; emplacement?: string | null; jours: number },
): Promise<LigneHistorique[]> {
  return requete<LigneHistorique>(
    `select d.id, d.cree_le, e.libelle as emplacement, e.groupe, d.cle, d.libelle, t.icone, d.note, d.langue, d.statut, d.prise_par,
            extract(epoch from d.prise_le - d.cree_le)::float8 as attente_sec,
            extract(epoch from d.faite_le - d.cree_le)::float8 as duree_sec
       from demandes_service d left join emplacements e on e.id = d.emplacement_id left join types_demandes t on t.id = d.type_id
      where d.etablissement_id = $1::uuid and d.cree_le >= now() - make_interval(days => $2::int)
        and ($3::text is null or d.cle = $3) and ($4::text is null or d.statut = $4) and ($5::uuid is null or d.emplacement_id = $5::uuid)
      order by d.cree_le desc limit 300`,
    [verifierId(etabId), f.jours, f.cle || null, f.statut || null, f.emplacement && UUID.test(f.emplacement) ? f.emplacement : null],
  )
}

/** Combien de textes manquent dans chaque langue de l'établissement (menus, concierge, annonces, demandes, accueil). */
export async function traductionsManquantes(etabId: string, langues: string[], defaut: string): Promise<Record<string, number>> {
  const [textes] = await Promise.all([
    requete<{ t: Texte }>(
      `select nom as t from menus where etablissement_id = $1::uuid
       union all select s.nom from menu_sections s join menus m on m.id = s.menu_id where m.etablissement_id = $1::uuid
       union all select i.nom from menu_items i join menu_sections s on s.id = i.section_id join menus m on m.id = s.menu_id where m.etablissement_id = $1::uuid
       union all select i.description from menu_items i join menu_sections s on s.id = i.section_id join menus m on m.id = s.menu_id
                  where m.etablissement_id = $1::uuid and i.description <> '{}'::jsonb
       union all select titre from annonces_service where etablissement_id = $1::uuid
       union all select texte from annonces_service where etablissement_id = $1::uuid and texte <> '{}'::jsonb
       union all select titre from rubriques_concierge where etablissement_id = $1::uuid
       union all select texte from rubriques_concierge where etablissement_id = $1::uuid and texte <> '{}'::jsonb
       union all select libelle from types_demandes where etablissement_id = $1::uuid
       union all select accueil from etablissements where id = $1::uuid and accueil <> '{}'::jsonb`,
      [verifierId(etabId)],
    ),
  ])
  const compte: Record<string, number> = {}
  for (const l of langues) if (l !== defaut) compte[l] = 0
  for (const { t } of textes) for (const m of manquantes(t, langues)) if (m !== defaut) compte[m] = (compte[m] ?? 0) + 1
  return compte
}

// ---------------------------------------------------------------------------
// Vue d'ensemble et mise en route
// ---------------------------------------------------------------------------

/** Pour la page d'accueil : les visites des 14 derniers jours et les demandes en attente, par établissement. */
export async function apercuEnsemble(fuseau = 'America/Toronto'): Promise<{ tendances: Record<string, number[]>; ouvertes: Record<string, number> }> {
  const [jours, attente] = await Promise.all([
    requete<{ id: string; jour: string; n: number }>(
      `select etablissement_id as id, to_char((cree_le at time zone $1)::date, 'YYYY-MM-DD') as jour, count(*)::int as n
         from evenements_service
        where type = 'ouverture' and cree_le >= ((now() at time zone $1)::date - 13)::timestamp at time zone $1
        group by 1, 2`,
      [fuseau],
    ),
    requete<{ id: string; n: number }>(
      `select etablissement_id as id, count(*)::int as n from demandes_service where statut in ('nouvelle', 'prise') group by 1`,
    ),
  ])
  const cal: string[] = []
  const auj = new Date(new Date().toLocaleString('en-US', { timeZone: fuseau }))
  for (let i = 13; i >= 0; i--) {
    const x = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() - i)
    cal.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`)
  }
  const tendances: Record<string, number[]> = {}
  for (const l of jours) {
    tendances[l.id] ??= cal.map(() => 0)
    const k = cal.indexOf(l.jour)
    if (k >= 0) tendances[l.id][k] = l.n
  }
  return { tendances, ouvertes: Object.fromEntries(attente.map((l) => [l.id, l.n])) }
}

export type Contenu = { menus: number; plats: number; epuises: number; sans_photo: number; rubriques: number; annonces: number; emplacements: number; types: number }

/** Ce qu'un établissement contient déjà : la liste « prêt à lancer » de l'aperçu. */
export async function compteContenu(etabId: string): Promise<Contenu> {
  const l = await requeteUne<Contenu>(
    `select (select count(*) from menus where etablissement_id = $1::uuid and actif)::int as menus,
            (select count(*) from menu_items i join menu_sections s on s.id = i.section_id join menus m on m.id = s.menu_id where m.etablissement_id = $1::uuid)::int as plats,
            (select count(*) from menu_items i join menu_sections s on s.id = i.section_id join menus m on m.id = s.menu_id where m.etablissement_id = $1::uuid and not i.disponible)::int as epuises,
            (select count(*) from menu_items i join menu_sections s on s.id = i.section_id join menus m on m.id = s.menu_id where m.etablissement_id = $1::uuid and i.photo is null)::int as sans_photo,
            (select count(*) from rubriques_concierge where etablissement_id = $1::uuid and actif)::int as rubriques,
            (select count(*) from annonces_service where etablissement_id = $1::uuid and actif)::int as annonces,
            (select count(*) from emplacements where etablissement_id = $1::uuid and actif)::int as emplacements,
            (select count(*) from types_demandes where etablissement_id = $1::uuid and actif)::int as types`,
    [verifierId(etabId)],
  )
  return l ?? { menus: 0, plats: 0, epuises: 0, sans_photo: 0, rubriques: 0, annonces: 0, emplacements: 0, types: 0 }
}
