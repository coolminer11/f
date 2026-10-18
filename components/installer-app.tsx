'use client'

import { useEffect, useState } from 'react'
import Logo from '@/components/client/logo'

type InvitationInstall = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
type Mode = 'android' | 'ios'

const CLE = 'tapora-bo-installer-plus-tard'
const PAUSE = 14 * 86_400_000
/** Le bouton de l'en-tête demande l'ouverture de la carte par cet événement. */
export const EVENEMENT_INSTALLER = 'tapora:installer'

const estInstallee = () =>
  window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

function estIos(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/**
 * Fait du back-office une app de téléphone :
 *   • enregistre le service worker (écran hors ligne, aucune donnée en cache) ;
 *   • Android / Chrome : le vrai bouton « Installer » du navigateur ;
 *   • iPhone / iPad : les trois gestes, avec l'icône Partager ;
 *   • déjà installée : rien.
 * La carte monte du bas de l'écran sur téléphone ; « Plus tard » la fait taire
 * deux semaines. Le bouton de l'en-tête la rouvre à tout moment.
 */
export default function InstallerApp() {
  const [mode, setMode] = useState<Mode | null>(null)
  const [ouverte, setOuverte] = useState(false)
  const [invitation, setInvitation] = useState<InvitationInstall | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw-bo.js', { scope: '/' }).catch(() => null)
    if (estInstallee()) return

    let minuterie: ReturnType<typeof setTimeout> | undefined
    const telephone = window.matchMedia('(max-width: 820px)').matches
    let silence = false
    try {
      silence = Date.now() - Number(localStorage.getItem(CLE) ?? 0) < PAUSE
    } catch {}

    if (estIos()) {
      setMode('ios')
      if (telephone && !silence) minuterie = setTimeout(() => setOuverte(true), 4000)
    }
    const avant = (e: Event) => {
      e.preventDefault()
      setInvitation(e as InvitationInstall)
      setMode('android')
      if (telephone && !silence) minuterie = setTimeout(() => setOuverte(true), 4000)
    }
    const installee = () => {
      setOuverte(false)
      setMode(null)
    }
    const demande = () => setOuverte(true)
    window.addEventListener('beforeinstallprompt', avant)
    window.addEventListener('appinstalled', installee)
    window.addEventListener(EVENEMENT_INSTALLER, demande)
    return () => {
      clearTimeout(minuterie)
      window.removeEventListener('beforeinstallprompt', avant)
      window.removeEventListener('appinstalled', installee)
      window.removeEventListener(EVENEMENT_INSTALLER, demande)
    }
  }, [])

  // Le bouton de l'en-tête n'apparaît que si l'installation est possible.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-installable', mode !== null)
  }, [mode])

  if (!mode || !ouverte) return null

  function plusTard() {
    try {
      localStorage.setItem(CLE, String(Date.now()))
    } catch {}
    setOuverte(false)
  }

  async function installer() {
    if (!invitation) return
    await invitation.prompt()
    const { outcome } = await invitation.userChoice
    if (outcome === 'accepted') setMode(null)
    setInvitation(null)
    setOuverte(false)
  }

  return (
    <div className="carte-installer fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md print:hidden" role="dialog" aria-label="Installer l’app Tapora">
      <div className="carte overflow-hidden !rounded-3xl p-5 shadow-2xl">
        <div className="flex items-start gap-3.5">
          <Logo className="size-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--police-fraunces)] text-lg font-semibold leading-tight">Tapora sur votre téléphone</p>
            <p className="mt-1 text-sm text-[var(--color-encre-doux)]">
              Une icône sur l’écran d’accueil, en plein écran, sans barre d’adresse. Vos ventes et vos taps en un geste.
            </p>
          </div>
          <button onClick={plusTard} className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-[var(--color-encre-doux)] hover:bg-[var(--color-fond)]" aria-label="Fermer">
            ✕
          </button>
        </div>

        {mode === 'android' ? (
          <div className="mt-4 flex gap-2">
            <button onClick={installer} className="bouton flex-1">Installer l’app</button>
            <button onClick={plusTard} className="bouton bouton-secondaire">Plus tard</button>
          </div>
        ) : (
          <ol className="mt-4 space-y-2.5 text-sm">
            <li className="flex items-center gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-accent-doux)] text-xs font-bold text-[var(--color-accent)]">1</span>
              <span>
                Touchez{' '}
                <svg viewBox="0 0 24 24" className="inline size-5 -translate-y-0.5 text-[#0a84ff]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Partager">
                  <path d="M12 15V3M8 7l4-4 4 4" />
                  <path d="M6 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
                </svg>{' '}
                <strong>Partager</strong>, en bas de Safari
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-accent-doux)] text-xs font-bold text-[var(--color-accent)]">2</span>
              <span>
                Choisissez <strong>Sur l’écran d’accueil</strong>
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-accent-doux)] text-xs font-bold text-[var(--color-accent)]">3</span>
              <span>
                Touchez <strong>Ajouter</strong> : l’icône Tapora apparaît
              </span>
            </li>
          </ol>
        )}
        {mode === 'ios' && (
          <p className="mt-3 text-[11px] leading-snug text-[var(--color-encre-doux)]">
            Dans l’app, connectez-vous une fois (mot de passe et code) : sur iPhone, elle garde sa propre session, séparée de Safari.
          </p>
        )}
      </div>
    </div>
  )
}
