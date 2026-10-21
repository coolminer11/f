'use client'

import { useEffect, useRef } from 'react'

/**
 * Un graphique qui se dessine de gauche à droite quand il entre à l'écran.
 * Une seule fois : le rafraîchissement automatique ne le rejoue pas.
 * « Réduire les animations » : affiché tel quel.
 */
export default function Apparition({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') return
    let fait = false
    const obs = new IntersectionObserver(
      ([x]) => {
        if (!x?.isIntersecting || fait) return
        fait = true
        obs.disconnect()
        el.animate(
          [
            { clipPath: 'inset(0 100% 0 0)', opacity: 0.3 },
            { clipPath: 'inset(0 0% 0 0)', opacity: 1 },
          ],
          { duration: 1200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
        )
      },
      { threshold: 0.15 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
