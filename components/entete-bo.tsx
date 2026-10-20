'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Logo from '@/components/client/logo'
import RafraichissementAuto from '@/components/rafraichissement-auto'
import { EVENEMENT_INSTALLER } from '@/components/installer-app'

const LIENS = [
  ['/transactions', 'Transactions'],
  ['/ventes', 'Factures'],
  ['/commandes', 'Commandes'],
  ['/messages', 'Messages'],
  ['/cartes', 'Cartes'],
  ['/resultats', 'Résultats'],
  ['/taxes', 'Taxes'],
  ['/marge', 'Marge'],
  ['/import', 'Import'],
  ['/associes', 'Associés'],
  ['/export', 'Export'],
] as const

export type Theme = 'tapora' | 'classique'

/**
 * L'en-tête du back-office : verre dépoli collant en haut, page active
 * soulignée, et la bascule de thème (Tapora ↔ classique), retenue dans un
 * cookie pour que le serveur rende directement le bon thème.
 */
export default function EnteteBo({
  nom,
  lecture,
  theme: initial,
  doubleAuth,
  aTraiter = 0,
}: {
  nom: string
  lecture: boolean
  theme: Theme
  doubleAuth: boolean
  /** Messages, demandes Entreprise et demandes de cartes qui attendent : la pastille de « Messages ». */
  aTraiter?: number
}) {
  const chemin = usePathname()
  const [theme, setTheme] = useState<Theme>(initial)

  function basculer() {
    const suivant: Theme = theme === 'tapora' ? 'classique' : 'tapora'
    setTheme(suivant)
    document.documentElement.dataset.theme = suivant
    document.cookie = `tapora_theme=${suivant}; path=/; max-age=31536000; samesite=lax`
  }

  const initiales = nom
    .split(/\s+/)
    .map((m) => m[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="entete-bo print:hidden">
      <div className="mx-auto flex max-w-[88rem] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 xl:flex-nowrap">
        <Link href="/transactions" className="group order-1 flex items-center gap-2.5" aria-label="Tapora, accueil du back-office">
          {theme === 'tapora' ? (
            <Logo className="size-8 transition-transform duration-500 group-hover:rotate-[20deg]" />
          ) : (
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-accent)] text-sm font-bold text-white">T</span>
          )}
          <span className={theme === 'tapora' ? 'font-[family-name:var(--police-fraunces)] text-xl font-semibold tracking-tight' : 'text-sm font-bold tracking-tight'}>
            Tapora
          </span>
        </Link>

        <nav className="order-3 -mx-1 flex w-full max-w-full gap-0.5 overflow-x-auto xl:order-2 xl:w-auto" aria-label="Sections">
          {LIENS.map(([href, libelle]) => {
            const actif = chemin === href || chemin.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                aria-current={actif ? 'page' : undefined}
                className="lien-bo shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium 2xl:px-2.5 text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]"
              >
                {libelle}
                {href === '/messages' && aTraiter > 0 && (
                  <span className="ml-1 inline-grid min-w-[1.15rem] place-items-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-bold leading-[1.15rem] text-white" aria-label={`${aTraiter} à traiter`}>
                    {aTraiter > 99 ? '99+' : aTraiter}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="order-2 ml-auto flex shrink-0 items-center gap-1.5 xl:order-3">
          <span className="hidden sm:inline-flex">
            <RafraichissementAuto />
          </span>
          <Link href="/etat" className="lien-bo hidden rounded-md px-2 py-1 text-xs font-medium text-[var(--color-encre-doux)] sm:inline-block">
            État
          </Link>
          <Link href="/aide" aria-current={chemin.startsWith('/aide') ? 'page' : undefined} className="lien-bo rounded-md px-2 py-1 text-xs font-medium text-[var(--color-encre-doux)]">
            Aide
          </Link>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(EVENEMENT_INSTALLER))}
            className="bouton-installer lien-bo size-8 place-items-center rounded-full text-[var(--color-encre-doux)]"
            title="Installer l’app sur ce téléphone"
            aria-label="Installer l’app sur ce téléphone"
          >
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
              <path d="M12 8v6M9.5 11.5 12 14l2.5-2.5M10.5 18.5h3" />
            </svg>
          </button>
          <button
            type="button"
            onClick={basculer}
            className="lien-bo grid size-8 place-items-center rounded-full text-[var(--color-encre-doux)]"
            title={theme === 'tapora' ? 'Passer au thème classique' : 'Passer au thème Tapora'}
            aria-label={theme === 'tapora' ? 'Passer au thème classique' : 'Passer au thème Tapora'}
          >
            {theme === 'tapora' ? (
              <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path d="M4 9h16M9 9v11" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" strokeWidth="2.2" strokeLinecap="round">
                <path d="M7 17a5 5 0 0 1 10 0" stroke="#f2d3c4" />
                <path d="M4 17a8 8 0 0 1 16 0" stroke="#e4a53a" />
                <path d="M1.5 17a10.5 10.5 0 0 1 21 0" stroke="#c2552f" />
              </svg>
            )}
          </button>
          <Link
            href="/compte/securite"
            className="lien-bo flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-medium text-[var(--color-encre-doux)]"
            title={doubleAuth ? 'Double authentification activée' : 'Double authentification désactivée'}
          >
            <span className="relative grid size-7 place-items-center rounded-full bg-[var(--color-accent-doux)] text-[11px] font-bold text-[var(--color-accent)]">
              {initiales}
              <span
                className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[var(--color-fond)] ${doubleAuth ? 'bg-[var(--color-positif)]' : 'bg-[var(--color-attention)]'}`}
              />
            </span>
            <span className="hidden lg:inline">
              {nom}
              {lecture && ' · lecture'}
            </span>
          </Link>
          <form action="/connexion/sortie" method="post">
            <button className="lien-bo rounded-md px-2 py-1 text-xs font-medium text-[var(--color-encre-doux)]" title="Fermer la session">
              Sortir
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
