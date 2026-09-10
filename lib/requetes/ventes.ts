import 'server-only'
import { requete, requeteUne } from '@/lib/db'

export type TypeDocument = 'facture' | 'devis' | 'recu'

export type DocumentVente = {
  id: string
  numero: string
  type_document: TypeDocument
  date: string
  date_echeance: string | null
  client: string | null
  province: string
  canal: string
  mode_paiement: string
  statut: string
  statut_paiement: 'impayee' | 'partielle' | 'payee' | 'remboursee'
  montant_ht: number
  total_taxes: number
  montant_ttc: number
  montant_paye: number
  solde: number
  remise_globale: number
  devis_origine_id: string | null
  nb_lignes: number
  quantite: number
  en_retard: boolean
  devis_facture: boolean
}

export async function listerDocuments(filtres: {
  type?: string
  statut_paiement?: string
  recherche?: string
}): Promise<DocumentVente[]> {
  const conditions: string[] = []
  const valeurs: unknown[] = []
  /** Ajoute une condition ; chaque « ? » consomme le paramètre qui vient d'être poussé. */
  const ajouter = (modele: string, valeur: unknown) => {
    valeurs.push(valeur)
    conditions.push(modele.replaceAll('?', `$${valeurs.length}`))
  }
  if (filtres.type) ajouter('type_document = ?::type_document', filtres.type)
  if (filtres.statut_paiement === 'en_retard') conditions.push('en_retard')
  else if (filtres.statut_paiement) ajouter('statut_paiement = ?', filtres.statut_paiement)
  if (filtres.recherche) ajouter('(client ilike ? or numero ilike ?)', `%${filtres.recherche}%`)
  const ou = conditions.length ? `where ${conditions.join(' and ')}` : ''
  return requete<DocumentVente>(
    `select * from v_documents_vente ${ou} order by date desc, numero desc limit 200`,
    valeurs,
  )
}

export type LigneDocument = {
  id: string
  produit_id: string | null
  description: string
  quantite: number
  prix_unitaire_ht: number
  remise_ht: number
  taxable: boolean
  montant_ht: number
  ordre: number
}

export type DetailTaxe = { code: string; taux: number; montant: number; autorite: string }

export type Paiement = {
  id: string
  date: string
  montant: number
  mode_paiement: string
  reference: string | null
  note: string | null
}

export type VenteComplete = DocumentVente & {
  client_nom: string | null
  adresse_facturation: string | null
  courriel_facturation: string | null
  bon_de_commande: string | null
  conditions_paiement: string | null
  notes_facture: string | null
  conditions_generales: string | null
  note: string | null
  lignes: LigneDocument[]
  taxes: DetailTaxe[]
  paiements: Paiement[]
  numero_devis_origine: string | null
}

