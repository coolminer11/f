/**
 * Confettis aux couleurs de Tapora, sur un canevas plein écran créé pour
 * l'occasion puis retiré. Rien si « réduire les animations » est demandé.
 *
 *   lancerConfettis()                       — deux salves depuis le bas
 *   lancerConfettis({ depuis: element })    — une gerbe qui part de l'élément
 */
const COULEURS = ['#c2552f', '#008a7e', '#eda100', '#f0b48f', '#2a211a', '#7fc4b8']

type Options = { depuis?: Element | null; nombre?: number; duree?: number }

export function lancerConfettis({ depuis, nombre = 140, duree = 3.6 }: Options = {}): void {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.remove()
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const L = window.innerWidth
  const H = window.innerHeight
  canvas.width = L * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)

  type P = { x: number; y: number; vx: number; vy: number; r: number; vr: number; l: number; h: number; c: string; rond: boolean }
  const parts: P[] = []
  const gerbe = (x: number, y: number, angle: number, ouverture: number, n: number, force: number) => {
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * ouverture
      const v = force * (0.55 + Math.random() * 0.6)
      parts.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        l: 6 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        c: COULEURS[(i + parts.length) % COULEURS.length],
        rond: Math.random() < 0.25,
      })
    }
  }
  if (depuis) {
    const r = depuis.getBoundingClientRect()
    gerbe(r.left + r.width / 2, r.top + r.height / 2, -Math.PI / 2, 2.2, nombre, 16)
  } else {
    gerbe(L * 0.15, H * 0.9, -Math.PI / 2 + 0.45, 0.9, nombre / 2, 18)
    gerbe(L * 0.85, H * 0.9, -Math.PI / 2 - 0.45, 0.9, nombre / 2, 18)
  }

  const debut = performance.now()
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
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - (duree - 1.2)) / 1.2)
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
    if (age < duree) requestAnimationFrame(image)
    else canvas.remove()
  }
  requestAnimationFrame(image)
}
