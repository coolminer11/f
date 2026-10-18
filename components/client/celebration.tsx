'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { textes, type Langue } from '@/lib/langue'

const COULEURS = ['#c2552f', '#008a7e', '#eda100', '#f0b48f', '#2a211a', '#7fc4b8']

/**
 * Fête un palier franchi : des confettis aux couleurs de Tapora et une
 * petite carte « Bravo ! ». Une seule fois par palier et par appareil (le
 * navigateur s'en souvient) ; à la toute première visite, on fête le plus
 * beau palier déjà atteint.
 *
 * « Réduire les animations » : la carte, sans confettis.
 */
export default function Celebration({
  dossierId,
  franchis,
  langue,
}: {
  dossierId: string
  franchis: { cle: string; titre: string }[]
  langue: Langue
}) {
  const T = textes(langue)
  const [titre, setTitre] = useState<string | null>(null)
  const toile = useRef<HTMLCanvasElement>(null)
  const signature = franchis.map((f) => f.cle).join(',')

  useEffect(() => {
    if (!franchis.length) return
    const cle = `tapora-paliers-${dossierId}`
    let vus: string[] = []
    try {
      vus = JSON.parse(localStorage.getItem(cle) ?? '[]')
    } catch {
      // Stockage indisponible (navigation privée) : on fête, sans mémoire.
    }
    const nouveaux = franchis.filter((f) => !vus.includes(f.cle))
    try {
      localStorage.setItem(cle, JSON.stringify(franchis.map((f) => f.cle)))
    } catch {}
    if (!nouveaux.length) return
    // Le plus beau : d'abord les avis (ce que le commerce veut), le plus haut.
    const avis = nouveaux.filter((f) => f.cle.startsWith('avis-'))
    const choisi = (avis.length ? avis : nouveaux).at(-1)!
    const attente = setTimeout(() => setTitre(choisi.titre), 1600)
    return () => clearTimeout(attente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossierId, signature])

  useEffect(() => {
    if (!titre || !toile.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    return confettis(toile.current)
  }, [titre])

  useEffect(() => {
    if (!titre) return
    const fin = setTimeout(() => setTitre(null), 9000)
    return () => clearTimeout(fin)
  }, [titre])

  if (!titre) return null
  // Hors de la page : un parent animé (transform) piégerait le « fixed ».
  return createPortal(
    <>
      <canvas ref={toile} className="pointer-events-none fixed inset-0 z-50 size-full" aria-hidden />
      <div className="fixed inset-x-4 bottom-6 z-50 flex justify-center" role="status">
        <div className="toast-bravo flex max-w-md items-center gap-4 rounded-3xl bg-[#2a211a] py-4 pl-5 pr-3 text-[#fffaf2] shadow-2xl">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#c2552f] text-2xl" aria-hidden>
            🎉
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-[#f0b48f]">{T.bravo}</p>
            <p className="titre-client text-xl font-medium leading-tight">{titre}</p>
            <p className="mt-0.5 text-xs text-[#fffaf2]/70">{T.bravoSous}</p>
          </div>
          <button
            onClick={() => setTitre(null)}
            className="ml-1 grid size-8 shrink-0 place-items-center self-start rounded-full text-[#fffaf2]/60 hover:bg-white/10 hover:text-[#fffaf2]"
            aria-label={T.fermer}
          >
            ✕
          </button>
        </div>
      </div>
    </>,
    document.getElementById('calque-client') ?? document.body,
  )
}

/** Confettis sur un canevas plein écran : deux salves, gravité, rotation, fondu. */
function confettis(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const L = window.innerWidth
  const H = window.innerHeight
  canvas.width = L * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)

  type P = { x: number; y: number; vx: number; vy: number; r: number; vr: number; l: number; h: number; c: string; rond: boolean }
  const parts: P[] = []
  const salve = (x: number, angle: number) => {
    for (let i = 0; i < 70; i++) {
      const a = angle + (Math.random() - 0.5) * 0.9
      const v = 9 + Math.random() * 9
      parts.push({
        x,
        y: H * 0.9,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        l: 6 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        c: COULEURS[i % COULEURS.length],
        rond: Math.random() < 0.25,
      })
    }
  }
  salve(L * 0.15, -Math.PI / 2 + 0.45)
  salve(L * 0.85, -Math.PI / 2 - 0.45)

  const debut = performance.now()
  let id = 0
  const image = (t: number) => {
    const age = (t - debut) / 1000
    ctx.clearRect(0, 0, L, H)
    for (const p of parts) {
      p.vy += 0.32
      p.vx *= 0.985
      p.vy *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.r += p.vr
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - 2.6) / 1.2)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.r)
      ctx.fillStyle = p.c
      if (p.rond) {
        ctx.beginPath()
        ctx.arc(0, 0, p.h * 0.7, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-p.l / 2, -p.h / 2, p.l, p.h * Math.abs(Math.cos(p.r * 2)) + 1)
      }
      ctx.restore()
    }
    if (age < 3.8) id = requestAnimationFrame(image)
    else ctx.clearRect(0, 0, L, H)
  }
  id = requestAnimationFrame(image)
  return () => cancelAnimationFrame(id)
}
