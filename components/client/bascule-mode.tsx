'use client'

import { useEffect, useState } from 'react'
import type { Langue } from '@/lib/langue'

type Mode = 'clair' | 'sombre'
const lire = (): Mode => (document.querySelector('.theme-client')?.getAttribute('data-mode') === 'sombre' ? 'sombre' : 'clair')

function appliquer(mode: Mode, auto = false) {
  document.querySelectorAll('.theme-client').forEach((e) => {
    e.setAttribute('data-mode', mode)
    if (auto) e.setAttribute('data-auto', '1')
    else e.removeAttribute('data-auto')
  })
}

/**
 * Soleil ou lune : le client choisit son mode, retenu un an (cookie). Le
 * passage se fait en cercle qui s'ouvre depuis le bouton (View Transitions),
 * ou en fondu doux sur les navigateurs qui ne l'ont pas.
 */
export default function BasculeMode({ langue, className = '' }: { langue: Langue; className?: string }) {
  const [mode, setMode] = useState<Mode>('clair')

  useEffect(() => {
    setMode(lire())
    // En mode automatique, la page suit le téléphone s'il change en cours de route.
    const media = matchMedia('(prefers-color-scheme: dark)')
    const suivre = () => {
      if (document.querySelector('.theme-client[data-auto]')) {
        appliquer(media.matches ? 'sombre' : 'clair', true)
        setMode(lire())
      }
    }
    media.addEventListener('change', suivre)
    return () => media.removeEventListener('change', suivre)
  }, [])

  function basculer(e: React.MouseEvent<HTMLButtonElement>) {
    const suivant: Mode = lire() === 'sombre' ? 'clair' : 'sombre'
    document.cookie = `tapora_mode=${suivant}; path=/; max-age=31536000; samesite=lax`
    const r = e.currentTarget.getBoundingClientRect()
    const racine = document.documentElement
    racine.style.setProperty('--vt-x', `${r.left + r.width / 2}px`)
    racine.style.setProperty('--vt-y', `${r.top + r.height / 2}px`)
    const changer = () => {
      appliquer(suivant)
      setMode(suivant)
    }
    const doc = document as Document & { startViewTransition?: (f: () => void) => unknown }
    if (doc.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(changer)
    else {
      racine.classList.add('fondu-mode')
      changer()
      setTimeout(() => racine.classList.remove('fondu-mode'), 500)
    }
  }

  const fr = langue === 'fr'
  const libelle = mode === 'sombre' ? (fr ? 'Passer en mode clair' : 'Switch to light mode') : fr ? 'Passer en mode sombre' : 'Switch to dark mode'
  return (
    <button
      type="button"
      onClick={basculer}
      aria-label={libelle}
      title={libelle}
      className={`bascule-mode grid size-10 place-items-center rounded-full bg-[var(--cl-sable-2)] text-[var(--cl-doux)] hover:text-[var(--cl-encre)] ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {/* Le soleil se cache derrière la lune (et inversement), en tournant. */}
        <g className={`icone-soleil ${mode === 'sombre' ? 'cache' : ''}`}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        </g>
        <path className={`icone-lune ${mode === 'sombre' ? '' : 'cache'}`} d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
      </svg>
    </button>
  )
}
