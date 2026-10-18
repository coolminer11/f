'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { textes, type Langue } from '@/lib/langue'

type InvitationInstall = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const CLE = 'tapora-ecran-plus-tard'
const PAUSE = 14 * 86_400_000

/**
 * « Ajoutez cette page à votre écran d'accueil » : une petite carte qui monte
 * du bas de l'écran, quelques secondes après l'arrivée.
 *
 *   • Android / Chrome : le vrai bouton d'installation du navigateur ;
 *   • iPhone / iPad (Safari) : les trois gestes, avec l'icône « Partager » ;
 *   • déjà installée, ou ordinateur sans installation possible : rien.
 *
 * « Plus tard » la fait taire deux semaines.
 */
export default function AjouterEcran({ langue }: { langue: Langue }) {
  const T = textes(langue)
  const [mode, setMode] = useState<'android' | 'ios' | null>(null)
  const [invitation, setInvitation] = useState<InvitationInstall | null>(null)

  useEffect(() => {
    const installee =
      window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
    if (installee) return
    try {
      if (Date.now() - Number(localStorage.getItem(CLE) ?? 0) < PAUSE) return
    } catch {}

    let minuterie: ReturnType<typeof setTimeout> | undefined
    // Jamais par-dessus le « Bravo » d'un palier : on attend qu'il soit parti.
    const montrer = (m: 'android' | 'ios') => {
      if (document.querySelector('.toast-bravo')) minuterie = setTimeout(() => montrer(m), 3000)
      else setMode(m)
    }
    const ua = navigator.userAgent
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    // Sur iPhone, seul Safari sait ajouter à l'écran d'accueil (les autres
    // navigateurs iOS aussi depuis iOS 16.4, par le même menu Partager).
    if (ios) minuterie = setTimeout(() => montrer('ios'), 6000)

    const avant = (e: Event) => {
      e.preventDefault()
      setInvitation(e as InvitationInstall)
      minuterie = setTimeout(() => montrer('android'), 6000)
    }
    const installe = () => setMode(null)
    window.addEventListener('beforeinstallprompt', avant)
    window.addEventListener('appinstalled', installe)
    return () => {
      clearTimeout(minuterie)
      window.removeEventListener('beforeinstallprompt', avant)
      window.removeEventListener('appinstalled', installe)
    }
  }, [])

  function plusTard() {
    try {
      localStorage.setItem(CLE, String(Date.now()))
    } catch {}
    setMode(null)
  }

  async function installer() {
    if (!invitation) return
    await invitation.prompt()
    await invitation.userChoice.catch(() => null)
    setInvitation(null)
    setMode(null)
  }

  if (!mode) return null
  return createPortal(
    <div className="fixed inset-x-3 bottom-3 z-40 flex justify-center sm:bottom-6" role="dialog" aria-label={T.installTitre}>
      <div className="toast-install w-full max-w-md rounded-3xl bg-[#fffaf2] p-4 shadow-[0_24px_60px_-20px_rgb(60_40_20/0.45)] ring-1 ring-[#e2d6c3]">
        <div className="flex items-start gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icones/icone-192.png" alt="" className="size-12 shrink-0 rounded-[14px]" />
          <div className="min-w-0 flex-1">
            <p className="titre-client text-lg font-medium leading-tight">{T.installTitre}</p>
            <p className="mt-0.5 text-sm text-[#6b5d50]">{T.installSous}</p>
            {mode === 'ios' && (
              <p className="mt-2 text-sm leading-relaxed">
                {T.iosEtape1}{' '}
                <span className="inline-flex items-center gap-1 rounded-md bg-[#f3ebdf] px-1.5 py-0.5 align-middle font-medium">
                  <svg viewBox="0 0 24 24" className="size-4 text-[#007aff]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 3v12M8 7l4-4 4 4" />
                    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
                  </svg>
                  {T.iosPartager}
                </span>{' '}
                {T.iosEtape2} {T.iosEtape3}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={plusTard} className="rounded-full px-4 py-2 text-sm font-medium text-[#6b5d50] hover:bg-[#f3ebdf]">
            {T.plusTard}
          </button>
          {mode === 'android' && (
            <button onClick={installer} className="rounded-full bg-[#2a211a] px-5 py-2 text-sm font-medium text-[#fffaf2] hover:bg-[#c2552f]">
              {T.installer}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.getElementById('calque-client') ?? document.body,
  )
}
