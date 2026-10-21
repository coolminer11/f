'use client'

/**
 * Désintégration : l'élément se dissout en poussière (filtre SVG de
 * turbulence qui se déforme de plus en plus) pendant que des particules s'en
 * détachent et s'envolent. Pour une demande terminée, une ligne supprimée,
 * une notification qu'on chasse. La promesse se résout à la fin : c'est
 * alors à l'appelant de retirer l'élément.
 *
 * « Réduire les animations » : un simple fondu, très court.
 */
let compteur = 0

function filtreSvg(): { id: string; deplacement: SVGFEDisplacementMapElement; retirer: () => void } {
  const ns = 'http://www.w3.org/2000/svg'
  const id = `tapora-poussiere-${++compteur}`
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.position = 'absolute'
  const filtre = document.createElementNS(ns, 'filter')
  filtre.setAttribute('id', id)
  filtre.setAttribute('x', '-20%')
  filtre.setAttribute('y', '-20%')
  filtre.setAttribute('width', '140%')
  filtre.setAttribute('height', '140%')
  const bruit = document.createElementNS(ns, 'feTurbulence')
  bruit.setAttribute('type', 'fractalNoise')
  bruit.setAttribute('baseFrequency', '0.035')
  bruit.setAttribute('numOctaves', '2')
  bruit.setAttribute('seed', String(Math.floor(Math.random() * 100)))
  bruit.setAttribute('result', 'bruit')
  const deplacement = document.createElementNS(ns, 'feDisplacementMap')
  deplacement.setAttribute('in', 'SourceGraphic')
  deplacement.setAttribute('in2', 'bruit')
  deplacement.setAttribute('scale', '0')
  deplacement.setAttribute('xChannelSelector', 'R')
  deplacement.setAttribute('yChannelSelector', 'G')
  filtre.append(bruit, deplacement)
  svg.append(filtre)
  document.body.append(svg)
  return { id, deplacement, retirer: () => svg.remove() }
}

function couleurDe(el: HTMLElement): string {
  const s = getComputedStyle(el)
  const fond = s.backgroundColor
  return fond && fond !== 'rgba(0, 0, 0, 0)' && fond !== 'transparent' ? fond : s.color
}

export function desintegrer(el: HTMLElement | null, options: { duree?: number; particules?: number; couleur?: string } = {}): Promise<void> {
  if (!el) return Promise.resolve()
  const duree = options.duree ?? 900
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }).finished.then(() => undefined)
  }
  const boite = el.getBoundingClientRect()
  const couleur = options.couleur ?? couleurDe(el)
  const { id, deplacement, retirer } = filtreSvg()
  el.style.filter = `url(#${id})`
  el.style.willChange = 'transform, opacity, filter'

  // La poussière : des grains qui partent vers la droite et le haut, comme emportés par le vent.
  const calque = document.createElement('div')
  calque.setAttribute('aria-hidden', 'true')
  calque.style.cssText = `position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:90;overflow:visible`
  document.body.append(calque)
  const n = options.particules ?? Math.min(90, Math.max(24, Math.round((boite.width * boite.height) / 900)))
  for (let i = 0; i < n; i++) {
    const grain = document.createElement('span')
    const taille = 1.5 + Math.random() * 3.5
    const x = boite.left + Math.random() * boite.width
    const y = boite.top + Math.random() * boite.height
    grain.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${taille}px;height:${taille}px;border-radius:999px;background:${couleur};opacity:0.9`
    calque.append(grain)
    const dx = 40 + Math.random() * 160
    const dy = -30 - Math.random() * 120
    grain.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 0.95 },
        { transform: `translate(${dx * 0.4}px, ${dy * 0.3}px) scale(0.9)`, opacity: 0.8, offset: 0.35 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0 },
      ],
      { duration: duree * (0.7 + Math.random() * 0.6), delay: Math.random() * duree * 0.45, easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)', fill: 'forwards' },
    )
  }

  const debut = performance.now()
  return new Promise((fin) => {
    const pas = (t: number) => {
      const p = Math.min(1, (t - debut) / duree)
      deplacement.setAttribute('scale', String(Math.round(p * p * 140)))
      el.style.opacity = String(1 - p * p)
      el.style.transform = `translateX(${p * 18}px)`
      if (p < 1) requestAnimationFrame(pas)
      else {
        setTimeout(() => {
          retirer()
          calque.remove()
        }, duree)
        fin()
      }
    }
    requestAnimationFrame(pas)
  })
}

/** Une petite vibration sur les téléphones qui le permettent (un geste confirmé). */
export function vibrer(motif: number | number[] = 12): void {
  try {
    navigator.vibrate?.(motif)
  } catch {
    // Pas de vibreur : rien à faire.
  }
}
