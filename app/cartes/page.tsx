import Link from 'next/link'
import { exigerSession } from '@/lib/auth'
import { listerCartes, tapsParCarte, tendances, totaux } from '@/lib/requetes/cartes'
import { baseCartesConfiguree } from '@/lib/cartes-url'
import StatsTaps from '@/components/stats-taps'
import SelecteurJours, { joursDepuis } from '@/components/selecteur-jours'
import { Evolution, MiniCourbe, Tuile, depuis, nombreFr } from '@/components/tuiles-cartes'

export const dynamic = 'force-dynamic'

export default async function PageCartes({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await exigerSession()
  const jours = joursDepuis((await searchParams).p)
  const [cartes, t, parCarte, courbes] = await Promise.all([
    listerCartes(),
    totaux(null, jours),
    tapsParCarte(jours),
    tendances(14),
  ])

  const actives = cartes.filter((c) => c.actif)
  const moyenne = actives.length ? Math.round(t.courant / actives.length) : 0
  const partQr = t.courant ? Math.round((t.qr / t.courant) * 100) : 0
  const classement = [...cartes].sort(
    (a, b) => (parCarte[b.id]?.courant ?? 0) - (parCarte[a.id]?.courant ?? 0) || b.taps_total - a.taps_total,
  )
  const maxPeriode = Math.max(1, ...classement.map((c) => parCarte[c.id]?.courant ?? 0))
  const libellePeriode = `vs ${jours} j précédents`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Cartes NFC</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            Chaque carte redirige vers la page de son client — et chaque tap est compté.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/cartes/direct" className="bouton bouton-secondaire">
            <span className="mr-1.5 inline-block size-2 rounded-full bg-[#0ca30c] align-middle" aria-hidden />
            En direct
          </Link>
          <Link href="/cartes/nouvelle" className="bouton">
            Nouvelle carte
          </Link>
        </div>
      </div>

      {!baseCartesConfiguree() && (
        <p className="carte border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Ne programmez encore aucune puce.</strong> L’adresse des cartes n’est pas
          configurée (variable <code>URL_CARTES</code>, par exemple{' '}
          <code>https://go.taporacards.com</code>). Une puce écrite avec l’adresse actuelle de
          l’hébergeur cesserait de marcher le jour où il change — et elle ne se reprogramme pas
          chez le client.
        </p>
      )}

      <SelecteurJours chemin="/cartes" jours={jours} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="carte p-4 sm:col-span-2 lg:col-span-1 lg:row-span-1">
          <div className="text-xs font-medium text-[var(--color-encre-doux)]">Taps, {jours} derniers jours</div>
          <div className="mt-1 text-5xl font-semibold tracking-tight" style={{ fontVariantNumeric: 'proportional-nums' }}>
            {nombreFr.format(t.courant)}
          </div>
          <div className="mt-1.5">
            <Evolution courant={t.courant} precedent={t.precedent} libelle={libellePeriode} />
          </div>
        </div>
        <Tuile
          libelle="Cartes actives"
          valeur={`${actives.length}`}
          sous={
            <span className="text-xs text-[var(--color-encre-doux)]">
              {t.cartes_tapees} utilisée{t.cartes_tapees > 1 ? 's' : ''} sur la période
            </span>
          }
        />
        <Tuile
          libelle="Moyenne par carte active"
          valeur={nombreFr.format(moyenne)}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">taps sur {jours} jours</span>}
        />
        <Tuile
          libelle="Dernier tap"
          valeur={depuis(t.dernier_tap)}
          sous={
            <span className="text-xs text-[var(--color-encre-doux)]">
              {partQr} % par code QR sur la période
            </span>
          }
        />
      </div>

      <StatsTaps carteId={null} jours={jours} totaux={t} />

      <section className="carte overflow-hidden">
        <div className="flex items-baseline justify-between px-5 pt-4">
          <h2 className="text-sm font-semibold">Classement des cartes</h2>
          <span className="text-xs text-[var(--color-encre-doux)]">{cartes.length} carte{cartes.length > 1 ? 's' : ''}</span>
        </div>
        {cartes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-encre-doux)]">
            Aucune carte pour l’instant.{' '}
            <Link href="/cartes/nouvelle" className="font-semibold text-[var(--color-accent)] hover:underline">
              Créer la première
            </Link>
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-y border-[var(--color-ligne)] bg-[var(--color-fond)] text-left text-xs uppercase tracking-wide text-[var(--color-encre-doux)]">
                  <th className="px-4 py-2 font-semibold">#</th>
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
                      <td className="chiffre px-4 py-2.5 text-[var(--color-encre-doux)]">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/cartes/${c.id}`} className="font-medium hover:underline">
                          {c.libelle}
                        </Link>
                        <div className="text-xs text-[var(--color-encre-doux)]">
                          {c.client_nom ?? 'sans client'} · <span className="chiffre">{c.code}</span>
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
      </section>
    </div>
  )
}
