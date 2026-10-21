import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import EnteteBo, { type Theme } from '@/components/entete-bo'
import InstallerApp from '@/components/installer-app'
import BarreChargement from '@/components/barre-chargement'
import Toasts from '@/components/effets/toasts'
import ChromeBo from '@/components/chrome-bo'
import { Suspense } from 'react'
import { utilisateurCourant } from '@/lib/auth'
import { nombreATraiter } from '@/lib/portail'
import { fraunces, inter } from '@/app/stats/polices'
import './globals.css'

/** App installable : le manifeste n'est annoncé qu'aux associés connectés
 *  (et sur la page de connexion), jamais aux clients ni sur leurs documents. */
export async function generateMetadata(): Promise<Metadata> {
  const connecte = (await utilisateurCourant()) !== null
  return {
    title: 'Tapora — Back-office',
    description: 'Gestion des dépenses, des profits et des comptes d’associés',
    ...(connecte
      ? {
          manifest: '/bo-manifeste',
          icons: { apple: '/icones/apple-touch-icon.png' },
          appleWebApp: { capable: true, title: 'Tapora', statusBarStyle: 'default' as const },
        }
      : {}),
  }
}

export const viewport: Viewport = { themeColor: '#f7f1e7', viewportFit: 'cover' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Le nom affiché vient de la session : la page de connexion n'en a pas.
  const utilisateur = await utilisateurCourant()
  // Le thème est rendu par le serveur (cookie) : aucun éclair de l'autre thème.
  // Hors session (connexion, pages publiques), toujours aux couleurs Tapora.
  const theme: Theme = utilisateur && (await cookies()).get('tapora_theme')?.value === 'classique' ? 'classique' : 'tapora'
  const aTraiter = utilisateur?.totp_actif ? await nombreATraiter().catch(() => 0) : 0
  return (
    <html lang="fr-CA" data-theme={theme} className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-screen antialiased">
        {/* Le menu n'existe que pour une session ouverte : les pages publiques
            (connexion, document d'un client, statistiques d'un client) ne
            montrent aucun lien vers le reste du back-office. */}
        {/* Sans double authentification, aucun menu : seule la page Sécurité
            s'ouvre (voir exigerSession), le temps de l'activer. */}
        {utilisateur?.totp_actif && (
          <ChromeBo>
            <Suspense>
              <BarreChargement />
            </Suspense>
            <EnteteBo nom={utilisateur.nom} lecture={utilisateur.role === 'lecture'} theme={theme} doubleAuth={utilisateur.totp_actif} aTraiter={aTraiter} proprietaire={utilisateur.proprietaire_logiciel} />
          </ChromeBo>
        )}
        <main className={`mx-auto max-w-6xl px-4 py-6 ${utilisateur ? 'bo-page' : ''}`}>{children}</main>
        {utilisateur?.totp_actif && (
          <ChromeBo>
            <InstallerApp />
            <Toasts />
          </ChromeBo>
        )}
      </body>
    </html>
  )
}
