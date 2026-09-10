import 'server-only'
import { createHash } from 'node:crypto'
import { requete, requeteUne } from '@/lib/db'
import type { LigneReleve } from '@/lib/csv'

export type Import = {
  id: string
  nom_fichier: string
  compte: string | null
  date_import: string
  nb_lignes: number
  nb_traitees: number
  statut: 'en_cours' | 'termine'
}

export async function listerImports(): Promise<Import[]> {
  return requete<Import>(
    `select i.id, i.nom_fichier, i.compte, i.date_import, i.nb_lignes,
            (select count(*) from lignes_import_bancaire l
              where l.import_id = i.id and l.statut <> 'a_categoriser')::int as nb_traitees,
            i.statut
       from imports_bancaires i order by i.date_import desc limit 50`,
  )
}

/**
 * Empreinte d'une ligne : date, montant et description normalisée. Deux
 * relevés qui se chevauchent ne recréent pas les mêmes écritures.
 */
function empreinteLigne(ligne: LigneReleve): string {
  const cle = [
    ligne.date,
    ligne.montant.toFixed(2),
    ligne.description.toLowerCase().replace(/\s+/g, ' ').trim(),
  ].join('|')
  return createHash('sha256').update(cle).digest('hex')
}

export type ResultatImport = {
  importId: string | null
  inserees: number
  doublons: number
  deja: boolean
}

export async function enregistrerImport(entree: {
  nomFichier: string
  empreinteFichier: string
  compte: string | null
  lignes: LigneReleve[]
}): Promise<ResultatImport> {
  const existant = await requeteUne<{ id: string }>(
    `select id from imports_bancaires where empreinte_fichier = $1`,
    [entree.empreinteFichier],
  )
  if (existant) return { importId: existant.id, inserees: 0, doublons: 0, deja: true }

  const dossier = await requeteUne<{ id: string }>(
    `insert into imports_bancaires (nom_fichier, empreinte_fichier, compte, nb_lignes)
     values ($1, $2, $3, $4::int) returning id`,
    [entree.nomFichier, entree.empreinteFichier, entree.compte, entree.lignes.length],
  )
  const importId = dossier!.id

  let inserees = 0
  for (const ligne of entree.lignes) {
    const insere = await requeteUne<{ id: string }>(
      `insert into lignes_import_bancaire
         (import_id, date, description, montant, solde, empreinte, categorie_suggeree)
       values ($1::uuid, $2::date, $3, $4::numeric, $5::numeric, $6,
               (select categorie from suggerer_categorie($3, $4::numeric)))
       on conflict (empreinte) do nothing
       returning id`,
      [importId, ligne.date, ligne.description, ligne.montant, ligne.solde, empreinteLigne(ligne)],
    )
    if (insere) inserees++
  }

  return { importId, inserees, doublons: entree.lignes.length - inserees, deja: false }
}

export type LigneAClasser = {
  id: string
  date: string
  description: string
  montant: number
  solde: number | null
  statut: string
  categorie_suggeree: string | null
  type_suggere: 'revenu' | 'depense' | null
  nature_suggeree: 'variable' | 'fixe' | null
  rapprochement_suggere: string | null
  versement_suggere: string | null
  versement_date: string | null
  versement_montant: number | null
  transaction_id: string | null
}

export async function lignesAClasser(
  importId: string | null,
  inclureTraitees: boolean,
): Promise<LigneAClasser[]> {
  return requete<LigneAClasser>(
    `select l.id, l.date, l.description, l.montant, l.solde, l.statut,
            l.categorie_suggeree, l.transaction_id,
            s.type as type_suggere, s.nature as nature_suggeree,
            r.statut_suggere as rapprochement_suggere,
            r.versement_stripe_id as versement_suggere,
            vs.date_arrivee as versement_date,
            vs.montant as versement_montant
       from lignes_import_bancaire l
       left join lateral suggerer_categorie(l.description, l.montant) s on true
       left join lateral suggerer_rapprochement(l.date, l.montant) r on true
       left join versements_stripe vs on vs.id = r.versement_stripe_id
      where ($1::uuid is null or l.import_id = $1::uuid)
        and ($2::boolean or l.statut = 'a_categoriser')
      order by l.date, l.description
      limit 500`,
    [importId, inclureTraitees],
  )
}

