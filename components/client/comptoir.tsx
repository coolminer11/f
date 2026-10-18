'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { locale, type Langue } from '@/lib/langue'
import { lancerConfettis } from '@/lib/confettis'
import Logo from '@/components/client/logo'

type Direct = { aujourdhui: number; hier_meme_heure: number; dernier_tap: string | null }

const INTERVALLE = 6000

const TX = {
  fr: {
    demarrer: 'Toucher pour démarrer',
    demarrerSous: 'Le son, le plein écran et l’écran toujours allumé s’activent.',
    aujourdhui: 'Aujourd’hui',
    taps: (n: number) => `tap${n > 1 ? 's' : ''} aujourd’hui`,
    objectif: 'Objectif du jour',
    reste: (n: number) => `plus que ${n}`,
    atteint: 'Objectif atteint !',
    atteintSous: 'Bravo l’équipe 🎉',
    record: 'Record',
    nouveauRecord: 'NOUVEAU RECORD !',
    serie: 'Série',
    jours: (n: number) => `jour${n > 1 ? 's' : ''} de suite`,
    phrase: 'La phrase du jour',
    phrases: [
      '« Un petit tap ici nous aide énormément — ça prend 10 secondes ! »',
      '« Si vous avez aimé, approchez votre téléphone de la carte : c’est tout ! »',
      '« Un avis en une phrase, ça nous fait vraiment plaisir. Merci ! »',
      '« Approchez le haut de votre iPhone ici, et le tour est joué. »',
    ],
    merci: ['Merci ! ⭐', 'Un client heureux de plus !', 'Et un de plus !', 'Bravo l’équipe !', 'Ça tape !', 'Superbe !', 'Encore un !'],
    son: 'Son',
    sansSon: 'Muet',
    retour: 'Quitter',
    hors: 'Reconnexion…',
    matin: 'Bon matin',
    apm: 'Bon après-midi',
    soir: 'Bonsoir',
  },
  en: {
    demarrer: 'Tap to start',
    demarrerSous: 'Sound, full screen and keep-awake turn on.',
    aujourdhui: 'Today',
    taps: (n: number) => `tap${n > 1 ? 's' : ''} today`,
    objectif: 'Today’s goal',
    reste: (n: number) => `${n} to go`,
    atteint: 'Goal reached!',
    atteintSous: 'Way to go, team 🎉',
    record: 'Best day',
    nouveauRecord: 'NEW RECORD!',
    serie: 'Streak',
    jours: (n: number) => `day${n > 1 ? 's' : ''} in a row`,
    phrase: 'Line of the day',
    phrases: [
      '“A quick tap here helps us a ton — it takes 10 seconds!”',
      '“If you enjoyed it, just hold your phone near the card — that’s it!”',
      '“A one-sentence review means a lot to us. Thank you!”',
      '“Hold the top of your iPhone here and you’re done.”',
    ],
    merci: ['Thank you! ⭐', 'One more happy customer!', 'And another one!', 'Go team!', 'Tap tap tap!', 'Awesome!', 'Keep them coming!'],
    son: 'Sound',
    sansSon: 'Muted',
    retour: 'Exit',
    hors: 'Reconnecting…',
    matin: 'Good morning',
    apm: 'Good afternoon',
    soir: 'Good evening',
  },
}

/** Un « ding-ding » doux, synthétisé (aucun fichier son à charger). */
function ding(ctx: AudioContext, fort = false) {
  const t0 = ctx.currentTime
  const notes = fort ? [1046.5, 1318.5, 1568, 2093] : [1318.5, 1760]
  notes.forEach((f, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = f
    const t = t0 + i * (fort ? 0.11 : 0.14)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.28, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
    o.connect(g).connect(ctx.destination)
    o.start(t)
    o.stop(t + 1.2)
  })
}

