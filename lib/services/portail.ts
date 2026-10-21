import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import { estLangue, type Texte } from '@/lib/services/langues'
import { fileDuPersonnel } from '@/lib/services/demandes'
import { pouls } from '@/lib/services/stats'
import { lireEtablissement } from '@/lib/services/donnees'
import * as A from '@/lib/services/admin'
import { ALLERGENES, ETIQUETTES, type Annonce, type Demande, type Variante } from '@/lib/services/types'

/**
 * Le portail du personnel, côté serveur : tout ce que le personnel modifie
 * lui-même (plat du jour, plats épuisés, message d'accueil, retours lus).
 *
 * Chaque fonction reçoit l'id de l'établissement obtenu par
 * etablissementDuJeton() — jamais d'un champ — et filtre TOUJOURS par lui :
 * un id de plat ou d'annonce venu du navigateur ne touche que ses propres
 * lignes.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const estUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

/** Un texte multilingue nettoyé : seulement les langues de l'établissement, longueur bornée. */
export function nettoyerTexte(brut: unknown, langues: string[], max: number): Texte {
  const sortie: Record<string, string> = {}
  if (brut && typeof brut === 'object') {
    for (const [l, v] of Object.entries(brut as Record<string, unknown>)) {
      if (!estLangue(l) || !langues.includes(l) || typeof v !== 'string') continue
      const t = v.trim().slice(0, max)
      if (t) sortie[l] = t
    }
  }
  return sortie as Texte
}

// ---------------------------------------------------------------------------
// La file (pour le sondage du navigateur)
// ---------------------------------------------------------------------------

export type FileJson = {
  ouvertes: Demande[]
  faites: Demande[]
  pouls: Awaited<ReturnType<typeof pouls>>
  nonLus: number
  maintenant: string
}

export async function fileJson(etabId: string): Promise<FileJson> {
  const [file, p, n] = await Promise.all([fileDuPersonnel(etabId), pouls(etabId), nonLus(etabId)])
  return { ...file, pouls: p, nonLus: n, maintenant: new Date().toISOString() }
}

// ---------------------------------------------------------------------------
// Plat du jour et annonces
// ---------------------------------------------------------------------------

const COLS_ANNONCE = `id, type, titre, texte, prix::float8 as prix, to_char(debut, 'YYYY-MM-DD') as debut, to_char(fin, 'YYYY-MM-DD') as fin, actif, ordre`

/** Le plat du jour le plus récent (actif d'abord). */
export async function platDuJour(etabId: string): Promise<Annonce | null> {
  return requeteUne<Annonce>(
    `select ${COLS_ANNONCE} from annonces_service where etablissement_id = $1::uuid and type = 'plat_du_jour'
      order by actif desc, cree_le desc limit 1`,
    [etabId],
  )
}

/** Les autres annonces (promos, infos, événements), pour les activer ou non d'un geste. */
export async function autresAnnonces(etabId: string): Promise<Annonce[]> {
  return requete<Annonce>(
    `select ${COLS_ANNONCE} from annonces_service where etablissement_id = $1::uuid and type <> 'plat_du_jour'
      order by actif desc, ordre, cree_le desc limit 20`,
    [etabId],
  )
}

