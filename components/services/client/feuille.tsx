'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Le panneau qui monte du bas de l'écran (demande, Wi-Fi, langue, plat).
 * Rendu dans #sv-calques, à l'intérieur de .theme-services : il garde les
 * couleurs de l'établissement. Se ferme au voile, à Échap, ou en le tirant
 * vers le bas ; bloque le défilement derrière ; rend le focus en sortant.
 */
export default function Feuille({
  ouverte,
  onFermer,
  titre,
  fermer,
  entete,
  children,
}: {
  ouverte: boolean
  onFermer: () => void
  titre?: string
  /** Libellé du bouton de fermeture (« Fermer »), dans la langue du client. */
  fermer: string
  /** Au-dessus de la poignée, bord à bord (une grande photo). */
  entete?: React.ReactNode
  children: React.ReactNode
}) {
  const [cible, setCible] = useState<HTMLElement | null>(null)
  const [visible, setVisible] = useState(ouverte)
  const [sortie, setSortie] = useState(false)
  const [tire, setTire] = useState(0)
  const panneau = useRef<HTMLDivElement>(null)
  const depart = useRef<number | null>(null)
  const avant = useRef<HTMLElement | null>(null)
  const idTitre = useId()
  const fermerRef = useRef(onFermer)
  fermerRef.current = onFermer
  // Pendant qu'elle redescend, la feuille garde son contenu (le parent l'a déjà vidé).
  const memo = useRef({ titre, entete, children })
  if (ouverte) memo.current = { titre, entete, children }

  useEffect(() => setCible(document.getElementById('sv-calques') ?? document.body), [])

  // Ouverture et sortie animée (la feuille redescend avant de disparaître).
  useEffect(() => {
    if (ouverte) {
      setVisible(true)
      setSortie(false)
      setTire(0)
      return
    }
    if (!visible) return
    setSortie(true)
    const t = setTimeout(() => {
      setVisible(false)
      setSortie(false)
    }, 220)
    return () => clearTimeout(t)
  }, [ouverte, visible])

  useEffect(() => {
    if (!visible || sortie) return
    avant.current = document.activeElement as HTMLElement | null
    const html = document.documentElement
    const ancien = html.style.overflow
    html.style.overflow = 'hidden'
    const t = setTimeout(() => panneau.current?.focus({ preventScroll: true }), 30)
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermerRef.current()
      if (e.key !== 'Tab' || !panneau.current) return
      // Le focus reste dans la feuille.
      const f = panneau.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')
      if (!f.length) return
      const premier = f[0]
      const dernier = f[f.length - 1]
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault()
        dernier.focus()
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault()
        premier.focus()
      }
    }
    document.addEventListener('keydown', touche)
    return () => {
      clearTimeout(t)
      html.style.overflow = ancien
      document.removeEventListener('keydown', touche)
      avant.current?.focus?.({ preventScroll: true })
    }
  }, [visible, sortie])

  if (!cible || !visible) return null
  const contenu = memo.current

  // Tirer vers le bas pour fermer (seulement quand le contenu est en haut).
  const poser = (e: React.PointerEvent) => {
    if ((panneau.current?.scrollTop ?? 0) > 0 || (e.target as HTMLElement).closest('button')) return
    depart.current = e.clientY
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const glisser = (e: React.PointerEvent) => {
    if (depart.current === null) return
    setTire(Math.max(0, e.clientY - depart.current))
  }
  const lacher = () => {
    if (depart.current === null) return
    depart.current = null
    if (tire > 110) onFermer()
    else setTire(0)
  }

  return createPortal(
    <>
      <div className="sv-voile" data-sortie={sortie} onClick={onFermer} aria-hidden />
      <div
        ref={panneau}
        role="dialog"
        aria-modal="true"
        aria-labelledby={contenu.titre ? idTitre : undefined}
        tabIndex={-1}
        className="sv-feuille"
        data-sortie={sortie}
        data-tire={tire > 0}
        style={tire ? { transform: `translateY(${tire}px)` } : undefined}
      >
        {contenu.entete}
        <div
          className="sv-feuille-prise"
          onPointerDown={poser}
          onPointerMove={glisser}
          onPointerUp={lacher}
          onPointerCancel={lacher}
        >
          <div className="sv-poignee" aria-hidden />
          {contenu.titre && (
            <h2 id={idTitre} className="sv-sous-titre pe-12">
              {contenu.titre}
            </h2>
          )}
        </div>
        <button type="button" className="sv-feuille-fermer" onClick={onFermer} aria-label={fermer}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className={contenu.titre ? 'mt-4' : ''}>{contenu.children}</div>
      </div>
    </>,
    cible,
  )
}
