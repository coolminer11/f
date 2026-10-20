'use client'

import { useEffect, useState } from 'react'
import { abonnerPush, clePubliquePush, desabonnerPush, essaiPush } from '@/app/stats/[jeton]/actions'
import type { Langue } from '@/lib/langue'

const TX = {
  fr: {
    titre: 'Le « Ding ! » à chaque tap',
    sous: 'Une notification sur votre téléphone dès qu’un client tape votre carte. Et une spéciale pour chaque record.',
    activer: 'Activer le Ding',
    desactiver: 'Désactiver',
    actives: 'Activé sur cet appareil',
    essai: 'Envoyer un essai',
    essaiOk: 'Essai envoyé : regardez vos notifications !',
    essaiKo: 'L’essai n’est pas parti. Réessayez dans un instant.',
    refuse: 'Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur, puis réessayez.',
    ios: 'Sur iPhone, Apple réserve les notifications aux pages ajoutées à l’écran d’accueil : ajoutez d’abord cette page (Partager → « Sur l’écran d’accueil »), puis ouvrez-la depuis l’icône.',
    nonSupporte: 'Ce navigateur ne prend pas en charge les notifications. Essayez Chrome, Safari ou Firefox à jour.',
    erreur: 'Impossible d’activer pour l’instant. Réessayez dans un instant.',
    patience: 'Un instant…',
  },
  en: {
    titre: 'The “Ding!” on every tap',
    sous: 'A notification on your phone as soon as a customer taps your card. And a special one for every record.',
    activer: 'Turn on the Ding',
    desactiver: 'Turn off',
    actives: 'On for this device',
    essai: 'Send a test',
    essaiOk: 'Test sent: check your notifications!',
    essaiKo: 'The test didn’t go through. Try again in a moment.',
    refuse: 'Notifications are blocked for this site. Allow them in your browser settings, then try again.',
    ios: 'On iPhone, Apple only allows notifications for pages added to the home screen: add this page first (Share → “Add to Home Screen”), then open it from the icon.',
    nonSupporte: 'This browser doesn’t support notifications. Try an up-to-date Chrome, Safari or Firefox.',
    erreur: 'Couldn’t turn it on right now. Try again in a moment.',
    patience: 'One moment…',
  },
}

type Etat = 'chargement' | 'inactif' | 'actif' | 'refuse' | 'ios' | 'non-supporte'

function base64VersOctets(b64: string): Uint8Array<ArrayBuffer> {
  const p = '='.repeat((4 - (b64.length % 4)) % 4)
  const brut = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'))
  const o = new Uint8Array(new ArrayBuffer(brut.length))
  for (let i = 0; i < brut.length; i++) o[i] = brut.charCodeAt(i)
  return o
}

/**
 * Activer le « Ding ! » sur cet appareil. Le service worker (/stats/sw.js)
 * reçoit les notifications ; l'abonnement est rattaché au dossier, et
 * disparaît tout seul si l'appareil le révoque.
 */
export default function NotificationsDing({ jeton, langue }: { jeton: string; langue: Langue }) {
  const T = TX[langue]
  const [etat, setEtat] = useState<Etat>('chargement')
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [endpoint, setEndpoint] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const ua = navigator.userAgent
      const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
      const installee = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        return setEtat(ios && !installee ? 'ios' : 'non-supporte')
      }
      if (Notification.permission === 'denied') return setEtat('refuse')
      const reg = await navigator.serviceWorker.getRegistration('/stats/')
      const abo = await reg?.pushManager.getSubscription()
      if (abo) {
        setEndpoint(abo.endpoint)
        setEtat('actif')
      } else setEtat('inactif')
    })().catch(() => setEtat('non-supporte'))
  }, [])

  async function activer() {
    setOccupe(true)
    setMessage(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return setEtat(permission === 'denied' ? 'refuse' : 'inactif')
      const reg = await navigator.serviceWorker.register('/stats/sw.js', { scope: '/stats/' })
      await navigator.serviceWorker.ready
      const cle = await clePubliquePush()
      const abo = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64VersOctets(cle) }))
      const ok = await abonnerPush(jeton, abo.toJSON(), langue)
      if (!ok) throw new Error()
      setEndpoint(abo.endpoint)
      setEtat('actif')
      const essai = await essaiPush(jeton, abo.endpoint)
      setMessage(essai ? T.essaiOk : null)
    } catch {
      setMessage(T.erreur)
    } finally {
      setOccupe(false)
    }
  }

  async function desactiver() {
    setOccupe(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/stats/')
      const abo = await reg?.pushManager.getSubscription()
      if (abo) {
        await desabonnerPush(jeton, abo.endpoint)
        await abo.unsubscribe()
      }
      setEndpoint(null)
      setEtat('inactif')
      setMessage(null)
    } finally {
      setOccupe(false)
    }
  }

  async function essayer() {
    if (!endpoint) return
    setOccupe(true)
    const ok = await essaiPush(jeton, endpoint).catch(() => false)
    setMessage(ok ? T.essaiOk : T.essaiKo)
    setOccupe(false)
  }

  return (
    <section className="carte relative overflow-hidden p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <span className={`cloche grid size-14 shrink-0 place-items-center rounded-2xl text-3xl ${etat === 'actif' ? 'cloche-active bg-[var(--cl-vert-pale)]' : 'bg-[var(--cl-creme)]'}`} aria-hidden>
          🔔
        </span>
        <div className="min-w-0">
          <h2>{T.titre}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--cl-doux)]">{T.sous}</p>
        </div>
      </div>

      <div className="mt-5">
        {etat === 'chargement' && <p className="text-sm text-[var(--cl-doux)]">{T.patience}</p>}
        {etat === 'inactif' && (
          <button onClick={activer} disabled={occupe} className="rounded-full bg-[var(--cl-nuit)] px-6 py-3 text-sm font-semibold text-[var(--cl-sur-nuit)] transition hover:-translate-y-0.5 hover:bg-[var(--cl-brique)] disabled:opacity-60">
            {occupe ? T.patience : T.activer}
          </button>
        )}
        {etat === 'actif' && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--cl-vert-pale)] px-4 py-2 text-sm font-medium text-[var(--cl-sapin)]">
              <span className="point-direct" aria-hidden /> {T.actives}
            </span>
            <button onClick={essayer} disabled={occupe} className="rounded-full bg-[var(--cl-sable)] px-4 py-2 text-sm font-medium hover:bg-[var(--cl-sable-2)] disabled:opacity-60">
              {T.essai}
            </button>
            <button onClick={desactiver} disabled={occupe} className="text-sm text-[var(--cl-doux)] underline-offset-4 hover:underline disabled:opacity-60">
              {T.desactiver}
            </button>
          </div>
        )}
        {etat === 'refuse' && <p className="rounded-2xl bg-[var(--cl-rose-pale)] px-4 py-3 text-sm text-[var(--cl-brique-fonce)]">{T.refuse}</p>}
        {etat === 'ios' && <p className="rounded-2xl bg-[var(--cl-creme)] px-4 py-3 text-sm leading-relaxed">{T.ios}</p>}
        {etat === 'non-supporte' && <p className="text-sm text-[var(--cl-doux)]">{T.nonSupporte}</p>}
        {message && <p className="mt-3 text-sm font-medium text-[var(--cl-sapin)]" role="status">{message}</p>}
      </div>
    </section>
  )
}
