import Link from 'next/link'
import type { Metadata } from 'next'
import { exigerSession } from '@/lib/auth'
import { ETAPES, listerCommandes, rangEtape } from '@/lib/commandes'
import { catalogue } from '@/lib/catalogue'
import { listerClients } from '@/lib/requetes/ventes'
import { argent } from '@/lib/format'
import OngletsVentes from '@/components/onglets-ventes'
import FormulaireCommande from '@/components/formulaire-commande'
import { creerCommandeAction } from '@/app/commandes/actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Commandes Entreprise — Tapora' }

const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', timeZone: 'America/Toronto' })

/** Les commandes Entreprise : où en est chacune, et une nouvelle en un formulaire. */
export default async function PageCommandes({ searchParams }: { searchParams: Promise<{ message?: string; erreur?: string; nouvelle?: string }> }) {
  const moi = await exigerSession()
  const sp = await searchParams
  const ecriture = moi.role !== 'lecture'
  const [commandes, cartes, clients] = await Promise.all([listerCommandes(), catalogue(), listerClients()])
  const entreprise = cartes.filter((c) => c.personnalisable).map((c) => ({ id: c.id, nom: c.nom, prix: c.prix, min: c.quantite_min, langue: c.langue }))
  const actives = commandes.filter((c) => !c.annulee_le)
  const enCours = actives.filter((c) => c.etape !== 'facturee')

  return (
    <div className="space-y-5">
      <OngletsVentes actif="/commandes" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--police-fraunces)] text-2xl font-semibold tracking-tight">Commandes Entreprise</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            Cartes personnalisées, 25 au minimum. Sept étapes, de la demande à la facture ; chacune a son bouton.
          </p>
        </div>
      </div>

      {sp.erreur && <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">{sp.erreur}</p>}
      {sp.message && <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">{sp.message}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {ETAPES.map(([code, libelle], i) => {
          const nb = actives.filter((c) => c.etape === code).length
          return (
            <div key={code} className={`carte p-3 ${nb ? '' : 'opacity-60'}`}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-encre-doux)]">{i + 1}. {libelle}</div>
              <div className="mt-0.5 text-2xl font-semibold tabular-nums">{nb}</div>
            </div>
          )
        })}
      </div>

      {ecriture && (
        <details className="carte p-5" open={sp.nouvelle === '1' || commandes.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-[var(--color-accent)]">+ Nouvelle commande</summary>
          <div className="mt-4">
            <FormulaireCommande action={creerCommandeAction} modeles={entreprise} clients={clients.map((c) => c.nom)} libelle="Créer la commande" />
          </div>
        </details>
      )}

      <section className="carte overflow-x-auto">
        {commandes.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-encre-doux)]">Aucune commande pour l’instant.</p>
        ) : (
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-ligne)] text-left text-xs text-[var(--color-encre-doux)]">
                <th className="px-4 py-2 font-medium">Commande</th>
                <th className="px-2 py-2 font-medium">Client</th>
                <th className="px-2 py-2 font-medium">Carte</th>
                <th className="px-2 py-2 text-right font-medium">Cartes</th>
                <th className="px-2 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Où elle en est</th>
              </tr>
            </thead>
            <tbody>
              {commandes.map((c) => {
                const rang = rangEtape(c.etape)
                return (
                  <tr key={c.id} className={`border-b border-[var(--color-ligne)] last:border-0 ${c.annulee_le ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2.5">
                      <Link href={`/commandes/${c.id}`} className="font-semibold hover:text-[var(--color-accent)]">{c.numero}</Link>
                      <span className="block text-xs text-[var(--color-encre-doux)]">{jour(c.cree_le)}</span>
                    </td>
                    <td className="px-2 py-2.5">{c.client_nom}</td>
                    <td className="px-2 py-2.5 text-xs">{c.produit_nom.replace('Carte Entreprise — ', '')}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{c.quantite}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{argent(c.total)}</td>
                    <td className="px-4 py-2.5">
                      {c.annulee_le ? (
                        <span className="text-xs font-semibold text-[var(--color-encre-doux)]">Annulée</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className="flex gap-0.5" aria-hidden>
                            {ETAPES.map(([code], i) => (
                              <span key={code} className={`h-1.5 w-4 rounded-full ${i <= rang ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-grille)]'}`} />
                            ))}
                          </span>
                          <span className="text-xs font-medium">{ETAPES[rang]?.[1]}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
      {enCours.length > 0 && (
        <p className="text-xs text-[var(--color-encre-doux)]">
          {enCours.length} commande{enCours.length > 1 ? 's' : ''} en cours · {argent(enCours.reduce((s, c) => s + c.total, 0))} à facturer.
        </p>
      )}
    </div>
  )
}
