import Link from 'next/link'
import { exigerSession } from '@/lib/auth'
import { carte, seriesParCarte, type Carte } from '@/lib/requetes/cartes'
import { GraphiqueLignes, type Serie } from '@/components/graphiques'
import SelecteurJours, { joursDepuis } from '@/components/selecteur-jours'
import { nombreFr } from '@/components/tuiles-cartes'

export const dynamic = 'force-dynamic'

const MAX = 4

function dateCourte(d: Date): string {
  return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', timeZone: 'America/Toronto' })
}
function dateLongue(d: Date): string {
  return d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Toronto' })
}

/** Deux à quatre cartes sur une même échelle : comptoir contre table, A contre B. */
export default async function Comparer({ searchParams }: { searchParams: Promise<{ c?: string | string[]; p?: string }> }) {
  await exigerSession()
  const sp = await searchParams
  const jours = joursDepuis(sp.p)
  const ids = [...new Set([sp.c ?? []].flat())].slice(0, MAX)
  const cartes = (await Promise.all(ids.map((id) => carte(id)))).filter(Boolean) as Carte[]
  const series = await seriesParCarte(cartes.map((c) => c.id), jours)

  // L'axe : les mêmes jours pour toutes les séries (aujourd'hui inclus).
  const aujourdhui = new Date()
  const dates = Array.from({ length: jours }, (_, i) => new Date(aujourdhui.getTime() - (jours - 1 - i) * 86_400_000))
  const donnees: Serie[] = cartes.map((c, i) => ({
    nom: c.libelle,
    slot: (i + 1) as Serie['slot'],
    valeurs: series[c.id] ?? Array(jours).fill(0),
  }))
  const extra = cartes.map((c) => `&c=${c.id}`).join('')

  return (
    <div className="space-y-5">
      <div>
        <Link href="/cartes" className="text-sm text-[var(--color-encre-doux)] hover:underline">
          ← Cartes NFC
        </Link>
        <h1 className="mt-1 text-lg font-bold tracking-tight">Comparer des cartes</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          Cochez de deux à quatre cartes dans un classement, puis « Comparer la sélection ».
        </p>
      </div>

      {cartes.length < 2 ? (
        <p className="carte px-4 py-6 text-center text-sm text-[var(--color-encre-doux)]">
          Sélectionnez au moins deux cartes à comparer.{' '}
          <Link href="/cartes" className="font-semibold text-[var(--color-accent)] hover:underline">
            Retour au classement
          </Link>
        </p>
      ) : (
        <>
          {ids.length > cartes.length || [sp.c ?? []].flat().length > MAX ? (
            <p className="text-xs text-[var(--color-encre-doux)]">Au plus {MAX} cartes à la fois : les suivantes sont ignorées.</p>
          ) : null}
          <SelecteurJours chemin="/cartes/comparer" jours={jours} extra={extra} />

          <section className="carte p-5">
            <h2 className="text-sm font-semibold">Taps par jour</h2>
            <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">{jours} derniers jours, heure du Québec</p>
            <div className="mt-4">
              <GraphiqueLignes
                series={donnees}
                etiquettes={dates.map(dateCourte)}
                details={dates.map(dateLongue)}
                hauteur={220}
                resume={`Comparaison des taps par jour de ${cartes.map((c) => c.libelle).join(', ')}.`}
              />
            </div>
          </section>

          <section className="carte overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-ligne)] bg-[var(--color-fond)] text-left text-xs uppercase tracking-wide text-[var(--color-encre-doux)]">
                  <th className="px-4 py-2 font-semibold">Carte</th>
                  <th className="px-4 py-2 text-right font-semibold">Taps · {jours} j</th>
                  <th className="px-4 py-2 text-right font-semibold">Moyenne / jour</th>
                  <th className="px-4 py-2 text-right font-semibold">Meilleur jour</th>
                  <th className="px-4 py-2 text-right font-semibold">Depuis la pose</th>
                </tr>
              </thead>
              <tbody>
                {cartes.map((c, i) => {
                  const v = donnees[i].valeurs
                  const total = v.reduce((a, b) => a + b, 0)
                  return (
                    <tr key={c.id} className="border-b border-[var(--color-ligne)] last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="mr-2 inline-block h-[3px] w-4 rounded-full align-middle" style={{ background: `var(--color-serie-${i + 1})` }} aria-hidden />
                        <Link href={`/cartes/${c.id}`} className="font-medium hover:underline">{c.libelle}</Link>
                        <span className="ml-1.5 text-xs text-[var(--color-encre-doux)]">{c.dossier_nom ?? ''}</span>
                      </td>
                      <td className="chiffre px-4 py-2.5 text-right font-semibold">{nombreFr.format(total)}</td>
                      <td className="chiffre px-4 py-2.5 text-right">{(total / jours).toLocaleString('fr-CA', { maximumFractionDigits: 1 })}</td>
                      <td className="chiffre px-4 py-2.5 text-right">{nombreFr.format(Math.max(0, ...v))}</td>
                      <td className="chiffre px-4 py-2.5 text-right">{nombreFr.format(c.taps_total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}
