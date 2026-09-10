import { NextResponse } from 'next/server'
import { sessionOuverte } from '@/lib/auth'
import {
  balance,
  documentsVente,
  grandLivre,
  mouvementsAssocies,
  sommaireTaxes,
  versCsv,
  type Colonne,
} from '@/lib/requetes/export'

const DATE = /^\d{4}-\d{2}-\d{2}$/

type Fabrique = (debut: string, fin: string) => Promise<{ nom: string; csv: string }>

const EXPORTS: Record<string, Fabrique> = {
  'grand-livre': async (debut, fin) => {
    const lignes = await grandLivre(debut, fin)
    const colonnes: Colonne<(typeof lignes)[number]>[] = [
      { entete: 'Date', valeur: (l) => l.date },
      { entete: 'Pièce', valeur: (l) => l.numero_piece },
      { entete: 'Description', valeur: (l) => l.description },
      { entete: 'Sens', valeur: (l) => (l.type === 'revenu' ? 'Revenu' : 'Dépense') },
      { entete: 'Catégorie', valeur: (l) => l.categorie_libelle },
      { entete: 'Code catégorie', valeur: (l) => l.categorie },
      { entete: 'Nature', valeur: (l) => l.nature },
      { entete: 'Province', valeur: (l) => l.province },
      { entete: 'Montant HT', valeur: (l) => l.montant_ht, montant: true },
      { entete: 'Taxe', valeur: (l) => l.code_taxe },
      { entete: 'Autorité', valeur: (l) => l.autorite },
      { entete: 'Montant taxe', valeur: (l) => l.montant_taxe, montant: true },
      { entete: 'Taxe récupérable', valeur: (l) => l.taxe_recuperable, montant: true },
      { entete: 'Montant TTC', valeur: (l) => l.montant_ttc, montant: true },
      { entete: 'Coût réel', valeur: (l) => l.cout_reel, montant: true },
      { entete: 'Mode de paiement', valeur: (l) => l.mode_paiement },
      { entete: 'Source', valeur: (l) => l.source },
      { entete: 'Porté au stock', valeur: (l) => (l.est_stock ? 'oui' : 'non') },
      { entete: 'Saisi par', valeur: (l) => l.saisi_par },
    ]
    return { nom: 'grand-livre', csv: versCsv(lignes, colonnes) }
  },

  balance: async (debut, fin) => {
    const lignes = await balance(debut, fin)
    return {
      nom: 'balance-de-verification',
      csv: versCsv(lignes, [
        { entete: 'Section', valeur: (l) => l.section },
        { entete: 'Catégorie', valeur: (l) => l.libelle },
        { entete: 'Code', valeur: (l) => l.categorie },
        { entete: 'Nature', valeur: (l) => l.nature },
        { entete: 'Montant HT', valeur: (l) => l.montant_ht, montant: true },
        { entete: 'Taxes', valeur: (l) => l.taxes, montant: true },
        { entete: 'Taxes récupérables', valeur: (l) => l.taxes_recuperables, montant: true },
        { entete: 'Coût réel', valeur: (l) => l.cout_reel, montant: true },
        { entete: 'Écritures', valeur: (l) => l.nb_ecritures },
      ]),
    }
  },

  taxes: async (debut, fin) => {
    const lignes = await sommaireTaxes(debut, fin)
    return {
      nom: 'sommaire-taxes',
      csv: versCsv(lignes, [
        { entete: 'Autorité', valeur: (l) => l.autorite },
        { entete: 'Taxe', valeur: (l) => l.code },
        { entete: 'Perçue sur ventes', valeur: (l) => l.taxes_percues, montant: true },
        { entete: 'Payée sur achats', valeur: (l) => l.taxes_payees, montant: true },
        { entete: 'Crédit sur intrants', valeur: (l) => l.credits, montant: true },
        { entete: 'Net à remettre', valeur: (l) => l.net_a_remettre, montant: true },
      ]),
    }
  },

  ventes: async (debut, fin) => {
    const lignes = await documentsVente(debut, fin)
    return {
      nom: 'documents-de-vente',
      csv: versCsv(lignes, [
        { entete: 'Numéro', valeur: (l) => l.numero },
        { entete: 'Type', valeur: (l) => l.type_libelle },
        { entete: 'Date', valeur: (l) => l.date },
        { entete: 'Client', valeur: (l) => l.client },
        { entete: 'Province', valeur: (l) => l.province },
        { entete: 'Régime de taxe', valeur: (l) => l.regime_taxe },
        { entete: 'Motif d’exemption', valeur: (l) => l.motif_exemption },
        { entete: 'Montant HT', valeur: (l) => l.montant_ht, montant: true },
        { entete: 'Taxes', valeur: (l) => l.total_taxes, montant: true },
        { entete: 'Total', valeur: (l) => l.montant_ttc, montant: true },
        { entete: 'Payé', valeur: (l) => l.montant_paye, montant: true },
        { entete: 'Solde', valeur: (l) => l.solde, montant: true },
        { entete: 'Statut', valeur: (l) => l.statut },
        { entete: 'Paiement', valeur: (l) => l.statut_paiement },
      ]),
    }
  },

  associes: async (debut, fin) => {
    const lignes = await mouvementsAssocies(debut, fin)
    return {
      nom: 'mouvements-associes',
      csv: versCsv(lignes, [
        { entete: 'Date', valeur: (l) => l.date },
        { entete: 'Associé', valeur: (l) => l.associe },
        { entete: 'Compte', valeur: (l) => l.compte },
        { entete: 'Nature', valeur: (l) => l.type },
        { entete: 'Montant', valeur: (l) => l.montant_signe, montant: true },
        { entete: 'Description', valeur: (l) => l.description },
      ]),
    }
  },
}

export async function GET(
  requete: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  if (!(await sessionOuverte())) {
    return new NextResponse('Non autorisé', { status: 401 })
  }

  const { type } = await params
  const fabrique = EXPORTS[type]
  if (!fabrique) return new NextResponse('Export inconnu', { status: 404 })

  const parametres = new URL(requete.url).searchParams
  const debut = parametres.get('debut') ?? ''
  const fin = parametres.get('fin') ?? ''
  if (!DATE.test(debut) || !DATE.test(fin) || debut > fin) {
    return new NextResponse('Période invalide', { status: 400 })
  }

  const { nom, csv } = await fabrique(debut, fin)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tapora-${nom}-${debut}-au-${fin}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
