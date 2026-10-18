import type { Metadata } from 'next'
import Link from 'next/link'
import RafraichissementAuto from '@/components/rafraichissement-auto'
import { utilisateurCourant } from '@/lib/auth'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tapora — Back-office',
  description: 'Gestion des dépenses, des profits et des comptes d’associés',
}

const LIENS = [
  ['/transactions', 'Transactions'],
  ['/ventes', 'Factures'],
  ['/cartes', 'Cartes'],
  ['/resultats', 'Résultats'],
  ['/taxes', 'Taxes'],
  ['/marge', 'Marge'],
  ['/import', 'Import'],
  ['/associes', 'Associés'],
  ['/export', 'Export'],
  ['/aide', 'Aide'],
] as const

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Le nom affiché vient de la session : la page de connexion n'en a pas.
  const utilisateur = await utilisateurCourant()
  return (
    <html lang="fr-CA">
      <body className="min-h-screen antialiased">
        {/* Le menu n'existe que pour une session ouverte : les pages publiques
            (connexion, document d'un client, statistiques d'un client) ne
            montrent aucun lien vers le reste du back-office. */}
        {utilisateur && (
        <header className="entete-application border-b border-[var(--color-ligne)] bg-white print:hidden">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/transactions" className="text-sm font-bold tracking-tight">
              Tapora <span className="font-normal text-[var(--color-encre-doux)]">S.E.N.C.</span>
            </Link>
            <nav className="-mx-1 flex max-w-full gap-1 overflow-x-auto">
              {LIENS.map(([href, libelle]) => (
                <Link
                  key={href}
                  href={href}
                  className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-encre-doux)] hover:bg-[var(--color-fond)] hover:text-[var(--color-encre)]"
                >
                  {libelle}
                </Link>
              ))}
            </nav>
            {utilisateur && (
              <div className="ml-auto flex items-center gap-3">
                <RafraichissementAuto />
                <Link
                  href="/etat"
                  className="text-xs font-medium text-[var(--color-encre-doux)] hover:underline"
                >
                  État
                </Link>
                <Link
                  href="/compte"
                  className="text-xs font-medium text-[var(--color-encre-doux)] hover:underline"
                >
                  {utilisateur.nom}
                  {utilisateur.role === 'lecture' && ' · lecture seule'}
                </Link>
                <form action="/connexion/sortie" method="post">
                  <button className="text-xs font-medium text-[var(--color-encre-doux)] hover:underline">
                    Fermer la session
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>
        )}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
