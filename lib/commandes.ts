import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import { accepterDevis, creerDocument } from '@/lib/requetes/ventes'
import { creerDossier } from '@/lib/requetes/dossiers'
import { inscritAuxTaxes, recevoirCartes } from '@/lib/stock'

/**
 * Les commandes Entreprise (cartes personnalisées, 25 au minimum).
 *
 * Sept étapes, chacune avec son action, qui fait le travail toute seule :
 *   1. Demande — et le devis, en un clic ;
 *   2. Maquette — le fichier joint à la commande ;
 *   3. Approuvée — le client a dit oui ;
 *   4. Commandée — chez le fournisseur ;
 *   5. Reçue — les cartes entrent au stock, à leur vrai coût ;
 *   6. Posée — les cartes NFC sont créées dans le dossier du client ;
 *   7. Facturée — le devis devient la facture ; les cartes sortent du stock.
 *
 * Les règles (minimum de 25, langue au Québec) sont vérifiées par la base.
 */

export const ETAPES = [
  ['demande', 'Demande', 'La commande et son devis.'],
  ['maquette', 'Maquette', 'Le visuel de la carte, envoyé au client.'],
  ['approuvee', 'Approuvée', 'Le client a dit oui à la maquette.'],
  ['commandee', 'Commandée', 'Chez le fournisseur.'],
  ['recue', 'Reçue', 'Les cartes entrent au stock, à leur vrai coût.'],
  ['posee', 'Posée', 'Programmées et posées ; elles sont créées dans le dossier du client.'],
  ['facturee', 'Facturée', 'La facture est faite ; les cartes sortent du stock.'],
] as const
export type Etape = (typeof ETAPES)[number][0]
export const rangEtape = (e: string) => ETAPES.findIndex(([c]) => c === e)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const n = (v: unknown) => Number(v ?? 0)

export type Commande = {
  id: string
  numero: string
  client_id: string | null
  client_nom: string
  courriel: string | null
  dossier_id: string | null
  produit_id: string
  produit_nom: string
  modele: string
  langue: 'fr_en' | 'en_fr'
  quantite: number
  prix_unitaire: number
  total: number
  lieu: string
  couleurs: string | null
  texte_fr: string | null
  texte_en: string | null
  noms_cartes: string | null
  destination: string | null
  logo_url: string | null
  maquette_url: string | null
  maquette_approuvee_le: string | null
  notes: string | null
  etape: Etape
  annulee_le: string | null
  devis_id: string | null
  devis_numero: string | null
  facture_id: string | null
  facture_numero: string | null
  reception_id: string | null
  cout_cartes: number | null
  cree_le: string
  etapes: { etape: string; fait_le: string; par: string | null; note: string | null }[]
}

const SELECT = `
  select c.id, c.numero, c.client_id, c.client_nom, c.courriel, c.dossier_id, c.produit_id, p.nom as produit_nom,
         p.modele, p.langue, c.quantite, c.prix_unitaire, round(c.quantite * c.prix_unitaire, 2) as total, c.lieu,
         c.couleurs, c.texte_fr, c.texte_en, c.noms_cartes, c.destination, c.logo_url, c.maquette_url, c.maquette_approuvee_le, c.notes,
         c.etape, c.annulee_le, c.devis_id, dv.numero as devis_numero, c.facture_id, fa.numero as facture_numero,
         c.reception_id, rc.cout_reel as cout_cartes, c.cree_le
    from commandes c
    join produits p on p.id = c.produit_id
    left join ventes dv on dv.id = c.devis_id
    left join ventes fa on fa.id = c.facture_id
    left join transactions rc on rc.id = c.reception_id`

const versCommande = (x: Record<string, unknown>, etapes: Commande['etapes'] = []): Commande => ({
  ...(x as unknown as Commande),
  quantite: n(x.quantite),
  prix_unitaire: n(x.prix_unitaire),
  total: n(x.total),
  cout_cartes: x.cout_cartes === null || x.cout_cartes === undefined ? null : n(x.cout_cartes),
  etapes,
})

