import 'server-only'
import { requete, requeteUne } from '@/lib/db'

export type Associe = { id: string; nom: string; part: number }

export type SoldeAssocie = {
  associe_id: string
  nom: string
  part: number
  apports: number
  prelevements: number
  profits_attribues: number
  part_profit_exercice_courant: number
  solde_capital: number
  solde_compte_courant: number
  total_du_a_lassocie: number
}

export async function soldesAssocies(): Promise<SoldeAssocie[]> {
  return requete<SoldeAssocie>(`select * from v_capital_associes`)
}

export type PrelevementExercice = {
  annee: number
  associe_id: string
  nom: string
  prelevements: number
  nb_prelevements: number
  dernier_prelevement: string | null
  prelevement_le_plus_eleve: number
  ecart: number
  alerte_desequilibre: boolean
}

export async function prelevementsExercice(annee: number): Promise<PrelevementExercice[]> {
  return requete<PrelevementExercice>(
    `select * from v_prelevements_exercice where annee = $1::int order by prelevements desc`,
    [annee],
  )
}

export type MouvementAssocie = {
  id: string
  associe_id: string
  nom: string
  date: string
  compte: 'capital' | 'courant'
  type: string
  montant: number
  montant_signe: number
  description: string | null
}

export async function listerMouvements(filtres: {
  annee?: number
  associe?: string
  compte?: string
}): Promise<MouvementAssocie[]> {
  const conditions: string[] = []
  const valeurs: unknown[] = []
  const ajouter = (modele: string, valeur: unknown) => {
    valeurs.push(valeur)
    conditions.push(modele.replaceAll('?', `$${valeurs.length}`))
  }
  if (filtres.annee) ajouter('m.annee = ?::int', filtres.annee)
  if (filtres.associe) ajouter('m.associe_id = ?::uuid', filtres.associe)
  if (filtres.compte) ajouter('m.compte = ?', filtres.compte)
  const ou = conditions.length ? `where ${conditions.join(' and ')}` : ''

  return requete<MouvementAssocie>(
    `select m.id, m.associe_id, a.nom, m.date, m.compte, m.type, m.montant,
            m.montant_signe, m.description
       from mouvements_associes m
       join associes a on a.id = m.associe_id
       ${ou}
      order by m.date desc, m.cree_le desc
      limit 200`,
    valeurs,
  )
}

export async function listerAssocies(): Promise<Associe[]> {
  return requete<Associe>(`select id, nom, part from associes where actif order by ordre`)
}

export async function ajouterMouvement(entree: {
  associeId: string
  date: string
  compte: 'capital' | 'courant'
  type: string
  montant: number
  description: string | null
}): Promise<void> {
  await requete(
    `insert into mouvements_associes (associe_id, date, compte, type, montant, description)
     values ($1::uuid, $2::date, $3, $4::type_mouvement_associe, $5::numeric, $6)`,
    [
      entree.associeId,
      entree.date,
      entree.compte,
      entree.type,
      entree.montant,
      entree.description,
    ],
  )
}

export async function supprimerMouvement(id: string): Promise<void> {
  await requete(`delete from mouvements_associes where id = $1::uuid`, [id])
}

/** Types de mouvement admis, par compte : la contrainte est aussi dans la base. */
export const TYPES_MOUVEMENT = {
  capital: [
    ['apport', 'Apport de capital'],
    ['prelevement', 'Prélèvement'],
    ['ajustement', 'Ajustement'],
  ],
  courant: [
    ['avance', 'Avance à la société'],
    ['remboursement_avance', 'Remboursement d’avance'],
    ['ajustement', 'Ajustement'],
  ],
} as const

// ---------------------------------------------------------------------------
// Registre des décisions
// ---------------------------------------------------------------------------

export type Decision = {
  id: string
  numero: number
  date: string
  titre: string
  description: string
  decision: string
  categorie: string
  notes: string | null
  nb_associes: number
  nb_approbations: number
  est_unanime: boolean
  statut_approbation: 'unanime' | 'partielle' | 'en_attente'
  date_unanimite: string | null
}

export type Approbation = {
  decision_id: string
  associe_id: string
  nom: string
  approuve: boolean
  date_approbation: string | null
}

export const CATEGORIES_DECISION = [
  ['finance', 'Finance'],
  ['operations', 'Opérations'],
  ['juridique', 'Juridique'],
  ['produit', 'Produit'],
  ['autre', 'Autre'],
] as const

export async function listerDecisions(filtres: {
  categorie?: string
  statut?: string
  recherche?: string
  annee?: number
}): Promise<{ decisions: Decision[]; approbations: Approbation[] }> {
  const conditions: string[] = []
  const valeurs: unknown[] = []
  const ajouter = (modele: string, valeur: unknown) => {
    valeurs.push(valeur)
    conditions.push(modele.replaceAll('?', `$${valeurs.length}`))
  }
  if (filtres.categorie) ajouter('categorie = ?', filtres.categorie)
  if (filtres.statut) ajouter('statut_approbation = ?', filtres.statut)
  if (filtres.annee) ajouter('extract(year from date)::int = ?::int', filtres.annee)
  if (filtres.recherche) {
    ajouter(
      `to_tsvector('french', titre || ' ' || description || ' ' || decision)
         @@ plainto_tsquery('french', ?)`,
      filtres.recherche,
    )
  }
  const ou = conditions.length ? `where ${conditions.join(' and ')}` : ''

  const decisions = await requete<Decision>(
    `select * from v_decisions ${ou} order by date desc, numero desc limit 200`,
    valeurs,
  )
  if (decisions.length === 0) return { decisions, approbations: [] }

  const approbations = await requete<Approbation>(
    `select ap.decision_id, ap.associe_id, a.nom, ap.approuve, ap.date_approbation
       from decisions_approbations ap
       join associes a on a.id = ap.associe_id
      where ap.decision_id = any($1::uuid[])
      order by a.ordre`,
    [decisions.map((d) => d.id)],
  )
  return { decisions, approbations }
}

export async function creerDecision(entree: {
  date: string
  titre: string
  description: string
  decision: string
  categorie: string
  notes: string | null
}): Promise<string> {
  const ligne = await requeteUne<{ id: string }>(
    `insert into decisions (date, titre, description, decision, categorie, notes)
     values ($1::date, $2, $3, $4, $5, $6) returning id`,
    [
      entree.date,
      entree.titre,
      entree.description,
      entree.decision,
      entree.categorie,
      entree.notes,
    ],
  )
  return ligne!.id
}

export async function basculerApprobation(
  decisionId: string,
  associeId: string,
  approuve: boolean,
): Promise<void> {
  await requete(
    `update decisions_approbations set approuve = $3::boolean
      where decision_id = $1::uuid and associe_id = $2::uuid`,
    [decisionId, associeId, approuve],
  )
}

export async function exercicesConnus(): Promise<{ annee: number; statut: string }[]> {
  return requete<{ annee: number; statut: string }>(
    `select annee, statut from exercices order by annee desc`,
  )
}
