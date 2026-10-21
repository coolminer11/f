'use client'

import { useEffect, useRef, useState } from 'react'
import { TEXTES_PORTAIL, type LanguePortail } from '@/components/services/portail/textes'

function base64VersOctets(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const brut = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const sortie = new Uint8Array(new ArrayBuffer(brut.length))
  for (let i = 0; i < brut.length; i++) sortie[i] = brut.charCodeAt(i)
  return sortie
}

type EtatPush = 'chargement' | 'non-supporte' | 'refuse' | 'inactif' | 'actif'

const pushSupporte = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/**
 * Les réglages de CET appareil : le prénom montré aux clients (« Marie
 * arrive »), le son, et les notifications (même portail fermé), pour tous les
 * secteurs ou un seul.
 */
export default function PanneauAppareil({
  jeton,
  l,
  cle,
  prenom,
  groupes,
  son,
  onPrenom,
  onSon,
  onFermer,
}: {
  jeton: string
  l: LanguePortail
  cle: string
  prenom: string
  groupes: string[]
  son: boolean
  onPrenom: (v: string) => void
  onSon: (v: boolean) => void
  onFermer: () => void
}) {
  const T = TEXTES_PORTAIL[l]
  const [nom, setNom] = useState(prenom)
  const [push, setPush] = useState<EtatPush>('chargement')
  const [groupe, setGroupe] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<{ ton: 'ok' | 'erreur'; texte: string } | null>(null)
  const panneau = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      setGroupe(localStorage.getItem(`${cle}:push-groupe`) ?? '')
    } catch {}
    if (!pushSupporte()) return setPush('non-supporte')
    if (Notification.permission === 'denied') return setPush('refuse')
    navigator.serviceWorker
      .getRegistration('/service/')
      .then((r) => r?.pushManager.getSubscription())
      .then((a) => setPush(a ? 'actif' : 'inactif'))
      .catch(() => setPush('inactif'))
  }, [cle])

  // La file se redessine chaque seconde : on garde la dernière fermeture sans refaire le focus.
  const fermeture = useRef(onFermer)
  fermeture.current = onFermer
  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && fermeture.current()
    document.addEventListener('keydown', touche)
    panneau.current?.focus()
    return () => document.removeEventListener('keydown', touche)
  }, [])

  async function inscrire(g: string) {
    const enregistrement = await navigator.serviceWorker.register('/service/sw.js', { scope: '/service/' })
    await navigator.serviceWorker.ready
    const { cle: publique } = (await (await fetch(`/api/service/${jeton}/push`, { cache: 'no-store' })).json()) as { cle?: string }
    if (!publique) throw new Error('cle')
    const abonnement =
      (await enregistrement.pushManager.getSubscription()) ??
      (await enregistrement.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64VersOctets(publique) }))
    const r = await fetch(`/api/service/${jeton}/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...abonnement.toJSON(), groupe: g || null }),
    })
    if (!r.ok || !(await r.json()).ok) throw new Error('inscription')
  }

  async function activer() {
    setOccupe(true)
    setMessage(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPush(permission === 'denied' ? 'refuse' : 'inactif')
        setMessage({ ton: 'erreur', texte: T.pushRefuse })
        return
      }
      await inscrire(groupe)
      setPush('actif')
      setMessage({ ton: 'ok', texte: T.pushOk })
    } catch {
      setMessage({ ton: 'erreur', texte: T.pushErreur })
    } finally {
      setOccupe(false)
    }
  }

  async function desactiver() {
    setOccupe(true)
    setMessage(null)
    try {
      const a = await (await navigator.serviceWorker.getRegistration('/service/'))?.pushManager.getSubscription()
      if (a) {
        await fetch(`/api/service/${jeton}/push`, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: a.endpoint }),
        }).catch(() => null)
        await a.unsubscribe()
      }
      setPush('inactif')
    } catch {
      setMessage({ ton: 'erreur', texte: T.pushErreur })
    } finally {
      setOccupe(false)
    }
  }

  async function essai() {
    setOccupe(true)
    setMessage(null)
    try {
      const r = await fetch(`/api/service/${jeton}/push?essai=1`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ groupe: groupe || null }),
      })
      const ok = r.ok && (await r.json()).ok
      setMessage(ok ? { ton: 'ok', texte: T.pushEssaiOk } : { ton: 'erreur', texte: T.pushErreur })
    } catch {
      setMessage({ ton: 'erreur', texte: T.pushErreur })
    } finally {
      setOccupe(false)
    }
  }

  async function changerGroupe(g: string) {
    setGroupe(g)
    try {
      if (g) localStorage.setItem(`${cle}:push-groupe`, g)
      else localStorage.removeItem(`${cle}:push-groupe`)
    } catch {}
    // Déjà abonné : on réinscrit le même appareil avec le nouveau secteur.
    if (push === 'actif') {
      setOccupe(true)
      try {
        await inscrire(g)
        setMessage({ ton: 'ok', texte: T.pushOk })
      } catch {
        setMessage({ ton: 'erreur', texte: T.pushErreur })
      } finally {
        setOccupe(false)
      }
    }
  }

  function garderNom() {
    const v = nom.trim().slice(0, 40)
    setNom(v)
    if (v !== prenom) onPrenom(v)
  }

  return (
    <>
      <div className="pt-voile" onClick={onFermer} aria-hidden />
      <div ref={panneau} className="pt-panneau p-6 outline-none" role="dialog" aria-modal="true" aria-labelledby="panneau-titre" tabIndex={-1}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="panneau-titre" className="titre-portail text-2xl font-medium">
            {T.cetAppareil}
          </h2>
          <button type="button" onClick={onFermer} className="pt-bouton-fantome !px-3 !py-2 text-sm" aria-label={T.fermer}>
            ✕
          </button>
        </div>

        {/* Prénom */}
        <div className="mt-6">
          <label className="pt-etiquette" htmlFor="prenom-portail">
            {T.vousEtes}
          </label>
          <input
            id="prenom-portail"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onBlur={garderNom}
            onKeyDown={(e) => e.key === 'Enter' && (garderNom(), (e.target as HTMLInputElement).blur())}
            placeholder={T.prenomEx}
            maxLength={40}
            autoComplete="given-name"
            className="pt-champ mt-1.5"
          />
          <p className="mt-1.5 text-xs text-[var(--p-doux)]">{T.prenomAide}</p>
        </div>

        {/* Son */}
        <div className="pt-carte-plate mt-5 flex items-center justify-between gap-4 p-4">
          <span className="text-sm font-semibold">🔔 {T.son}</span>
          <button type="button" role="switch" aria-checked={son} aria-label={T.son} className="pt-interrupteur" onClick={() => onSon(!son)} />
        </div>

        {/* Notifications */}
        <div className="pt-carte-plate mt-3 p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold">📲 {T.push}</span>
            {push === 'actif' && <span className="pt-pastille bg-[var(--p-vert-pale)] text-[var(--p-vert)]">●</span>}
          </div>

          {push === 'non-supporte' ? (
            <p className="mt-3 text-sm text-[var(--p-doux)]">{T.pushNonSupporte}</p>
          ) : push === 'refuse' ? (
            <p className="mt-3 text-sm text-[var(--p-rouge)]">{T.pushRefuse}</p>
          ) : (
            <>
              {groupes.length > 0 && (
                <select value={groupe} onChange={(e) => changerGroupe(e.target.value)} disabled={occupe} className="pt-champ mt-3" aria-label={T.groupeSeul}>
                  <option value="">{T.tousGroupes}</option>
                  {groupes.map((g) => (
                    <option key={g} value={g}>
                      {T.groupeSeul} : {g}
                    </option>
                  ))}
                </select>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {push === 'actif' ? (
                  <>
                    <button type="button" onClick={essai} disabled={occupe} className="pt-bouton !py-2.5 text-sm">
                      {T.pushEssai}
                    </button>
                    <button type="button" onClick={desactiver} disabled={occupe} className="pt-bouton-doux !py-2.5 text-sm">
                      {T.pushDesactiver}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={activer} disabled={occupe || push === 'chargement'} className="pt-bouton !py-2.5 text-sm">
                    {T.pushActiver}
                  </button>
                )}
              </div>
            </>
          )}
          {message && (
            <p role="status" className={`mt-3 text-sm font-medium ${message.ton === 'ok' ? 'text-[var(--p-vert)]' : 'text-[var(--p-rouge)]'}`}>
              {message.texte}
            </p>
          )}
        </div>

        <p className="mt-5 hidden text-xs leading-relaxed text-[var(--p-faible)] md:block">⌨️ {T.raccourcis}</p>
      </div>
    </>
  )
}
