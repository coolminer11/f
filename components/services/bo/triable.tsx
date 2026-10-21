'use client'

import { Children, createElement, isValidElement, useLayoutEffect, useRef } from 'react'
import { reordonnerAction } from '@/app/services/actions'
import { toast } from '@/components/effets/toasts'
import { vibrer } from '@/components/effets/desintegration'

/**
 * Une liste qu'on réordonne en glissant (souris, doigt ou stylet) : l'élément
 * se soulève avec une ombre, ses voisins s'écartent pour lui faire de la
 * place, il se pose d'un ressort, puis le serveur enregistre — sans
 * redirection, la page ne remonte pas. Au clavier : flèches ↑ / ↓ sur la
 * poignée, ou les boutons ↑ / ↓ de la ligne.
 *
 * Les enfants directs portent `data-tri-id` ; la poignée, `data-poignee`
 * (voir <PoigneeTri />) ; les boutons, `data-tri-sens="-1" | "1"` (voir
 * <FlechesTri />). Rien n'est déplacé dans le DOM pendant le geste (React
 * en reste maître) : seulement des transformations, effacées quand la page
 * revient du serveur avec le nouvel ordre.
 */
type Quoi = 'menus' | 'sections' | 'plats' | 'emplacements' | 'annonces' | 'rubriques' | 'types'

type Geste = {
  el: HTMLElement
  poignee: HTMLElement
  liste: HTMLElement[]
  rects: { haut: number; hauteur: number }[]
  index: number
  cible: number
  pas: number
  ecart: number
  departY: number
  departScroll: number
  y: number
  vitesse: number
  raf: number
  pointeur: number
}

const RESSORT = 'cubic-bezier(0.18, 1.25, 0.4, 1)'
const DOUX = 'cubic-bezier(0.2, 0.9, 0.3, 1)'

