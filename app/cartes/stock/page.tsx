import Link from 'next/link'
import type { Metadata } from 'next'
import { exigerSession } from '@/lib/auth'
import { achatsProbables, etatStock, receptions } from '@/lib/stock'
import { lienRecu } from '@/lib/stockage'
import { argent } from '@/lib/format'
import FormulaireReception from '@/components/formulaire-reception'
import BoutonSupprimer from '@/components/bouton-supprimer'
import { convertirAction, modifierAction, seuilAction, supprimerAction } from '@/app/cartes/stock/actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Stock de cartes — Tapora' }

const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date())
const jour = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const virgule = (v: number) => v.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, '')

/**
 * Le stock de cartes : combien il en reste, ce qu'elles valent, et les
 * réceptions. Une réception, c'est deux chiffres (cartes reçues, total payé) ;
 * l'app met les cartes au stock et chaque vente en sort une à son coût.
 */
export default async function PageStock({ searchParams }: { searchParams: Promise<{ message?: string; erreur?: string }> }) {
  const moi = await exigerSession()
  const sp = await searchParams
  const ecriture = moi.role !== 'lecture'
  const [s, liste, probables] = await Promise.all([etatStock(), receptions(), achatsProbables()])
  const bas = s.quantite < s.seuil
  const semainesRestantes = s.rythme_semaine > 0 && s.quantite > 0 ? Math.floor(s.quantite / s.rythme_semaine) : null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/cartes" className="text-xs text-[var(--color-encre-doux)] hover:underline">← Cartes</Link>
          <h1 className="mt-1 font-[family-name:var(--police-fraunces)] text-2xl font-semibold tracking-tight">Stock de cartes</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            Les cartes reçues vont au stock (ce n’est pas une dépense tant qu’elles ne sont pas vendues). Chaque vente en sort une, à son coût.
          </p>
        </div>
      </div>

      {sp.erreur && <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">{sp.erreur}</p>}
      {sp.message && <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">{sp.message}</p>}

      {!s.produit_id ? (
        <p className="carte px-5 py-6 text-sm text-[var(--color-encre-doux)]">Aucun produit « carte » suivi au stock.</p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
            <section className={`carte relative overflow-hidden p-6 ${bas ? 'ring-1 ring-[var(--color-attention)]' : ''}`}>
              <p className="text-sm font-medium text-[var(--color-encre-doux)]">En stock aujourd’hui</p>
              <p className={`mt-1 font-[family-name:var(--police-fraunces)] text-6xl font-semibold tracking-tight tabular-nums ${s.quantite < 0 ? 'text-[var(--color-negatif)]' : ''}`}>
                {s.quantite}{' '}
                <span className="ml-1 text-xl font-medium text-[var(--color-encre-doux)]">carte{Math.abs(s.quantite) > 1 ? 's' : ''}</span>
              </p>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-[var(--color-encre-doux)]">Valeur du stock</dt><dd className="tabular-nums font-semibold">{argent(s.valeur)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--color-encre-doux)]">Coût moyen d’une carte</dt><dd className="tabular-nums">{argent(s.cout_moyen)}</dd></div>
                {s.rythme_semaine > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--color-encre-doux)]">Ventes par semaine (8 dern.)</dt>
                    <dd className="whitespace-nowrap tabular-nums">{virgule(s.rythme_semaine)}</dd>
                  </div>
                )}
              </dl>
              {s.quantite < 0 ? (
                <p className="mt-4 rounded-lg bg-[#fbebe4] px-3 py-2 text-xs text-[var(--color-negatif)]">
                  Stock négatif : des cartes ont été vendues sans réception inscrite. Ajoutez la réception (ou convertissez la dépense ci-dessous).
                </p>
              ) : bas ? (
                <p className="mt-4 rounded-lg bg-[#fdf3dc] px-3 py-2 text-xs font-medium text-[#6b4a05]">
                  ⚠️ Moins de {s.seuil} cartes : pensez à commander{semainesRestantes !== null && semainesRestantes <= 52 ? ` (environ ${semainesRestantes} semaine${semainesRestantes > 1 ? 's' : ''} au rythme actuel)` : ''}. L’alerte part aussi dans le courriel du lundi.
                </p>
              ) : semainesRestantes !== null ? (
                <p className="mt-4 text-xs text-[var(--color-encre-doux)]">
                  {semainesRestantes > 52 ? 'Plus d’un an de cartes au rythme actuel.' : `Environ ${semainesRestantes} semaine${semainesRestantes > 1 ? 's' : ''} de cartes au rythme actuel.`}
                </p>
              ) : null}
              {ecriture && (
                <form action={seuilAction} className="mt-4 flex items-center gap-2 border-t border-[var(--color-ligne)] pt-3 text-xs text-[var(--color-encre-doux)]">
                  <label htmlFor="seuil">Prévenir sous</label>
                  <input id="seuil" name="seuil" inputMode="numeric" defaultValue={s.seuil} className="champ py-1 text-right text-xs" style={{ width: '4.5rem' }} />
                  <span>cartes</span>
                  <button className="bouton bouton-secondaire py-1 text-xs">OK</button>
                </form>
              )}
            </section>

            {ecriture && (
              <section className="carte p-6" id="reception">
                <h2 className="text-sm font-semibold">Réception de cartes</h2>
                <p className="mb-4 mt-0.5 text-xs text-[var(--color-encre-doux)]">Deux chiffres suffisent : le nombre de cartes reçues et le total payé.</p>
                <FormulaireReception aujourdhui={aujourdhui()} inscritTaxes={s.inscrit_taxes} />
              </section>
            )}
          </div>

          {ecriture && probables.length > 0 && (
            <section className="carte border-[var(--color-accent)] p-5">
              <h2 className="text-sm font-semibold">Ces dépenses ressemblent à des achats de cartes</h2>
              <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
                Inscrites comme dépenses ordinaires, elles comptent les cartes deux fois (à l’achat, puis à chaque vente). Convertissez-les : la part « cartes » va au stock, le reste (frais, stickers…) reste une dépense.
              </p>
              <ul className="mt-3 divide-y divide-[var(--color-ligne)]">
                {probables.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-end justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{p.description}</p>
                      <p className="text-xs text-[var(--color-encre-doux)]">{jour(p.date)} · {argent(p.montant)}</p>
                    </div>
                    <form action={convertirAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <label className="flex flex-col text-xs text-[var(--color-encre-doux)]">
                        Cartes reçues
                        <input name="quantite" inputMode="numeric" required className="champ mt-0.5 py-1.5 text-right" style={{ width: '6rem' }} placeholder="50" />
                      </label>
                      <label className="flex flex-col text-xs text-[var(--color-encre-doux)]">
                        Dont pour les cartes
                        <input name="montant_cartes" inputMode="decimal" required defaultValue={virgule(p.montant)} className="champ mt-0.5 py-1.5 text-right" style={{ width: '7.5rem' }} />
                      </label>
                      <button className="bouton py-1.5 text-sm">C’était des cartes</button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="carte p-5">
            <h2 className="text-sm font-semibold">Réceptions</h2>
            {liste.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-encre-doux)]">Aucune réception inscrite.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[var(--color-ligne)]">
                {liste.map((r) => {
                  const recu = lienRecu(r.piece_jointe_url)
                  return (
                    <li key={r.id} className="py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {r.quantite} cartes · {argent(r.montant_cartes)}
                            <span className="ml-2 text-xs font-normal text-[var(--color-encre-doux)]">({argent(r.cout_unitaire)} la carte)</span>
                          </p>
                          <p className="text-xs text-[var(--color-encre-doux)]">
                            {jour(r.date)} · {r.description}
                            {r.hors_cartes > 0 && ` · plus ${argent(r.hors_cartes)} hors cartes (dépense)`}
                            {recu && (
                              <>
                                {' · '}
                                <a href={recu} target="_blank" rel="noreferrer" className="font-medium text-[var(--color-accent)] hover:underline">reçu ↗</a>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      {ecriture && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-semibold text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]">Corriger</summary>
                          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                            <form action={modifierAction} className="flex flex-wrap items-end gap-2">
                              <input type="hidden" name="id" value={r.id} />
                              <label className="flex flex-col text-xs text-[var(--color-encre-doux)]">
                                Cartes reçues
                                <input name="quantite" inputMode="numeric" required defaultValue={r.quantite} className="champ mt-0.5 py-1.5 text-right" style={{ width: '6rem' }} />
                              </label>
                              <label className="flex flex-col text-xs text-[var(--color-encre-doux)]">
                                Total payé
                                <input name="total" inputMode="decimal" required defaultValue={virgule(r.total)} readOnly={r.a_des_taxes} className="champ mt-0.5 py-1.5 text-right" style={{ width: '7.5rem' }} />
                              </label>
                              <label className="flex flex-col text-xs text-[var(--color-encre-doux)]">
                                Dont pour les cartes
                                <input name="montant_cartes" inputMode="decimal" required defaultValue={virgule(r.montant_cartes)} readOnly={r.a_des_taxes} className="champ mt-0.5 py-1.5 text-right" style={{ width: '7.5rem' }} />
                              </label>
                              <button className="bouton py-1.5 text-sm">Enregistrer</button>
                            </form>
                            <form action={supprimerAction}>
                              <input type="hidden" name="id" value={r.id} />
                              <BoutonSupprimer
                                quoi={`la réception de ${r.quantite} cartes (${argent(r.montant_cartes)})`}
                                avertissement="La dépense disparaît des comptes avec les cartes du stock (une trace est gardée). Pour corriger un chiffre, utilisez plutôt « Enregistrer »."
                              />
                            </form>
                          </div>
                          <p className="mt-1.5 text-xs text-[var(--color-encre-doux)]">
                            Le reste du total (ex. frais d’immatriculation) devient une dépense à part. Le coût des ventes se recalcule tout seul.
                          </p>
                        </details>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="carte p-5 text-sm">
            <h2 className="text-sm font-semibold">Comment ça marche</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed text-[var(--color-encre-doux)] marker:text-[var(--color-accent)]">
              <li>Une réception met les cartes au stock : c’est un actif (elles valent encore de l’argent), pas une perte.</li>
              <li>Chaque reçu ou facture sort ses cartes du stock à leur coût moyen : la vente montre son vrai profit.</li>
              <li>Annuler un reçu remet la carte en stock et retire son coût, tout seul.</li>
              <li>Le coût moyen se refait à chaque réception, sur les cartes encore en stock : ce qui a été payé = cartes vendues + stock, au cent près.</li>
              <li>Au 31 décembre, le stock est ce qui reste « à vous » : il apparaît dans le résumé fiscal (onglet Vos profits).</li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
