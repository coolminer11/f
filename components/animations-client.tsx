'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { locale, type Langue } from '@/lib/langue'

/**
 * Les animations de la page client — les mêmes gestes que taporacards.com :
 * défilement fluide, titres mot à mot, chiffres qui comptent, barres qui
 * poussent, cases qui s'allument, courbes qui se dessinent.
 *
 * Sans JavaScript, ou avec « réduire les animations », la page est complète
 * et immobile. Les états de départ sont posés avant de retirer le voile
 * (classe « attente ») : rien ne clignote.
 */
export default function AnimationsClient({ children, langue = 'fr' }: { children: React.ReactNode; langue?: Langue }) {
  const racine = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const montrer = () => document.documentElement.classList.remove('attente')
    const el = racine.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return montrer()

    gsap.registerPlugin(ScrollTrigger)
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true })
    lenis.on('scroll', ScrollTrigger.update)
    const tic = (t: number) => lenis.raf(t * 1000)
    gsap.ticker.add(tic)
    gsap.ticker.lagSmoothing(0)
    const fmt = new Intl.NumberFormat(locale(langue), { maximumFractionDigits: 1 })
    const BLOCS = 'section.carte, [data-bloc]'
    const compter = (n: HTMLElement, tl: gsap.core.Timeline, position: number | string) => {
      const cible = Number(n.dataset.compteur)
      if (!Number.isFinite(cible)) return
      const etat = { v: 0 }
      tl.to(etat, { v: cible, duration: 1.8, ease: 'power2.out', onUpdate: () => (n.textContent = (n.dataset.prefixe ?? '') + fmt.format(Math.round(etat.v * 10) / 10)) }, position)
    }

    const ctx = gsap.context(() => {
      // ---- Le haut de page : petite étiquette, puis le nom mot à mot.
      const mots: HTMLElement[] = []
      el.querySelectorAll<HTMLElement>('[data-mots]').forEach((titre) => {
        const texte = titre.textContent ?? ''
        titre.textContent = ''
        texte.split(/(\s+)/).forEach((m) => {
          if (!m) return
          if (/^\s+$/.test(m)) return titre.appendChild(document.createTextNode(m))
          const masque = document.createElement('span')
          masque.className = 'masque-mot'
          const mot = document.createElement('span')
          mot.className = 'mot'
          mot.textContent = m
          masque.appendChild(mot)
          titre.appendChild(masque)
          mots.push(mot)
        })
      })
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      intro
        .from('[data-intro]', { y: 18, opacity: 0, duration: 0.8, stagger: 0.08 })
        .from(mots, { yPercent: 115, rotation: 3, duration: 1, ease: 'power4.out', stagger: 0.05 }, 0.1)

      // ---- Les tuiles chiffrées : elles montent, et leurs chiffres comptent.
      intro.from('[data-tuile]', { y: 26, opacity: 0, duration: 0.9, stagger: 0.08 }, 0.35)
      // Les compteurs des sections plus bas comptent quand on les atteint.
      el.querySelectorAll<HTMLElement>('[data-compteur]').forEach((n) => {
        if (!n.closest(BLOCS)) compter(n, intro, 0.45)
      })

      // ---- Chaque section se pose quand on l'atteint, puis ses graphiques s'animent.
      el.querySelectorAll<HTMLElement>(BLOCS).forEach((bloc) => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: bloc, start: 'top 88%', once: true } })
        tl.from(bloc, { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out' })
        const barres = bloc.querySelectorAll('.barre-graphique')
        if (barres.length) tl.from(barres, { scaleY: 0, transformOrigin: '50% 100%', duration: 0.8, ease: 'power3.out', stagger: { amount: 0.6 } }, '-=0.5')
        const cases = bloc.querySelectorAll('.case-chaleur')
        if (cases.length) tl.from(cases, { opacity: 0, scale: 0.4, duration: 0.45, ease: 'back.out(1.8)', stagger: { grid: [7, 24], from: 'start', amount: 1 } }, '-=0.5')
        bloc.querySelectorAll('.trace-ligne').forEach((svg) =>
          tl.fromTo(svg, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.4, ease: 'power2.inOut' }, '-=0.4'),
        )
        const segments = bloc.querySelectorAll('.segment-repartition, [data-jauge]')
        if (segments.length) tl.from(segments, { scaleX: 0, transformOrigin: '0% 50%', duration: 0.9, ease: 'power3.out', stagger: 0.08 }, '-=0.5')
        // Paliers : l'anneau se remplit, le chiffre compte, les médailles tombent une à une.
        bloc.querySelectorAll<SVGCircleElement>('[data-anneau]').forEach((c) =>
          tl.from(c, { strokeDashoffset: Number(c.dataset.anneau), duration: 1.6, ease: 'power3.inOut' }, '-=0.6'),
        )
        bloc.querySelectorAll<HTMLElement>('[data-compteur]').forEach((n) => compter(n, tl, '<'))
        const jaugesV = bloc.querySelectorAll('[data-jauge-v]')
        if (jaugesV.length) tl.from(jaugesV, { scaleY: 0, transformOrigin: '50% 0%', duration: 1.1, ease: 'power3.out' }, '-=0.5')
        const etapes = bloc.querySelectorAll('[data-etape]')
        if (etapes.length) tl.from(etapes, { y: 14, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.07 }, '-=0.6')
        bloc.querySelectorAll<SVGPathElement>('[data-fleche]').forEach((f) => {
          const l = f.getTotalLength()
          tl.fromTo(f, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.out' }, '-=0.4')
        })
        const medailles = bloc.querySelectorAll('.medaille')
        if (medailles.length) tl.from(medailles, { scale: 0.3, opacity: 0, duration: 0.55, ease: 'back.out(2.2)', stagger: 0.05 }, '-=1')
      })
    }, el)

    montrer()
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
    return () => {
      ctx.revert()
      gsap.ticker.remove(tic)
      lenis.destroy()
    }
  }, [langue])

  return <div ref={racine}>{children}</div>
}