/** Un identifiant malformé n'est pas une erreur serveur : c'est une page absente. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function documentComplet(id: string): Promise<VenteComplete | null> {
  if (!UUID.test(id)) return null

  const entete = await requeteUne<VenteComplete>(
    `select d.*, v.client_nom, v.adresse_facturation, v.courriel_facturation,
            v.bon_de_commande, v.conditions_paiement, v.notes_facture,
            v.conditions_generales, v.note,
            (select numero from ventes o where o.id = v.devis_origine_id) as numero_devis_origine
       from v_documents_vente d
       join ventes v on v.id = d.id
      where d.id = $1::uuid`,
    [id],
  )
  if (!entete) return null

  const [lignes, taxes, paiements] = await Promise.all([
    requete<LigneDocument>(
      `select id, produit_id, description, quantite, prix_unitaire_ht, remise_ht,
              taxable, montant_ht, ordre
         from vente_lignes where vente_id = $1::uuid order by ordre, description`,
      [id],
    ),
    requete<DetailTaxe>(
      `select l.code, l.taux, l.montant, l.autorite
         from lignes_taxe l
         join transactions t on t.id = l.transaction_id
        where t.vente_id = $1::uuid and t.type = 'revenu'
        order by l.code`,
      [id],
    ),
    requete<Paiement>(
      `select id, date, montant, mode_paiement, reference, note
         from paiements_vente where vente_id = $1::uuid order by date, cree_le`,
      [id],
    ),
  ])

  // Un devis ne produit aucune écriture : ses taxes se calculent à la volée.
  const taxesAffichees =
    taxes.length > 0 || entete.type_document !== 'devis'
      ? taxes
      : await requete<DetailTaxe>(
          `select code, taux, montant, autorite
             from calculer_taxes($1::numeric, $2::province_canada, $3::date)`,
          [entete.montant_ht, entete.province, entete.date],
        )

  return { ...entete, lignes, taxes: taxesAffichees, paiements }
}

export type Emetteur = {
  nom_entreprise: string
  neq: string | null
  numero_tps: string | null
  numero_tvq: string | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  telephone: string | null
  site_web: string | null
  courriel_contact: string | null
  pied_facture: string | null
  conditions_generales_defaut: string | null
  delai_paiement_jours: number
}

export async function emetteur(): Promise<Emetteur> {
  const p = await requeteUne<Emetteur>(
    `select nom_entreprise, neq, numero_tps, numero_tvq, adresse, ville, code_postal,
            telephone, site_web, courriel_contact, pied_facture,
            conditions_generales_defaut, delai_paiement_jours
       from parametres where id`,
  )
  if (!p) throw new Error('Les paramètres de la société ne sont pas initialisés.')
  return p
}

export type Produit = {
  id: string
  sku: string
  nom: string
  prix_vente_ht: number
  taxable: boolean
}

export async function listerProduits(): Promise<Produit[]> {
  return requete<Produit>(
    `select id, sku, nom, prix_vente_ht, taxable from produits where actif order by nom`,
  )
}

export type SaisieLigne = {
  produit_id: string | null
  description: string
  quantite: number
  prix_unitaire_ht: number
  remise_ht: number
  taxable: boolean
}

export async function creerDocument(entree: {
  typeDocument: TypeDocument
  date: string
  clientNom: string
  clientId: string | null
  province: string
  modePaiement: string
  conditionsPaiement: string | null
  dateEcheance: string | null
  adresseFacturation: string | null
  courrielFacturation: string | null
  bonDeCommande: string | null
  remiseGlobale: number
  notesFacture: string | null
  conditionsGenerales: string | null
  lignes: SaisieLigne[]
  paiementImmediat: number | null
}): Promise<{ id: string; numero: string }> {
  const canal = entree.modePaiement === 'comptant' ? 'comptant' : 'autre'
  const vente = await requeteUne<{ id: string; numero: string }>(
    `insert into ventes (
        date, client_id, client_nom, province, canal, mode_paiement, type_document,
        statut, conditions_paiement, date_echeance, adresse_facturation,
        courriel_facturation, bon_de_commande, remise_globale, notes_facture,
        conditions_generales)
      values ($1::date, $2::uuid, $3, $4::province_canada, $5::canal_vente,
              $6::mode_paiement, $7::type_document,
              $8::statut_vente, $9, $10::date, $11, $12, $13, $14::numeric, $15, $16)
      returning id, numero`,
    [
      entree.date,
      entree.clientId,
      entree.clientNom,
      entree.province,
      canal,
      entree.modePaiement,
      entree.typeDocument,
      entree.typeDocument === 'devis' ? 'envoyee' : 'ferme',
      entree.conditionsPaiement,
      entree.dateEcheance,
      entree.adresseFacturation,
      entree.courrielFacturation,
      entree.bonDeCommande,
      entree.remiseGlobale,
      entree.notesFacture,
      entree.conditionsGenerales,
    ],
  )
  if (!vente) throw new Error('Création du document impossible.')

  for (const [index, ligne] of entree.lignes.entries()) {
    await requete(
      `insert into vente_lignes (vente_id, produit_id, description, quantite,
                                 prix_unitaire_ht, remise_ht, taxable, ordre)
       values ($1::uuid, $2::uuid, $3, $4::int, $5::numeric, $6::numeric, $7::boolean, $8::int)`,
      [
        vente.id,
        ligne.produit_id,
        ligne.description,
        ligne.quantite,
        ligne.prix_unitaire_ht,
        ligne.remise_ht,
        ligne.taxable,
        index + 1,
      ],
    )
  }

  if (entree.paiementImmediat && entree.paiementImmediat > 0) {
    await requete(
      `insert into paiements_vente (vente_id, date, montant, mode_paiement)
       values ($1::uuid, $2::date, $3::numeric, $4::mode_paiement)`,
      [vente.id, entree.date, entree.paiementImmediat, entree.modePaiement],
    )
  }

  return vente
}

export async function ajouterPaiement(entree: {
  venteId: string
  date: string
  montant: number
  modePaiement: string
  reference: string | null
}): Promise<void> {
  await requete(
    `insert into paiements_vente (vente_id, date, montant, mode_paiement, reference)
     values ($1::uuid, $2::date, $3::numeric, $4::mode_paiement, $5)`,
    [entree.venteId, entree.date, entree.montant, entree.modePaiement, entree.reference],
  )
}

export async function supprimerPaiement(id: string): Promise<void> {
  await requete(`delete from paiements_vente where id = $1::uuid`, [id])
}

export async function accepterDevis(devisId: string, date: string): Promise<string> {
  const ligne = await requeteUne<{ id: string }>(
    `select convertir_devis_en_facture($1::uuid, $2::date) as id`,
    [devisId, date],
  )
  return ligne!.id
}

export async function annulerDocument(id: string): Promise<void> {
  await requete(`update ventes set statut = 'annulee' where id = $1::uuid`, [id])
}

export const CONDITIONS_PAIEMENT = [
  ['Payable à réception', 0],
  ['Net 15', 15],
  ['Net 30', 30],
  ['Net 60', 60],
] as const
