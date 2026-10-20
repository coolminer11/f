'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/**
 * La fine barre terre cuite en haut de l'écran, dès le clic sur un lien du
 * back-office : la page d'avant reste affichée (rien ne saute) et on voit que
 * la suivante arrive. Elle se termine quand l'adresse a changé.
 */
export default function BarreChargement() {
  const chemin = usePathname()
  const recherche = useSearchParams()
  const [etat, setEtat] = useState<'repos' | 'en-cours' | 'fin'>('repos')
  const filet = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const demarrer = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const u = new URL(a.href, location.href)
      if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return
      setEtat('en-cours')
      if (filet.current) clearTimeout(filet.current)
      filet.current = setTimeout(() => setEtat('fin'), 12_000)
    }
    document.addEventListener('click', demarrer, true)
    return () => document.removeEventListener('click', demarrer, true)
  }, [])

  // L'adresse a changé : la page est là.
  useEffect(() => {
    setEtat((e) => (e === 'en-cours' ? 'fin' : e))
  }, [chemin, recherche])

  return <div className="barre-chargement" data-etat={etat} aria-hidden />
}