export async function enregistrerPlatDuJour(
  etabId: string,
  fuseau: string,
  e: { id: string | null; titre: Texte; texte: Texte; prix: number | null; fin: string | null; actif: boolean },
): Promise<string | null> {
  const fin = e.fin && /^\d{4}-\d{2}-\d{2}$/.test(e.fin) ? e.fin : null
  const prix = e.prix !== null && Number.isFinite(e.prix) && e.prix >= 0 && e.prix < 100000 ? Math.round(e.prix * 100) / 100 : null
  let id: string | null = null
  if (estUuid(e.id)) {
    const l = await requeteUne<{ id: string }>(
      `update annonces_service set titre = $3::jsonb, texte = $4::jsonb, prix = $5, fin = $6::date, actif = $7,
              debut = case when $7 and (debut is null or debut > (now() at time zone $8)::date) then (now() at time zone $8)::date else debut end
        where id = $2::uuid and etablissement_id = $1::uuid and type = 'plat_du_jour' returning id`,
      [etabId, e.id, JSON.stringify(e.titre), JSON.stringify(e.texte), prix, fin, e.actif, fuseau],
    )
    id = l?.id ?? null
  }
  if (!id) {
    const l = await requeteUne<{ id: string }>(
      `insert into annonces_service (etablissement_id, type, titre, texte, prix, debut, fin, actif)
       values ($1::uuid, 'plat_du_jour', $2::jsonb, $3::jsonb, $4, (now() at time zone $7)::date, $5::date, $6) returning id`,
      [etabId, JSON.stringify(e.titre), JSON.stringify(e.texte), prix, fin, e.actif, fuseau],
    )
    id = l?.id ?? null
  }
  // Un seul plat du jour affiché à la fois.
  if (id && e.actif) {
    await requete(
      `update annonces_service set actif = false where etablissement_id = $1::uuid and type = 'plat_du_jour' and id <> $2::uuid and actif`,
      [etabId, id],
    )
  }
  return id
}

export async function basculerAnnonce(etabId: string, id: string, actif: boolean): Promise<boolean> {
  if (!estUuid(id)) return false
  const l = await requeteUne<{ id: string }>(
    `update annonces_service set actif = $3 where id = $2::uuid and etablissement_id = $1::uuid returning id`,
    [etabId, id, actif],
  )
  return Boolean(l)
}

// ---------------------------------------------------------------------------
// Plats épuisés
// ---------------------------------------------------------------------------

export type PlatDispo = {
  id: string
  nom: Texte
  prix: number | null
  disponible: boolean
  section: Texte
  menu: Texte
  menu_id: string
}

export async function platsDisponibilite(etabId: string): Promise<PlatDispo[]> {
  return requete<PlatDispo>(
    `select i.id, i.nom, i.prix::float8 as prix, i.disponible, s.nom as section, m.nom as menu, m.id as menu_id
       from menu_items i join menu_sections s on s.id = i.section_id join menus m on m.id = s.menu_id
      where m.etablissement_id = $1::uuid
      order by m.ordre, m.cree_le, s.ordre, i.ordre, i.cree_le`,
    [etabId],
  )
}

export async function changerDisponibilite(etabId: string, platId: string, disponible: boolean): Promise<boolean> {
  if (!estUuid(platId)) return false
  const l = await requeteUne<{ id: string }>(
    `update menu_items i set disponible = $3
       from menu_sections s, menus m
      where i.id = $2::uuid and s.id = i.section_id and m.id = s.menu_id and m.etablissement_id = $1::uuid
      returning i.id`,
    [etabId, platId, disponible],
  )
  return Boolean(l)
}

/** Fin de service : tout redevient disponible. */
export async function toutDisponible(etabId: string): Promise<number> {
  const l = await requete<{ id: string }>(
    `update menu_items i set disponible = true
       from menu_sections s, menus m
      where s.id = i.section_id and m.id = s.menu_id and m.etablissement_id = $1::uuid and not i.disponible
      returning i.id`,
    [etabId],
  )
  return l.length
}

// ---------------------------------------------------------------------------
// Message d'accueil
// ---------------------------------------------------------------------------

export async function changerAccueil(etabId: string, accueil: Texte): Promise<void> {
  await requete(`update etablissements set accueil = $2::jsonb, maj_le = now() where id = $1::uuid`, [etabId, JSON.stringify(accueil)])
}

// ---------------------------------------------------------------------------
// Retours des clients
// ---------------------------------------------------------------------------

export type RetourPortail = {
  id: string
  note: number
  commentaire: string | null
  emplacement: string | null
  groupe: string | null
  google: boolean
  langue: string
  lu_le: string | null
  cree_le: string
}

