import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  accepterDevis,
  ajouterPaiement,
  annulerDocument,
  documentComplet,
  supprimerPaiement,
} from '@/lib/requetes/ventes'
import { MODES_PAIEMENT } from '@/lib/requetes/transactions'
import { argent, dateLongue, nombre, taux } from '@/lib/format'

export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = { facture: 'Facture', devis: 'Devis', recu: 'Reçu de vente' }

const SaisiePaiement = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.'),
  montant: z.coerce.number().refine((n) => n !== 0, 'Le montant ne peut pas être zéro.'),
  mode_paiement: z.string().min(1),
  reference: z.string().trim().max(100).optional(),
})

export default async function PageDocument({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erreur?: string }>
}) {
  const { id } = await params
  const { erreur } = await searchParams
  const doc = await documentComplet(id)
  if (!doc) notFound()

  async function enregistrerPaiement(donnees: FormData) {
    'use server'
    const analyse = SaisiePaiement.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) {
      redirect(`/ventes/${id}?erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)
    }
    const v = analyse.data
    await ajouterPaiement({
      venteId: id,
      date: v.date,
      montant: v.montant,
      modePaiement: v.mode_paiement,
      reference: v.reference?.length ? v.reference : null,
    })
    revalidatePath(`/ventes/${id}`)
    redirect(`/ventes/${id}`)
  }

  async function retirerPaiement(donnees: FormData) {
    'use server'
    await supprimerPaiement(String(donnees.get('id')))
    revalidatePath(`/ventes/${id}`)
  }

  async function transformer() {
    'use server'
    let factureId: string
    try {
      factureId = await accepterDevis(id, new Date().toISOString().slice(0, 10))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Conversion impossible.'
      redirect(`/ventes/${id}?erreur=${encodeURIComponent(message)}`)
    }
    revalidatePath('/ventes')
    redirect(`/ventes/${factureId}`)
  }

  async function annuler() {
    'use server'
    await annulerDocument(id)
    revalidatePath('/ventes')
    redirect('/ventes')
  }

  const sousTotal = doc.lignes.reduce((s, l) => s + Number(l.montant_ht), 0)

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/ventes" className="text-sm text-[var(--color-encre-doux)] hover:underline">
            ← Factures et devis
          </Link>
          <h1 className="chiffre mt-1 text-lg font-bold tracking-tight">
            {TYPES[doc.type_document]} {doc.numero}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            {dateLongue(doc.date)} · {doc.client ?? 'client non nommé'}
            {doc.numero_devis_origine && ` · issue du devis ${doc.numero_devis_origine}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/ventes/${doc.id}/facture`} className="bouton" target="_blank">
            Ouvrir le document
          </Link>
          {doc.type_document === 'devis' && !doc.devis_facture && doc.statut !== 'annulee' && (
            <form action={transformer}>
              <button className="bouton bouton-secondaire">Accepter et facturer</button>
            </form>
          )}
          {doc.statut !== 'annulee' && (
            <form action={annuler}>
              <button className="bouton bouton-secondaire">Annuler</button>
            </form>
          )}
        </div>
      </div>

      {erreur && (
        <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {erreur}
        </p>
      )}

      {doc.statut === 'annulee' && (
        <p className="carte bg-[var(--color-fond)] px-4 py-3 text-sm font-medium">
          Ce document est annulé : il ne compte dans aucun résultat.
        </p>
      )}

      {doc.type_document === 'devis' && (
        <p className="carte border-[var(--color-accent)] bg-[var(--color-accent-doux)] px-4 py-3 text-sm">
          Un devis ne crée ni revenu, ni sortie de stock, ni taxe à remettre. Les montants ci-dessous
          sont ceux qui s’appliqueront <em>si</em> le devis est accepté.
          {doc.devis_facture && ' Ce devis a déjà été facturé.'}
        </p>
      )}

      <div className="carte overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-ligne)] bg-[var(--color-fond)] text-left text-xs uppercase text-[var(--color-encre-doux)]">
              <th className="px-4 py-2 font-semibold">Description</th>
              <th className="px-4 py-2 text-right font-semibold">Quantité</th>
              <th className="px-4 py-2 text-right font-semibold">Prix HT</th>
              <th className="px-4 py-2 text-right font-semibold">Remise</th>
              <th className="px-4 py-2 text-right font-semibold">Montant</th>
            </tr>
          </thead>
          <tbody>
            {doc.lignes.map((l) => (
              <tr key={l.id} className="border-b border-[var(--color-ligne)] last:border-0">
                <td className="px-4 py-2">
                  {l.description}
                  {!l.taxable && (
                    <span className="ml-2 text-xs text-[var(--color-encre-doux)]">non taxable</span>
                  )}
                </td>
                <td className="chiffre px-4 py-2 text-right">{nombre(l.quantite)}</td>
                <td className="chiffre px-4 py-2 text-right">{argent(l.prix_unitaire_ht)}</td>
                <td className="chiffre px-4 py-2 text-right text-[var(--color-encre-doux)]">
                  {l.remise_ht > 0 ? `− ${argent(l.remise_ht)}` : '—'}
                </td>
                <td className="chiffre px-4 py-2 text-right font-semibold">
                  {argent(l.montant_ht)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-[var(--color-ligne)] bg-[var(--color-fond)] px-4 py-3">
          <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
            <Total libelle="Sous-total" valeur={argent(sousTotal)} />
            {doc.remise_globale > 0 && (
              <Total libelle="Remise globale" valeur={`− ${argent(doc.remise_globale)}`} />
            )}
            <Total libelle="Total hors taxes" valeur={argent(doc.montant_ht)} fort />
            {doc.taxes.map((t) => (
              <Total
                key={t.code}
                libelle={`${t.code} (${taux(t.taux)} · ${t.autorite})`}
                valeur={argent(t.montant)}
              />
            ))}
            <Total libelle="Total" valeur={argent(doc.montant_ttc)} fort />
            {doc.type_document !== 'devis' && (
              <>
                <Total libelle="Payé" valeur={argent(doc.montant_paye)} />
                <Total libelle="Solde dû" valeur={argent(doc.solde)} fort />
              </>
            )}
          </dl>
        </div>
      </div>

      {doc.type_document !== 'devis' && (
        <section className="carte p-5">
          <h2 className="text-sm font-bold">Paiements</h2>
          {doc.paiements.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-encre-doux)]">
              Aucun paiement enregistré. Le revenu est déjà reconnu ; seul l’encaissement manque.
            </p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <tbody>
                {doc.paiements.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--color-ligne)] last:border-0">
                    <td className="py-1.5">{dateLongue(p.date)}</td>
                    <td className="py-1.5 text-[var(--color-encre-doux)]">
                      {MODES_PAIEMENT.find(([code]) => code === p.mode_paiement)?.[1] ??
                        p.mode_paiement}
                      {p.reference && ` · ${p.reference}`}
                    </td>
                    <td className="chiffre py-1.5 text-right font-semibold">{argent(p.montant)}</td>
                    <td className="py-1.5 pl-3 text-right">
                      <form action={retirerPaiement}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="text-xs text-[var(--color-encre-doux)] hover:underline">
                          Supprimer
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {doc.statut !== 'annulee' && (
            <form action={enregistrerPaiement} className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="etiquette" htmlFor="date_paiement">
                  Date
                </label>
                <input
                  id="date_paiement"
                  name="date"
                  type="date"
                  className="champ w-auto"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
              <div>
                <label className="etiquette" htmlFor="montant_paiement">
                  Montant
                </label>
                <input
                  id="montant_paiement"
                  name="montant"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="champ w-32"
                  defaultValue={doc.solde > 0 ? doc.solde.toFixed(2) : ''}
                  required
                />
              </div>
              <div>
                <label className="etiquette" htmlFor="mode_paiement_ajout">
                  Mode
                </label>
                <select
                  id="mode_paiement_ajout"
                  name="mode_paiement"
                  className="champ w-auto"
                  defaultValue={doc.mode_paiement}
                >
                  {MODES_PAIEMENT.map(([code, nom]) => (
                    <option key={code} value={code}>
                      {nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="etiquette" htmlFor="reference_paiement">
                  Référence <span className="font-normal">(facultatif)</span>
                </label>
                <input
                  id="reference_paiement"
                  name="reference"
                  className="champ w-40"
                  maxLength={100}
                />
              </div>
              <button className="bouton">Enregistrer le paiement</button>
            </form>
          )}
          <p className="mt-2 text-xs text-[var(--color-encre-doux)]">
            Un montant négatif enregistre un remboursement au client. Un paiement comptant entre
            automatiquement en caisse.
          </p>
        </section>
      )}
    </div>
  )
}

function Total({
  libelle,
  valeur,
  fort = false,
}: {
  libelle: string
  valeur: string
  fort?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={fort ? 'font-semibold' : 'text-[var(--color-encre-doux)]'}>{libelle}</dt>
      <dd className={`chiffre ${fort ? 'font-bold' : ''}`}>{valeur}</dd>
    </div>
  )
}
