import 'server-only'
import { requete, requeteUne } from '@/lib/db'

/**
 * Le partage des profits dans le temps, et ce que chaque associé déclare.
 *
 * Tout le calcul est en base (migration 20261020000200) : chaque revenu et
 * chaque dépense est réparti selon le partage en vigueur à sa date, au cent
 * près. Ici, on ne fait que lire et présenter — aucune arithmétique sur
 * l'argent côté serveur Node, pour qu'il n'existe qu'une seule vérité.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const n = (v: unknown) => Number(v ?? 0)

export type PartAssocie = { associe_id: string; nom: string; part: number }
export type Partage = {
  id: string
  debut: string
  /** Vrai pour le partage de départ (« depuis le début »). */
  premier: boolean
  motif: string | null
  propose_par: string | null
  propose_le: string
  applique_le: string | null
  decision_numero: number | null
  parts: PartAssocie[]
  approbations: { associe_id: string; approuve_le: string }[]
}

/** Les partages appliqués (du plus récent au plus ancien) et la proposition en attente, s'il y en a une. */
export async function partages(): Promise<{ appliques: Partage[]; proposition: Partage | null }> {
  const lignes = await requete<Omit<Partage, 'parts' | 'approbations' | 'premier'>>(
    `select p.id, to_char(p.debut, 'YYYY-MM-DD') as debut, p.motif, u.nom as propose_par, p.propose_le, p.applique_le, d.numero as decision_numero
       from partages p
       left join utilisateurs u on u.id = p.propose_par
       left join decisions d on d.id = p.decision_id
      where p.annule_le is null
      order by p.debut desc`,
  )
  const ids = lignes.map((l) => l.id)
  const [parts, approbations] = await Promise.all([
    requete<PartAssocie & { partage_id: string }>(
      `select pp.partage_id, pp.associe_id, a.nom, pp.part::float8 as part
         from partages_parts pp join associes a on a.id = pp.associe_id
        where pp.partage_id = any($1::uuid[]) order by a.ordre`,
      [ids],
    ),
    requete<{ partage_id: string; associe_id: string; approuve_le: string }>(
      `select partage_id, associe_id, approuve_le from partages_approbations where partage_id = any($1::uuid[])`,
      [ids],
    ),
  ])
  const premierDebut = lignes.filter((l) => l.applique_le).map((l) => l.debut).sort()[0]
  const complet = lignes.map((l) => ({
    ...l,
    premier: !!l.applique_le && l.debut === premierDebut,
    parts: parts.filter((p) => p.partage_id === l.id).map(({ associe_id, nom, part }) => ({ associe_id, nom, part: n(part) })),
    approbations: approbations.filter((a) => a.partage_id === l.id).map(({ associe_id, approuve_le }) => ({ associe_id, approuve_le })),
  }))
  return { appliques: complet.filter((p) => p.applique_le), proposition: complet.find((p) => !p.applique_le) ?? null }
}

export type ResumeAnnee = {
  annee: number
  societe: {
    revenus: number
    depenses: number
    benefice: number
    /** La moitié non déductible des repas et frais de représentation. */
    repas_non_deductible: number
    benefice_fiscal: number
  }
  categories: { categorie: string; libelle: string; type: 'revenu' | 'depense'; montant: number }[]
  associes: {
    associe_id: string
    nom: string
    /** Sa part du bénéfice comptable. */
    comptable: number
    /** Sa part du bénéfice fiscal estimé (ce qu'il déclare). */
    fiscal: number
    prelevements: number
    apports: number
  }[]
  /** Par mois : le profit de la société, les partages qui s'y appliquent (identifiants), la part de chacun. */
  mois: { mois: string; profit: number; partages: string[]; parts: Record<string, number> }[]
}