export async function retoursRecents(etabId: string, limite = 80): Promise<RetourPortail[]> {
  return requete<RetourPortail>(
    `select r.id, r.note, r.commentaire, e.libelle as emplacement, e.groupe, r.google, r.langue, r.lu_le, r.cree_le
       from retours_service r left join emplacements e on e.id = r.emplacement_id
      where r.etablissement_id = $1::uuid
      order by r.cree_le desc limit $2`,
    [etabId, limite],
  )
}

export async function nonLus(etabId: string): Promise<number> {
  const l = await requeteUne<{ n: number }>(
    `select count(*)::int as n from retours_service where etablissement_id = $1::uuid and lu_le is null and cree_le > now() - interval '30 days'`,
    [etabId],
  )
  return l?.n ?? 0
}

export async function marquerRetourLu(etabId: string, id: string, lu: boolean): Promise<boolean> {
  if (!estUuid(id)) return false
  const l = await requeteUne<{ id: string }>(
    `update retours_service set lu_le = case when $3 then coalesce(lu_le, now()) else null end
      where id = $2::uuid and etablissement_id = $1::uuid returning id`,
    [etabId, id, lu],
  )
  return Boolean(l)
}

export async function marquerTousLus(etabId: string): Promise<number> {
  const l = await requete<{ id: string }>(
    `update retours_service set lu_le = now() where etablissement_id = $1::uuid and lu_le is null returning id`,
    [etabId],
  )
  return l.length
}

/** Les groupes d'emplacements (Terrasse, 2e étage…), pour le filtre de la file et les notifications. */
export async function groupes(etabId: string): Promise<string[]> {
  const l = await requete<{ groupe: string }>(
    `select distinct groupe from emplacements where etablissement_id = $1::uuid and actif and groupe is not null order by groupe`,
    [etabId],
  )
  return l.map((g) => g.groupe)
}

// ---------------------------------------------------------------------------
// Le mode gérant : le menu, les annonces, l'établissement
// ---------------------------------------------------------------------------
//
// Les écritures passent par lib/services/admin.ts (mêmes règles que le
// back-office, chaque id vérifié contre l'établissement). Ici, en plus :
// seules les langues de l'établissement sont modifiées — un texte dans une
// autre langue, préparé par Tapora, est gardé tel quel.

/**
 * Une saisie fusionnée dans le texte existant. Seules les langues de
 * l'établissement envoyées changent (vide = retirée) ; une langue absente de
 * la saisie, ou hors de l'établissement (préparée par Tapora), reste telle quelle.
 */
export function fusionnerTexte(existant: Texte | null | undefined, saisie: unknown, langues: string[], max: number): Texte {
  const sortie: Record<string, string> = { ...((existant as Record<string, string> | null) ?? {}) }
  const brut = saisie && typeof saisie === 'object' ? (saisie as Record<string, unknown>) : {}
  for (const l of langues) {
    if (!estLangue(l) || typeof brut[l] !== 'string') continue
    const v = (brut[l] as string).trim().slice(0, max)
    if (v) sortie[l] = v
    else delete sortie[l]
  }
  return sortie as Texte
}

const CLES_ALLERGENES = ALLERGENES.map((a) => a.cle) as string[]
const CLES_ETIQUETTES = ETIQUETTES.map((e) => e.cle) as string[]

/** « 16,50 », « 16.5 $ » → 16.5 ; vide → null ; illisible → erreur. */
function prixSaisi(v: unknown): number | null {
  const brut = typeof v === 'string' ? v.trim() : ''
  if (!brut) return null
  const n = A.lirePrix(brut)
  if (n === null) throw new Error(`Prix illisible : ${brut.slice(0, 20)}`)
  return n
}

async function etabEtLangues(etabId: string): Promise<{ langues: string[] }> {
  const e = await lireEtablissement(etabId)
  if (!e) throw new Error('Établissement introuvable.')
  return { langues: e.langues }
}

