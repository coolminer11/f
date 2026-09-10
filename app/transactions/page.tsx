import Link from 'next/link'
import { listerCategories, listerTransactions, PROVINCES } from '@/lib/requetes/transactions'
import { lienRecu } from '@/lib/stockage'
import { argent, dateCourte, nombre } from '@/lib/format'
import type { LigneJournal } from '@/lib/requetes/transactions'
import FiltresJournal from '@/components/filtres-journal'
import { exigerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const SOURCES: Record<string, string> = { stripe: 'Stripe', banque: 'Banque', manuel: 'Manuel' }

export default async function PageTransactions({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await exigerSession()
  const p = await searchParams
  const filtres = {
    debut: p.debut,
    fin: p.fin,
    type: p.type,
    categorie: p.categorie,
    source: p.source,
    province: p.province,
    recherche: p.recherche,
    page: p.page ? Number(p.page) : 1,
  }

  const [{ lignes, totaux, page, parPage }, categories] = await Promise.all([
    listerTransactions(filtres),
    listerCategories(),
  ])

  const nbPages = Math.max(1, Math.ceil((totaux?.nb ?? 0) / parPage))
  const parametres = new URLSearchParams(
    Object.entries(p).filter(([, v]) => v) as [string, string][],
  )
  const lienPage = (n: number) => {
    const copie = new URLSearchParams(parametres)
    copie.set('page', String(n))
    return `/transactions?${copie}`
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Transactions</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            Journal complet. Le revenu est toujours le montant hors taxes.
          </p>
        </div>
        <Link href="/transactions/nouvelle" className="bouton">
          Saisir une dépense
        </Link>
      </div>

      <FiltresJournal categories={categories} provinces={PROVINCES} valeurs={p} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Sommaire libelle="Revenus (HT)" valeur={argent(totaux?.revenus)} />
        <Sommaire libelle="Dépenses (coût réel)" valeur={argent(totaux?.depenses)} />
        <Sommaire libelle="Taxes perçues" valeur={argent(totaux?.taxes_percues)} />
        <Sommaire libelle="Taxes récupérables" valeur={argent(totaux?.taxes_recuperables)} />
      </div>

      <div className="carte overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-ligne)] bg-[var(--color-fond)] text-left text-xs uppercase tracking-wide text-[var(--color-encre-doux)]">
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Description</th>
                <th className="px-3 py-2 font-semibold">Catégorie</th>
                <th className="px-3 py-2 text-right font-semibold">Montant HT</th>
                <th className="px-3 py-2 font-semibold">Taxes</th>
                <th className="px-3 py-2 text-right font-semibold">TTC</th>
                <th className="px-3 py-2 font-semibold">Source</th>
                <th className="px-3 py-2 font-semibold">Reçu</th>
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-[var(--color-encre-doux)]">
                    Aucune transaction pour ces critères.
                  </td>
                </tr>
              )}
              {lignes.map((l) => (
                <tr key={l.id} className="border-b border-[var(--color-ligne)] last:border-0">
                  <td className="chiffre whitespace-nowrap px-3 py-2 text-[var(--color-encre-doux)]">
                    {dateCourte(l.date)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{l.description}</span>
                    {l.est_stock && (
                      <span className="ml-2 rounded bg-[var(--color-accent-doux)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-accent)]">
                        porté au stock
                      </span>
                    )}
                    {l.est_remboursement && (
                      <span className="ml-2 rounded bg-orange-50 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-attention)]">
                        contre-écriture
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-[var(--color-encre-doux)]">{l.categorie_libelle}</span>
                    {l.nature && (
                      <span className="ml-1.5 text-[11px] uppercase text-[var(--color-encre-doux)] opacity-70">
                        {l.nature}
                      </span>
                    )}
                  </td>
                  <td
                    className={`chiffre whitespace-nowrap px-3 py-2 text-right font-semibold ${
                      effetSurLeResultat(l) > 0 ? 'text-[var(--color-positif)]' : ''
                    }`}
                  >
                    {montantSigne(effetSurLeResultat(l))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--color-encre-doux)]">
                    {l.taxes?.length
                      ? l.taxes.map((t) => `${t.code} ${argent(t.montant)}`).join('  ·  ')
                      : '—'}
                  </td>
                  <td className="chiffre whitespace-nowrap px-3 py-2 text-right text-[var(--color-encre-doux)]">
                    {argent(l.montant_ttc)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="rounded border border-[var(--color-ligne)] px-1.5 py-0.5 text-[var(--color-encre-doux)]">
                      {SOURCES[l.source] ?? l.source}
                    </span>
                    <span className="ml-1.5 text-[var(--color-encre-doux)]">{l.province}</span>
                  </td>
                  <td className="px-3 py-2">
                    {l.piece_jointe_url ? (
                      <a
                        className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
                        href={lienRecu(l.piece_jointe_url) ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Voir
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--color-encre-doux)] opacity-60">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-[var(--color-encre-doux)]">
        <span>
          {nombre(totaux?.nb ?? 0)} transaction{(totaux?.nb ?? 0) > 1 ? 's' : ''}
        </span>
        {nbPages > 1 && (
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link className="bouton bouton-secondaire" href={lienPage(page - 1)}>
                Précédent
              </Link>
            )}
            <span>
              Page {page} sur {nbPages}
            </span>
            {page < nbPages && (
              <Link className="bouton bouton-secondaire" href={lienPage(page + 1)}>
                Suivant
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Effet de l'écriture sur le résultat : positif si elle l'améliore.
 * Une contre-écriture de revenu (remboursement, rétrofacturation) porte un
 * montant HT négatif : elle doit s'afficher en négatif, pas en « + ».
 */
function effetSurLeResultat(l: LigneJournal): number {
  return l.type === 'revenu' ? l.montant_ht : -l.montant_ht
}

function montantSigne(valeur: number): string {
  const signe = valeur >= 0 ? '+' : '−'
  return `${signe}${argent(Math.abs(valeur))}`
}

function Sommaire({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="carte px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-encre-doux)]">
        {libelle}
      </div>
      <div className="chiffre mt-1 text-xl font-bold">{valeur}</div>
    </div>
  )
}
