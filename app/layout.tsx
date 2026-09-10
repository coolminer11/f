import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tapora — Back-office',
  description: 'Gestion des dépenses, des profits et des comptes d’associés',
}

const LIENS = [
  ['/transactions', 'Transactions'],
  ['/ventes', 'Factures'],
  ['/resultats', 'Résultats'],
  ['/taxes', 'Taxes'],
  ['/marge', 'Marge'],
  ['/import', 'Import'],
  ['/associes', 'Associés'],
] as const

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-CA">
      <body className="min-h-screen antialiased">
        <header className="entete-application border-b border-[var(--color-ligne)] bg-white print:hidden">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/transactions" className="text-sm font-bold tracking-tight">
              Tapora <span className="font-normal text-[var(--color-encre-doux)]">S.E.N.C.</span>
            </Link>
            <nav className="flex gap-1">
              {LIENS.map(([href, libelle]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-encre-doux)] hover:bg-[var(--color-fond)] hover:text-[var(--color-encre)]"
                >
                  {libelle}
                </Link>
              ))}
            </nav>
            <form action="/connexion/sortie" method="post" className="ml-auto">
              <button className="text-xs font-medium text-[var(--color-encre-doux)] hover:underline">
                Fermer la session
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
