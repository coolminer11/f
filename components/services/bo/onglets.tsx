'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type Onglet = { href: string; libelle: string; compte?: number | null; alerte?: boolean }

/** Les onglets de la console d'un établissement ; l'actif suit l'adresse. */
export default function OngletsService({ base, onglets }: { base: string; onglets: Onglet[] }) {
  const chemin = usePathname()
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-[var(--color-ligne)] print:hidden" aria-label="Sections de l’établissement">
      {onglets.map((o) => {
        const actif = o.href === base ? chemin === base : chemin.startsWith(o.href)
        return (
          <Link
            key={o.href}
            href={o.href}
            aria-current={actif ? 'page' : undefined}
            className={`-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              actif ? 'border-[var(--color-accent)] text-[var(--color-encre)]' : 'border-transparent text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]'
            }`}
          >
            {o.libelle}
            {o.compte != null && o.compte > 0 && (
              <span
                className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                  o.alerte ? 'bg-[var(--color-attention)] text-white' : 'bg-[var(--color-fond)] text-[var(--color-encre-doux)]'
                }`}
              >
                {o.compte}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
