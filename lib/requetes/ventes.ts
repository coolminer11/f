import 'server-only'
import { requete, requeteUne } from '@/lib/db'

export type TypeDocument =
  | 'facture'
  | 'recu'
  | 'facture_acompte'
  | 'note_credit'
  | 'devis'
  | 'proforma'
  | 'bon_livraison'

export type RegimeTaxe = 'taxable' | 'detaxe' | 'exonere' | 'hors_champ'

/**
 * Ce que fait chaque type de document vient de la base (`types_document`), pas
 * de constantes recopiées ici : il n'existe qu'une seule définition, et les
 * déclencheurs SQL et l'interface la lisent au même endroit.
 */
export type DefinitionType = {
  code: TypeDocument
  libelle: string
  libelle_pluriel: string
  prefixe: string
  comptabilise_revenu: boolean
  affecte_stock: boolean
  affiche_prix: boolean
  signe: number
  attend_paiement: boolean
  aide: string | null
  ordre: number
}

export type DefinitionRegime = {
  code: RegimeTaxe
  libelle: string
  applique_taxes: boolean
  motif_requis: boolean
  certificat_requis: boolean
  mention_document: string | null
  ordre: number
}

export async function typesDocument(): Promise<DefinitionType[]> {
  return requete<DefinitionType>(`select * from types_document order by ordre`)
}

export async function regimesTaxe(): Promise<DefinitionRegime[]> {
  return requete<DefinitionRegime>(`select * from regimes_taxe order by ordre`)
}

// ---------------------------------------------------------------------------
// Liste des documents
// ---------------------------------------------------------------------------

export type DocumentVente = {
  id: string
  numero: string
  type_document: TypeDocument
  type_libelle: string
  affiche_prix: boolean
  attend_paiement: boolean
  signe: number
  date: string
  date_echeance: string | null
  date_envoi: string | null
  client: string | null
  client_id: string | null
  province: string
  canal: string
  mode_paiement: string
  statut: string
  statut_paiement: 'impayee' | 'partielle' | 'payee' | 'remboursee' | 'sans_objet'
  regime_taxe: RegimeTaxe
  motif_exemption: string | null
  prix_avec_taxes: boolean
  montant_ht: number
  base_taxable: number
  total_taxes: number
  montant_ttc: number
  montant_paye: number
  solde: number
  remise_globale: number
  document_origine_id: string | null
  numero_origine: string | null
  nb_lignes: number
  quantite: number
  en_retard: boolean
  a_un_suivi: boolean
  numero_suivi_document: string | null
}

export async function listerDocuments(filtres: {
  type?: string
  statut_paiement?: string
  recherche?: string
}): Promise<DocumentVente[]> {
  const conditions: string[] = []
  const valeurs: unknown[] = []
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

// ---------------------------------------------------------------------------
// Un document complet
// ---------------------------------------------------------------------------

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
  note_credit_id: string | null
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
  numero_certificat_exemption: string | null
  transporteur: string | null
  numero_suivi: string | null
  lignes: LigneDocument[]
  taxes: DetailTaxe[]
  paiements: Paiement[]
  definition: DefinitionType
  regime: DefinitionRegime
}

