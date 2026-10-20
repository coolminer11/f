import Link from 'next/link'

const ONGLETS = [
  ['/commandes', 'Commandes Entreprise'],
  ['/commandes/catalogue', 'Catalogue'],
  ['/cartes/stock', 'Stock'],
] as const

/** Ce qu'on vend : les commandes Entreprise, le catalogue des trois cartes, le stock. */
export default function OngletsVentes({ actif }: { actif: (typeof ONGLETS)[number][0] }) {
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-[var(--color-ligne)] print:hidden" aria-label="Commandes">
      {ONGLETS.map(([href, libelle]) => (
        <Link
          key={href}
          href={href}
          aria-current={href === actif ? 'page' : undefined}
          className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
            href === actif ? 'border-[var(--color-accent)] text-[var(--color-encre)]' : 'border-transparent text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]'
          }`}
        >
          {libelle}
        </Link>
      ))}
    </nav>
  )
}