export async function listerCommandes(): Promise<Commande[]> {
  const l = await requete<Record<string, unknown>>(`${SELECT} order by c.annulee_le is not null, c.cree_le desc limit 200`)
  return l.map((x) => versCommande(x))
}

export async function lireCommande(id: string): Promise<Commande | null> {
  if (!UUID.test(id)) return null
  const x = await requeteUne<Record<string, unknown>>(`${SELECT} where c.id = $1::uuid`, [id])
  if (!x) return null
  const etapes = await requete<Commande['etapes'][number]>(
    `select e.etape, e.fait_le, u.nom as par, e.note from commandes_etapes e left join utilisateurs u on u.id = e.par
      where e.commande_id = $1::uuid`,
    [id],
  )
  return versCommande(x, etapes)
}

export type SaisieCommande = {
  clientNom: string
  courriel: string | null
  produitId: string
  quantite: number
  prixUnitaire: number
  lieu: string
  couleurs: string | null
  texteFr: string | null
  texteEn: string | null
  nomsCartes: string | null
  destination: string | null
  notes: string | null
}

export async function creerCommande(e: SaisieCommande, utilisateurId: string): Promise<string> {
  const client = await requeteUne<{ id: string }>(`select id from clients where lower(nom) = lower($1) limit 1`, [e.clientNom])
  const l = await requeteUne<{ id: string }>(
    `insert into commandes (client_id, client_nom, courriel, produit_id, quantite, prix_unitaire, lieu, couleurs,
                            texte_fr, texte_en, noms_cartes, destination, notes, cree_par)
     values ($1::uuid, $2, $3, $4::uuid, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::uuid) returning id`,
    [client?.id ?? null, e.clientNom, e.courriel, e.produitId, e.quantite, e.prixUnitaire, e.lieu, e.couleurs,
     e.texteFr, e.texteEn, e.nomsCartes, e.destination, e.notes, utilisateurId],
  )
  await noterEtape(l!.id, 'demande', utilisateurId, null)
  return l!.id
}

export async function modifierCommande(id: string, e: SaisieCommande): Promise<void> {
  if (!UUID.test(id)) throw new Error('Commande introuvable.')
  await requete(
    `update commandes set client_nom = $2, courriel = $3, produit_id = $4::uuid, quantite = $5, prix_unitaire = $6, lieu = $7,
            couleurs = $8, texte_fr = $9, texte_en = $10, noms_cartes = $11, destination = $12, notes = $13
      where id = $1::uuid and annulee_le is null`,
    [id, e.clientNom, e.courriel, e.produitId, e.quantite, e.prixUnitaire, e.lieu, e.couleurs, e.texteFr, e.texteEn,
     e.nomsCartes, e.destination, e.notes],
  )
}

/** Une étape faite : sa date (et qui), et la commande avance jusque-là si elle était derrière. */
/** Une étape faite (par un associé, ou par le client depuis son portail : `utilisateurId` null). */
export async function noterEtape(id: string, etape: Etape, utilisateurId: string | null, note: string | null): Promise<void> {
  await requete(
    `insert into commandes_etapes (commande_id, etape, par, note) values ($1::uuid, $2, $3::uuid, $4)
     on conflict (commande_id, etape) do update set fait_le = now(), par = excluded.par, note = coalesce(excluded.note, commandes_etapes.note)`,
    [id, etape, utilisateurId, note],
  )
  const ordre = ETAPES.map(([c]) => c)
  await requete(
    `update commandes set etape = $2
      where id = $1::uuid and array_position($3::text[], etape) < array_position($3::text[], $2)`,
    [id, etape, ordre],
  )
}

export async function joindreFichier(id: string, quoi: 'logo' | 'maquette', chemin: string): Promise<void> {
  await requete(`update commandes set ${quoi === 'logo' ? 'logo_url' : 'maquette_url'} = $2 where id = $1::uuid`, [id, chemin])
}

