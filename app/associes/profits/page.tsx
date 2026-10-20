import Link from 'next/link'
import type { Metadata } from 'next'
import { exigerSession } from '@/lib/auth'
import { exercicesConnus, listerAssocies } from '@/lib/requetes/associes'
import { partages, RESERVE_IMPOTS, resumeAnnee, type Partage } from '@/lib/profits'
import { argent } from '@/lib/format'
import { stockAu } from '@/lib/stock'
import OngletsAssocies from '@/components/onglets-associes'
import FormulairePartage from '@/components/formulaire-partage'
import { annulerPartageAction, approuverPartageAction } from '@/app/associes/actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Vos profits — Tapora' }

const FUSEAU = 'America/Toronto'
const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU }).format(new Date())
const dateLongue = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const nomMois = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-CA', { month: 'long', timeZone: 'UTC' })
const pct = (p: number) => `${(Math.round(p * 10000) / 100).toLocaleString('fr-CA', { maximumFractionDigits: 2 })} %`
const prenom = (nom: string) => nom.split(' ')[0]
/** « 40/60 » dans l'ordre des associés. */
const court = (p: Partage | undefined) => (p ? p.parts.map((x) => (Math.round(x.part * 10000) / 100).toLocaleString('fr-CA', { maximumFractionDigits: 2 })).join('/') : '—')
const signe = (v: number) => (v > 0 ? 'text-[var(--color-positif)]' : v < 0 ? 'text-[var(--color-negatif)]' : '')

/**
 * Vos profits : la part de chaque associé, calculée selon le partage en
 * vigueur à la date de chaque revenu et de chaque dépense ; l'historique des
 * partages et leurs changements (approuvés par tous) ; et ce que chacun
 * déclare aux impôts, puisqu'une S.E.N.C. ne paie pas d'impôt sur le revenu
 * elle-même : ses associés le paient sur leur part.
 */
