'use client'

import { useRef } from 'react'

/**
 * Une carte qui s'incline sous le doigt ou la souris, avec un reflet qui
 * suit — comme une carte bancaire haut de gamme qu'on tourne dans la lumière.
 * L'inclinaison reste légère (8° au plus) ; rien avec « réduire les animations ».
 */
export default function Inclinaison({ children, className = '', intensite = 8 }: { children: React.ReactNode; className?: string; intensite?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const bouger = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.style.setProperty('--incl-x', `${(0.5 - y) * intensite}deg`)
    el.style.setProperty('--incl-y', `${(x - 0.5) * intensite}deg`)
    el.style.setProperty('--reflet-x', `${x * 100}%`)
    el.style.setProperty('--reflet-y', `${y * 100}%`)
    el.dataset.actif = '1'
  }
  const quitter = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--incl-x', '0deg')
    el.style.setProperty('--incl-y', '0deg')
    delete el.dataset.actif
  }
  return (
    <div ref={ref} className={`inclinaison ${className}`} onPointerMove={bouger} onPointerLeave={quitter}>
      {children}
      <span className="inclinaison-reflet" aria-hidden />
    </div>
  )
}
