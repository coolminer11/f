'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import type { Langue } from '@/lib/langue'

/**
 * La chorégraphie de l'écran « Bienvenue » (voir bienvenue.tsx) : le fond
 * s'allume, le sceau se dessine arc par arc, l'étoile se lève, le nom monte
 * lettre par lettre, le trait doré se trace, puis le rideau se lève sur la
 * page, dont les animations démarrent à ce moment-là
 * (« tapora:bienvenue-fin », écouté par AnimationsClient).
 *
 * Un tap, une touche ou la molette passent directement au rideau. Avec
 * « réduire les animations » : le message, immobile, une seconde, puis un
 * fondu.
 *
 * Retient aussi, sur cet appareil, le nom et l'adresse de l'espace : la page
 * « Espace client » (/portail) dit alors « Bon retour, <nom> ».
 */
export default function BienvenueAnime({ nom, langue }: { nom: string; langue: Langue }) {
  useEffect(() => {
    try {
      localStorage.setItem('tapora_espace', JSON.stringify({ nom, chemin: location.pathname, l: langue, le: Date.now() }))
    } catch {}

    const racine = document.documentElement
    const el = document.querySelector<HTMLElement>('.bienvenue')
    if (!el || racine.getAttribute('data-bienvenue') !== '1') return

    try {
      const u = new URL(location.href)
      if (u.searchParams.has('bienvenue')) {
        u.searchParams.delete('bienvenue')
        history.replaceState(history.state, '', u.toString())
      }
    } catch {}

    let fini = false
    const finir = () => {
      if (fini) return
      fini = true
      window.dispatchEvent(new Event('tapora:bienvenue-fin'))
    }
    const retirer = () => racine.removeAttribute('data-bienvenue')

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = setTimeout(() => {
        el.style.transition = 'opacity 0.5s'
        el.style.opacity = '0'
        finir()
        setTimeout(retirer, 520)
      }, 1100)
      return () => clearTimeout(t)
    }

    const $ = (s: string) => el.querySelectorAll<SVGElement | HTMLElement>(s)
    const centre = el.querySelector('.bienvenue-centre')
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.from($('.bienvenue-fond'), { opacity: 0, scale: 1.15, duration: 1.1, ease: 'power2.out' }, 0)
      .from($('.bienvenue-sceau'), { opacity: 0, scale: 0.55, rotation: -28, duration: 1, ease: 'back.out(1.7)', transformOrigin: '50% 50%' }, 0.1)
      .fromTo($('.bienvenue-arc'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.85, stagger: 0.13, ease: 'power2.inOut' }, 0.35)
      .from($('.bienvenue-etoile'), { scale: 0, rotation: -140, transformOrigin: '50% 50%', duration: 0.75, ease: 'back.out(2.6)' }, 0.8)
      .from($('.bienvenue-sur'), { opacity: 0, letterSpacing: '0.85em', duration: 0.9 }, 0.6)
      .from($('.bienvenue-lettre'), { yPercent: 115, opacity: 0, rotationX: -75, filter: 'blur(10px)', duration: 0.95, ease: 'power4.out', stagger: { each: 0.035 } }, 0.85)
      .fromTo($('.bienvenue-trait path'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut' }, 1.35)
      .from($('.bienvenue-sous'), { opacity: 0, y: 12, duration: 0.6 }, 1.6)
      .from($('.bienvenue-passer'), { opacity: 0, duration: 0.5 }, 1)
      .addLabel('sortie', 2.9)
      .to(centre, { scale: 1.06, opacity: 0, filter: 'blur(8px)', duration: 0.6, ease: 'power2.in' }, 'sortie')
      .add(finir, 'sortie+=0.25')
      .fromTo(el, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'power4.inOut' }, 'sortie+=0.2')
      .add(retirer)

    // Passer : directement au rideau.
    const passer = () => {
      if (tl.time() < tl.labels.sortie) tl.seek('sortie')
    }
    const touches = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') passer()
    }
    el.addEventListener('pointerdown', passer)
    window.addEventListener('keydown', touches)
    window.addEventListener('wheel', passer, { passive: true })
    return () => {
      el.removeEventListener('pointerdown', passer)
      window.removeEventListener('keydown', touches)
      window.removeEventListener('wheel', passer)
      tl.kill()
    }
  }, [nom, langue])

  return null
}
