'use client'

import { useEffect, useRef, useState } from 'react'
import type { Surprise } from '@/lib/surprises'
import type { Langue } from '@/lib/langue'
import { lancerConfettis } from '@/lib/confettis'

const TX = {
  fr: {
    titre: 'La surprise du jour',
    ouvrir: 'Touchez pour ouvrir',
    prochaine: (h: number, m: number) => `Nouvelle surprise dans ${h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`}`,
    numero: (n: number, total: number) => `Surprise ${n} sur ${total}`,
  },
  en: {
    titre: 'Today’s surprise',
    ouvrir: 'Tap to open',
    prochaine: (h: number, m: number) => `New surprise in ${h > 0 ? `${h}h ${String(m).padStart(2, '0')}` : `${m} min`}`,
    numero: (n: number, total: number) => `Surprise ${n} of ${total}`,
  },
}

/** Minutes avant minuit, heure du Québec. */
function avantMinuit(): number {
  const ici = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  return 24 * 60 - (ici.getHours() * 60 + ici.getMinutes())
}

/**
 * Une boîte cadeau : on la touche, le couvercle saute, la surprise du jour
 * apparaît. Une fois ouverte, elle reste ouverte jusqu'à minuit (le
 * navigateur s'en souvient), et un compte à rebours annonce la suivante.
 */
export default function SurpriseDuJour({
  surprise,
  jour,
  langue,
  rang,
  total,
}: {
  surprise: Surprise
  jour: string
  langue: Langue
  rang: number
  total: number
}) {
  const T = TX[langue]
  const cle = `tapora-surprise-${jour}`
  const [ouverte, setOuverte] = useState(false)
  const [restant, setRestant] = useState<number | null>(null)
  const boite = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(cle) === surprise.id) setOuverte(true)
    } catch {}
    setRestant(avantMinuit())
    const t = setInterval(() => setRestant(avantMinuit()), 30_000)
    return () => clearInterval(t)
  }, [cle, surprise.id])

  function ouvrir() {
    if (ouverte) return
    try {
      localStorage.setItem(cle, surprise.id)
    } catch {}
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduit || !boite.current) return setOuverte(true)
    boite.current.classList.add('boite-ouvre')
    lancerConfettis({ depuis: boite.current, nombre: 70, duree: 2.6 })
    setTimeout(() => setOuverte(true), 520)
  }

  return (
    <section className="carte relative flex min-h-[15rem] flex-col overflow-hidden p-6 sm:p-7">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[#f6dccd] opacity-60" />
      <div className="relative flex items-baseline justify-between gap-2">
        <h2>{T.titre}</h2>
        <span className="text-xs text-[#6b5d50]">{T.numero(rang, total)}</span>
      </div>

      <div className="relative flex flex-1 items-center justify-center py-4">
        {ouverte ? (
          <div className="surprise-revele w-full">
            <div className="flex items-start gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#f6ecdf] text-3xl" aria-hidden>
                {surprise.emoji}
              </span>
              <div className="min-w-0">
                <p className="titre-client text-2xl font-medium leading-tight">{surprise.titre}</p>
                <p className="mt-2 leading-relaxed text-[#6b5d50]">{surprise.texte}</p>
              </div>
            </div>
          </div>
        ) : (
          <button ref={boite} onClick={ouvrir} className="boite-cadeau group flex flex-col items-center gap-3" aria-label={`${T.titre} — ${T.ouvrir}`}>
            <svg viewBox="0 0 120 120" className="size-28 drop-shadow-[0_14px_18px_rgb(120_50_20/.25)]" aria-hidden>
              <g className="boite-couvercle">
                <rect x="14" y="34" width="92" height="22" rx="6" fill="#d96a40" />
                <rect x="54" y="34" width="12" height="22" fill="#eda100" />
                <path d="M60 34c-6-14-26-18-26-6 0 7 14 7 26 6Z" fill="#eda100" />
                <path d="M60 34c6-14 26-18 26-6 0 7-14 7-26 6Z" fill="#f2b632" />
              </g>
              <rect x="20" y="56" width="80" height="50" rx="6" fill="#c2552f" />
              <rect x="54" y="56" width="12" height="50" fill="#eda100" />
              <rect x="20" y="56" width="80" height="6" fill="#000" opacity=".08" />
            </svg>
            <span className="rounded-full bg-[#2a211a] px-4 py-1.5 text-sm font-medium text-[#fffaf2] transition group-hover:bg-[#c2552f]">{T.ouvrir}</span>
          </button>
        )}
      </div>

      {restant !== null && (
        <p className="relative text-center text-xs text-[#6b5d50]">⏳ {T.prochaine(Math.floor(restant / 60), restant % 60)}</p>
      )}
    </section>
  )
}
