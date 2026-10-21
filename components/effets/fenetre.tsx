'use client'

import { useEffect, useRef } from 'react'

/**
 * Une fenêtre (pop-up) : fond flouté, la carte arrive avec un ressort (du bas
 * sur un téléphone, au centre sur un écran), Échap ou un clic à côté la
 * ferme, le focus reste dedans tant qu'elle est ouverte.
 */
export default function Fenetre({
  ouverte,
  fermer,
  titre,
  children,
  largeur = 'max-w-lg',
}: {
  ouverte: boolean
  fermer: () => void
  titre: string
  children: React.ReactNode
  largeur?: string
}) {
  const boite = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ouverte) return
    const avant = document.activeElement as HTMLElement | null
    const premier = boite.current?.querySelector<HTMLElement>('button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])')
    premier?.focus()
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer()
      if (e.key === 'Tab' && boite.current) {
        const f = [...boite.current.querySelectorAll<HTMLElement>('button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'))
        if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault()
          f[f.length - 1].focus()
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault()
          f[0].focus()
        }
      }
    }
    document.addEventListener('keydown', touche)
    const defilement = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', touche)
      document.documentElement.style.overflow = defilement
      avant?.focus?.()
    }
  }, [ouverte, fermer])

  if (!ouverte) return null
  return (
    <div className="fenetre-fond" onMouseDown={(e) => e.target === e.currentTarget && fermer()} role="presentation">
      <div ref={boite} role="dialog" aria-modal="true" aria-label={titre} className={`fenetre-carte ${largeur}`}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="fenetre-titre">{titre}</h2>
          <button type="button" onClick={fermer} className="fenetre-fermer" aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}