function mouvementReduit(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function elements(conteneur: HTMLElement): HTMLElement[] {
  return Array.from(conteneur.children).filter((c): c is HTMLElement => c instanceof HTMLElement && Boolean(c.dataset.triId))
}

function effacer(el: HTMLElement) {
  el.style.transition = 'none'
  el.style.transform = ''
  el.style.boxShadow = ''
  el.style.zIndex = ''
  el.style.position = ''
  el.style.background = ''
  el.style.borderRadius = ''
  el.removeAttribute('data-tri-souleve')
}

export default function Triable({
  quoi,
  etab,
  parent,
  as = 'ul',
  className,
  desactive = false,
  libelle,
  children,
}: {
  quoi: Quoi
  etab: string
  /** Le menu (pour des sections) ou la section (pour des plats). */
  parent?: string
  as?: 'ul' | 'ol' | 'div'
  className?: string
  desactive?: boolean
  libelle?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const geste = useRef<Geste | null>(null)
  const enAttente = useRef<{ cles: string; minuterie: number } | null>(null)
  const refocus = useRef<string | null>(null)
  const cles = Children.toArray(children)
    .map((c) => (isValidElement(c) ? String(c.key) : ''))
    .join('|')

  // La page est revenue du serveur : chacun reprend sa place, sans animation.
  useLayoutEffect(() => {
    const conteneur = ref.current
    if (!conteneur) return
    if (enAttente.current && enAttente.current.cles !== cles) {
      clearTimeout(enAttente.current.minuterie)
      enAttente.current = null
    }
    if (!enAttente.current) {
      for (const el of elements(conteneur)) effacer(el)
      conteneur.removeAttribute('aria-busy')
    }
    if (refocus.current) {
      const id = refocus.current
      refocus.current = null
      elements(conteneur)
        .find((el) => el.dataset.triId === id)
        ?.querySelector<HTMLElement>('[data-poignee]')
        ?.focus({ preventScroll: true })
    }
  }, [cles])

  /** Remet tout en place en douceur (geste annulé ou refus du serveur). */
  function relacher(conteneur: HTMLElement) {
    const reduit = mouvementReduit()
    for (const el of elements(conteneur)) {
      el.style.transition = reduit ? 'none' : `transform 0.35s ${RESSORT}, box-shadow 0.25s ease`
      el.style.transform = ''
      el.style.boxShadow = ''
      el.removeAttribute('data-tri-souleve')
      window.setTimeout(() => !geste.current && !enAttente.current && effacer(el), reduit ? 0 : 380)
    }
    conteneur.removeAttribute('aria-busy')
  }

  function enregistrer(conteneur: HTMLElement, ids: string[], deplace: string) {
    conteneur.setAttribute('aria-busy', 'true')
    const minuterie = window.setTimeout(() => {
      // Le serveur a répondu sans que l'ordre ait changé à l'écran : on relâche.
      if (enAttente.current?.cles === cles) {
        enAttente.current = null
        relacher(conteneur)
      }
    }, 4000)
    enAttente.current = { cles, minuterie }
    refocus.current = document.activeElement?.closest('[data-tri-id]') ? deplace : null
    void reordonnerAction({ etab, quoi, parent: parent ?? etab, ids }).then(
      (r) => {
        if (r.ok) toast(r.message, { ton: 'succes', duree: 2200 })
        else {
          toast(r.message, { ton: 'erreur', duree: 6000 })
          if (enAttente.current) clearTimeout(enAttente.current.minuterie)
          enAttente.current = null
          relacher(conteneur)
        }
      },
      () => {
        toast('L’ordre n’a pas pu être enregistré.', { ton: 'erreur', duree: 6000 })
        if (enAttente.current) clearTimeout(enAttente.current.minuterie)
        enAttente.current = null
        relacher(conteneur)
      },
    )
  }

  /** Déplace l'élément `index` vers `cible` : animation de la permutation, puis enregistrement. */
  function deplacerVers(conteneur: HTMLElement, liste: HTMLElement[], index: number, cible: number, mesures?: { hauteurs: number[]; ecart: number }) {
    const reduit = mouvementReduit()
    const depuisGeste = Boolean(mesures)
    // Pendant un geste, les éléments sont déjà décalés : on garde les mesures prises au départ.
    const m =
      mesures ??
      (() => {
        const r = liste.map((x) => x.getBoundingClientRect())
        return { hauteurs: r.map((x) => x.height), ecart: r.length > 1 ? Math.max(0, r[1].top - r[0].bottom) : 0 }
      })()
    const ecart = m.ecart
    const pas = m.hauteurs[index] + ecart
    for (const x of liste) x.style.animation = 'none'
    liste.forEach((x, i) => {
      if (i === index) return
      const decale = index < cible ? i > index && i <= cible : i >= cible && i < index
      x.style.transition = reduit ? 'none' : `transform 0.3s ${DOUX}`
      x.style.transform = decale ? `translate3d(0, ${index < cible ? -pas : pas}px, 0)` : ''
    })
    let decalage = 0
    if (cible > index) for (let i = index + 1; i <= cible; i++) decalage += m.hauteurs[i] + ecart
    else for (let i = cible; i < index; i++) decalage -= m.hauteurs[i] + ecart
    const el = liste[index]
    el.style.position = 'relative'
    el.style.zIndex = '3'
    el.style.transition = reduit ? 'none' : `transform 0.34s ${RESSORT}, box-shadow 0.3s ease`
    el.style.transform = `translate3d(0, ${decalage}px, 0)`
    if (!depuisGeste) {
      el.style.boxShadow = '0 14px 30px -18px rgb(28 22 17 / 0.45)'
      window.setTimeout(() => (el.style.boxShadow = ''), 340)
    } else el.style.boxShadow = ''
    el.removeAttribute('data-tri-souleve')
    const ids = liste.map((x) => x.dataset.triId!)
    const [bouge] = ids.splice(index, 1)
    ids.splice(cible, 0, bouge)
    vibrer(12)
    enregistrer(conteneur, ids, bouge)
  }

  function actualiser() {
    const g = geste.current
    if (!g) return
    if (g.vitesse) window.scrollBy(0, g.vitesse)
    const dy = g.y + window.scrollY - (g.departY + g.departScroll)
    g.el.style.transform = `translate3d(0, ${dy}px, 0) scale(1.015)`
    // La nouvelle place : le nombre de voisins dont le centre est au-dessus du centre de l'élément porté.
    const centre = g.rects[g.index].haut + g.rects[g.index].hauteur / 2 + dy
    let cible = 0
    g.rects.forEach((r, i) => {
      if (i !== g.index && r.haut + r.hauteur / 2 < centre) cible++
    })
    if (cible !== g.cible) {
      g.cible = cible
      vibrer(4)
      g.liste.forEach((x, i) => {
        if (i === g.index) return
        const decale = g.index < cible ? i > g.index && i <= cible : i >= cible && i < g.index
        x.style.transform = decale ? `translate3d(0, ${g.index < cible ? -g.pas : g.pas}px, 0)` : ''
      })
    }
    g.raf = g.vitesse ? requestAnimationFrame(actualiser) : 0
  }

  function finir(annule: boolean) {
    const g = geste.current
    const conteneur = ref.current
    if (!g || !conteneur) return
    geste.current = null
    cancelAnimationFrame(g.raf)
    document.body.style.userSelect = ''
    document.documentElement.style.cursor = ''
    try {
      g.poignee.releasePointerCapture(g.pointeur)
    } catch {}
    if (annule || g.cible === g.index) {
      relacher(conteneur)
      return
    }
    deplacerVers(conteneur, g.liste, g.index, g.cible, { hauteurs: g.rects.map((r) => r.hauteur), ecart: g.ecart })
  }

  function surPointeurBas(e: React.PointerEvent<HTMLElement>) {
    const conteneur = ref.current
    if (desactive || !conteneur || e.button !== 0 || geste.current || conteneur.hasAttribute('aria-busy')) return
    const poignee = (e.target as HTMLElement).closest<HTMLElement>('[data-poignee]')
    const el = poignee?.closest<HTMLElement>('[data-tri-id]')
    if (!poignee || !el || el.parentElement !== conteneur) return
    const liste = elements(conteneur)
    if (liste.length < 2) return
    e.preventDefault()
    e.stopPropagation()
    const rects = liste.map((x) => {
      const r = x.getBoundingClientRect()
      return { haut: r.top + window.scrollY, hauteur: r.height }
    })
    const index = liste.indexOf(el)
    const ecart = liste.length > 1 ? Math.max(0, rects[1].haut - (rects[0].haut + rects[0].hauteur)) : 0
    geste.current = {
      el,
      poignee,
      liste,
      rects,
      index,
      cible: index,
      pas: rects[index].hauteur + ecart,
      ecart,
      departY: e.clientY,
      departScroll: window.scrollY,
      y: e.clientY,
      vitesse: 0,
      raf: 0,
      pointeur: e.pointerId,
    }
    try {
      poignee.setPointerCapture(e.pointerId)
    } catch {}
    document.body.style.userSelect = 'none'
    document.documentElement.style.cursor = 'grabbing'
    const reduit = mouvementReduit()
    for (const x of liste) {
      // L'animation d'entrée (.cascade, « both ») garderait la main sur la transformation.
      x.style.animation = 'none'
      x.style.transition = x === el || reduit ? 'none' : `transform 0.28s ${DOUX}`
    }
    el.style.position = 'relative'
    el.style.zIndex = '5'
    // Une ligne sans fond (dans une liste) en reçoit un le temps d'être portée.
    if (getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)') {
      el.style.background = 'white'
      el.style.borderRadius = '0.75rem'
    }
    el.style.transition = reduit ? 'none' : 'box-shadow 0.2s ease'
    el.style.boxShadow = '0 22px 44px -20px rgb(28 22 17 / 0.5), 0 0 0 1px rgb(28 22 17 / 0.06)'
    el.setAttribute('data-tri-souleve', '')
    vibrer(8)
  }

  function surPointeurBouge(e: React.PointerEvent<HTMLElement>) {
    const g = geste.current
    if (!g || e.pointerId !== g.pointeur) return
    e.preventDefault()
    g.y = e.clientY
    // Défilement automatique près des bords de la fenêtre.
    const bord = 72
    const avant = g.vitesse
    g.vitesse = e.clientY < bord ? -Math.ceil((bord - e.clientY) / 6) : e.clientY > innerHeight - bord ? Math.ceil((e.clientY - (innerHeight - bord)) / 6) : 0
    if (g.vitesse && !avant) g.raf = requestAnimationFrame(actualiser)
    else if (!g.vitesse) actualiser()
  }

  function surClavier(e: React.KeyboardEvent<HTMLElement>) {
    const conteneur = ref.current
    const cible = e.target as HTMLElement
    if (desactive || !conteneur || !cible.hasAttribute('data-poignee') || conteneur.hasAttribute('aria-busy')) return
    if (e.key === 'Escape' && geste.current) return finir(true)
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    const el = cible.closest<HTMLElement>('[data-tri-id]')
    if (!el || el.parentElement !== conteneur) return
    e.preventDefault()
    const liste = elements(conteneur)
    const index = liste.indexOf(el)
    const vers = index + (e.key === 'ArrowUp' ? -1 : 1)
    if (vers < 0 || vers >= liste.length) return
    deplacerVers(conteneur, liste, index, vers)
  }

  function surClic(e: React.MouseEvent<HTMLElement>) {
    const conteneur = ref.current
    const bouton = (e.target as HTMLElement).closest<HTMLElement>('[data-tri-sens]')
    if (!bouton || !conteneur) return
    const el = bouton.closest<HTMLElement>('[data-tri-id]')
    if (!el || el.parentElement !== conteneur) return
    e.preventDefault()
    e.stopPropagation()
    if (desactive || conteneur.hasAttribute('aria-busy')) return
    const liste = elements(conteneur)
    const index = liste.indexOf(el)
    const vers = index + (bouton.dataset.triSens === '-1' ? -1 : 1)
    if (vers < 0 || vers >= liste.length) return
    refocus.current = el.dataset.triId ?? null
    deplacerVers(conteneur, liste, index, vers)
  }

  return createElement(
    as,
    {
      ref,
      className,
      'aria-label': libelle,
      'data-triable': desactive ? undefined : '',
      onPointerDown: surPointeurBas,
      onPointerMove: surPointeurBouge,
      onPointerUp: () => finir(false),
      onPointerCancel: () => finir(true),
      onLostPointerCapture: () => geste.current && finir(false),
      onKeyDown: surClavier,
      onClickCapture: surClic,
    },
    children,
  )
}

/** La poignée : on la saisit pour glisser ; au clavier, ↑ / ↓ déplacent. */
export function PoigneeTri({ libelle = 'Déplacer', className = '' }: { libelle?: string; className?: string }) {
  return (
    <button
      type="button"
      data-poignee=""
      aria-label={`${libelle} : glisser, ou flèches haut et bas`}
      title="Glisser pour déplacer (ou ↑ / ↓ au clavier)"
      className={`grid size-7 shrink-0 cursor-grab touch-none select-none place-items-center rounded-lg text-[var(--color-encre-doux)] transition hover:bg-[var(--color-fond)] hover:text-[var(--color-encre)] focus-visible:bg-[var(--color-fond)] active:cursor-grabbing ${className}`}
    >
      <svg viewBox="0 0 10 16" className="h-3.5 w-2.5" aria-hidden>
        {[3, 8, 13].flatMap((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.35" fill="currentColor" />))}
      </svg>
    </button>
  )
}

/** Les boutons ↑ / ↓ d'une ligne (gérés par la liste qui les contient). */
export function FlechesTri({
  premier,
  dernier,
  className = '',
  symboles = ['↑', '↓'],
}: {
  premier: boolean
  dernier: boolean
  className?: string
  symboles?: [string, string]
}) {
  return (
    <>
      <button type="button" data-tri-sens="-1" disabled={premier} className={className} title="Monter" aria-label="Monter">
        {symboles[0]}
      </button>
      <button type="button" data-tri-sens="1" disabled={dernier} className={className} title="Descendre" aria-label="Descendre">
        {symboles[1]}
      </button>
    </>
  )
}