export type DecisionLigne = {
  ligneId: string
  action: 'categoriser' | 'depot_caisse' | 'virement_stripe' | 'mouvement_associe' | 'ignoree'
  categorie?: string
  province?: string
  versementStripeId?: string | null
}

/**
 * Applique les décisions de l'écran de rapprochement.
 *
 * Seule l'action « categoriser » crée une écriture. Un dépôt d'argent
 * comptant, un versement Stripe ou un mouvement d'associé sont de l'argent
 * DÉJÀ comptabilisé : les marquer sans rien créer est précisément ce qui
 * évite de compter la même vente deux fois.
 */
export async function appliquerDecisions(decisions: DecisionLigne[]): Promise<number> {
  let traitees = 0

  for (const d of decisions) {
    const ligne = await requeteUne<{
      id: string
      date: string
      description: string
      montant: number
      statut: string
      transaction_id: string | null
    }>(
      `select id, date, description, montant, statut, transaction_id
         from lignes_import_bancaire where id = $1::uuid`,
      [d.ligneId],
    )
    if (!ligne || ligne.statut !== 'a_categoriser') continue

    if (d.action === 'categoriser') {
      if (!d.categorie) continue
      const estDepense = ligne.montant < 0
      const province = d.province ?? 'QC'

      // Un montant au relevé bancaire est TOUJOURS taxes incluses : c'est ce
      // qui a réellement quitté le compte. L'enregistrer tel quel comme montant
      // hors taxes ajouterait les taxes une seconde fois par-dessus.
      const ventilation = await requeteUne<{ montant_ht: number; montant_taxes: number }>(
        `select montant_ht, montant_taxes
           from ventiler_ttc($1::numeric, $2::province_canada, $3::date)`,
        [Math.abs(ligne.montant), province, ligne.date],
      )
      const montantHt = ventilation?.montant_ht ?? Math.abs(ligne.montant)
      const totalTaxes = ventilation?.montant_taxes ?? 0

      const transaction = await requeteUne<{ id: string }>(
        estDepense
          ? `select enregistrer_depense($1::date, $2::text, $3::numeric,
                     $4::categorie_transaction, $5::province_canada, 'virement'::mode_paiement,
                     null, null, $6::numeric, 'Import bancaire') as id`
          : `insert into transactions (date, description, montant_ht, type, categorie,
                                       source, mode_paiement, province, note)
             values ($1::date, $2::text, $3::numeric, 'revenu', $4::categorie_transaction,
                     'banque', 'virement', $5::province_canada, 'Import bancaire')
             returning id`,
        [ligne.date, ligne.description, montantHt, d.categorie, province, totalTaxes],
      )
      // Une ligne importée est marquée à la source « banque » : elle vient du relevé.
      await requete(
        `update transactions set source = 'banque', reference_externe = $2 where id = $1::uuid`,
        [transaction!.id, `import:${ligne.id}`],
      )
      if (!estDepense) {
        await requete(`select poser_lignes_taxe($1::uuid, $2::numeric, $3::numeric)`, [
          transaction!.id,
          montantHt,
          totalTaxes,
        ])
      }
      await requete(
        `update lignes_import_bancaire
            set statut = 'categorisee', transaction_id = $2::uuid where id = $1::uuid`,
        [ligne.id, transaction!.id],
      )
    } else {
      await requete(
        `update lignes_import_bancaire
            set statut = $2, versement_stripe_id = $3 where id = $1::uuid`,
        [ligne.id, d.action, d.versementStripeId ?? null],
      )
      if (d.action === 'virement_stripe' && d.versementStripeId) {
        await requete(`update versements_stripe set rapproche = true where id = $1`, [
          d.versementStripeId,
        ])
      }
    }
    traitees++
  }
  return traitees
}

export async function annulerClassement(ligneId: string): Promise<void> {
  const ligne = await requeteUne<{ transaction_id: string | null }>(
    `select transaction_id from lignes_import_bancaire where id = $1::uuid`,
    [ligneId],
  )
  if (ligne?.transaction_id) {
    await requete(`delete from transactions where id = $1::uuid`, [ligne.transaction_id])
  }
  await requete(
    `update lignes_import_bancaire
        set statut = 'a_categoriser', transaction_id = null, versement_stripe_id = null
      where id = $1::uuid`,
    [ligneId],
  )
}

export async function supprimerImport(id: string): Promise<void> {
  await requete(`delete from imports_bancaires where id = $1::uuid`, [id])
}
