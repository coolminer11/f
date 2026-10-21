import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import { optionsParDefaut, type Annonce, type Emplacement, type Etablissement, type Menu, type Plat, type Rubrique, type Section, type TypeDemande } from '@/lib/services/types'

/**
 * Les lectures de Tapora Services, communes aux pages des clients (par code
 * d'emplacement), au portail du personnel et au back-office.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const CODE_EMPLACEMENT = /^[A-HJ-NP-Z2-9]{8}$/

const COLONNES = `id, type, nom, langues, langue_defaut, couleur, logo, couverture, accueil, adresse, telephone, site_web, avis_url,
  wifi_nom, wifi_mdp, devise, options, version_lien, mot_de_passe is not null as protege, actif, formule,
  to_char(essai_jusqua, 'YYYY-MM-DD') as essai_jusqua, prix_mensuel::float8 as prix_mensuel, contact_nom, contact_courriel, notes, cree_le`

const avecOptions = (e: Etablissement): Etablissement => ({ ...e, options: { ...optionsParDefaut(e.type), ...(e.options ?? {}) } })

export async function lireEtablissement(id: string): Promise<Etablissement | null> {
  if (!UUID.test(id)) return null
  const e = await requeteUne<Etablissement>(`select ${COLONNES} from etablissements where id = $1::uuid`, [id])
  return e ? avecOptions(e) : null
}

export async function listerEtablissements(): Promise<(Etablissement & { emplacements: number; demandes_7j: number; ouvertures_7j: number; note: number | null })[]> {
  const l = await requete<Etablissement & { emplacements: number; demandes_7j: number; ouvertures_7j: number; note: number | null }>(
    `select ${COLONNES},
            (select count(*)::int from emplacements x where x.etablissement_id = e.id and x.actif) as emplacements,
            (select count(*)::int from demandes_service d where d.etablissement_id = e.id and d.cree_le > now() - interval '7 days') as demandes_7j,
            (select count(*)::int from evenements_service v where v.etablissement_id = e.id and v.type = 'ouverture' and v.cree_le > now() - interval '7 days') as ouvertures_7j,
            (select round(avg(note)::numeric, 1)::float8 from retours_service r where r.etablissement_id = e.id and r.cree_le > now() - interval '90 days') as note
       from etablissements e order by actif desc, nom`,
  )
  return l.map(avecOptions) as typeof l
}

/** L'emplacement d'un code (carte NFC ou QR) et son établissement — seulement s'ils sont actifs. */
export async function parCode(code: string): Promise<{ etab: Etablissement; emplacement: Emplacement } | null> {
  const c = code.toUpperCase()
  if (!CODE_EMPLACEMENT.test(c)) return null
  const emplacement = await requeteUne<Emplacement>(
    `select id, etablissement_id, type, libelle, groupe, code, actif, ordre from emplacements where code = $1 and actif`,
    [c],
  )
  if (!emplacement) return null
  const etab = await lireEtablissement(emplacement.etablissement_id)
  if (!etab?.actif || etab.formule === 'suspendu') return null
  return { etab, emplacement }
}

export async function emplacements(etabId: string): Promise<Emplacement[]> {
  return requete<Emplacement>(
    `select id, etablissement_id, type, libelle, groupe, code, actif, ordre from emplacements where etablissement_id = $1::uuid order by ordre, libelle`,
    [etabId],
  )
}

/** L'heure et le jour (1 = lundi) au fuseau de l'établissement. */
async function maintenant(fuseau: string): Promise<{ heure: string; jour: number; date: string }> {
  const l = await requeteUne<{ heure: string; jour: number; date: string }>(
    `select to_char(now() at time zone $1, 'HH24:MI:SS') as heure, extract(isodow from now() at time zone $1)::int as jour,
            to_char(now() at time zone $1, 'YYYY-MM-DD') as date`,
    [fuseau],
  )
  return l ?? { heure: '12:00:00', jour: 1, date: new Date().toISOString().slice(0, 10) }
}

