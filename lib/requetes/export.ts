import 'server-only'
import { requete, requeteUne } from '@/lib/db'

/**
 * Exports destinés au comptable.
 *
 * Format retenu : CSV séparé par des points-virgules, décimales à la virgule,
 * avec la marque d'ordre d'octets UTF-8 en tête. C'est ce qu'Excel en français
 * ouvre correctement d'un double-clic, sans assistant d'importation ni accents
 * cassés — la seule chose qui compte pour un fichier que quelqu'un d'autre
 * devra ouvrir.
 */
export type Colonne<T> = {
  entete: string
  valeur: (ligne: T) => string | number | null
  /** Vrai pour un montant : la décimale devient une virgule. */
  montant?: boolean
}

function cellule(valeur: string | number | null, montant = false): string {
  if (valeur === null || valeur === undefined) return ''
  if (typeof valeur === 'number') {
    const texte = valeur.toFixed(montant ? 2 : 0)
    return montant ? texte.replace('.', ',') : texte
  }
  const texte = String(valeur)
  return /[;"\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte
}

export function versCsv<T>(lignes: T[], colonnes: Colonne<T>[]): string {
  const entete = colonnes.map((c) => cellule(c.entete)).join(';')
  const corps = lignes.map((l) =>
    colonnes.map((c) => cellule(c.valeur(l), c.montant)).join(';'),
  )
  return '﻿' + [entete, ...corps].join('\r\n') + '\r\n'
}

// ---------------------------------------------------------------------------
// Grand livre
// ---------------------------------------------------------------------------

export type LigneGrandLivre = {
  date: string
  numero_piece: string | null
  description: string
  type: string
  categorie: string
  categorie_libelle: string
  nature: string | null
  province: string
  montant_ht: number
  code_taxe: string | null
  autorite: string | null
  montant_taxe: number | null
  taxe_recuperable: number | null
  montant_ttc: number
  cout_reel: number
  mode_paiement: string
  source: string
  est_stock: boolean
  saisi_par: string | null
}

export async function grandLivre(debut: string, fin: string): Promise<LigneGrandLivre[]> {
  return requete<LigneGrandLivre>(
    `select t.date, v.numero as numero_piece, t.description,
            t.type::text, t.categorie::text, d.libelle as categorie_libelle,
            t.nature::text, t.province::text,
            t.montant_ht, l.code as code_taxe, l.autorite,
            l.montant as montant_taxe, l.montant_recuperable as taxe_recuperable,
            t.montant_ttc, t.cout_reel, t.mode_paiement::text, t.source::text, t.est_stock,
            u.nom as saisi_par
       from transactions t
       join categories_defauts d on d.categorie = t.categorie
       left join lignes_taxe l on l.transaction_id = t.id
       left join ventes v on v.id = t.vente_id
       left join utilisateurs u on u.id = t.cree_par
      where t.date between $1::date and $2::date
      order by t.date, t.description, l.code`,
    [debut, fin],
  )
}

// ---------------------------------------------------------------------------
// Balance de vérification
// ---------------------------------------------------------------------------

export type LigneBalance = {
  section: string
  categorie: string
  libelle: string
  nature: string | null
  montant_ht: number
  taxes: number
  taxes_recuperables: number
  cout_reel: number
  nb_ecritures: number
}

export async function balance(debut: string, fin: string): Promise<LigneBalance[]> {
  return requete<LigneBalance>(
    `select case
              when t.type = 'revenu' then 'Produits'
              when t.est_stock then 'Actif — stock'
              else 'Charges'
            end as section,
            t.categorie::text, d.libelle, t.nature::text,
            sum(t.montant_ht) as montant_ht,
            sum(t.total_taxes) as taxes,
            sum(t.total_taxes_recuperables) as taxes_recuperables,
            sum(t.cout_reel) as cout_reel,
            count(*)::int as nb_ecritures
       from transactions t
       join categories_defauts d on d.categorie = t.categorie
      where t.date between $1::date and $2::date
      group by 1, 2, 3, 4
      order by 1 desc, 5 desc`,
    [debut, fin],
  )
}

// ---------------------------------------------------------------------------
// Sommaire de période
// ---------------------------------------------------------------------------

export type Sommaire = {
  revenus_ht: number
  couts_variables: number
  couts_fixes: number
  cout_marchandises: number
  profit_net: number
  achats_stock: number
  valeur_stock: number
  taxes_percues: number
  credits_taxes: number
  net_taxes: number
  nb_transactions: number
  nb_documents: number
}

export async function sommaire(debut: string, fin: string): Promise<Sommaire> {
  const ligne = await requeteUne<Sommaire>(
    `with t as (select * from transactions where date between $1::date and $2::date)
     select
       coalesce(sum(montant_ht) filter (where type = 'revenu'), 0) as revenus_ht,
       coalesce(sum(cout_reel) filter (where type = 'depense' and nature = 'variable' and not est_stock), 0) as couts_variables,
       coalesce(sum(cout_reel) filter (where type = 'depense' and nature = 'fixe' and not est_stock), 0) as couts_fixes,
       coalesce(sum(cout_reel) filter (where categorie = 'cout_marchandises_vendues'), 0) as cout_marchandises,
       coalesce(sum(case when type = 'revenu' then montant_ht else -cout_reel end)
                filter (where not est_stock), 0) as profit_net,
       coalesce(sum(montant_ht) filter (where est_stock), 0) as achats_stock,
       (select coalesce(sum(valeur_stock), 0) from v_stock) as valeur_stock,
       coalesce(sum(total_taxes) filter (where type = 'revenu'), 0) as taxes_percues,
       coalesce(sum(total_taxes_recuperables) filter (where type = 'depense'), 0) as credits_taxes,
       coalesce(sum(total_taxes) filter (where type = 'revenu'), 0)
         - coalesce(sum(total_taxes_recuperables) filter (where type = 'depense'), 0) as net_taxes,
       count(*)::int as nb_transactions,
       (select count(*)::int from ventes v join types_document td on td.code = v.type_document
         where v.date between $1::date and $2::date and td.comptabilise_revenu
           and v.statut not in ('annulee', 'brouillon', 'refusee')) as nb_documents
     from t`,
    [debut, fin],
  )
  return (
    ligne ?? {
      revenus_ht: 0,
      couts_variables: 0,
      couts_fixes: 0,
      cout_marchandises: 0,
      profit_net: 0,
      achats_stock: 0,
      valeur_stock: 0,
      taxes_percues: 0,
      credits_taxes: 0,
      net_taxes: 0,
      nb_transactions: 0,
      nb_documents: 0,
    }
  )
}

// ---------------------------------------------------------------------------
// Documents de vente et mouvements d'associés
// ---------------------------------------------------------------------------

export type LigneVente = {
  numero: string
  type_libelle: string
  date: string
  client: string | null
  province: string
  regime_taxe: string
  motif_exemption: string | null
  montant_ht: number
  total_taxes: number
  montant_ttc: number
  montant_paye: number
  solde: number
  statut: string
  statut_paiement: string
}

export async function documentsVente(debut: string, fin: string): Promise<LigneVente[]> {
  return requete<LigneVente>(
    `select numero, type_libelle, date, client, province::text, regime_taxe::text,
            motif_exemption, montant_ht, total_taxes, montant_ttc, montant_paye, solde,
            statut::text, statut_paiement
       from v_documents_vente
      where date between $1::date and $2::date
      order by date, numero`,
    [debut, fin],
  )
}

export type LigneAssocie = {
  date: string
  associe: string
  compte: string
  type: string
  montant_signe: number
  description: string | null
}

export async function mouvementsAssocies(debut: string, fin: string): Promise<LigneAssocie[]> {
  return requete<LigneAssocie>(
    `select m.date, a.nom as associe, m.compte, m.type::text, m.montant_signe, m.description
       from mouvements_associes m
       join associes a on a.id = m.associe_id
      where m.date between $1::date and $2::date
      order by m.date, a.ordre`,
    [debut, fin],
  )
}

export type LigneTaxeExport = {
  autorite: string
  code: string
  taxes_percues: number
  taxes_payees: number
  credits: number
  net_a_remettre: number
}

export async function sommaireTaxes(debut: string, fin: string): Promise<LigneTaxeExport[]> {
  return requete<LigneTaxeExport>(`select * from rapport_taxes($1::date, $2::date)`, [debut, fin])
}
