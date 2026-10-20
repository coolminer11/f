import type { Metadata } from 'next'
import { exigerSession } from '@/lib/auth'
import { achatsProbables, etatsStock, inscritAuxTaxes, receptions, type EtatStock } from '@/lib/stock'
import { lienRecu } from '@/lib/stockage'
import { argent } from '@/lib/format'
import FormulaireReception from '@/components/formulaire-reception'
import BoutonSupprimer from '@/components/bouton-supprimer'
import OngletsVentes from '@/components/onglets-ventes'
import { convertirAction, modifierAction, seuilAction, supprimerAction } from '@/app/cartes/stock/actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Stock de cartes — Tapora' }

const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date())
const jour = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const virgule = (v: number) => v.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, '')

/**
 * Le stock de cartes, par modèle : combien il en reste, ce qu'elles valent,
 * et les réceptions. Une réception, c'est deux chiffres (cartes reçues, total
 * payé) ; l'app met les cartes au stock et chaque vente en sort une à son coût.
 */
export default async function PageStock({ searchParams }: { searchParams: Promise<{ message?: string; erreur?: string; modele?: string }> }) {
  const moi = await exigerSession()
  const sp = await searchParams
  const ecriture = moi.role !== 'lecture'
  const [stocks, liste, probables, inscrit] = await Promise.all([etatsStock(), receptions(), achatsProbables(), inscritAuxTaxes()])
  const modeles = stocks.filter((s) => s.produit_id).map((s) => ({ id: s.produit_id!, nom: s.nom ?? 'Carte' }))
  const parDefaut = (stocks.find((s) => s.produit_id === sp.modele) ?? stocks.find((s) => s.modele === 'quebec') ?? stocks[0])?.produit_id ?? null

  return (
    <div className="space-y-5">
      <OngletsVentes actif="/cartes/stock" />
      <div>
        <h1 className="font-[family-name:var(--police-fraunces)] text-2xl font-semibold tracking-tight">Stock de cartes</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          Les cartes reçues vont au stock (ce n’est pas une dépense tant qu’elles ne sont pas vendues). Chaque vente en sort une, à son coût.
        </p>
      </div>

      {sp.erreur && <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">{sp.erreur}</p>}
      {sp.message && <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">{sp.message}</p>}

      {stocks.length === 0 ? (
        <p className="carte px-5 py-6 text-sm text-[var(--color-encre-doux)]">Aucune carte suivie au stock.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {stocks.map((s) => (
              <CarteStock key={s.produit_id} s={s} ecriture={ecriture} />
            ))}
          </div>

          {ecriture && (
            <section className="carte p-6" id="reception">
              <h2 className="text-sm font-semibold">Réception de cartes</h2>
              <p className="mb-4 mt-0.5 text-xs text-[var(--color-encre-doux)]">Deux chiffres suffisent : le nombre de cartes reçues et le total payé.</p>
              <FormulaireReception aujourdhui={aujourdhui()} inscritTaxes={inscrit} modeles={modeles} modeleParDefaut={parDefaut} />
            </section>
          )}

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
                      {modeles.length > 1 && (
                        <label className="flex flex-col text-xs text-[var(--color-encre-doux)]">
                          Modèle
                          <select name="produit_id" defaultValue={parDefaut ?? undefined} className="champ mt-0.5 py-1.5 text-sm">
                            {modeles.map((m) => (
                              <option key={m.id} value={m.id}>{m.nom}</option>
                            ))}
                          </select>
                        </label>
                      )}
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
                      <p className="text-sm font-medium">
                        {r.quantite} × {r.modele_nom} · {argent(r.montant_cartes)}
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
              <li>Les cartes Entreprise se reçoivent depuis leur commande : elles entrent au stock puis en sortent à la facture.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

function CarteStock({ s, ecriture }: { s: EtatStock; ecriture: boolean }) {
  const bas = s.quantite < 0 || (s.seuil !== null && s.quantite < s.seuil)
  const semaines = s.rythme_semaine > 0 && s.quantite > 0 ? Math.floor(s.quantite / s.rythme_semaine) : null
  return (
    <section className={`carte p-5 ${bas ? 'ring-1 ring-[var(--color-attention)]' : ''}`}>
      <p className="text-sm font-semibold">{s.nom}</p>
      <p className={`mt-2 font-[family-name:var(--police-fraunces)] text-5xl font-semibold tracking-tight tabular-nums ${s.quantite < 0 ? 'text-[var(--color-negatif)]' : ''}`}>
        {s.quantite}{' '}
        <span className="text-lg font-medium text-[var(--color-encre-doux)]">carte{Math.abs(s.quantite) > 1 ? 's' : ''}</span>
      </p>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-[var(--color-encre-doux)]">Valeur</dt><dd className="tabular-nums font-semibold">{argent(s.valeur)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-[var(--color-encre-doux)]">Coût moyen</dt><dd className="tabular-nums">{s.depuis_receptions ? argent(s.cout_moyen) : '—'}</dd></div>
        {s.rythme_semaine > 0 && (
          <div className="flex justify-between gap-3"><dt className="text-[var(--color-encre-doux)]">Ventes / semaine</dt><dd className="tabular-nums">{virgule(s.rythme_semaine)}</dd></div>
        )}
      </dl>
      {s.quantite < 0 ? (
        <p className="mt-3 rounded-lg bg-[#fbebe4] px-3 py-2 text-xs text-[var(--color-negatif)]">Stock négatif : des cartes vendues n’ont pas de réception inscrite.</p>
      ) : bas ? (
        <p className="mt-3 rounded-lg bg-[#fdf3dc] px-3 py-2 text-xs font-medium text-[#6b4a05]">
          ⚠️ Moins de {s.seuil} cartes : pensez à commander{semaines !== null && semaines <= 52 ? ` (environ ${semaines} semaine${semaines > 1 ? 's' : ''})` : ''}.
        </p>
      ) : s.seuil === null ? (
        <p className="mt-3 text-xs text-[var(--color-encre-doux)]">Faites sur commande : pas d’alerte de stock.</p>
      ) : semaines !== null ? (
        <p className="mt-3 text-xs text-[var(--color-encre-doux)]">{semaines > 52 ? 'Plus d’un an de cartes au rythme actuel.' : `Environ ${semaines} semaine${semaines > 1 ? 's' : ''} de cartes au rythme actuel.`}</p>
      ) : null}
      {ecriture && (
        <form action={seuilAction} className="mt-3 flex items-center gap-2 border-t border-[var(--color-ligne)] pt-3 text-xs text-[var(--color-encre-doux)]">
          <input type="hidden" name="produit_id" value={s.produit_id ?? ''} />
          <label htmlFor={`seuil-${s.produit_id}`}>Prévenir sous</label>
          <input id={`seuil-${s.produit_id}`} name="seuil" inputMode="numeric" defaultValue={s.seuil ?? ''} placeholder="—" className="champ py-1 text-right text-xs" style={{ width: '4rem' }} />
          <span>cartes</span>
          <button className="bouton bouton-secondaire py-1 text-xs">OK</button>
        </form>
      )}
    </section>
  )
}
