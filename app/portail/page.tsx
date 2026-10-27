import type { Metadata, Viewport } from 'next'
import { langueValide } from '@/lib/langue'
import CadreClient from '@/components/client/cadre-client'
import BasculeMode from '@/components/client/bascule-mode'
import AccesPortail from '@/components/client/acces-portail'
import { ApercuVivant, RetourPortail } from '@/components/client/portail-anime'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Espace client — Tapora',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f1e7' },
    { media: '(prefers-color-scheme: dark)', color: '#15100c' },
  ],
}

const T = {
  fr: {
    surtitre: 'Espace client',
    titre: 'Votre portail Tapora',
    sous: 'Vos statistiques en direct, vos commandes, votre maquette à approuver et une ligne directe avec nous, au même endroit.',
    comment: 'Entrez le courriel que vous nous avez donné : on vous envoie le lien de votre espace. Si votre page est protégée, votre mot de passe vous sera demandé.',
    points: ['Statistiques carte par carte, par groupe', 'Suivi de commande et maquette à approuver', 'Messages directs avec Tapora'],
    autre: 'English',
  },
  en: {
    surtitre: 'Client area',
    titre: 'Your Tapora portal',
    sous: 'Your live stats, your orders, your design to approve and a direct line to us, all in one place.',
    comment: 'Enter the email you gave us: we’ll send you the link to your area. If your page is protected, you’ll be asked for your password.',
    points: ['Card-by-card stats, by group', 'Order tracking and design approval', 'Direct messages with Tapora'],
    autre: 'Français',
  },
}

/** Le sceau soleil, qui se dessine à l'arrivée (arcs tracés, étoile qui se lève). */
function SceauAnime() {
  return (
    <svg viewBox="0 0 100 100" className="portail-sceau size-11" aria-hidden>
      <circle className="portail-sceau-disque" cx="50" cy="50" r="49" fill="#c2552f" />
      <g transform="translate(50 50) scale(.92) translate(-50 -54)">
        <g fill="none" strokeWidth="6" strokeLinecap="round">
          <path className="portail-arc" style={{ '--i': 0 } as React.CSSProperties} pathLength={1} d="M30.5 64A19.5 19.5 0 0 1 69.5 64" stroke="#f2d3c4" />
          <path className="portail-arc" style={{ '--i': 1 } as React.CSSProperties} pathLength={1} d="M21.5 64A28.5 28.5 0 0 1 78.5 64" stroke="#e4a53a" />
          <path className="portail-arc" style={{ '--i': 2 } as React.CSSProperties} pathLength={1} d="M12.5 64A37.5 37.5 0 0 1 87.5 64" stroke="#fffaf2" />
        </g>
        <polygon
          className="portail-etoile"
          points="50,51.9 52.48,58.08 59.13,58.53 54.02,62.81 55.64,69.27 50,65.72 44.36,69.27 45.98,62.81 40.87,58.53 47.52,58.08"
          fill="#fffaf2"
          stroke="#fffaf2"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

/**
 * L'entrée du portail des entreprises (lien « Espace client » du site).
 * Pas de compte à créer : le lien privé de chaque client est envoyé à
 * l'adresse connue de son dossier, et son mot de passe (s'il en a un)
 * reste exigé sur la page. Un client déjà venu sur cet appareil voit
 * « Bon retour, <nom> » et rentre en un tap.
 */
export default async function PagePortail({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const langue = langueValide((await searchParams).l) ?? 'fr'
  const X = T[langue]
  const mots = X.titre.split(' ')
  return (
    <CadreClient lang={langue === 'fr' ? 'fr-CA' : 'en-CA'}>
      <div className="portail-scene">
        <div className="portail-aurore" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <main className="relative mx-auto grid min-h-[86vh] max-w-5xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="portail-entre flex items-center justify-between gap-3" style={{ '--d': '0s' } as React.CSSProperties}>
              <a href="https://taporacards.com" className="flex items-center gap-2.5" aria-label="Tapora Cards">
                <SceauAnime />
                <span className="titre-client text-xl font-semibold">Tapora</span>
              </a>
              <BasculeMode langue={langue} />
            </div>
            <p className="portail-entre mt-12 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cl-brique)]" style={{ '--d': '.35s' } as React.CSSProperties}>
              {X.surtitre}
            </p>
            <h1 className="titre-client mt-3 text-5xl font-medium leading-[1.05] sm:text-6xl">
              {mots.map((m, i) => (
                <span key={i}>
                  {i > 0 && ' '}
                  <span className="portail-masque">
                    <span className="portail-mot" style={{ '--d': `${0.45 + i * 0.09}s` } as React.CSSProperties}>
                      {i === mots.length - 1 ? <span className="portail-dernier">{m}</span> : m}
                    </span>
                  </span>
                </span>
              ))}
            </h1>
            <p className="portail-entre mt-5 max-w-md text-lg text-[var(--cl-doux)]" style={{ '--d': '.85s' } as React.CSSProperties}>
              {X.sous}
            </p>
            <ul className="mt-7 space-y-2.5 text-[15px]">
              {X.points.map((p, i) => (
                <li key={p} className="portail-point flex items-center gap-3" style={{ '--d': `${1.05 + i * 0.12}s` } as React.CSSProperties}>
                  <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-[var(--cl-sapin)]" aria-hidden>
                    <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12" />
                    <path className="portail-coche" pathLength={1} d="M7 12.5l3.2 3.2L17 8.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {p}
                </li>
              ))}
            </ul>
            <ApercuVivant langue={langue} />
          </div>
          <div className="portail-carte carte p-7 sm:p-9">
            <div className="portail-lueur" aria-hidden />
            <RetourPortail langue={langue} />
            <p className="text-[var(--cl-doux)]">{X.comment}</p>
            <div className="mt-6">
              <AccesPortail langue={langue} />
            </div>
            <p className="mt-6 text-right text-xs">
              <a href={`/portail?l=${langue === 'fr' ? 'en' : 'fr'}`} className="font-semibold text-[var(--cl-doux)] hover:text-[var(--cl-encre)]">
                {X.autre}
              </a>
            </p>
          </div>
        </main>
      </div>
    </CadreClient>
  )
}
