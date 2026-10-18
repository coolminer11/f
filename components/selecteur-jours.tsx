import Link from 'next/link'

export const PERIODES = [7, 30, 90] as const

export function joursDepuis(valeur: string | undefined): number {
  const n = Number(valeur)
  return (PERIODES as readonly number[]).includes(n) ? n : 30
}

/** La période, en une rangée au-dessus de tout ce qu'elle filtre. */
export default function SelecteurJours({ chemin, jours, extra = '' }: { chemin: string; jours: number; extra?: string }) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--color-ligne)] bg-white p-0.5 text-sm">
      {PERIODES.map((p) => (
        <Link
          key={p}
          href={`${chemin}?p=${p}${extra}`}
          scroll={false}
          className={`rounded-md px-3 py-1 font-medium ${
            p === jours
              ? 'bg-[var(--color-encre)] text-white'
              : 'text-[var(--color-encre-doux)] hover:bg-[var(--color-fond)]'
          }`}
          aria-current={p === jours ? 'page' : undefined}
        >
          {p} jours
        </Link>
      ))}
    </div>
  )
}
