import type { Langue } from '@/lib/langue'

export type EtapePas = { cle: string; libelle: string; fait: boolean }

const TX = {
  fr: { titre: 'Vos premiers pas', sous: 'Chaque étape franchie, c’est votre carte qui prend sa place.', sur: (a: number, b: number) => `${a} sur ${b}` },
  en: { titre: 'Your first steps', sous: 'Every step you clear is your card finding its place.', sur: (a: number, b: number) => `${a} of ${b}` },
}

/**
 * Les premières victoires, atteignables dès les premiers jours : au lieu de
 * regarder un « 0 avis » décourageant, le commerce coche des étapes. Le
 * parcours disparaît une fois tout franchi.
 */
export default function PremiersPas({ etapes, langue }: { etapes: EtapePas[]; langue: Langue }) {
  const T = TX[langue]
  const faites = etapes.filter((e) => e.fait).length
  const prochaine = etapes.findIndex((e) => !e.fait)
  // La piste se remplit jusqu'à l'étape en cours (« vous êtes ici »).
  const avancement = prochaine === -1 || etapes.length < 2 ? 1 : prochaine / (etapes.length - 1)

  return (
    <section className="carte p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2>{T.titre}</h2>
          <p className="mt-0.5 text-sm text-[var(--cl-doux)]">{T.sous}</p>
        </div>
        <span className="rounded-full bg-[var(--cl-creme)] px-3 py-1 text-sm font-semibold tabular-nums">{T.sur(faites, etapes.length)}</span>
      </div>

      <ol className="relative mt-7 flex flex-col gap-5 sm:grid sm:auto-cols-fr sm:grid-flow-col sm:gap-2">
        {/* La piste : verticale sur mobile, horizontale dès 640 px. */}
        <li role="presentation" aria-hidden className="absolute bottom-5 left-[calc(1.375rem-2px)] top-5 w-1 rounded-full bg-[var(--cl-ligne-douce)] sm:hidden">
          <span data-jauge-v className="block w-full rounded-full bg-[var(--cl-brique)]" style={{ height: `${avancement * 100}%` }} />
        </li>
        <li role="presentation" aria-hidden className="absolute left-[calc(100%/var(--n)/2)] right-[calc(100%/var(--n)/2)] top-[calc(1.375rem-2px)] hidden h-1 rounded-full bg-[var(--cl-ligne-douce)] sm:block" style={{ ['--n' as string]: etapes.length }}>
          <span data-jauge className="block h-full rounded-full bg-[var(--cl-brique)]" style={{ width: `${avancement * 100}%` }} />
        </li>
          {etapes.map((e, i) => {
            const etat = e.fait ? 'fait' : i === prochaine ? 'prochain' : 'avenir'
            return (
              <li key={e.cle} data-etape className="relative flex items-center gap-4 sm:flex-col sm:gap-2.5 sm:text-center">
                <span className={`pas-rond pas-${etat}`} aria-hidden>
                  {e.fait ? '✓' : i + 1}
                </span>
                <span className={`text-sm leading-tight ${e.fait ? 'font-medium' : etat === 'prochain' ? 'font-semibold text-[var(--cl-brique)]' : 'text-[var(--cl-doux)]'}`}>
                  {e.libelle}
                  <span className="sr-only">{e.fait ? ' ✓' : ''}</span>
                </span>
              </li>
            )
          })}
      </ol>
    </section>
  )
}
