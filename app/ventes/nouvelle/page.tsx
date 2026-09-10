import Link from 'next/link'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  CONDITIONS_PAIEMENT,
  contenuPour,
  creerDocument,
  emetteur,
  listerClients,
  listerProduits,
  MOTIFS_EXEMPTION,
  regimesTaxe,
  typesDocument,
  type TypeDocument,
} from '@/lib/requetes/ventes'
import { MODES_PAIEMENT, PROVINCES } from '@/lib/requetes/transactions'
import FormulaireDocument from '@/components/formulaire-document'

export const dynamic = 'force-dynamic'

const Ligne = z.object({
  produit_id: z.string().uuid().nullable(),
  description: z.string().trim().min(1, 'Chaque ligne doit avoir une description.').max(300),
  quantite: z.number().int().refine((n) => n !== 0, 'La quantité ne peut pas être zéro.'),
  prix_unitaire_ht: z.number().min(0),
  remise_ht: z.number().min(0),
  taxable: z.boolean(),
})

/**
 * Un champ absent du formulaire arrive à `null`, et `z.coerce.number()` en fait
 * un NaN illisible pour la personne qui saisit. Les champs numériques
 * facultatifs passent donc par ce filtre : absent ou vide vaut zéro.
 */
const nombreFacultatif = z.preprocess(
  (v) => (v === null || v === undefined || v === '' ? 0 : v),
  z.coerce.number().min(0, 'Un montant ne peut pas être négatif.'),
)

const Saisie = z.object({
  type_document: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.'),
  client_nom: z.string().trim().min(2, 'Le nom du client est requis.').max(200),
  province: z.string().length(2),
  mode_paiement: z.string().min(1),
  regime_taxe: z.enum(['taxable', 'detaxe', 'exonere', 'hors_champ']),
  motif_exemption: z.string().trim().max(300).optional(),
  numero_certificat: z.string().trim().max(100).optional(),
  prix_avec_taxes: z.enum(['0', '1']),
  conditions_paiement: z.string().trim().max(100).optional(),
  date_echeance: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
  adresse_facturation: z.string().trim().max(500).optional(),
  courriel_facturation: z.string().trim().max(200).optional(),
  bon_de_commande: z.string().trim().max(100).optional(),
  transporteur: z.string().trim().max(100).optional(),
  numero_suivi: z.string().trim().max(100).optional(),
  remise_globale: nombreFacultatif,
  notes_facture: z.string().trim().max(1000).optional(),
  conditions_generales: z.string().trim().max(2000).optional(),
  paiement_immediat: nombreFacultatif,
  document_origine_id: z.string().uuid().optional().or(z.literal('')),
  lignes: z.string(),
})

export default async function PageNouveauDocument({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; depuis?: string; erreur?: string }>
}) {
  const p = await searchParams
  const [produits, societe, types, regimes, clients] = await Promise.all([
    listerProduits(),
    emetteur(),
    typesDocument(),
    regimesTaxe(),
    listerClients(),
  ])

  const typeInitial = (types.find((t) => t.code === p.type)?.code ?? 'facture') as TypeDocument
  const prefill = p.depuis ? await contenuPour(p.depuis) : null

  async function enregistrer(donnees: FormData) {
    'use server'
    const analyse = Saisie.safeParse(Object.fromEntries(donnees))
    const retour = `/ventes/nouvelle?type=${encodeURIComponent(String(donnees.get('type_document') ?? 'facture'))}${
      p.depuis ? `&depuis=${p.depuis}` : ''
    }`
    if (!analyse.success) {
      redirect(
        `${retour}&erreur=${encodeURIComponent(analyse.error.issues[0]?.message ?? 'Saisie invalide.')}`,
      )
    }
    const v = analyse.data

    if (!types.some((t) => t.code === v.type_document)) {
      redirect(`${retour}&erreur=${encodeURIComponent('Type de document inconnu.')}`)
    }
    const regime = regimes.find((r) => r.code === v.regime_taxe)!
    const motif = v.motif_exemption?.trim() ?? ''
    if (regime.motif_requis && motif.length < 3) {
      redirect(
        `${retour}&erreur=${encodeURIComponent(
          `Une vente « ${regime.libelle.toLowerCase()} » doit indiquer pourquoi elle ne porte pas de taxe.`,
        )}`,
      )
    }

    let lignes: z.infer<typeof Ligne>[]
    try {
      lignes = z.array(Ligne).min(1, 'Ajoutez au moins une ligne.').parse(JSON.parse(v.lignes))
    } catch (e) {
      const message =
        e instanceof z.ZodError ? (e.issues[0]?.message ?? 'Lignes invalides.') : 'Lignes illisibles.'
      redirect(`${retour}&erreur=${encodeURIComponent(message)}`)
    }

    let cree: { id: string; numero: string }
    try {
      cree = await creerDocument({
        typeDocument: v.type_document as TypeDocument,
        date: v.date,
        clientNom: v.client_nom,
        province: v.province,
        modePaiement: v.mode_paiement,
        regimeTaxe: v.regime_taxe,
        motifExemption: motif.length ? motif : null,
        numeroCertificat: v.numero_certificat?.length ? v.numero_certificat : null,
        prixAvecTaxes: v.prix_avec_taxes === '1',
        conditionsPaiement: v.conditions_paiement?.length ? v.conditions_paiement : null,
        dateEcheance: v.date_echeance,
        adresseFacturation: v.adresse_facturation?.length ? v.adresse_facturation : null,
        courrielFacturation: v.courriel_facturation?.length ? v.courriel_facturation : null,
        bonDeCommande: v.bon_de_commande?.length ? v.bon_de_commande : null,
        transporteur: v.transporteur?.length ? v.transporteur : null,
        numeroSuivi: v.numero_suivi?.length ? v.numero_suivi : null,
        remiseGlobale: v.remise_globale,
        notesFacture: v.notes_facture?.length ? v.notes_facture : null,
        conditionsGenerales: v.conditions_generales?.length ? v.conditions_generales : null,
        documentOrigineId: v.document_origine_id?.length ? v.document_origine_id : null,
        lignes,
        paiementImmediat:
          types.find((t) => t.code === v.type_document)?.attend_paiement
            ? v.paiement_immediat || null
            : null,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Création impossible.'
      redirect(`${retour}&erreur=${encodeURIComponent(message)}`)
    }

    redirect(`/ventes/${cree.id}`)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link href="/ventes" className="text-sm text-[var(--color-encre-doux)] hover:underline">
          ← Documents de vente
        </Link>
        <h1 className="mt-1 text-lg font-bold tracking-tight">Nouveau document</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          {prefill
            ? `Prérempli depuis ${prefill.source.numero}. Ajustez avant d’enregistrer.`
            : 'Les taxes suivent la province de destination. Le numéro est attribué à l’enregistrement et ne se réutilise jamais.'}
        </p>
      </div>

      {p.erreur && (
        <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {p.erreur}
        </p>
      )}

      <FormulaireDocument
        action={enregistrer}
        types={types}
        regimes={regimes}
        produits={produits}
        clients={clients}
        provinces={PROVINCES}
        modesPaiement={MODES_PAIEMENT}
        conditions={CONDITIONS_PAIEMENT}
        motifs={MOTIFS_EXEMPTION}
        typeInitial={typeInitial}
        prefill={prefill}
        conditionsGeneralesDefaut={societe.conditions_generales_defaut}
        delaiPaiementJours={societe.delai_paiement_jours}
      />
    </div>
  )
}
