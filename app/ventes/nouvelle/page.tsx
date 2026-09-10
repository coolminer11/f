import Link from 'next/link'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  CONDITIONS_PAIEMENT,
  creerDocument,
  emetteur,
  listerProduits,
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

const Saisie = z.object({
  type_document: z.enum(['facture', 'devis', 'recu']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.'),
  client_nom: z.string().trim().min(2, 'Le nom du client est requis.').max(200),
  province: z.string().length(2),
  mode_paiement: z.string().min(1),
  conditions_paiement: z.string().trim().max(100).optional(),
  date_echeance: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
  adresse_facturation: z.string().trim().max(500).optional(),
  courriel_facturation: z.string().trim().max(200).optional(),
  bon_de_commande: z.string().trim().max(100).optional(),
  remise_globale: z.coerce.number().min(0),
  notes_facture: z.string().trim().max(1000).optional(),
  conditions_generales: z.string().trim().max(2000).optional(),
  paiement_immediat: z.coerce.number().min(0),
  lignes: z.string(),
})

export default async function PageNouveauDocument({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; erreur?: string }>
}) {
  const p = await searchParams
  const [produits, societe] = await Promise.all([listerProduits(), emetteur()])
  const typeInitial = (['facture', 'devis', 'recu'] as const).includes(p.type as TypeDocument)
    ? (p.type as TypeDocument)
    : 'facture'

  async function enregistrer(donnees: FormData) {
    'use server'
    const analyse = Saisie.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) {
      redirect(
        `/ventes/nouvelle?erreur=${encodeURIComponent(analyse.error.issues[0]?.message ?? 'Saisie invalide.')}`,
      )
    }
    const v = analyse.data

    let lignes: z.infer<typeof Ligne>[]
    try {
      lignes = z.array(Ligne).min(1, 'Ajoutez au moins une ligne.').parse(JSON.parse(v.lignes))
    } catch (e) {
      const message =
        e instanceof z.ZodError
          ? (e.issues[0]?.message ?? 'Lignes invalides.')
          : 'Lignes illisibles.'
      redirect(`/ventes/nouvelle?erreur=${encodeURIComponent(message)}`)
    }

    let cree: { id: string; numero: string }
    try {
      cree = await creerDocument({
        typeDocument: v.type_document,
        date: v.date,
        clientNom: v.client_nom,
        clientId: null,
        province: v.province,
        modePaiement: v.mode_paiement,
        conditionsPaiement: v.conditions_paiement?.length ? v.conditions_paiement : null,
        dateEcheance: v.date_echeance,
        adresseFacturation: v.adresse_facturation?.length ? v.adresse_facturation : null,
        courrielFacturation: v.courriel_facturation?.length ? v.courriel_facturation : null,
        bonDeCommande: v.bon_de_commande?.length ? v.bon_de_commande : null,
        remiseGlobale: v.remise_globale,
        notesFacture: v.notes_facture?.length ? v.notes_facture : null,
        conditionsGenerales: v.conditions_generales?.length ? v.conditions_generales : null,
        lignes: lignes.map((l) => ({
          produit_id: l.produit_id,
          description: l.description,
          quantite: l.quantite,
          prix_unitaire_ht: l.prix_unitaire_ht,
          remise_ht: l.remise_ht,
          taxable: l.taxable,
        })),
        // Un devis n'encaisse rien : il n'engage personne.
        paiementImmediat: v.type_document === 'devis' ? null : v.paiement_immediat || null,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Création impossible.'
      redirect(`/ventes/nouvelle?erreur=${encodeURIComponent(message)}`)
    }

    redirect(`/ventes/${cree.id}`)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link href="/ventes" className="text-sm text-[var(--color-encre-doux)] hover:underline">
          ← Factures et devis
        </Link>
        <h1 className="mt-1 text-lg font-bold tracking-tight">Nouveau document</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          Les taxes suivent la province de destination. Le numéro est attribué à l’enregistrement et
          ne se réutilise jamais.
        </p>
      </div>

      {p.erreur && (
        <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {p.erreur}
        </p>
      )}

      <FormulaireDocument
        action={enregistrer}
        produits={produits}
        provinces={PROVINCES}
        modesPaiement={MODES_PAIEMENT}
        conditions={CONDITIONS_PAIEMENT}
        typeInitial={typeInitial}
        conditionsGeneralesDefaut={societe.conditions_generales_defaut}
        delaiPaiementJours={societe.delai_paiement_jours}
      />
    </div>
  )
}
