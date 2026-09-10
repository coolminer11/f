import Link from 'next/link'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  creerDepense,
  listerCategories,
  ventilerTtc,
  MODES_PAIEMENT,
  PROVINCES,
} from '@/lib/requetes/transactions'
import { televerserRecu } from '@/lib/stockage'
import FormulaireDepense from '@/components/formulaire-depense'

export const dynamic = 'force-dynamic'

const Saisie = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.'),
  description: z.string().trim().min(2, 'La description est requise.').max(200),
  montant: z.coerce.number().positive('Le montant doit être supérieur à zéro.'),
  taxes_incluses: z.enum(['0', '1']),
  categorie: z.string().min(1, 'Choisissez une catégorie.'),
  province: z.string().length(2),
  mode_paiement: z.string().min(1),
  taxes_reelles: z
    .union([z.coerce.number().min(0), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v))),
  note: z.string().trim().max(500).optional(),
})

export default async function PageNouvelleDepense({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>
}) {
  const { erreur } = await searchParams
  const categories = (await listerCategories()).filter(
    (c) => c.type_defaut === 'depense' && c.saisie_manuelle,
  )

  async function enregistrer(donnees: FormData) {
    'use server'

    const analyse = Saisie.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) {
      const message = analyse.error.issues[0]?.message ?? 'Saisie invalide.'
      redirect(`/transactions/nouvelle?erreur=${encodeURIComponent(message)}`)
    }
    const v = analyse.data

    // Le montant saisi peut être celui imprimé sur le reçu (taxes incluses).
    // La conversion se fait en base, avec les taux de la province.
    const montantHt =
      v.taxes_incluses === '1'
        ? (await ventilerTtc(v.montant, v.province, v.date)).montant_ht
        : v.montant

    let cheminRecu: string | null = null
    const fichier = donnees.get('recu')
    if (fichier instanceof File && fichier.size > 0) {
      if (fichier.size > 10 * 1024 * 1024) {
        redirect('/transactions/nouvelle?erreur=' + encodeURIComponent('Reçu trop volumineux (10 Mo maximum).'))
      }
      try {
        cheminRecu = await televerserRecu(fichier)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Téléversement impossible.'
        redirect(`/transactions/nouvelle?erreur=${encodeURIComponent(message)}`)
      }
    }

    try {
      await creerDepense({
        date: v.date,
        description: v.description,
        montantHt,
        categorie: v.categorie,
        province: v.province,
        modePaiement: v.mode_paiement,
        totalTaxes: v.taxes_reelles,
        pieceJointeUrl: cheminRecu,
        note: v.note?.length ? v.note : null,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Enregistrement impossible.'
      redirect(`/transactions/nouvelle?erreur=${encodeURIComponent(message)}`)
    }

    redirect('/transactions')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/transactions"
          className="text-sm text-[var(--color-encre-doux)] hover:underline"
        >
          ← Transactions
        </Link>
        <h1 className="mt-1 text-lg font-bold tracking-tight">Saisir une dépense</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          Les taxes sont calculées selon la province, et la part récupérable selon la catégorie.
        </p>
      </div>

      {erreur && (
        <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {erreur}
        </p>
      )}

      <FormulaireDepense
        action={enregistrer}
        categories={categories}
        provinces={PROVINCES}
        modesPaiement={MODES_PAIEMENT}
      />
    </div>
  )
}
