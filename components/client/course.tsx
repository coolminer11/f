import type { LigneCourse } from '@/lib/requetes/profil'
import { locale, type Langue } from '@/lib/langue'

const TX = {
  fr: {
    titre: 'La course des cartes',
    sous: (j: number) => `Taps depuis lundi · remise à zéro ${j <= 1 ? 'demain' : `dans ${j} jours`}`,
    mene: (c: string) => `« ${c} » mène la course !`,
    egalite: 'Égalité en tête : tout se joue maintenant !',
    depart: 'Nouvelle semaine, compteurs à zéro : qui prendra la tête ?',
    champion: 'Gagnante de la semaine dernière',
    taps: 'taps',
    ecart: (n: number, c: string) => `${n} tap${n > 1 ? 's' : ''} devant « ${c} »`,
  },
  en: {
    titre: 'The card race',
    sous: (j: number) => `Taps since Monday · resets ${j <= 1 ? 'tomorrow' : `in ${j} days`}`,
    mene: (c: string) => `“${c}” leads the race!`,
    egalite: 'Tied at the top: it all comes down to now!',
    depart: 'New week, counters at zero: who will take the lead?',
    champion: 'Last week’s winner',
    taps: 'taps',
    ecart: (n: number, c: string) => `${n} tap${n > 1 ? 's' : ''} ahead of “${c}”`,
  },
}

const PLACES = ['🥇', '🥈', '🥉']
// Podium : 2e à gauche, 1re au centre, 3e à droite.
const ORDRE_PODIUM = [1, 0, 2]
const HAUTEURS = [100, 72, 52]

/**
 * La course de la semaine entre les cartes d'un même commerce (seulement
 * s'il y en a au moins deux). Remise à zéro chaque lundi : tout le monde a sa
 * chance, et le gagnant de la semaine passée garde son badge.
 */
export default function Course({ lignes, langue, joursAvantLundi }: { lignes: LigneCourse[]; langue: Langue; joursAvantLundi: number }) {
  if (lignes.length < 2) return null
  const T = TX[langue]
  const nf = new Intl.NumberFormat(locale(langue))
  const champion = [...lignes].sort((a, b) => b.precedente - a.precedente)[0]
  const aChampion = champion.precedente > 0 && lignes.filter((l) => l.precedente === champion.precedente).length === 1
  const [a, b] = lignes
  const message = a.semaine === 0 ? T.depart : a.semaine === b.semaine ? T.egalite : T.mene(a.libelle)
  const podium = lignes.slice(0, 3)
  const reste = lignes.slice(3)
  const max = Math.max(1, a.semaine)

  return (
    <section className="carte p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2>{T.titre}</h2>
          <p className="mt-0.5 text-sm text-[var(--cl-doux)]">{T.sous(joursAvantLundi)}</p>
        </div>
        <p className="text-sm font-semibold text-[var(--cl-brique)]">{message}</p>
      </div>

      <div className="mt-6 grid grid-cols-3 items-end gap-3 sm:mx-auto sm:max-w-xl">
        {ORDRE_PODIUM.filter((i) => podium[i]).map((i) => {
          const l = podium[i]
          return (
            <div key={l.id} className="flex min-w-0 flex-col items-center text-center">
              <span className="text-3xl" aria-hidden>
                {PLACES[i]}
              </span>
              <p className="mt-1 w-full truncate text-sm font-semibold" title={l.libelle}>
                {l.libelle}
              </p>
              <p className="titre-client text-2xl font-medium tabular-nums">
                <span data-compteur={l.semaine}>{nf.format(l.semaine)}</span>
              </p>
              {aChampion && champion.id === l.id && (
                <span className="mt-1 rounded-full bg-[var(--cl-miel-pale)] px-2 py-0.5 text-[11px] font-medium text-[var(--cl-miel-texte)]">👑 {T.champion}</span>
              )}
              <div
                className={`barre-graphique mt-2 w-full rounded-t-2xl ${i === 0 ? 'bg-gradient-to-b from-[var(--cl-brique-clair)] to-[var(--cl-brique)]' : i === 1 ? 'bg-[#e8b394]' : 'bg-[var(--cl-rose-pale)]'}`}
                style={{ height: `${HAUTEURS[i]}px` }}
                aria-hidden
              />
            </div>
          )
        })}
      </div>

      {reste.length > 0 && (
        <ul className="mt-5 space-y-2.5 border-t border-dashed border-[var(--cl-ligne)] pt-4">
          {reste.map((l, k) => (
            <li key={l.id} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,40%)_auto] items-center gap-3 text-sm">
              <span className="text-center font-semibold text-[var(--cl-doux)]">{k + 4}</span>
              <span className="truncate font-medium">
                {l.libelle}
                {aChampion && champion.id === l.id && ' 👑'}
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-[var(--cl-ligne-douce)]" aria-hidden>
                <span data-jauge className="block h-full rounded-full bg-[#e8b394]" style={{ width: `${(l.semaine / max) * 100}%` }} />
              </span>
              <span className="text-right font-semibold tabular-nums">{nf.format(l.semaine)}</span>
            </li>
          ))}
        </ul>
      )}
      {a.semaine > b.semaine && <p className="mt-4 text-center text-xs text-[var(--cl-doux)]">{T.ecart(a.semaine - b.semaine, b.libelle)}</p>}
    </section>
  )
}
