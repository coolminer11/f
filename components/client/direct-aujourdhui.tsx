'use client'

import { useEffect, useRef, useState } from 'react'
import { dateCourte, depuisL, locale, textes, type Langue } from '@/lib/langue'

type Direct = { aujourdhui: number; hier_meme_heure: number; dernier_tap: string | null }

const INTERVALLE = 15_000

/**
 * Le compteur du jour, en direct : il se met à jour tout seul toutes les
 * 15 secondes, et chaque nouveau tap se voit (« +1 » qui s'envole, chiffre
 * qui bondit). À côté, la série de jours d'affilée et le record — qu'on peut
 * battre sous ses yeux.
 *
 * Onglet caché : on ne sonde pas, on rattrape au retour.
 */
export default function DirectAujourdhui({
  jeton,
  langue,
  initial,
  record,
  serie,
}: {
  jeton: string
  langue: Langue
  initial: Direct
  record: { taps: number; jour: string | null }
  serie: { jours: number; inclutAujourdhui: boolean }
}) {
  const T = textes(langue)
  const fmt = new Intl.NumberFormat(locale(langue))
  const [d, setD] = useState(initial)
  const [affiche, setAffiche] = useState(initial.aujourdhui)
  const [enLigne, setEnLigne] = useState(true)
  const [gain, setGain] = useState<{ n: number; cle: number } | null>(null)
  const [, setTic] = useState(0)
  const precedent = useRef(initial.aujourdhui)
  const chiffre = useRef<HTMLSpanElement>(null)

  // Le chiffre compte jusqu'à sa valeur, à l'arrivée puis à chaque nouveau tap.
  function compter(de: number, a: number, duree: number) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || de === a) return setAffiche(a)
    const debut = performance.now()
    const pas = (t: number) => {
      const p = Math.min(1, (t - debut) / duree)
      setAffiche(Math.round(de + (a - de) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(pas)
    }
    requestAnimationFrame(pas)
  }

  useEffect(() => {
    const attente = setTimeout(() => compter(0, initial.aujourdhui, 1400), 450)
    return () => clearTimeout(attente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let vivant = true
    async function sonder() {
      if (!vivant || document.hidden) return
      try {
        const r = await fetch(`/api/stats/${jeton}/direct`, { cache: 'no-store' })
        if (!vivant) return
        if (!r.ok) return setEnLigne(false)
        const n: Direct = await r.json()
        setEnLigne(true)
        setD(n)
        const avant = precedent.current
        if (n.aujourdhui !== avant) {
          if (n.aujourdhui > avant) {
            setGain({ n: n.aujourdhui - avant, cle: Date.now() })
            chiffre.current?.animate(
              [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
              { duration: 600, easing: 'cubic-bezier(.2,.9,.3,1.4)' },
            )
          }
          compter(avant, n.aujourdhui, 900)
          precedent.current = n.aujourdhui
        }
      } catch {
        if (vivant) setEnLigne(false)
      }
    }
    const minuterie = setInterval(sonder, INTERVALLE)
    // « il y a 2 min » vieillit même sans nouveau tap.
    const horloge = setInterval(() => setTic((x) => x + 1), 30_000)
    const auRetour = () => !document.hidden && sonder()
    document.addEventListener('visibilitychange', auRetour)
    return () => {
      vivant = false
      clearInterval(minuterie)
      clearInterval(horloge)
      document.removeEventListener('visibilitychange', auRetour)
    }
  }, [jeton])

  const n = d.aujourdhui
  const nouveauRecord = record.taps > 0 && n > record.taps
  const recordEgal = record.taps > 0 && n === record.taps
  const meilleur = Math.max(record.taps, n)
  // La série s'allonge en direct dès le premier tap du jour.
  const serieJours = serie.jours + (!serie.inclutAujourdhui && n > 0 ? 1 : 0)
  const devant = n > d.hier_meme_heure && d.hier_meme_heure > 0

  return (
    <div className="carte direct-client relative overflow-hidden p-6 sm:p-7" data-tuile aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <span className={`point-direct ${enLigne ? '' : 'point-direct-pause'}`} aria-hidden />
          {enLigne ? T.direct : T.reconnexion}
        </span>
        <span className="text-[var(--cl-doux)]">
          {T.dernierTap} {depuisL(d.dernier_tap, langue)}
        </span>
      </div>

      <div className="mt-4 grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="text-sm text-[var(--cl-doux)]">{T.aujourdhui}</p>
          <p className="mt-1 flex items-baseline gap-3">
            <span className="relative">
              <span ref={chiffre} className="titre-client inline-block origin-left text-7xl font-medium leading-none tabular-nums sm:text-8xl">
                {fmt.format(affiche)}
              </span>
              {gain && (
                <span key={gain.cle} className="gain-direct" aria-hidden>
                  +{gain.n}
                </span>
              )}
            </span>
            <span className="text-lg text-[var(--cl-doux)]">{T.tapsAujourdhui(n)}</span>
          </p>
          <p className={`mt-3 text-sm font-medium ${devant ? 'text-[var(--cl-sapin)]' : 'text-[var(--cl-doux)]'}`}>
            {nouveauRecord ? (
              <span className="badge-record">★ {T.nouveauRecord}</span>
            ) : recordEgal ? (
              <span className="badge-record">★ {T.recordEgal}</span>
            ) : devant ? (
              `▲ ${T.devantHier} (${fmt.format(d.hier_meme_heure)})`
            ) : (
              T.hierMemeHeure(d.hier_meme_heure)
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:w-72">
          <div className="rounded-2xl bg-[var(--cl-creme)] p-4" title={T.serieAide}>
            <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--cl-doux)]">
              <svg viewBox="0 0 24 24" className="size-4 text-[var(--cl-brique)]" fill="currentColor" aria-hidden>
                <path d="M12 2c.6 3.2 2.4 4.9 4 6.6 1.7 1.8 3 3.7 3 6.4A7 7 0 0 1 5 15c0-2.2 1-4 2.6-5.3-.1 1.7.6 3 1.9 3.6C9 9 10.6 5.6 12 2Z" />
              </svg>
              {T.serie}
            </p>
            <p className="titre-client mt-1 text-3xl font-medium tabular-nums">{fmt.format(serieJours)}</p>
            <p className="text-xs text-[var(--cl-doux)]">{T.serieUnite(serieJours)}</p>
          </div>
          <div className="rounded-2xl bg-[var(--cl-creme)] p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--cl-doux)]">
              <svg viewBox="0 0 24 24" className="size-4 text-[var(--cl-attention)]" fill="currentColor" aria-hidden>
                <path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.7V7Zm10 0v2.7A2 2 0 0 0 18 8V7h-1Z" />
              </svg>
              {T.record}
            </p>
            <p className="titre-client mt-1 text-3xl font-medium tabular-nums">{fmt.format(meilleur)}</p>
            <p className="truncate text-xs text-[var(--cl-doux)]">
              {nouveauRecord || (!record.jour && n > 0) ? T.aujourdhui.toLowerCase() : record.jour ? dateCourte(record.jour, langue) : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