export type SaisiePlat = {
  id: string | null
  section_id: string
  nom: Record<string, string>
  description: Record<string, string>
  prix: string
  variantes: { nom: Record<string, string>; prix: string }[]
  allergenes: string[]
  etiquettes: string[]
  disponible: boolean
}

/** Créer ou modifier un plat (et le changer de section). Renvoie son id. */
export async function enregistrerPlatGerant(etabId: string, s: SaisiePlat): Promise<string> {
  const { langues } = await etabEtLangues(etabId)
  if (!estUuid(s.section_id)) throw new Error('Section introuvable.')
  const existant = estUuid(s.id)
    ? await requeteUne<{ nom: Texte; description: Texte; variantes: Variante[] }>(
        `select i.nom, i.description, i.variantes from menu_items i join menu_sections x on x.id = i.section_id join menus m on m.id = x.menu_id
          where i.id = $2::uuid and m.etablissement_id = $1::uuid`,
        [etabId, s.id],
      )
    : null
  if (estUuid(s.id) && !existant) throw new Error('Plat introuvable.')
  const variantes = (Array.isArray(s.variantes) ? s.variantes : []).slice(0, 12).map((v, i) => ({
    nom: fusionnerTexte(existant?.variantes?.[i]?.nom, v?.nom, langues, 60),
    prix: prixSaisi(v?.prix),
  }))
  const champs: A.ChampsPlat = {
    nom: fusionnerTexte(existant?.nom, s.nom, langues, 120),
    description: fusionnerTexte(existant?.description, s.description, langues, 600),
    prix: prixSaisi(s.prix),
    variantes,
    allergenes: (Array.isArray(s.allergenes) ? s.allergenes : []).filter((a) => CLES_ALLERGENES.includes(a)),
    etiquettes: (Array.isArray(s.etiquettes) ? s.etiquettes : []).filter((e) => CLES_ETIQUETTES.includes(e)),
    disponible: Boolean(s.disponible),
  }
  if (existant && s.id) {
    await A.modifierPlat(etabId, s.id, { ...champs, section_id: s.section_id })
    return s.id
  }
  return A.creerPlat(etabId, s.section_id, champs)
}

export type SaisieSection = { id: string | null; menu_id: string; nom: Record<string, string>; description: Record<string, string> }

export async function enregistrerSectionGerant(etabId: string, s: SaisieSection): Promise<string> {
  const { langues } = await etabEtLangues(etabId)
  if (estUuid(s.id)) {
    const existant = await requeteUne<{ nom: Texte; description: Texte }>(
      `select x.nom, x.description from menu_sections x join menus m on m.id = x.menu_id where x.id = $2::uuid and m.etablissement_id = $1::uuid`,
      [etabId, s.id],
    )
    if (!existant) throw new Error('Section introuvable.')
    await A.modifierSection(etabId, s.id, fusionnerTexte(existant.nom, s.nom, langues, 80), fusionnerTexte(existant.description, s.description, langues, 300))
    return s.id
  }
  if (!estUuid(s.menu_id)) throw new Error('Menu introuvable.')
  return A.creerSection(etabId, s.menu_id, fusionnerTexte(null, s.nom, langues, 80))
}

/** Une section ne se supprime que vide : jamais de plats perdus d'un geste. */
export async function supprimerSectionVide(etabId: string, sectionId: string): Promise<void> {
  if (!estUuid(sectionId)) throw new Error('Section introuvable.')
  const l = await requeteUne<{ n: number }>(
    `select (select count(*)::int from menu_items i where i.section_id = x.id) as n
       from menu_sections x join menus m on m.id = x.menu_id where x.id = $2::uuid and m.etablissement_id = $1::uuid`,
    [etabId, sectionId],
  )
  if (!l) throw new Error('Section introuvable.')
  if (l.n > 0) throw new Error('Videz d’abord la section : déplacez ou supprimez ses plats.')
  await A.supprimerSection(etabId, sectionId)
}

