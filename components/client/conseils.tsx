import type { Conseil } from '@/lib/conseils'
import type { Langue } from '@/lib/langue'

const TX = {
  fr: { titre: 'Vos conseils de la semaine', sous: 'Tirés de vos propres chiffres, pour plus de taps et plus d’avis.' },
  en: { titre: 'Your tips this week', sous: 'Drawn from your own numbers, for more taps and more reviews.' },
}

export default function Conseils({ liste, langue }: { liste: Conseil[]; langue: Langue }) {
  if (!liste.length) return null
  const T = TX[langue]
  return (
    <section className="carte p-6 sm:p-7">
      <h2>{T.titre}</h2>
      <p className="mt-0.5 text-sm text-[#6b5d50]">{T.sous}</p>
      <ul className="mt-5 space-y-3">
        {liste.map((c, i) => (
          <li key={c.id} data-etape className="flex gap-4 rounded-2xl bg-[#f8f1e6] p-4">
            <span className={`grid size-11 shrink-0 place-items-center rounded-2xl text-xl ${i === 0 ? 'bg-[#c2552f]/12' : 'bg-[#fffaf2]'}`} aria-hidden>
              {c.emoji}
            </span>
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{c.titre}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#6b5d50]">{c.texte}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