function enService(m: Pick<Menu, 'heure_debut' | 'heure_fin' | 'jours' | 'actif'>, heure: string, jour: number): boolean {
  if (!m.actif || !m.jours.includes(jour)) return false
  if (!m.heure_debut || !m.heure_fin) return true
  // Un service qui passe minuit (22 h – 2 h) : vrai avant la fin OU après le début.
  return m.heure_debut <= m.heure_fin ? heure >= m.heure_debut && heure < m.heure_fin : heure >= m.heure_debut || heure < m.heure_fin
}

/**
 * Les menus avec leurs sections et leurs plats. `tous` : le back-office voit
 * aussi les menus désactivés ; les clients ne voient que les actifs, avec
 * l'indication « servi en ce moment ».
 */
export async function menus(etabId: string, fuseau = 'America/Toronto', tous = false): Promise<Menu[]> {
  const [liste, sections, plats, ici] = await Promise.all([
    requete<Omit<Menu, 'sections'>>(
      `select id, type, nom, description, pdf, to_char(heure_debut, 'HH24:MI') as heure_debut, to_char(heure_fin, 'HH24:MI') as heure_fin, jours, actif, ordre
         from menus where etablissement_id = $1::uuid ${tous ? '' : 'and actif'} order by ordre, cree_le`,
      [etabId],
    ),
    requete<Omit<Section, 'plats'>>(
      `select s.id, s.menu_id, s.nom, s.description, s.ordre from menu_sections s join menus m on m.id = s.menu_id
        where m.etablissement_id = $1::uuid order by s.ordre`,
      [etabId],
    ),
    requete<Plat>(
      `select i.id, i.section_id, i.nom, i.description, i.prix::float8 as prix, i.variantes, i.photo, i.allergenes, i.etiquettes, i.disponible, i.ordre
         from menu_items i join menu_sections s on s.id = i.section_id join menus m on m.id = s.menu_id
        where m.etablissement_id = $1::uuid order by i.ordre, i.cree_le`,
      [etabId],
    ),
    maintenant(fuseau),
  ])
  return liste.map((m) => ({
    ...m,
    en_service: enService(m, ici.heure.slice(0, 5), ici.jour),
    sections: sections.filter((s) => s.menu_id === m.id).map((s) => ({ ...s, plats: plats.filter((p) => p.section_id === s.id) })),
  }))
}

/** Les annonces en cours (plat du jour, promos) : actives, et dans leurs dates. */
export async function annonces(etabId: string, fuseau = 'America/Toronto', toutes = false): Promise<Annonce[]> {
  return requete<Annonce>(
    `select id, type, titre, texte, prix::float8 as prix, to_char(debut, 'YYYY-MM-DD') as debut, to_char(fin, 'YYYY-MM-DD') as fin, actif, ordre
       from annonces_service
      where etablissement_id = $1::uuid
        ${toutes ? '' : `and actif and (debut is null or debut <= (now() at time zone $2)::date) and (fin is null or fin >= (now() at time zone $2)::date)`}
      order by ordre, cree_le desc`,
    toutes ? [etabId] : [etabId, fuseau],
  )
}

export async function rubriques(etabId: string, toutes = false): Promise<Rubrique[]> {
  return requete<Rubrique>(
    `select id, type, icone, titre, texte, lien, telephone, actif, ordre from rubriques_concierge
      where etablissement_id = $1::uuid ${toutes ? '' : 'and actif'} order by ordre, cree_le`,
    [etabId],
  )
}

export async function typesDemandes(etabId: string, tous = false): Promise<TypeDemande[]> {
  return requete<TypeDemande>(
    `select id, cle, libelle, icone, avec_note, avis_apres, actif, ordre from types_demandes
      where etablissement_id = $1::uuid ${tous ? '' : 'and actif'} order by ordre, cle`,
    [etabId],
  )
}