/** Un identifiant malformé n'est pas une erreur serveur : c'est une page absente. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function documentComplet(id: string): Promise<VenteComplete | null> {
  if (!UUID.test(id)) return null

  const entete = await requeteUne<
    DocumentVente & {
      client_nom: string | null
      adresse_facturation: string | null
      courriel_facturation: string | null
      bon_de_commande: string | null
      conditions_paiement: string | null
      notes_facture: string | null
      conditions_generales: string | null
      note: string | null
      numero_certificat_exemption: string | null
      transporteur: string | null
      numero_suivi: string | null
    }
  >(
    `select d.*, v.client_nom, v.adresse_facturation, v.courriel_facturation,
            v.bon_de_commande, v.conditions_paiement, v.notes_facture,
            v.conditions_generales, v.note, v.numero_certificat_exemption,
            v.transporteur, v.numero_suivi
       from v_documents_vente d
       join ventes v on v.id = d.id
      where d.id = $1::uuid`,
    [id],
  )
  if (!entete) return null

  const [lignes, taxes, paiements, definition, regime] = await Promise.all([
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
      `select id, date, montant, mode_paiement, reference, note, note_credit_id
         from paiements_vente where vente_id = $1::uuid order by date, cree_le`,
      [id],
    ),
    requeteUne<DefinitionType>(`select * from types_document where code = $1::type_document`, [
      entete.type_document,
    ]),
    requeteUne<DefinitionRegime>(`select * from regimes_taxe where code = $1::regime_taxe`, [
      entete.regime_taxe,
    ]),
  ])

  // Un document qui ne comptabilise rien n'a pas d'écriture, donc pas de lignes
  // de taxe : on les calcule à la volée pour pouvoir les afficher.
  const taxesAffichees =
    taxes.length > 0 || !regime!.applique_taxes || entete.base_taxable === 0
      ? taxes
      : await requete<DetailTaxe>(
          `select code, taux, montant, autorite
             from calculer_taxes($1::numeric, $2::province_canada, $3::date)`,
          [entete.base_taxable, entete.province, entete.date],
        )

  return {
    ...entete,
    lignes,
    taxes: taxesAffichees,
    paiements,
    definition: definition!,
    regime: regime!,
  }
}

// ---------------------------------------------------------------------------
// Émetteur, produits, clients
// ---------------------------------------------------------------------------

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

export type Client = {
  id: string
  nom: string
  courriel: string | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  province: string | null
}

export async function listerClients(): Promise<Client[]> {
  return requete<Client>(
    `select id, nom, courriel, adresse, ville, code_postal, province
       from clients order by lower(nom) limit 500`,
  )
}

/**
 * Le fichier client se construit tout seul : facturer un nom inconnu le crée,
 * refacturer le même nom le retrouve. Personne n'a à tenir un répertoire à part.
 */
async function trouverOuCreerClient(entree: {
  nom: string
  courriel: string | null
  adresse: string | null
  province: string
}): Promise<string> {
  const existant = await requeteUne<{ id: string }>(
    `select id from clients where lower(nom) = lower($1) limit 1`,
    [entree.nom],
  )
  if (existant) {
    await requete(
      `update clients
          set courriel = coalesce(nullif($2, ''), courriel),
              adresse  = coalesce(nullif($3, ''), adresse),
              province = coalesce($4::province_canada, province)
        where id = $1::uuid`,
      [existant.id, entree.courriel ?? '', entree.adresse ?? '', entree.province],
    )
    return existant.id
  }
  const cree = await requeteUne<{ id: string }>(
    `insert into clients (nom, courriel, adresse, province)
     values ($1, nullif($2, ''), nullif($3, ''), $4::province_canada) returning id`,
    [entree.nom, entree.courriel ?? '', entree.adresse ?? '', entree.province],
  )
  return cree!.id
}

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

export type SaisieLigne = {
  produit_id: string | null
  description: string
  quantite: number
  prix_unitaire_ht: number
  remise_ht: number
  taxable: boolean
}

export type SaisieDocument = {
  typeDocument: TypeDocument
  date: string
  clientNom: string
  province: string
  modePaiement: string
  regimeTaxe: RegimeTaxe
  motifExemption: string | null
  numeroCertificat: string | null
  prixAvecTaxes: boolean
  conditionsPaiement: string | null
  dateEcheance: string | null
  adresseFacturation: string | null
  courrielFacturation: string | null
  bonDeCommande: string | null
  transporteur: string | null
  numeroSuivi: string | null
  remiseGlobale: number
  notesFacture: string | null
  conditionsGenerales: string | null
  documentOrigineId: string | null
  lignes: SaisieLigne[]
  paiementImmediat: number | null
}