export async function annulerCommande(id: string, annuler: boolean): Promise<void> {
  await requete(`update commandes set annulee_le = case when $2 then now() else null end where id = $1::uuid`, [id, annuler])
}

/** Le régime de taxes de nos documents : non inscrite → hors champ, avec le motif. */
async function regimeSociete(): Promise<{ regime: 'taxable' | 'hors_champ'; motif: string | null }> {
  return (await inscritAuxTaxes())
    ? { regime: 'taxable', motif: null }
    : { regime: 'hors_champ', motif: 'Petit fournisseur — non inscrit aux taxes (TPS/TVQ)' }
}

function resume(c: Commande): string {
  const parties = [
    `Commande ${c.numero} — ${c.quantite} cartes personnalisées (${c.langue === 'fr_en' ? 'français d’abord' : 'anglais d’abord'}).`,
    c.couleurs && `Couleurs : ${c.couleurs}.`,
    c.texte_fr && `Texte : « ${c.texte_fr} »${c.texte_en ? ` / « ${c.texte_en} »` : ''}.`,
  ]
  return parties.filter(Boolean).join(' ')
}

/** Étape 1 : le devis, prérempli (client, carte, quantité, prix, personnalisation). */
export async function creerDevisCommande(id: string): Promise<{ id: string; numero: string }> {
  const c = await lireCommande(id)
  if (!c) throw new Error('Commande introuvable.')
  if (c.devis_id) throw new Error(`Le devis ${c.devis_numero} existe déjà.`)
  const { regime, motif } = await regimeSociete()
  const aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date())
  const devis = await creerDocument({
    typeDocument: 'devis',
    date: aujourdhui,
    clientNom: c.client_nom,
    province: /^[A-Z]{2}$/.test(c.lieu) ? c.lieu : 'QC',
    modePaiement: 'autre',
    regimeTaxe: regime,
    motifExemption: motif,
    numeroCertificat: null,
    prixAvecTaxes: false,
    conditionsPaiement: 'Payable à réception',
    dateEcheance: null,
    adresseFacturation: null,
    courrielFacturation: c.courriel,
    bonDeCommande: c.numero,
    transporteur: null,
    numeroSuivi: null,
    remiseGlobale: 0,
    notesFacture: resume(c),
    conditionsGenerales: null,
    documentOrigineId: null,
    lignes: [
      { produit_id: c.produit_id, description: `${c.produit_nom} — personnalisée`, quantite: c.quantite, prix_unitaire_ht: c.prix_unitaire, remise_ht: 0, taxable: true },
    ],
    paiementImmediat: null,
  })
  await requete(`update commandes set devis_id = $2::uuid where id = $1::uuid`, [id, devis.id])
  return devis
}

/** Étape 5 : les cartes reçues entrent au stock du modèle, à leur coût réel. */
export async function recevoirCommande(id: string, total: number, date: string, utilisateurId: string): Promise<void> {
  const c = await lireCommande(id)
  if (!c) throw new Error('Commande introuvable.')
  if (c.reception_id) throw new Error('Les cartes de cette commande sont déjà reçues (corrigez la réception dans Stock).')
  const reception = await recevoirCartes({
    produitId: c.produit_id,
    date,
    quantite: c.quantite,
    total,
    taxes: 0,
    description: `Commande ${c.numero} — ${c.client_nom}`,
    modePaiement: 'autre',
    pieceJointe: null,
  })
  await requete(`update commandes set reception_id = $2::uuid where id = $1::uuid`, [id, reception])
  await noterEtape(id, 'recue', utilisateurId, null)
}

/**
 * Le dossier (et donc le portail) du client de la commande, créé au besoin :
 * dès qu'il existe, le client suit sa commande et approuve sa maquette depuis
 * sa page privée.
 */
