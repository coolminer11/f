'use client'

import { useEffect, useState } from 'react'
import type { Langue } from '@/lib/langue'

const T = {
  fr: {
    retour: 'Bon retour,',
    ouvrir: 'Ouvrir mon espace',
    pasVous: 'Ce n’est pas vous ?',
    oublier: 'Oublier cet appareil',
    ou: 'Ou recevez un nouveau lien par courriel :',
    taps: 'Taps aujourd’hui',
    vsHier: 'vs hier',
    ding: 'Ding ! Un client vient de taper',
    maintenant: 'maintenant',
    exemple: 'aperçu',
  },
  en: {
    retour: 'Welcome back,',
    ouvrir: 'Open my area',
    pasVous: 'Not you?',
    oublier: 'Forget this device',
    ou: 'Or get a new link by email:',
    taps: 'Taps today',
    vsHier: 'vs yesterday',
    ding: 'Ding! A customer just tapped',
    maintenant: 'now',
    exemple: 'preview',
  },
}

type Espace = { nom: string; chemin: string; l?: string }

function lireEspace(): Espace | null {
  try {
    const v = JSON.parse(localStorage.getItem('tapora_espace') ?? 'null')
    // Seulement une adresse d'espace client de ce site, jamais autre chose.
    // Oublié après 90 jours : un appareil prêté ou vendu ne garde pas l'accès indéfiniment.
    const recent = typeof v?.le === 'number' && Date.now() - v.le < 90 * 86_400_000
    if (!recent) localStorage.removeItem('tapora_espace')
    return recent && typeof v.nom === 'string' && v.nom.length <= 120 && typeof v.chemin === 'string' && /^\/stats\/[A-Za-z0-9._-]{20,90}$/.test(v.chemin) ? v : null
  } catch {
    return null
  }
}

/**
 * « Bon retour, <nom de l'entreprise> » : l'appareil a déjà ouvert l'espace
 * de ce client (retenu par la page de statistiques). Un bouton l'y ramène,
 * avec l'écran « Bienvenue ». Sinon, rien : seul le formulaire s'affiche.
 */
export function RetourPortail({ langue }: { langue: Langue }) {
  const X = T[langue]
  const [espace, setEspace] = useState<Espace | null>(null)
  useEffect(() => setEspace(lireEspace()), [])
  if (!espace) return null
  const oublier = () => {
    try {
      localStorage.removeItem('tapora_espace')
    } catch {}
    setEspace(null)
  }
  const lien = `${espace.chemin}?bienvenue=1${espace.l === 'en' || espace.l === 'fr' ? `&l=${espace.l}` : ''}`
  return (
    <div className="portail-retour" data-portail-retour>
      <div className="flex items-center gap-4">
        <span className="portail-initiale" aria-hidden>
          {Array.from(espace.nom.trim())[0]?.toUpperCase() ?? 'T'}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-[var(--cl-doux)]">{X.retour}</p>
          <p className="titre-client truncate text-2xl font-medium leading-tight">
            {Array.from(espace.nom).map((c, i) => (
              <span key={i} className="portail-retour-lettre" style={{ '--i': i } as React.CSSProperties}>
                {c === ' ' ? ' ' : c}
              </span>
            ))}
          </p>
        </div>
      </div>
      <a href={lien} className="portail-bouton mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--cl-brique)] px-5 py-3.5 font-semibold text-white">
        {X.ouvrir} <span aria-hidden>→</span>
      </a>
      <p className="mt-3 text-center text-xs text-[var(--cl-doux)]">
        {X.pasVous}{' '}
        <button type="button" onClick={oublier} className="font-semibold underline underline-offset-2 hover:text-[var(--cl-encre)]">
          {X.oublier}
        </button>
      </p>
      <p className="mt-6 border-t border-[var(--cl-ligne)] pt-5 text-sm text-[var(--cl-doux)]">{X.ou}</p>
    </div>
  )
}

/**
 * Un petit aperçu vivant de l'espace : les taps du jour qui montent, les
 * barres de la semaine, et un « Ding ! » qui arrive de temps en temps.
 * Décoratif (aria-hidden) ; immobile avec « réduire les animations ».
 */
export function ApercuVivant({ langue }: { langue: Langue }) {
  const X = T[langue]
  const [taps, setTaps] = useState(12)
  const [ding, setDing] = useState(false)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let n = 12
    const cycle = setInterval(() => {
      n += 1
      setTaps(n)
      setDing(true)
      setTimeout(() => setDing(false), 2600)
      if (n > 17) n = 11
    }, 4200)
    const premier = setTimeout(() => setDing(true), 1600)
    const fin = setTimeout(() => setDing(false), 4000)
    return () => {
      clearInterval(cycle)
      clearTimeout(premier)
      clearTimeout(fin)
    }
  }, [])
  const barres = [38, 52, 44, 66, 58, 80, 72]
  return (
    <div className="portail-apercu" aria-hidden="true">
      <div className={`portail-ding ${ding ? 'portail-ding-visible' : ''}`}>
        <span className="portail-ding-icone">
          <svg viewBox="0 0 100 100" className="size-5">
            <circle cx="50" cy="50" r="49" fill="#c2552f" />
            <g transform="translate(50 50) scale(.92) translate(-50 -54)" fill="none" strokeWidth="7" strokeLinecap="round">
              <path d="M30.5 64A19.5 19.5 0 0 1 69.5 64" stroke="#f2d3c4" />
              <path d="M21.5 64A28.5 28.5 0 0 1 78.5 64" stroke="#e4a53a" />
              <path d="M12.5 64A37.5 37.5 0 0 1 87.5 64" stroke="#fffaf2" />
            </g>
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex justify-between gap-3 text-[11px] text-[var(--cl-doux)]">
            <b className="font-semibold text-[var(--cl-encre)]">Tapora</b>
            {X.maintenant}
          </span>
          <span className="block truncate text-[13px] font-semibold">🔔 {X.ding}</span>
        </span>
      </div>
      <div className="portail-apercu-carte">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[var(--cl-doux)]">{X.taps}</p>
            <p className="titre-client mt-1 text-4xl font-medium tabular-nums">
              <span key={taps} className="portail-chiffre">
                {taps}
              </span>
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--cl-sapin)]">▲ +4 {X.vsHier}</p>
          </div>
          <span className="rounded-full bg-[var(--cl-sable-2)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cl-doux)]">{X.exemple}</span>
        </div>
        <div className="mt-5 flex h-16 items-end gap-1.5">
          {barres.map((h, i) => (
            <span key={i} className="portail-barre" style={{ '--h': `${h}%`, '--i': i } as React.CSSProperties} />
          ))}
        </div>
      </div>
    </div>
  )
}