export async function creerDocument(
  entree: SaisieDocument,
): Promise<{ id: string; numero: string }> {
  const canal = entree.modePaiement === 'comptant' ? 'comptant' : 'autre'
  const clientId = await trouverOuCreerClient({
    nom: entree.clientNom,
    courriel: entree.courrielFacturation,
    adresse: entree.adresseFacturation,
    province: entree.province,
  })

  const vente = await requeteUne<{ id: string; numero: string }>(
    `insert into ventes (
        date, client_id, client_nom, province, canal, mode_paiement, type_document,
        statut, conditions_paiement, date_echeance, adresse_facturation,
        courriel_facturation, bon_de_commande, remise_globale, notes_facture,
        conditions_generales, regime_taxe, motif_exemption,
        numero_certificat_exemption, prix_avec_taxes, document_origine_id,
        transporteur, numero_suivi)
      values ($1::date, $2::uuid, $3, $4::province_canada, $5::canal_vente,
              $6::mode_paiement, $7::type_document, $8::statut_vente, $9, $10::date,
              $11, $12, $13, $14::numeric, $15, $16, $17::regime_taxe, $18, $19,
              $20::boolean, $21::uuid, $22, $23)
      returning id, numero`,
    [
      entree.date,
      clientId,
      entree.clientNom,
      entree.province,
      canal,
      entree.modePaiement,
      entree.typeDocument,
      entree.typeDocument === 'devis' || entree.typeDocument === 'proforma'
        ? 'envoyee'
        : 'ferme',
      entree.conditionsPaiement,
      entree.dateEcheance,
      entree.adresseFacturation,
      entree.courrielFacturation,
      entree.bonDeCommande,
      entree.remiseGlobale,
      entree.notesFacture,
      entree.conditionsGenerales,
      entree.regimeTaxe,
      entree.motifExemption,
      entree.numeroCertificat,
      entree.prixAvecTaxes,
      entree.documentOrigineId,
      entree.transporteur,
      entree.numeroSuivi,
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

/** Contenu d'un document existant, pour préremplir une copie, une note de crédit ou un bon de livraison. */
export type Prefill = {
  source: { id: string; numero: string; type_document: TypeDocument }
  clientNom: string
  province: string
  modePaiement: string
  regimeTaxe: RegimeTaxe
  motifExemption: string | null
  numeroCertificat: string | null
  prixAvecTaxes: boolean
  adresseFacturation: string | null
  courrielFacturation: string | null
  bonDeCommande: string | null
  conditionsPaiement: string | null
  remiseGlobale: number
  notesFacture: string | null
  conditionsGenerales: string | null
  lignes: SaisieLigne[]
}

export async function contenuPour(sourceId: string): Promise<Prefill | null> {
  if (!UUID.test(sourceId)) return null
  const doc = await documentComplet(sourceId)
  if (!doc) return null

  return {
    source: { id: doc.id, numero: doc.numero, type_document: doc.type_document },
    clientNom: doc.client ?? doc.client_nom ?? '',
    province: doc.province,
    modePaiement: doc.mode_paiement,
    regimeTaxe: doc.regime_taxe,
    motifExemption: doc.motif_exemption,
    numeroCertificat: doc.numero_certificat_exemption,
    prixAvecTaxes: doc.prix_avec_taxes,
    adresseFacturation: doc.adresse_facturation,
    courrielFacturation: doc.courriel_facturation,
    bonDeCommande: doc.bon_de_commande,
    conditionsPaiement: doc.conditions_paiement,
    remiseGlobale: doc.remise_globale,
    notesFacture: doc.notes_facture,
    conditionsGenerales: doc.conditions_generales,
    lignes: doc.lignes.map((l) => ({
      produit_id: l.produit_id,
      description: l.description,
      quantite: l.quantite,
      prix_unitaire_ht: Number(l.prix_unitaire_ht),
      remise_ht: Number(l.remise_ht),
      taxable: l.taxable,
    })),
  }
}

// ---------------------------------------------------------------------------
// Actions sur un document
// ---------------------------------------------------------------------------

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

export async function appliquerNoteCredit(noteId: string, factureId: string): Promise<void> {
  await requete(`select appliquer_note_credit($1::uuid, $2::uuid)`, [noteId, factureId])
}

export async function marquerEnvoye(id: string, date: string): Promise<void> {
  await requete(
    `update ventes set date_envoi = $2::date,
            statut = case when statut = 'brouillon' then 'envoyee'::statut_vente else statut end
      where id = $1::uuid`,
    [id, date],
  )
}

export async function annulerDocument(id: string): Promise<void> {
  await requete(`update ventes set statut = 'annulee' where id = $1::uuid`, [id])
}

/** Factures et reçus non soldés d'un client : cibles possibles d'une note de crédit. */
export async function documentsCreditables(clientNom: string): Promise<DocumentVente[]> {
  return requete<DocumentVente>(
    `select * from v_documents_vente
      where type_document in ('facture', 'facture_acompte', 'recu')
        and statut not in ('annulee', 'brouillon')
        and lower(coalesce(client, '')) = lower($1)
      order by date desc limit 20`,
    [clientNom],
  )
}

export const CONDITIONS_PAIEMENT = [
  ['Payable à réception', 0],
  ['Net 15', 15],
  ['Net 30', 30],
  ['Net 60', 60],
] as const

export const MOTIFS_EXEMPTION = [
  'Exportation hors du Canada — bien expédié à l’étranger',
  'Fourniture à un acheteur autochtone, livrée sur réserve',
  'Vente à un autre inscrit, hors du champ des taxes de vente',
] as const