export default async function PageProfits({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; associe?: string; message?: string; erreur?: string }>
}) {
  const moi = await exigerSession()
  const sp = await searchParams
  const ecriture = moi.role !== 'lecture'
  const [exercices, associes, histo] = await Promise.all([exercicesConnus(), listerAssocies(), partages()])
  const anneeCourante = Number(aujourdhui().slice(0, 4))
  const annee = exercices.some((e) => e.annee === Number(sp.annee)) ? Number(sp.annee) : anneeCourante
  const finStock = annee === anneeCourante ? aujourdhui() : `${annee}-12-31`
  const [r, stockDebut, stockFin] = await Promise.all([resumeAnnee(annee), stockAu(`${annee - 1}-12-31`), stockAu(finStock)])
  const choisi = r.associes.find((a) => a.associe_id === sp.associe) ?? r.associes.find((a) => a.associe_id === moi.associe_id) ?? r.associes[0]
  const mien = choisi?.associe_id === moi.associe_id
  const parId = new Map(histo.appliques.map((p) => [p.id, p]))
  const enCours = histo.appliques.find((p) => p.debut <= aujourdhui()) ?? histo.appliques[histo.appliques.length - 1]
  const partMoyenne = choisi && r.societe.benefice !== 0 ? choisi.comptable / r.societe.benefice : null
  const reserve = choisi && choisi.fiscal > 0 ? Math.round(choisi.fiscal * RESERVE_IMPOTS * 100) / 100 : 0
  const laisse = choisi ? (Math.round(choisi.comptable * 100) - Math.round(choisi.prelevements * 100)) / 100 : 0
  const exportUrl = choisi ? `/associes/profits/export?annee=${annee}&associe=${choisi.associe_id}` : null
  const vous = mien ? 'Vous' : prenom(choisi?.nom ?? '')
  const maxMois = Math.max(1, ...r.mois.map((m) => Math.abs(choisi ? (m.parts[choisi.associe_id] ?? 0) : 0)))
  const lien = (q: Record<string, string | number>) => `?${new URLSearchParams({ annee: String(annee), associe: choisi?.associe_id ?? '', ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, String(v)])) })}`
  const proposition = histo.proposition
  const jApprouve = proposition?.approbations.some((a) => a.associe_id === moi.associe_id)
  const jeSuisConcerne = proposition?.parts.some((p) => p.associe_id === moi.associe_id)

  return (
    <div className="space-y-5">
      <OngletsAssocies actif="/associes/profits" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--police-fraunces)] text-2xl font-semibold tracking-tight">{mien ? 'Vos profits' : `Les profits de ${prenom(choisi?.nom ?? '')}`}</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            Chaque revenu et chaque dépense se partage selon le partage en vigueur à sa date. Calculé au cent près, tout seul.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex rounded-full bg-[var(--color-fond)] p-1 text-sm" aria-label="Associé">
            {r.associes.map((a) => (
              <Link
                key={a.associe_id}
                href={lien({ associe: a.associe_id })}
                aria-current={a.associe_id === choisi?.associe_id ? 'page' : undefined}
                className={`rounded-full px-3.5 py-1 font-medium transition ${a.associe_id === choisi?.associe_id ? 'bg-[var(--color-encre)] text-[var(--color-fond)]' : 'text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]'}`}
              >
                {a.associe_id === moi.associe_id ? 'Moi' : prenom(a.nom)}
              </Link>
            ))}
          </nav>
          <form method="get" className="flex items-center gap-1.5">
            <input type="hidden" name="associe" value={choisi?.associe_id ?? ''} />
            <select name="annee" defaultValue={annee} className="champ w-auto py-1.5 text-sm" aria-label="Année">
              {exercices.map((e) => (
                <option key={e.annee} value={e.annee}>{e.annee}{e.statut === 'clos' ? ' (clos)' : ''}</option>
              ))}
            </select>
            <button className="bouton bouton-secondaire py-1.5 text-sm">Voir</button>
          </form>
        </div>
      </div>

      {sp.erreur && <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">{sp.erreur}</p>}
      {sp.message && <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">{sp.message}</p>}

      {choisi && (
        <>
          {/* ---- L'essentiel */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
            <section className="carte relative overflow-hidden p-6">
              <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-[var(--color-accent-doux)] opacity-70" />
              <p className="relative text-sm font-medium text-[var(--color-encre-doux)]">
                {mien ? 'Votre part' : `Part de ${prenom(choisi.nom)}`} du {r.societe.benefice < 0 ? 'résultat' : 'profit'} {annee}
                {annee === anneeCourante && ' · à ce jour'}
              </p>
              <p className={`relative mt-1 font-[family-name:var(--police-fraunces)] text-5xl font-semibold tracking-tight tabular-nums ${signe(choisi.comptable)}`}>{argent(choisi.comptable)}</p>
              <p className="relative mt-2 text-sm text-[var(--color-encre-doux)]">
                sur un {r.societe.benefice < 0 ? 'résultat (perte)' : 'profit'} de la société de <strong className="text-[var(--color-encre)]">{argent(r.societe.benefice)}</strong>
                {partMoyenne !== null && <> · part moyenne {pct(partMoyenne)}</>}
              </p>
              <p className="relative mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--color-fond)] px-3 py-1 text-xs">
                Partage en vigueur : <strong>{enCours ? enCours.parts.map((p) => `${prenom(p.nom)} ${pct(p.part)}`).join(' · ') : '—'}</strong>
              </p>
            </section>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
              <Tuile libelle={`Prélevé en ${annee}`} valeur={argent(choisi.prelevements)} aide="Ce qui est sorti de la société vers votre poche. Pas imposé en soi." />
              <Tuile libelle="Laissé dans la société" valeur={argent(laisse)} aide="Votre part moins vos prélèvements. Il reste à votre compte de capital." />
              <Tuile
                libelle="À mettre de côté pour l’impôt"
                valeur={reserve > 0 ? `≈ ${argent(reserve)}` : '—'}
                aide={`Repère : ${Math.round(RESERVE_IMPOTS * 100)} % de votre part imposable, pour l’impôt et les cotisations. Pas un calcul d’impôt.`}
                className="col-span-2 lg:col-span-1"
              />
            </div>
          </div>

          {/* ---- Mois par mois */}
          <section className="carte p-5">
            <h2 className="text-sm font-semibold">Mois par mois</h2>
            {r.mois.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-encre-doux)]">Aucune transaction en {annee}.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-ligne)] text-left text-xs text-[var(--color-encre-doux)]">
                    <th className="py-1.5 font-medium">Mois</th>
                    <th className="py-1.5 text-right font-medium">Profit de la société</th>
                    <th className="hidden py-1.5 pl-4 font-medium sm:table-cell">Partage ({r.associes.map((a) => prenom(a.nom)).join('/')})</th>
                    <th className="py-1.5 text-right font-medium">{mien ? 'Votre part' : `Part de ${prenom(choisi.nom)}`}</th>
                    <th className="hidden w-32 py-1.5 sm:table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {r.mois.map((m) => {
                    const v = m.parts[choisi.associe_id] ?? 0
                    return (
                      <tr key={m.mois} className="border-b border-[var(--color-ligne)] last:border-0">
                        <td className="py-2">
                          <span className="capitalize">{nomMois(m.mois)}</span>
                          <span className="block text-xs tabular-nums text-[var(--color-encre-doux)] sm:hidden">{m.partages.map((id) => court(parId.get(id))).join(' puis ')}</span>
                        </td>
                        <td className={`py-2 text-right tabular-nums ${signe(m.profit)}`}>{argent(m.profit)}</td>
                        <td className="hidden py-2 pl-4 tabular-nums text-[var(--color-encre-doux)] sm:table-cell">
                          {m.partages.map((id) => court(parId.get(id))).join(' puis ')}
                        </td>
                        <td className={`py-2 text-right font-semibold tabular-nums ${signe(v)}`}>{argent(v)}</td>
                        <td className="hidden py-2 pl-3 sm:table-cell">
                          <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--color-grille)]" aria-hidden>
                            <span className={`block h-full rounded-full ${v < 0 ? 'bg-[var(--color-negatif)]' : 'bg-[var(--color-accent)]'}`} style={{ width: `${(Math.abs(v) / maxMois) * 100}%` }} />
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--color-ligne)] font-semibold">
                    <td className="py-2">{annee}</td>
                    <td className={`py-2 text-right tabular-nums ${signe(r.societe.benefice)}`}>{argent(r.societe.benefice)}</td>
                    <td className="hidden sm:table-cell" />
                    <td className={`py-2 text-right tabular-nums ${signe(choisi.comptable)}`}>{argent(choisi.comptable)}</td>
                    <td className="hidden sm:table-cell" />
                  </tr>
                </tfoot>
              </table>
            )}
          </section>
        </>
      )}

      {/* ---- Le partage dans le temps */}
      <section id="partage" className="carte scroll-mt-4 p-5">
        <h2 className="text-sm font-semibold">Le partage dans le temps</h2>
        <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
          Un changement s’applique à partir de sa date, une fois approuvé par chacun. Les profits d’avant gardent l’ancien partage.
        </p>

        {proposition && (
          <div className="mt-4 rounded-xl border border-[#f1dca8] bg-[#fdf6e6] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#6b4a05]">
                  Changement proposé : {proposition.parts.map((p) => `${prenom(p.nom)} ${pct(p.part)}`).join(' · ')}
                </p>
                <p className="mt-0.5 text-xs text-[#6b4a05]">
                  À partir du {dateLongue(proposition.debut)}
                  {proposition.propose_par && ` · proposé par ${prenom(proposition.propose_par)}`}
                  {proposition.motif && ` · « ${proposition.motif} »`}
                </p>
                <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                  {proposition.parts.map((p) => {
                    const ok = proposition.approbations.some((a) => a.associe_id === p.associe_id)
                    return (
                      <li key={p.associe_id} className={`rounded-full px-2.5 py-1 font-semibold ${ok ? 'bg-[#e9f2ea] text-[var(--color-positif)]' : 'bg-white/70 text-[var(--color-encre-doux)]'}`}>
                        {ok ? '✓' : '…'} {prenom(p.nom)}
                      </li>
                    )
                  })}
                </ul>
              </div>
              {ecriture && (
                <div className="flex items-center gap-2">
                  {jeSuisConcerne && !jApprouve && (
                    <form action={approuverPartageAction}>
                      <input type="hidden" name="id" value={proposition.id} />
                      <input type="hidden" name="retour_associe" value={choisi?.associe_id ?? ''} />
                      <button className="bouton py-1.5 text-sm">J’approuve</button>
                    </form>
                  )}
                  <form action={annulerPartageAction}>
                    <input type="hidden" name="id" value={proposition.id} />
                    <input type="hidden" name="retour_associe" value={choisi?.associe_id ?? ''} />
                    <button className="bouton bouton-secondaire py-1.5 text-sm">Annuler</button>
                  </form>
                </div>
              )}
            </div>
            {proposition.debut < aujourdhui() && (
              <p className="mt-2 text-xs text-[#6b4a05]">Date passée : une fois approuvé, les profits depuis le {dateLongue(proposition.debut)} seront répartis à nouveau.</p>
            )}
          </div>
        )}

        <ol className="mt-4 space-y-0">
          {histo.appliques.map((p, i) => {
            const fin = i > 0 ? histo.appliques[i - 1].debut : null
            const actuel = p.id === enCours?.id
            return (
              <li key={p.id} className="relative flex gap-3 pb-4 pl-1 last:pb-0">
                <span className={`relative z-10 mt-1 size-3 shrink-0 rounded-full ${actuel ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-ligne)]'}`} aria-hidden />
                {i < histo.appliques.length - 1 && <span className="absolute left-[9px] top-4 h-full w-px bg-[var(--color-ligne)]" aria-hidden />}
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">
                    {p.parts.map((x) => `${prenom(x.nom)} ${pct(x.part)}`).join(' · ')}
                    {actuel && <span className="ml-2 rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">En vigueur</span>}
                    {p.debut > aujourdhui() && <span className="ml-2 rounded-full bg-[var(--color-fond)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-encre-doux)]">À venir</span>}
                  </p>
                  <p className="text-xs text-[var(--color-encre-doux)]">
                    {p.premier ? 'Depuis le début' : `À partir du ${dateLongue(p.debut)}`}
                    {fin && ` · jusqu’au ${dateLongue(new Date(Date.parse(`${fin}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10))}`}
                    {p.decision_numero && (
                      <>
                        {' · '}
                        <Link href="/associes#registre" className="hover:underline">décision n° {p.decision_numero}</Link>
                      </>
                    )}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>

        {ecriture && !proposition && (
          <details className="mt-4 border-t border-[var(--color-ligne)] pt-3">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--color-accent)]">Proposer un nouveau partage</summary>
            <div className="mt-3">
              <FormulairePartage associes={associes} aujourdhui={aujourdhui()} retourAssocie={choisi?.associe_id ?? ''} />
            </div>
          </details>
        )}
      </section>

      {/* ---- Impôts */}
      {choisi && (
        <section id="impots" className="carte scroll-mt-4 overflow-hidden">
          <div className="border-b border-[var(--color-ligne)] bg-[linear-gradient(110deg,var(--color-accent-doux),transparent_70%)] px-5 py-4">
            <h2 className="font-[family-name:var(--police-fraunces)] text-xl font-semibold">Impôts {annee} — ce que {mien ? 'vous déclarez' : `${prenom(choisi.nom)} déclare`}</h2>
            <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
              Une société en nom collectif ne paie pas d’impôt sur le revenu elle-même : chaque associé déclare sa part du bénéfice, qu’il l’ait prélevée ou non.
            </p>
          </div>
          <div className="grid gap-6 p-5 lg:grid-cols-2">
            <div>
              <p className="text-sm text-[var(--color-encre-doux)]">{vous === 'Vous' ? 'Votre' : 'Son'} revenu d’entreprise {annee}{annee === anneeCourante && ' (à ce jour)'}</p>
              <p className={`mt-1 font-[family-name:var(--police-fraunces)] text-4xl font-semibold tabular-nums ${signe(choisi.fiscal)}`}>{argent(choisi.fiscal)}</p>
              <dl className="mt-4 space-y-1.5 text-sm">
                <Ligne libelle="Revenus de la société (avant taxes)" valeur={argent(r.societe.revenus)} />
                <Ligne libelle="Dépenses de la société" valeur={`− ${argent(r.societe.depenses)}`} />
                <Ligne libelle="Bénéfice net" valeur={argent(r.societe.benefice)} fort />
                {r.societe.repas_non_deductible > 0 && (
                  <Ligne libelle="+ Repas et représentation non déductibles (50 %)" valeur={argent(r.societe.repas_non_deductible)} />
                )}
                <Ligne libelle="Bénéfice imposable estimé de la société" valeur={argent(r.societe.benefice_fiscal)} fort />
                <Ligne libelle={`Part de ${mien ? 'vous' : prenom(choisi.nom)}, selon le partage de chaque période`} valeur={argent(choisi.fiscal)} fort />
              </dl>
              {(stockFin.achats > 0 || stockFin.cogs > 0 || stockDebut.valeur > 0 || stockFin.valeur > 0) && (
                <div className="mt-5 rounded-xl bg-[var(--color-fond)] p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-encre-doux)]">Coût des cartes vendues (section « coût des produits vendus »)</h3>
                  <dl className="mt-2 space-y-1.5 text-sm">
                    <Ligne libelle={`Stock au 1er janvier ${annee}`} valeur={`${argent(stockDebut.valeur)} · ${Math.max(0, stockDebut.quantite)} cartes`} />
                    <Ligne libelle="+ Cartes reçues dans l’année (achats)" valeur={argent(stockFin.achats)} />
                    <Ligne libelle={`− Stock au ${annee === anneeCourante ? 'aujourd’hui' : `31 décembre ${annee}`}`} valeur={`${argent(stockFin.valeur)} · ${Math.max(0, stockFin.quantite)} cartes`} />
                    <Ligne libelle="= Coût des cartes vendues (déjà dans les dépenses)" valeur={argent(stockFin.cogs)} fort />
                  </dl>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--color-encre-doux)]">Les cartes encore en stock ne sont pas une dépense : elles comptent l’année où elles se vendent.</p>
                </div>
              )}
              {exportUrl && (
                <a href={exportUrl} className="bouton mt-5 inline-flex text-sm">Télécharger le résumé pour le comptable (CSV)</a>
              )}
            </div>

            <div className="space-y-4 text-sm">
              <Bloc titre="Où le déclarer">
                <li><strong>Fédéral :</strong> formulaire T2125 (État des résultats des activités d’une entreprise ou d’une profession libérale), joint à la déclaration T1. On y indique être membre d’une société de personnes, et sa part.</li>
                <li><strong>Québec :</strong> formulaire TP-80 (Revenus et dépenses d’entreprise ou de profession), joint à la déclaration TP-1.</li>
                <li>Les cotisations de travailleur autonome au RRQ et au RQAP se calculent sur cette part.</li>
              </Bloc>
              <Bloc titre="Les dates">
                <li>Produire la déclaration {annee} au plus tard le <strong>15 juin {annee + 1}</strong>.</li>
                <li>Payer le solde au plus tard le <strong>30 avril {annee + 1}</strong> (des intérêts courent après).</li>
                <li>Si l’impôt à payer dépasse 1 800 $ cette année et l’une des deux précédentes, des acomptes provisionnels trimestriels sont demandés.</li>
              </Bloc>
              <Bloc titre="Côté société">
                <li>TPS et TVQ : c’est la société qui les déclare — voir l’onglet <Link href="/taxes" className="font-medium text-[var(--color-accent)] hover:underline">Taxes</Link>.</li>
                <li>Déclaration de renseignements de société de personnes (T5013 au fédéral, TP-600 au Québec) : en général pas exigée pour une petite S.E.N.C. de deux particuliers ; à confirmer avec votre comptable.</li>
                <li>Équipement durable (ordinateur, imprimante…) : il s’amortit (DPA) au lieu de se déduire d’un coup ; le comptable ajuste.</li>
              </Bloc>
              <p className="text-xs leading-relaxed text-[var(--color-encre-doux)]">
                Un repère, pas un avis fiscal : les chiffres viennent des transactions inscrites dans l’app. Faites valider la déclaration par un comptable.
              </p>
            </div>
          </div>

          {r.categories.length > 0 && (
            <details className="border-t border-[var(--color-ligne)] px-5 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]">Revenus et dépenses de la société par catégorie</summary>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {r.categories.map((c) => (
                    <tr key={c.type + c.categorie} className="border-b border-[var(--color-ligne)] last:border-0">
                      <td className="py-1.5">{c.libelle}</td>
                      <td className="py-1.5 text-xs text-[var(--color-encre-doux)]">{c.type === 'revenu' ? 'revenu' : 'dépense'}</td>
                      <td className="py-1.5 text-right tabular-nums">{argent(c.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </section>
      )}
    </div>
  )
}

function Tuile({ libelle, valeur, aide, className = '' }: { libelle: string; valeur: string; aide: string; className?: string }) {
  return (
    <div className={`carte p-4 ${className}`}>
      <div className="text-xs font-medium text-[var(--color-encre-doux)]">{libelle}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{valeur}</div>
      <div className="mt-1 text-xs leading-relaxed text-[var(--color-encre-doux)]">{aide}</div>
    </div>
  )
}

function Ligne({ libelle, valeur, fort = false }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${fort ? 'border-t border-[var(--color-ligne)] pt-1.5 font-semibold' : ''}`}>
      <dt className={fort ? '' : 'text-[var(--color-encre-doux)]'}>{libelle}</dt>
      <dd className="whitespace-nowrap tabular-nums">{valeur}</dd>
    </div>
  )
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-encre-doux)]">{titre}</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 leading-relaxed marker:text-[var(--color-accent)]">{children}</ul>
    </div>
  )
}
