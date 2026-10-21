import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import { creerDocument, emetteur } from '@/lib/requetes/ventes'
import { inscritAuxTaxes } from '@/lib/stock'
import { lireEtablissement } from '@/lib/services/donnees'
import type { Etablissement } from '@/lib/services/types'

/**
 * La facturation des abonnements Tapora Services.
 *
 * Les revenus de Tapora Services sont ceux de la société (convention
 * d'associés, article 8) : chaque mois d'abonnement devient une facture du
 * module des ventes — même numérotation, mêmes taxes, mêmes paiements, même
 * comptabilité, visibles par les deux associés. `factures_service` note
 * seulement quel mois de quel établissement est facturé, pour ne jamais le
 * facturer deux fois.
 */
const FUSEAU = 'America/Toronto'
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MOIS_VALIDE = /^\d{4}-(0[1-9]|1[0-2])-01$/

/** Aujourd'hui au Québec : « 2026-10-22 ». */
export function aujourdhui(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU }).format(new Date())
}

/** Le premier jour du mois d'une date : « 2026-10-01 ». */
export function moisDe(date: string): string {
  return `${date.slice(0, 7)}-01`
}

export function decalerMois(mois: string, n: number): string {
  const [a, m] = mois.split('-').map(Number)
  const t = a * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`
}

/** « octobre 2026 ». */
export function nomMois(mois: string): string {
  const [a, m] = mois.split('-').map(Number)
  return `${MOIS[m - 1]} ${a}`
}

function ajouterJours(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Le régime de taxes de nos documents, comme pour les cartes : non inscrite → hors champ, avec le motif. */
export async function regimeSociete(): Promise<{ regime: 'taxable' | 'hors_champ'; motif: string | null; libelle: string }> {
  return (await inscritAuxTaxes())
    ? { regime: 'taxable', motif: null, libelle: 'Taxable — TPS et TVQ ajoutées au prix' }
    : { regime: 'hors_champ', motif: 'Petit fournisseur — non inscrit aux taxes (TPS/TVQ)', libelle: 'Sans taxes — petit fournisseur non inscrit (TPS/TVQ)' }
}

// ---------------------------------------------------------------------------
// Le client facturé
// ---------------------------------------------------------------------------

export type ClientService = {
  id: string
  nom: string
  entreprise: string | null
  courriel: string | null
  telephone: string | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  province: string | null
}

const COLONNES_CLIENT = 'id, nom, entreprise, courriel, telephone, adresse, ville, code_postal, province::text as province'

export async function clientDe(etabId: string): Promise<ClientService | null> {
  if (!UUID.test(etabId)) return null
  return requeteUne<ClientService>(
    `select ${COLONNES_CLIENT.split(', ').map((c) => `c.${c}`).join(', ')}
       from etablissements e join clients c on c.id = e.client_id where e.id = $1::uuid`,
    [etabId],
  )
}

/** Les clients du fichier, pour en choisir un autre. */
export async function clientsPossibles(): Promise<{ id: string; nom: string; courriel: string | null }[]> {
  return requete(`select id, nom, courriel from clients order by lower(nom) limit 500`)
}

/**
 * La fiche client de l'établissement : retrouvée par son nom (ou celui de
 * son entreprise) dans le fichier des clients, sinon créée à partir de ses
 * coordonnées. Elle sert ensuite à chaque facture.
 */
export async function lierClient(etabId: string): Promise<ClientService> {
  const e = await lireEtablissement(etabId)
  if (!e) throw new Error('Établissement introuvable.')
  const existant = await requeteUne<{ id: string }>(
    `select id from clients where lower(nom) = lower($1) or lower(coalesce(entreprise, '')) = lower($1) order by cree_le limit 1`,
    [e.nom],
  )
  const id =
    existant?.id ??
    (
      await requeteUne<{ id: string }>(
        `insert into clients (nom, entreprise, courriel, telephone, adresse, province, notes)
         values ($1, $1, nullif($2, ''), nullif($3, ''), nullif($4, ''), 'QC', $5) returning id`,
        [e.nom, e.contact_courriel ?? '', e.telephone ?? '', e.adresse ?? '', `Tapora Services${e.contact_nom ? ` — contact : ${e.contact_nom}` : ''}`],
      )
    )?.id
  if (!id) throw new Error('Création de la fiche client impossible.')
  await requete(`update etablissements set client_id = $2::uuid, maj_le = now() where id = $1::uuid`, [e.id, id])
  return (await clientDe(e.id))!
}

export async function choisirClient(etabId: string, clientId: string | null): Promise<void> {
  if (!UUID.test(etabId)) throw new Error('Établissement introuvable.')
  if (clientId !== null) {
    if (!UUID.test(clientId) || !(await requeteUne(`select 1 from clients where id = $1::uuid`, [clientId]))) throw new Error('Client introuvable.')
  }
  await requete(`update etablissements set client_id = $2::uuid, maj_le = now() where id = $1::uuid`, [etabId, clientId])
}

// ---------------------------------------------------------------------------
// Les factures d'un établissement
// ---------------------------------------------------------------------------

export type EtatFacture = 'payee' | 'partielle' | 'en_retard' | 'a_payer' | 'annulee' | 'en_cours'

export type FactureService = {
  mois: string
  vente_id: string | null
  numero: string | null
  date: string | null
  date_echeance: string | null
  montant_ttc: number
  montant_paye: number
  solde: number
  etat: EtatFacture
}

function etatDe(l: { vente_id: string | null; statut: string | null; statut_paiement: string | null; en_retard: boolean | null }): EtatFacture {
  if (!l.vente_id) return 'en_cours'
  if (l.statut === 'annulee') return 'annulee'
  if (l.statut_paiement === 'payee') return 'payee'
  if (l.en_retard) return 'en_retard'
  if (l.statut_paiement === 'partielle') return 'partielle'
  return 'a_payer'
}

export async function facturesEtablissement(etabId: string): Promise<FactureService[]> {
  if (!UUID.test(etabId)) return []
  const l = await requete<Omit<FactureService, 'etat'> & { statut: string | null; statut_paiement: string | null; en_retard: boolean | null }>(
    `select to_char(f.mois, 'YYYY-MM-DD') as mois, f.vente_id, d.numero, to_char(d.date, 'YYYY-MM-DD') as date,
            to_char(d.date_echeance, 'YYYY-MM-DD') as date_echeance,
            coalesce(d.montant_ttc, 0)::float8 as montant_ttc, coalesce(d.montant_paye, 0)::float8 as montant_paye,
            coalesce(d.solde, 0)::float8 as solde, d.statut::text as statut, d.statut_paiement, d.en_retard
       from factures_service f left join v_documents_vente d on d.id = f.vente_id
      where f.etablissement_id = $1::uuid
      order by f.mois desc`,
    [etabId],
  )
  return l.map(({ statut, statut_paiement, en_retard, ...f }) => ({ ...f, etat: etatDe({ vente_id: f.vente_id, statut, statut_paiement, en_retard }) }))
}

/** Les mois déjà facturés (factures annulées exclues : leur mois peut se refacturer). */
export function moisFactures(factures: FactureService[]): Map<string, FactureService> {
  return new Map(factures.filter((f) => f.etat !== 'annulee').map((f) => [f.mois, f]))
}

// ---------------------------------------------------------------------------
// Facturer
// ---------------------------------------------------------------------------

function verifierFacturable(e: Etablissement, mois: string, forcer: boolean): void {
  if (!MOIS_VALIDE.test(mois)) throw new Error('Mois invalide.')
  const courant = moisDe(aujourdhui())
  if (mois > decalerMois(courant, 1) || mois < decalerMois(courant, -12)) throw new Error('On facture du mois prochain jusqu’à un an en arrière.')
  if (!e.prix_mensuel || e.prix_mensuel <= 0) throw new Error('Réglez d’abord le prix mensuel (Réglages → Abonnement).')
  if (!forcer && (!e.actif || e.formule !== 'actif')) {
    const etat = !e.actif ? 'désactivé' : e.formule === 'essai' ? 'en essai' : 'suspendu'
    throw new Error(`« ${e.nom} » est ${etat} : confirmez pour facturer quand même.`)
  }
}

/**
 * La facture d'un mois d'abonnement, dans le module des ventes. Le mois est
 * réservé AVANT de créer la facture : un double clic, ou deux onglets, ne
 * font jamais deux factures. Une facture annulée libère son mois.
 */
export async function facturerMois(etabId: string, mois: string, forcer = false): Promise<{ id: string; numero: string }> {
  const e = await lireEtablissement(etabId)
  if (!e) throw new Error('Établissement introuvable.')
  verifierFacturable(e, mois, forcer)

  // Une réservation restée vide (serveur coupé en plein travail) ou une facture annulée libèrent le mois.
  await requete(
    `delete from factures_service f
      where f.etablissement_id = $1::uuid and f.mois = $2::date
        and ((f.vente_id is null and f.cree_le < now() - interval '5 minutes')
             or exists (select 1 from ventes v where v.id = f.vente_id and v.statut = 'annulee'))`,
    [e.id, mois],
  )
  const reserve = await requeteUne<{ id: string }>(
    `insert into factures_service (etablissement_id, mois) values ($1::uuid, $2::date)
     on conflict (etablissement_id, mois) do nothing returning id`,
    [e.id, mois],
  )
  if (!reserve) {
    const deja = await requeteUne<{ numero: string | null }>(
      `select v.numero from factures_service f left join ventes v on v.id = f.vente_id where f.etablissement_id = $1::uuid and f.mois = $2::date`,
      [e.id, mois],
    )
    throw new Error(deja?.numero ? `${nomMois(mois)} est déjà facturé (${deja.numero}).` : `La facture de ${nomMois(mois)} est en cours de création.`)
  }

  try {
    const client = (await clientDe(e.id)) ?? (await lierClient(e.id))
    const [societe, taxes] = await Promise.all([emetteur(), regimeSociete()])
    const date = aujourdhui()
    const delai = societe.delai_paiement_jours ?? 30
    const fin = ajouterJours(decalerMois(mois, 1), -1)
    const adresse = [client.adresse ?? e.adresse, [client.ville, client.code_postal].filter(Boolean).join(' ')].filter(Boolean).join('\n') || null
    const facture = await creerDocument({
      typeDocument: 'facture',
      date,
      clientNom: client.nom,
      province: client.province && /^[A-Z]{2}$/.test(client.province) ? client.province : 'QC',
      modePaiement: 'virement',
      regimeTaxe: taxes.regime,
      motifExemption: taxes.motif,
      numeroCertificat: null,
      prixAvecTaxes: false,
      conditionsPaiement: delai > 0 ? `Net ${delai}` : 'Payable à réception',
      dateEcheance: ajouterJours(date, delai),
      adresseFacturation: adresse,
      courrielFacturation: client.courriel ?? e.contact_courriel,
      bonDeCommande: null,
      transporteur: null,
      numeroSuivi: null,
      remiseGlobale: 0,
      notesFacture: `Abonnement Tapora Services — ${e.nom}, du 1er au ${Number(fin.slice(8))} ${nomMois(mois)}.`,
      conditionsGenerales: societe.conditions_generales_defaut,
      documentOrigineId: null,
      lignes: [
        {
          produit_id: null,
          description: `Tapora Services — abonnement ${nomMois(mois)} (${e.nom})`,
          quantite: 1,
          prix_unitaire_ht: e.prix_mensuel!,
          remise_ht: 0,
          taxable: true,
        },
      ],
      paiementImmediat: null,
    })
    await requete(`update factures_service set vente_id = $2::uuid where id = $1::uuid`, [reserve.id, facture.id])
    return facture
  } catch (x) {
    await requete(`delete from factures_service where id = $1::uuid and vente_id is null`, [reserve.id])
    throw x
  }
}

/** Les abonnements actifs et payants pas encore facturés pour ce mois. */
export async function aFacturer(mois: string): Promise<{ id: string; nom: string; prix_mensuel: number }[]> {
  if (!MOIS_VALIDE.test(mois)) return []
  return requete(
    `select e.id, e.nom, e.prix_mensuel::float8 as prix_mensuel
       from etablissements e
      where e.actif and e.formule = 'actif' and coalesce(e.prix_mensuel, 0) > 0
        and not exists (select 1 from factures_service f left join ventes v on v.id = f.vente_id
                         where f.etablissement_id = e.id and f.mois = $1::date and (f.vente_id is null or v.statut <> 'annulee'))
      order by lower(e.nom)`,
    [mois],
  )
}

/** « Facturer le mois » : une facture par abonnement pas encore facturé, l'une après l'autre. */
export async function facturerTous(mois: string): Promise<{ crees: { nom: string; numero: string }[]; erreurs: { nom: string; raison: string }[] }> {
  const crees: { nom: string; numero: string }[] = []
  const erreurs: { nom: string; raison: string }[] = []
  for (const e of await aFacturer(mois)) {
    try {
      crees.push({ nom: e.nom, numero: (await facturerMois(e.id, mois)).numero })
    } catch (x) {
      erreurs.push({ nom: e.nom, raison: x instanceof Error ? x.message : 'Facture impossible.' })
    }
  }
  return { crees, erreurs }
}

// ---------------------------------------------------------------------------
// Le résumé du propriétaire
// ---------------------------------------------------------------------------

export type ResumeFacturation = {
  mois: string
  mrr: number
  factureMois: number
  nbFacturesMois: number
  encaisseMois: number
  enRetard: number
  nbEnRetard: number
  aFacturer: { id: string; nom: string; prix_mensuel: number }[]
  impayees: { etablissement_id: string | null; nom: string | null; vente_id: string; numero: string; date: string; solde: number; jours: number }[]
}

export async function resumeFacturation(): Promise<ResumeFacturation> {
  const mois = moisDe(aujourdhui())
  const [totaux, liste, impayees] = await Promise.all([
    requeteUne<{ mrr: number; facture: number; nb: number; encaisse: number; retard: number; nb_retard: number }>(
      `select (select coalesce(sum(prix_mensuel), 0) from etablissements where actif and formule = 'actif')::float8 as mrr,
              (select coalesce(sum(d.montant_ttc), 0) from factures_service f join v_documents_vente d on d.id = f.vente_id
                where f.mois = $1::date and d.statut <> 'annulee')::float8 as facture,
              (select count(*) from factures_service f join ventes v on v.id = f.vente_id
                where f.mois = $1::date and v.statut <> 'annulee')::int as nb,
              (select coalesce(sum(p.montant), 0) from paiements_vente p join factures_service f on f.vente_id = p.vente_id
                where p.date >= $1::date and p.date < ($1::date + interval '1 month'))::float8 as encaisse,
              (select coalesce(sum(d.solde), 0) from factures_service f join v_documents_vente d on d.id = f.vente_id where d.en_retard)::float8 as retard,
              (select count(*) from factures_service f join v_documents_vente d on d.id = f.vente_id where d.en_retard)::int as nb_retard`,
      [mois],
    ),
    aFacturer(mois),
    requete<ResumeFacturation['impayees'][number]>(
      `select f.etablissement_id, e.nom, d.id as vente_id, d.numero, to_char(d.date, 'YYYY-MM-DD') as date, d.solde::float8 as solde,
              (current_date - d.date)::int as jours
         from factures_service f join v_documents_vente d on d.id = f.vente_id
         left join etablissements e on e.id = f.etablissement_id
        where d.solde > 0.005 and d.statut not in ('annulee', 'brouillon') and d.date < current_date - 30
        order by d.date`,
    ),
  ])
  return {
    mois,
    mrr: totaux?.mrr ?? 0,
    factureMois: totaux?.facture ?? 0,
    nbFacturesMois: totaux?.nb ?? 0,
    encaisseMois: totaux?.encaisse ?? 0,
    enRetard: totaux?.retard ?? 0,
    nbEnRetard: totaux?.nb_retard ?? 0,
    aFacturer: liste,
    impayees,
  }
}
