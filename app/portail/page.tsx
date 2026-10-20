import type { Metadata, Viewport } from 'next'
import { langueValide } from '@/lib/langue'
import { fraunces, inter } from '@/app/stats/polices'
import Logo from '@/components/client/logo'
import AccesPortail from '@/components/client/acces-portail'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Espace client — Tapora',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}
export const viewport: Viewport = { themeColor: '#f7f1e7' }

const T = {
  fr: {
    surtitre: 'Espace client',
    titre: 'Votre portail Tapora',
    sous: 'Vos statistiques en direct, vos commandes, votre maquette à approuver et une ligne directe avec nous — au même endroit.',
    comment: 'Entrez le courriel que vous nous avez donné : on vous envoie le lien de votre espace. Si votre page est protégée, votre mot de passe vous sera demandé.',
    points: ['Statistiques carte par carte, par groupe', 'Suivi de commande et maquette à approuver', 'Messages directs avec Tapora'],
    autre: 'English',
  },
  en: {
    surtitre: 'Client area',
    titre: 'Your Tapora portal',
    sous: 'Your live stats, your orders, your design to approve and a direct line to us — all in one place.',
    comment: 'Enter the email you gave us: we’ll send you the link to your area. If your page is protected, you’ll be asked for your password.',
    points: ['Card-by-card stats, by group', 'Order tracking and design approval', 'Direct messages with Tapora'],
    autre: 'Français',
  },
}

/**
 * L'entrée du portail des entreprises (lien « Espace client » du site).
 * Pas de compte à créer : le lien privé de chaque client est envoyé à
 * l'adresse connue de son dossier, et son mot de passe (s'il en a un)
 * reste exigé sur la page.
 */
export default async function PagePortail({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const langue = langueValide((await searchParams).l) ?? 'fr'
  const X = T[langue]
  return (
    <div className={`${fraunces.variable} ${inter.variable} theme-client`} lang={langue === 'fr' ? 'fr-CA' : 'en-CA'}>
      <main className="mx-auto grid min-h-[85vh] max-w-5xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <a href="https://taporacards.com" className="flex items-center gap-2.5" aria-label="Tapora Cards">
            <Logo />
            <span className="titre-client text-xl font-semibold">Tapora</span>
          </a>
          <p className="mt-12 text-xs font-semibold uppercase tracking-[0.2em] text-[#c2552f]">{X.surtitre}</p>
          <h1 className="titre-client mt-3 text-5xl font-medium leading-[1.05]">{X.titre}</h1>
          <p className="mt-4 max-w-md text-lg text-[#6b5d50]">{X.sous}</p>
          <ul className="mt-6 space-y-2 text-[15px]">
            {X.points.map((p) => (
              <li key={p} className="flex gap-2.5">
                <span className="text-[#2f6b4f]" aria-hidden>
                  ✓
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="carte p-7 sm:p-9">
          <p className="text-[#6b5d50]">{X.comment}</p>
          <div className="mt-6">
            <AccesPortail langue={langue} />
          </div>
          <p className="mt-6 text-right text-xs">
            <a href={`/portail?l=${langue === 'fr' ? 'en' : 'fr'}`} className="font-semibold text-[#6b5d50] hover:text-[#2a211a]">
              {X.autre}
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
