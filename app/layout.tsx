import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import EnteteBo, { type Theme } from '@/components/entete-bo'
import { utilisateurCourant } from '@/lib/auth'
import { fraunces, inter } from '@/app/stats/polices'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tapora — Back-office',
  description: 'Gestion des dépenses, des profits et des comptes d’associés',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Le nom affiché vient de la session : la page de connexion n'en a pas.
  const utilisateur = await utilisateurCourant()
  // Le thème est rendu par le serveur (cookie) : aucun éclair de l'autre thème.
  // Hors session (connexion, pages publiques), toujours aux couleurs Tapora.
  const theme: Theme = utilisateur && (await cookies()).get('tapora_theme')?.value === 'classique' ? 'classique' : 'tapora'
  return (
    <html lang="fr-CA" data-theme={theme} className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-screen antialiased">
        {/* Le menu n'existe que pour une session ouverte : les pages publiques
            (connexion, document d'un client, statistiques d'un client) ne
            montrent aucun lien vers le reste du back-office. */}
        {utilisateur && (
          <EnteteBo nom={utilisateur.nom} lecture={utilisateur.role === 'lecture'} theme={theme} doubleAuth={utilisateur.totp_actif} />
        )}
        {utilisateur && !utilisateur.totp_actif && (
          <div className="mx-auto max-w-6xl px-4 pt-4 print:hidden">
            <div className="bandeau-2fa flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-white" aria-hidden>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <strong className="font-semibold">Protégez votre compte.</strong>{' '}
                <span className="hidden text-[var(--color-encre-doux)] sm:inline">Activez la double authentification : même avec votre mot de passe, personne n’entre sans votre téléphone.</span>
                <span className="text-[var(--color-encre-doux)] sm:hidden">Activez la double authentification.</span>
              </span>
              <Link href="/compte/securite#double-auth" className="bouton shrink-0 !py-1.5 text-xs">
                Activer (2 min)
              </Link>
            </div>
          </div>
        )}
        <main className={`mx-auto max-w-6xl px-4 py-6 ${utilisateur ? 'bo-page' : ''}`}>{children}</main>
      </body>
    </html>
  )
}
