import Link from 'next/link'
import type { Carte } from '@/lib/requetes/cartes'
import { Evolution, MiniCourbe, depuis, nombreFr } from '@/components/tuiles-cartes'

/**
 * Classement des cartes, avec cases à cocher pour en comparer jusqu'à quatre.
 * Le formulaire part en GET vers /cartes/comparer : pas une ligne de JS.
 */
export default function TableauCartes({
  cartes,
  parCarte,
  courbes,
  jours,
  afficherDossier = true,
  titre = 'Classement des cartes',
  vide,
}: {
  cartes: Carte[]
  parCarte: Record<string, { courant: number; precedent: number }>
  courbes: Record<string, number[]>
  jours: number
  afficherDossier?: boolean
  titre?: string
  vide?: React.ReactNode
}) {
  const classement = [...cartes].sort(
    (a, b) => (parCarte[b.id]?.courant ?? 0) - (parCarte[a.id]?.courant ?? 0) || b.taps_total - a.taps_total,
  )
  const maxPeriode = Math.max(1, ...classement.map((c) => parCarte[c.id]?.courant ?? 0))

  return (
    <section className="carte overflow-hidden">
      <form action="/cartes/comparer" method="get">
        <input type="hidden" name="p" value={jours} />
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
          <h2 className="text-sm font-semibold">{titre}</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--color-encre-doux)]">
              {cartes.length} carte{cartes.length > 1 ? 's' : ''}
            </span>
            {cartes.length > 1 && (
              <button className="bouton bouton-secondaire py-1 text-xs">Comparer la sélection</button>
            )}
          </div>
        </div>
        {cartes.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[var(--color-encre-doux)]">{vide ?? 'Aucune carte.'}</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-y border-[var(--color-ligne)] bg-[var(--color-fond)] text-left text-xs uppercase tracking-wide text-[var(--color-encre-doux)]">
                  <th className="w-8 px-3 py-2 font-semibold">
                    <span className="sr-only">Comparer</span>
                  </th>
                  <th className="px-2 py-2 font-semibold">#</th>
                  <th className="px-4 py-2 font-semibold">Carte</th>
                  <th className="px-4 py-2 font-semibold">Taps · {jours} j</th>
                  <th className="px-4 py-2 font-semibold">Évolution</th>
                  <th className="px-4 py-2 font-semibold">14 derniers jours</th>
                  <th className="px-4 py-2 text-right font-semibold">Total</th>
                  <th className="px-4 py-2 font-semibold">Dernier tap</th>
                </tr>
              </thead>
              <tbody>
                {classement.map((c, i) => {
                  const p = parCarte[c.id] ?? { courant: 0, precedent: 0 }
                  return (
                    <tr key={c.id} className="border-b border-[var(--color-ligne)] last:border-0 hover:bg-[var(--color-fond)]">
                      <td className="px-3 py-2.5">
                        <input type="checkbox" name="c" value={c.id} aria-label={`Comparer ${c.libelle}`} className="size-4 accent-[var(--color-accent)]" />
                      </td>
                      <td className="chiffre px-2 py-2.5 text-[var(--color-encre-doux)]">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/cartes/${c.id}`} className="font-medium hover:underline">
                          {c.libelle}
                        </Link>
                        <div className="text-xs text-[var(--color-encre-doux)]">
                          {afficherDossier && (
                            <>
                              {c.dossier_id ? (
                                <Link href={`/cartes/dossiers/${c.dossier_id}`} className="hover:underline">
                                  {c.dossier_nom}
                                </Link>
                              ) : (
                                'sans dossier'
                              )}{' '}
                              ·{' '}
                            </>
                          )}
                          <span className="chiffre">{c.code}</span>
                          {!c.actif && (
                            <span className="ml-1.5 rounded bg-[var(--color-fond)] px-1.5 py-0.5 font-semibold">désactivée</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="chiffre w-10 text-right font-semibold">{nombreFr.format(p.courant)}</span>
                          <span className="h-2 w-28 overflow-hidden rounded-r bg-[var(--color-grille)]" aria-hidden>
                            <span
                              className="block h-full rounded-r bg-[var(--color-serie-1)]"
                              style={{ width: `${(p.courant / maxPeriode) * 100}%` }}
                            />
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Evolution courant={p.courant} precedent={p.precedent} libelle="" />
                      </td>
                      <td className="px-4 py-2.5">
                        <MiniCourbe serie={courbes[c.id] ?? []} />
                      </td>
                      <td className="chiffre px-4 py-2.5 text-right">{nombreFr.format(c.taps_total)}</td>
                      <td className="px-4 py-2.5 text-[var(--color-encre-doux)]">{depuis(c.dernier_tap)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </form>
    </section>
  )
}