export async function assurerDossier(c: Commande): Promise<string> {
  if (c.dossier_id) return c.dossier_id
  const dossierId = await creerDossier({
    nom: c.client_nom.slice(0, 120),
    clientId: c.client_id,
    courrielRapport: c.courriel,
    rapportMensuel: false,
    note: `Commande ${c.numero}`,
    langue: c.langue === 'en_fr' ? 'en' : 'fr',
    objectifAvis: null,
    avisPose: null,
    avisMoisAvant: null,
    datePose: null,
    siteWeb: null,
    partenairePublic: false,
  })
  await requete(`update commandes set dossier_id = $2::uuid where id = $1::uuid and dossier_id is null`, [c.id, dossierId])
  return dossierId
}

/**
 * Étape 6 : les cartes NFC sont créées dans le dossier du client (créé au
 * besoin), une par nom de la liste, sinon « Carte 1 » à « Carte N ».
 */
export async function poserCommande(id: string, utilisateurId: string): Promise<number> {
  const c = await lireCommande(id)
  if (!c) throw new Error('Commande introuvable.')
  if (!c.destination) throw new Error('Indiquez d’abord la destination des cartes (le lien Google ou autre) dans « Modifier ».')
  const deja = await requeteUne<{ n: number }>(`select count(*)::int as n from cartes_nfc where note = $1`, [`Commande ${c.numero}`])
  if (deja && deja.n > 0) throw new Error(`Les cartes de cette commande existent déjà (${deja.n}).`)

  const dossierId = await assurerDossier(c)

  const noms = (c.noms_cartes ?? '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, c.quantite)
  const libelles = Array.from({ length: c.quantite }, (_, i) => (noms[i] ?? `Carte ${i + 1}`).slice(0, 80))
  await requete(
    `insert into cartes_nfc (code, libelle, dossier_id, client_id, destination, note)
     select nouveau_code_carte(), l, $2::uuid, (select client_id from dossiers_cartes where id = $2::uuid), $3, $4
       from unnest($1::text[]) with ordinality as x(l, i) order by i`,
    [libelles, dossierId, c.destination, `Commande ${c.numero}`],
  )
  await noterEtape(id, 'posee', utilisateurId, null)
  return libelles.length
}

/** Étape 7 : le devis accepté devient la facture (ou une facture directe, sans devis). */
export async function facturerCommande(id: string, date: string, utilisateurId: string): Promise<{ id: string; numero: string }> {
  const c = await lireCommande(id)
  if (!c) throw new Error('Commande introuvable.')
  if (c.facture_id) throw new Error(`La facture ${c.facture_numero} existe déjà.`)
  let facture: { id: string; numero: string }
  if (c.devis_id) {
    const fid = await accepterDevis(c.devis_id, date)
    const l = await requeteUne<{ numero: string }>(`select numero from ventes where id = $1::uuid`, [fid])
    facture = { id: fid, numero: l?.numero ?? '' }
  } else {
    const { regime, motif } = await regimeSociete()
    facture = await creerDocument({
      typeDocument: 'facture',
      date,
      clientNom: c.client_nom,
      province: /^[A-Z]{2}$/.test(c.lieu) ? c.lieu : 'QC',
      modePaiement: 'autre',
      regimeTaxe: regime,
      motifExemption: motif,
      numeroCertificat: null,
      prixAvecTaxes: false,
      conditionsPaiement: 'Payable à réception',
      dateEcheance: date,
      adresseFacturation: null,
      courrielFacturation: c.courriel,
      bonDeCommande: c.numero,
      transporteur: null,
      numeroSuivi: null,
      remiseGlobale: 0,
      notesFacture: resume(c),
      conditionsGenerales: null,
      documentOrigineId: null,
      lignes: [
        { produit_id: c.produit_id, description: `${c.produit_nom} — personnalisée`, quantite: c.quantite, prix_unitaire_ht: c.prix_unitaire, remise_ht: 0, taxable: true },
      ],
      paiementImmediat: null,
    })
  }
  await requete(`update commandes set facture_id = $2::uuid where id = $1::uuid`, [id, facture.id])
  await noterEtape(id, 'facturee', utilisateurId, null)
  return facture
}
