import { prochainesNotes } from '@/lib/note-google'
import { locale, type Langue } from '@/lib/langue'

const TX = {
  fr: {
    titre: 'Votre prochaine étoile',
    pour: (n: string) => `pour passer à ${n} ★`,
    environ: 'avis 5 ★',
    exact: (n: number) => `Exactement ${n} avis 5 ★, calculé au chiffre près.`,
    fourchette: (garanti: number, des: number) => `Garanti avec ${garanti} · peut-être dès ${des}`,
    ensuite: (n: string, k: number) => `Ensuite : ${n} ★ avec ≈ ${k} avis 5 ★ de plus`,
    pourquoi: (a: string, b: string) =>
      `Google n’affiche qu’une décimale : votre vraie moyenne se cache entre ${a} et ${b}. D’où la fourchette — le chiffre « garanti » l’est dans tous les cas.`,
    parfaite: 'Note parfaite',
    parfaiteSous: 'Chaque nouvel avis 5 ★ la protège. Continuez de présenter la carte à chaque client.',
    actuelle: 'aujourd’hui',
  },
  en: {
    titre: 'Your next star',
    pour: (n: string) => `to reach ${n} ★`,
    environ: 'five-star reviews',
    exact: (n: number) => `Exactly ${n} five-star reviews, calculated to the unit.`,
    fourchette: (garanti: number, des: number) => `Guaranteed with ${garanti} · maybe as few as ${des}`,
    ensuite: (n: string, k: number) => `Then: ${n} ★ with ≈ ${k} more five-star reviews`,
    pourquoi: (a: string, b: string) =>
      `Google shows only one decimal: your true average hides between ${a} and ${b}. Hence the range — the “guaranteed” number holds in every case.`,
    parfaite: 'Perfect rating',
    parfaiteSous: 'Every new five-star review protects it. Keep showing the card to every customer.',
    actuelle: 'today',
  },
}

/**
 * Combien d'avis 5 ★ pour la note suivante — calcul exact (lib/note-google.ts),
 * présenté honnêtement : une estimation, un chiffre garanti, et pourquoi.
 */
export default function ProchaineEtoile({ nb, note, langue }: { nb: number; note: number; langue: Langue }) {
  const T = TX[langue]
  const loc = locale(langue)
  const dec = (x: number) => x.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 2 })
  const etapes = prochainesNotes(nb, note, 2)
  const actuelle = dec(Math.round(note * 10) / 10)

  if (Math.round(note * 10) >= 50) {
    return (
      <section className="carte flex flex-col justify-center p-6 sm:p-7">
        <Etoiles valeur={5} />
        <h2 className="titre-client mt-3 !text-3xl">{dec(5)} ★ · {T.parfaite}</h2>
        <p className="mt-2 text-[#6b5d50]">{T.parfaiteSous}</p>
      </section>
    )
  }
  const e = etapes[0]
  if (!e) return null
  const cible = dec(e.cible / 10)
  const r = Math.round(note * 10)

  return (
    <section className="carte p-6 sm:p-7">
      <h2>{T.titre}</h2>
      <div className="mt-4 flex items-center gap-3 text-2xl">
        <span className="titre-client font-medium tabular-nums text-[#6b5d50]">{actuelle} ★</span>
        <svg viewBox="0 0 40 12" className="h-3 w-10 text-[#c2552f]" aria-hidden>
          <path data-fleche d="M1 6h34M30 1l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="titre-client font-medium tabular-nums text-[#c2552f]">{cible} ★</span>
      </div>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="titre-client text-6xl font-medium leading-none tabular-nums">
          {e.auMoins === e.auPlus ? '' : '≈ '}
          <span data-compteur={e.estimation}>{e.estimation}</span>
        </span>
        <span className="text-[#6b5d50]">{T.environ}</span>
      </p>
      <p className="mt-1 text-sm text-[#6b5d50]">{T.pour(cible)}</p>
      <p className="mt-3 text-sm font-medium">{e.auMoins === e.auPlus ? T.exact(e.auPlus) : T.fourchette(e.auPlus, e.auMoins)}</p>
      {etapes[1] && <p className="mt-1 text-sm text-[#6b5d50]">{T.ensuite(dec(etapes[1].cible / 10), etapes[1].estimation)}</p>}
      {e.auMoins !== e.auPlus && (
        <p className="mt-4 border-t border-dashed border-[#e2d6c3] pt-3 text-xs leading-relaxed text-[#6b5d50]">
          {T.pourquoi(dec((r * 10 - 5) / 100), dec((r * 10 + 5) / 100))}
        </p>
      )}
    </section>
  )
}

function Etoiles({ valeur }: { valeur: number }) {
  return (
    <span className="text-2xl tracking-[0.15em] text-[#eda100]" aria-hidden>
      {'★★★★★'.slice(0, valeur)}
    </span>
  )
}