export default function Comptoir({
  jeton,
  langue,
  nom,
  jour,
  initial,
  objectif,
  record,
  serie,
  serieInclutAujourdhui,
  retour,
}: {
  jeton: string
  langue: Langue
  nom: string
  jour: string
  initial: Direct
  objectif: number
  record: number
  serie: number
  serieInclutAujourdhui: boolean
  retour: string
}) {
  const T = TX[langue]
  const fmt = new Intl.NumberFormat(locale(langue))
  const [demarre, setDemarre] = useState(false)
  const [son, setSon] = useState(true)
  const [n, setN] = useState(initial.aujourdhui)
  const [affiche, setAffiche] = useState(initial.aujourdhui)
  const [enLigne, setEnLigne] = useState(true)
  const [bulle, setBulle] = useState<{ texte: string; plus: number; cle: number } | null>(null)
  const [fete, setFete] = useState<'objectif' | 'record' | null>(null)
  const [heure, setHeure] = useState('')
  const [h, setH] = useState<number | null>(null)
  const [phrase, setPhrase] = useState(0)
  const audio = useRef<AudioContext | null>(null)
  const chiffre = useRef<HTMLDivElement>(null)
  const precedent = useRef(initial.aujourdhui)
  const verrou = useRef<{ release: () => Promise<void> } | null>(null)
  const sonRef = useRef(son)
  sonRef.current = son

  const compter = useCallback((de: number, a: number) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setAffiche(a)
    const debut = performance.now()
    const pas = (t: number) => {
      const p = Math.min(1, (t - debut) / 900)
      setAffiche(Math.round(de + (a - de) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(pas)
    }
    requestAnimationFrame(pas)
  }, [])

  // Horloge, phrase du jour qui tourne, et rechargement à minuit (nouveau jour, nouvel objectif).
  useEffect(() => {
    const maj = () => {
      const d = new Date()
      setHeure(d.toLocaleTimeString(locale(langue), { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' }))
      setH(Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: 'numeric', hourCycle: 'h23' }).format(d)))
      const ici = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
      if (ici !== jour) window.location.reload()
    }
    maj()
    const a = setInterval(maj, 10_000)
    const b = setInterval(() => setPhrase((p) => (p + 1) % T.phrases.length), 20_000)
    return () => {
      clearInterval(a)
      clearInterval(b)
    }
  }, [jour, langue, T.phrases.length])

  // Le sondage : un nouveau tap = ding, confettis, chiffre qui bondit.
  useEffect(() => {
    let vivant = true
    async function sonder() {
      try {
        const r = await fetch(`/api/stats/${jeton}/direct`, { cache: 'no-store' })
        if (!vivant) return
        if (!r.ok) return setEnLigne(false)
        const d: Direct = await r.json()
        setEnLigne(true)
        const avant = precedent.current
        if (d.aujourdhui > avant) {
          const plus = d.aujourdhui - avant
          const objectifFranchi = avant < objectif && d.aujourdhui >= objectif
          const recordBattu = record > 0 && avant <= record && d.aujourdhui > record
          if (sonRef.current && audio.current) ding(audio.current, objectifFranchi || recordBattu)
          setBulle({ texte: T.merci[Math.floor(Math.random() * T.merci.length)], plus, cle: Date.now() })
          chiffre.current?.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }],
            { duration: 700, easing: 'cubic-bezier(.2,.9,.3,1.4)' },
          )
          lancerConfettis({ depuis: chiffre.current, nombre: objectifFranchi || recordBattu ? 220 : 90 })
          if (objectifFranchi || recordBattu) {
            setFete(recordBattu ? 'record' : 'objectif')
            setTimeout(() => lancerConfettis({ nombre: 200 }), 500)
            setTimeout(() => setFete(null), 6000)
          }
        }
        if (d.aujourdhui !== avant) compter(avant, d.aujourdhui)
        precedent.current = d.aujourdhui
        setN(d.aujourdhui)
      } catch {
        if (vivant) setEnLigne(false)
      }
    }
    const t = setInterval(sonder, INTERVALLE)
    return () => {
      vivant = false
      clearInterval(t)
    }
  }, [jeton, objectif, record, compter, T.merci])

  // L'écran reste allumé ; le verrou se perd quand l'onglet est caché, on le reprend.
  useEffect(() => {
    if (!demarre) return
    const prendre = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
        verrou.current = (await nav.wakeLock?.request('screen')) ?? null
      } catch {}
    }
    prendre()
    const retourVisible = () => document.visibilityState === 'visible' && prendre()
    document.addEventListener('visibilitychange', retourVisible)
    return () => {
      document.removeEventListener('visibilitychange', retourVisible)
      verrou.current?.release().catch(() => {})
    }
  }, [demarre])

  function demarrer() {
    try {
      audio.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      ding(audio.current)
    } catch {}
    document.documentElement.requestFullscreen?.().catch(() => {})
    setDemarre(true)
    compter(0, precedent.current)
  }

  const salut = h === null ? '' : h >= 5 && h < 12 ? T.matin : h >= 12 && h < 18 ? T.apm : T.soir
  const progres = Math.min(1, n / objectif)
  const reste = Math.max(0, objectif - n)
  const serieJours = serie + (!serieInclutAujourdhui && n > 0 ? 1 : 0)

  return (
    <div className="comptoir fixed inset-0 overflow-y-auto overflow-x-hidden text-[#fffaf2]">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="comptoir-halo comptoir-halo-1" />
        <div className="comptoir-halo comptoir-halo-2" />
      </div>

      <div className="relative flex min-h-full flex-col gap-6 p-5 sm:p-8 lg:p-10">
        {/* En-tête */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Logo className="size-10 shrink-0" />
            <div className="min-w-0">
              <p className="titre-client truncate text-xl font-medium sm:text-2xl">{nom}</p>
              <p className="flex items-center gap-2 text-sm text-[#fffaf2]/60">
                <span className={`point-direct ${enLigne ? '' : 'point-direct-pause'}`} aria-hidden />
                {enLigne ? salut : T.hors}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="titre-client hidden whitespace-nowrap text-3xl font-medium tabular-nums sm:inline lg:text-4xl">{heure}</span>
            <button onClick={() => setSon((s) => !s)} className="rounded-full bg-white/10 px-3 py-2 text-sm hover:bg-white/20" aria-pressed={son}>
              {son ? '🔔' : '🔕'} <span className="hidden sm:inline">{son ? T.son : T.sansSon}</span>
            </button>
            <a href={retour} className="rounded-full bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
              ✕ <span className="hidden sm:inline">{T.retour}</span>
            </a>
          </div>
        </header>

        {/* Le chiffre du jour */}
        <main className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-lg uppercase tracking-[0.3em] text-[#f6c9a8] sm:text-xl">{T.aujourdhui}</p>
          <div className="relative">
            <div ref={chiffre} className="titre-client font-medium leading-none tabular-nums" style={{ fontSize: 'clamp(6rem, min(30vh, 45vw), 22rem)' }}>
              {fmt.format(affiche)}
            </div>
            {bulle && (
              <div key={bulle.cle} className="bulle-comptoir pointer-events-none absolute left-1/2 top-0" aria-live="polite">
                <span className="rounded-full bg-[#2f9e6a] px-4 py-1.5 text-2xl font-bold">+{bulle.plus}</span>
                <span className="mt-3 block whitespace-nowrap rounded-full bg-[#2a211a]/70 px-4 py-1 text-2xl font-medium backdrop-blur">{bulle.texte}</span>
              </div>
            )}
          </div>
          <p className="mt-2 text-xl text-[#fffaf2]/70 sm:text-2xl">{T.taps(n)}</p>

          <div className="mt-8 w-full max-w-2xl">
            <div className="flex items-baseline justify-between text-base sm:text-lg">
              <span className="font-medium">
                {T.objectif}
                {langue === 'fr' ? ' : ' : ': '}
                {fmt.format(objectif)}
              </span>
              <span className={reste === 0 ? 'font-semibold text-[#9ee0bd]' : 'text-[#fffaf2]/70'}>{reste === 0 ? `✓ ${T.atteint}` : T.reste(reste)}</span>
            </div>
            <div className="mt-2 h-5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-[width] duration-1000 ease-out ${reste === 0 ? 'bg-gradient-to-r from-[#2f9e6a] to-[#9ee0bd]' : 'bg-gradient-to-r from-[#c2552f] to-[#eda100]'}`}
                style={{ width: `${Math.max(2, progres * 100)}%` }}
              />
            </div>
          </div>
        </main>

        {/* Bas : série, record, phrase du jour */}
        <footer className="grid grid-cols-2 gap-3 sm:grid-cols-[auto_auto_minmax(0,1fr)] sm:gap-4">
          <div className="rounded-3xl bg-white/[0.07] px-5 py-4">
            <p className="text-sm text-[#fffaf2]/60">🔥 {T.serie}</p>
            <p className="titre-client text-3xl font-medium tabular-nums">
              {fmt.format(serieJours)} <span className="text-base text-[#fffaf2]/60">{T.jours(serieJours)}</span>
            </p>
          </div>
          <div className="rounded-3xl bg-white/[0.07] px-5 py-4">
            <p className="text-sm text-[#fffaf2]/60">🏆 {T.record}</p>
            <p className="titre-client text-3xl font-medium tabular-nums">{fmt.format(Math.max(record, n))}</p>
          </div>
          <div className="col-span-2 rounded-3xl bg-white/[0.07] px-5 py-4 sm:col-span-1">
            <p className="text-sm text-[#fffaf2]/60">🗣️ {T.phrase}</p>
            <p key={phrase} className="phrase-comptoir mt-1 text-lg leading-snug sm:text-xl">
              {T.phrases[phrase]}
            </p>
          </div>
        </footer>
      </div>

      {fete && (
        <div className="fete-comptoir pointer-events-none absolute inset-0 grid place-items-center bg-[#2a211a]/60 backdrop-blur-sm" role="status">
          <div className="text-center">
            <p className="text-7xl sm:text-8xl" aria-hidden>
              {fete === 'record' ? '🏆' : '🎯'}
            </p>
            <p className="titre-client mt-4 text-5xl font-medium sm:text-7xl">{fete === 'record' ? T.nouveauRecord : T.atteint}</p>
            <p className="mt-3 text-2xl text-[#f6c9a8]">{T.atteintSous}</p>
          </div>
        </div>
      )}

      {!demarre && (
        <button onClick={demarrer} className="demarrer-comptoir absolute inset-0 grid place-items-center bg-[#2a211a]/85 backdrop-blur-md">
          <span className="text-center">
            <span className="mx-auto grid size-28 place-items-center rounded-full bg-[#c2552f] text-5xl shadow-[0_0_0_14px_rgb(194_85_47/0.25)]" aria-hidden>
              ▶
            </span>
            <span className="titre-client mt-8 block text-4xl font-medium sm:text-5xl">{T.demarrer}</span>
            <span className="mt-3 block text-lg text-[#fffaf2]/70">{T.demarrerSous}</span>
          </span>
        </button>
      )}
    </div>
  )
}