/** Toutes les annonces sauf le plat du jour (qui se règle dans Contrôles). */
export async function annoncesGerant(etabId: string): Promise<Annonce[]> {
  return requete<Annonce>(
    `select ${COLS_ANNONCE} from annonces_service where etablissement_id = $1::uuid and type <> 'plat_du_jour' order by ordre, cree_le desc`,
    [etabId],
  )
}

export type SaisieAnnonce = {
  id: string | null
  type: 'promo' | 'info' | 'evenement'
  titre: Record<string, string>
  texte: Record<string, string>
  prix: string
  debut: string
  fin: string
  actif: boolean
}

export async function enregistrerAnnonceGerant(etabId: string, s: SaisieAnnonce): Promise<void> {
  const { langues } = await etabEtLangues(etabId)
  const type = s.type === 'info' || s.type === 'evenement' ? s.type : 'promo'
  const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  const existant = estUuid(s.id)
    ? await requeteUne<{ titre: Texte; texte: Texte }>(
        `select titre, texte from annonces_service where id = $2::uuid and etablissement_id = $1::uuid and type <> 'plat_du_jour'`,
        [etabId, s.id],
      )
    : null
  if (estUuid(s.id) && !existant) throw new Error('Annonce introuvable.')
  const champs: A.ChampsAnnonce = {
    type,
    titre: fusionnerTexte(existant?.titre, s.titre, langues, 120),
    texte: fusionnerTexte(existant?.texte, s.texte, langues, 600),
    prix: prixSaisi(s.prix),
    debut: date(s.debut),
    fin: date(s.fin),
    actif: Boolean(s.actif),
  }
  if (existant && s.id) await A.modifierAnnonce(etabId, s.id, champs)
  else await A.creerAnnonce(etabId, champs)
}

export async function supprimerAnnonceGerant(etabId: string, id: string): Promise<void> {
  if (!estUuid(id)) throw new Error('Annonce introuvable.')
  const l = await requeteUne<{ id: string }>(
    `delete from annonces_service where id = $2::uuid and etablissement_id = $1::uuid and type <> 'plat_du_jour' returning id`,
    [etabId, id],
  )
  if (!l) throw new Error('Annonce introuvable.')
}

export type SaisieInfos = {
  /** Absent : le message d'accueil ne change pas (il se règle aussi dans Contrôles). */
  accueil?: Record<string, string>
  telephone: string
  avis_url: string
  wifi_nom: string
  wifi_mdp: string
}

/** Les informations que le gérant tient à jour : accueil, téléphone, lien d'avis (https seulement), Wi-Fi. L'adresse et le site restent ceux de Tapora. */
export async function enregistrerInfosGerant(etabId: string, s: SaisieInfos): Promise<void> {
  const e = await lireEtablissement(etabId)
  if (!e) throw new Error('Établissement introuvable.')
  const telephone = String(s.telephone ?? '').trim().slice(0, 40)
  if (telephone && !/^[0-9+().\-\s#*]{7,40}$/.test(telephone)) throw new Error('Numéro de téléphone invalide.')
  const avis = String(s.avis_url ?? '').trim()
  if (avis) {
    let url: URL | null = null
    try {
      url = new URL(avis)
    } catch {}
    if (!url || url.protocol !== 'https:' || !url.hostname.includes('.')) throw new Error('Le lien d’avis doit commencer par https://')
  }
  if (s.accueil) await A.modifierAccueil(etabId, fusionnerTexte(e.accueil, s.accueil, e.langues, 400))
  await A.modifierCoordonnees(etabId, {
    adresse: e.adresse,
    telephone: telephone || null,
    site_web: e.site_web,
    avis_url: avis || null,
    wifi_nom: String(s.wifi_nom ?? '').trim().slice(0, 64) || null,
    wifi_mdp: String(s.wifi_mdp ?? '').trim().slice(0, 64) || null,
  })
}