export async function resumeAnnee(annee: number): Promise<ResumeAnnee> {
  const debut = `${annee}-01-01`
  const fin = `${annee}-12-31`
  const [societe, categories, associes, morceaux] = await Promise.all([
    requeteUne<ResumeAnnee['societe']>(
      `select coalesce(sum(montant_ht) filter (where type = 'revenu'), 0) as revenus,
              coalesce(sum(cout_reel) filter (where type = 'depense'), 0) as depenses,
              coalesce(sum(case when type = 'revenu' then montant_ht else -cout_reel end), 0) as benefice,
              coalesce(sum(cout_reel - round(cout_reel * 0.5, 2)) filter (where type = 'depense' and categorie = 'repas_representation'), 0) as repas_non_deductible
         from transactions where not est_stock and date between $1::date and $2::date`,
      [debut, fin],
    ),
    requete<ResumeAnnee['categories'][number]>(
      `select t.categorie::text as categorie, coalesce(c.libelle, t.categorie::text) as libelle, t.type::text as type,
              sum(case when t.type = 'revenu' then t.montant_ht else t.cout_reel end) as montant
         from transactions t left join categories_defauts c on c.categorie = t.categorie
        where not t.est_stock and t.date between $1::date and $2::date
        group by 1, 2, 3 order by 3 desc, 4 desc`,
      [debut, fin],
    ),
    requete<ResumeAnnee['associes'][number]>(
      `select a.id as associe_id, a.nom,
              coalesce((select sum(r.montant) from repartition_profits($1::date, $2::date) r where r.associe_id = a.id), 0) as comptable,
              coalesce((select sum(r.montant) from repartition_profits($1::date, $2::date, true) r where r.associe_id = a.id), 0) as fiscal,
              coalesce((select sum(m.montant) from mouvements_associes m where m.associe_id = a.id and m.type = 'prelevement' and m.date between $1::date and $2::date), 0) as prelevements,
              coalesce((select sum(m.montant) from mouvements_associes m where m.associe_id = a.id and m.type = 'apport' and m.date between $1::date and $2::date), 0) as apports
         from associes a
        where a.actif
           or exists (select 1 from repartition_profits($1::date, $2::date) r where r.associe_id = a.id)
        order by a.ordre`,
      [debut, fin],
    ),
    requete<{ mois: string; partage_id: string; associe_id: string; profit: number; montant: number }>(
      `select to_char(r.mois, 'YYYY-MM-DD') as mois, r.partage_id, r.associe_id, r.profit, r.montant
         from repartition_profits($1::date, $2::date) r
         join partages p on p.id = r.partage_id
        order by r.mois, p.debut`,
      [debut, fin],
    ),
  ])

  const s = {
    revenus: n(societe?.revenus),
    depenses: n(societe?.depenses),
    benefice: n(societe?.benefice),
    repas_non_deductible: n(societe?.repas_non_deductible),
    benefice_fiscal: 0,
  }
  // En cents entiers : jamais d'erreur d'arrondi en additionnant.
  s.benefice_fiscal = (Math.round(s.benefice * 100) + Math.round(s.repas_non_deductible * 100)) / 100

  const parMois = new Map<string, ResumeAnnee['mois'][number] & { vus: Set<string> }>()
  for (const m of morceaux) {
    const l = parMois.get(m.mois) ?? { mois: m.mois, profit: 0, partages: [], parts: {}, vus: new Set<string>() }
    if (!l.vus.has(m.partage_id)) {
      l.vus.add(m.partage_id)
      l.profit = (Math.round(l.profit * 100) + Math.round(n(m.profit) * 100)) / 100
      l.partages.push(m.partage_id)
    }
    l.parts[m.associe_id] = (Math.round((l.parts[m.associe_id] ?? 0) * 100) + Math.round(n(m.montant) * 100)) / 100
    parMois.set(m.mois, l)
  }

  return {
    annee,
    societe: s,
    categories: categories.map((c) => ({ ...c, montant: n(c.montant) })),
    associes: associes.map((a) => ({
      ...a,
      comptable: n(a.comptable),
      fiscal: n(a.fiscal),
      prelevements: n(a.prelevements),
      apports: n(a.apports),
    })),
    mois: [...parMois.values()].map(({ vus: _vus, ...l }) => l),
  }
}

// ---------------------------------------------------------------------------
// Proposer, approuver, annuler (les règles sont dans les fonctions SQL)
// ---------------------------------------------------------------------------
export async function proposerPartage(debut: string, parts: Record<string, string>, motif: string | null, utilisateurId: string): Promise<string> {
  const l = await requeteUne<{ id: string }>(`select proposer_partage($1::date, $2::jsonb, $3, $4::uuid) as id`, [
    debut,
    JSON.stringify(parts),
    motif,
    utilisateurId,
  ])
  return l!.id
}

export async function approuverPartage(partageId: string, associeId: string): Promise<'applique' | 'en_attente'> {
  if (!UUID.test(partageId) || !UUID.test(associeId)) throw new Error('Changement de partage introuvable.')
  const l = await requeteUne<{ r: 'applique' | 'en_attente' }>(`select approuver_partage($1::uuid, $2::uuid) as r`, [partageId, associeId])
  return l!.r
}

export async function annulerPartage(partageId: string): Promise<void> {
  if (!UUID.test(partageId)) return
  await requete(`select annuler_partage($1::uuid)`, [partageId])
}

/** Repère pour mettre de côté l'impôt et les cotisations : pas un calcul d'impôt. */
export const RESERVE_IMPOTS = 0.3
