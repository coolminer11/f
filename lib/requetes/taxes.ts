import 'server-only'
import { requete, requeteUne } from '@/lib/db'

export type LigneTaxePeriode = {
  autorite: string
  code: string
  taxes_percues: number
  taxes_payees: number
  credits: number
  net_a_remettre: number
}

export type TotalAutorite = {
  autorite: string
  taxes_percues: number
  credits: number
  net_a_remettre: number
}

export const AUTORITES: Record<string, { nom: string; formulaire: string }> = {
  ARC: { nom: 'Agence du revenu du Canada', formulaire: 'TPS et TVH' },
  RQ: { nom: 'Revenu Québec', formulaire: 'TVQ' },
  BC: { nom: 'Colombie-Britannique', formulaire: 'TVP (PST)' },
  SK: { nom: 'Saskatchewan', formulaire: 'TVP (PST)' },
  MB: { nom: 'Manitoba', formulaire: 'TVP (RST)' },
}

export async function rapportTaxes(debut: string, fin: string) {
  const [detail, totaux] = await Promise.all([
    requete<LigneTaxePeriode>(`select * from rapport_taxes($1::date, $2::date)`, [debut, fin]),
    requete<TotalAutorite>(`select * from rapport_taxes_par_autorite($1::date, $2::date)`, [
      debut,
      fin,
    ]),
  ])
  return { detail, totaux }
}

export type EcritureTaxe = {
  id: string
  date: string
  description: string
  type: 'revenu' | 'depense'
  montant_ht: number
  code: string
  autorite: string
  taux: number
  montant: number
  montant_recuperable: number
}

/** Les écritures derrière un total : sans elles, un rapport n'est pas vérifiable. */
export async function ecrituresDeLaPeriode(
  debut: string,
  fin: string,
  autorite?: string,
): Promise<EcritureTaxe[]> {
  return requete<EcritureTaxe>(
    `select t.id, t.date, t.description, t.type, t.montant_ht,
            l.code, l.autorite, l.taux, l.montant, l.montant_recuperable
       from lignes_taxe l
       join transactions t on t.id = l.transaction_id
      where t.date between $1::date and $2::date
        and ($3::text is null or l.autorite = $3::text)
      order by t.date desc, t.description
      limit 500`,
    [debut, fin, autorite ?? null],
  )
}

export type Declaration = {
  id: string
  autorite: string
  periode_debut: string
  periode_fin: string
  taxes_percues: number
  credits: number
  net_a_remettre: number
  statut: 'brouillon' | 'transmise' | 'payee'
  date_transmission: string | null
  date_paiement: string | null
  reference: string | null
}

export async function listerDeclarations(): Promise<Declaration[]> {
  return requete<Declaration>(
    `select id, autorite, periode_debut, periode_fin, taxes_percues, credits,
            net_a_remettre, statut, date_transmission, date_paiement, reference
       from declarations_taxes order by periode_debut desc, autorite`,
  )
}

export async function produireDeclaration(
  autorite: string,
  debut: string,
  fin: string,
): Promise<string> {
  const ligne = await requeteUne<{ id: string }>(
    `select produire_declaration($1::text, $2::date, $3::date) as id`,
    [autorite, debut, fin],
  )
  return ligne!.id
}

export async function marquerDeclaration(
  id: string,
  statut: 'brouillon' | 'transmise' | 'payee',
  reference: string | null,
): Promise<void> {
  await requete(
    `update declarations_taxes
        set statut = $2,
            date_transmission = case when $2 in ('transmise', 'payee')
                                     then coalesce(date_transmission, current_date) end,
            date_paiement = case when $2 = 'payee' then coalesce(date_paiement, current_date) end,
            reference = coalesce($3, reference)
      where id = $1::uuid`,
    [id, statut, reference],
  )
}

export async function supprimerDeclaration(id: string): Promise<void> {
  await requete(`delete from declarations_taxes where id = $1::uuid`, [id])
}

/** Trimestres civils disponibles, du plus récent au plus ancien. */
export async function periodesDisponibles(): Promise<
  { valeur: string; libelle: string; debut: string; fin: string }[]
> {
  const bornes = await requeteUne<{ premier: string | null; dernier: string | null }>(
    `select min(date)::text as premier, max(date)::text as dernier from transactions`,
  )
  if (!bornes?.premier) return []

  const periodes: { valeur: string; libelle: string; debut: string; fin: string }[] = []
  const [a1, m1] = bornes.premier.split('-').map(Number)
  const fin = bornes.dernier ?? bornes.premier
  const [a2, m2] = fin.split('-').map(Number)

  for (let annee = a2; annee >= a1; annee--) {
    const trimestreMax = annee === a2 ? Math.ceil(m2 / 3) : 4
    const trimestreMin = annee === a1 ? Math.ceil(m1 / 3) : 1
    for (let t = trimestreMax; t >= trimestreMin; t--) {
      const moisDebut = (t - 1) * 3 + 1
      const dernierJour = new Date(Date.UTC(annee, moisDebut + 2, 0)).getUTCDate()
      periodes.push({
        valeur: `${annee}-T${t}`,
        libelle: `T${t} ${annee}`,
        debut: `${annee}-${String(moisDebut).padStart(2, '0')}-01`,
        fin: `${annee}-${String(moisDebut + 2).padStart(2, '0')}-${dernierJour}`,
      })
    }
    periodes.push({
      valeur: `${annee}-annee`,
      libelle: `Année ${annee}`,
      debut: `${annee}-01-01`,
      fin: `${annee}-12-31`,
    })
  }
  return periodes
}
