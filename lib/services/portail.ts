import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import { estLangue, type Texte } from '@/lib/services/langues'
import { fileDuPersonnel } from '@/lib/services/demandes'
import { pouls } from '@/lib/services/stats'
import type { Annonce, Demande } from '@/lib/services/types'

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
