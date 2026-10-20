'use client'

import { useRef, useState } from 'react'
import { deverrouillerPage } from '@/app/stats/[jeton]/actions'
import type { Langue } from '@/lib/langue'
import Logo from '@/components/client/logo'
import BasculeMode from '@/components/client/bascule-mode'

const T = {
  fr: {
    protegee: 'Page protégée',
    sous: 'Entrez le mot de passe que Tapora vous a donné. Cet appareil s’en souviendra 30 jours.',
    champ: 'Mot de passe',
    voir: 'Afficher le mot de passe',
    cacher: 'Masquer le mot de passe',
    ouvrir: 'Ouvrir',
    attente: 'Vérification…',
    ouvert: 'C’est ouvert',
    faux: 'Mot de passe incorrect.',
    bloque: 'Trop d’essais. Réessayez dans 15 minutes.',
    invalide: 'Ce lien n’est plus valide.',
    oubli: 'Oublié ? Écrivez-nous : on vous en donne un nouveau.',
  },
  en: {
    protegee: 'Protected page',
    sous: 'Enter the password Tapora gave you. This device will remember it for 30 days.',
    champ: 'Password',
    voir: 'Show password',
    cacher: 'Hide password',
    ouvrir: 'Open',
    attente: 'Checking…',
    ouvert: 'Unlocked',
    faux: 'Wrong password.',
    bloque: 'Too many attempts. Try again in 15 minutes.',
    invalide: 'This link is no longer valid.',
    oubli: 'Forgot it? Write to us and we’ll set a new one.',
  },
}

/**
 * L'écran qui remplace la page client tant que le mot de passe n'est pas
 * entré. Un mauvais mot de passe secoue la carte ; le bon ouvre le cadenas,
 * puis la page apparaît.
 */
type Erreur = 'faux' | 'bloque' | 'invalide'

export default function Verrou({ jeton, nom, langue, l, refus }: { jeton: string; nom: string; langue: Langue; l?: string; refus?: Erreur }) {
  const X = T[langue]
  const [erreur, setErreur] = useState<Erreur | null>(refus ?? null)
  const [enCours, setEnCours] = useState(false)
  const [ouvert, setOuvert] = useState(false)
  const [visible, setVisible] = useState(false)
  const [secousses, setSecousses] = useState(refus ? 1 : 0)
  const champ = useRef<HTMLInputElement>(null)

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEnCours(true)
    let etat: string = 'invalide'
    try {
      const r = await fetch(`/stats/${jeton}/deverrouiller`, { method: 'POST', body: new FormData(e.currentTarget) })
      etat = (await r.json()).etat
    } catch {
      etat = 'invalide'
    }
    setEnCours(false)
    if (etat === 'ok') {
      setErreur(null)
      setOuvert(true)
      // Le cadenas s'ouvre, puis la page (le témoin d'accès est posé).
      setTimeout(() => window.location.replace(`/stats/${jeton}${l ? `?l=${l}` : ''}`), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 750)
      return
    }
    setErreur(etat === 'faux' || etat === 'bloque' ? etat : 'invalide')
    setSecousses((n) => n + 1)
    requestAnimationFrame(() => champ.current?.select())
  }

  return (
    <main className="relative mx-auto flex min-h-[86vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="absolute right-4 top-6">
        <BasculeMode langue={langue} />
      </div>
      <div key={secousses} className={`carte verrou-carte p-7 sm:p-9 ${secousses ? 'verrou-secoue' : ''} ${ouvert ? 'verrou-ouvert' : ''}`}>
        <div className="flex items-center justify-between">
          <Logo className="size-11" />
          {/* Le cadenas : l'anse se lève quand c'est le bon mot de passe. */}
          <span className={`cadenas grid size-12 place-items-center rounded-2xl ${ouvert ? 'bg-[var(--cl-vert-pale)] text-[var(--cl-sapin)]' : 'bg-[var(--cl-rose-pale)] text-[var(--cl-brique)]'}`} aria-hidden>
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path className="cadenas-anse" d="M8 11V7.5a4 4 0 0 1 8 0V11" />
              <rect x="5" y="11" width="14" height="10" rx="2.5" />
              <path d="M12 15v2" />
            </svg>
          </span>
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cl-brique)]">{X.protegee}</p>
        <h1 className="titre-client mt-2 text-3xl font-medium leading-tight">{nom}</h1>
        <p className="mt-2 text-[var(--cl-doux)]">{X.sous}</p>
        <form action={deverrouillerPage} onSubmit={envoyer} className="mt-6 space-y-3">
          <input type="hidden" name="jeton" value={jeton} />
          {l && <input type="hidden" name="l" value={l} />}
          <label className="block text-sm font-medium" htmlFor="mdp">
            {X.champ}
          </label>
          <div className="relative">
            <input
              ref={champ}
              id="mdp"
              name="mot_de_passe"
              type={visible ? 'text' : 'password'}
              required
              autoFocus
              autoComplete="current-password"
              maxLength={200}
              disabled={ouvert}
              aria-invalid={erreur ? true : undefined}
              aria-describedby={erreur ? 'mdp-erreur' : undefined}
              className={`w-full rounded-xl border bg-[var(--cl-papier)] py-3 pl-4 pr-12 text-base tracking-wide outline-none focus:border-[var(--cl-brique)] ${erreur ? 'border-[var(--cl-rouge)]' : 'border-[var(--cl-ligne)]'}`}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? X.cacher : X.voir}
              title={visible ? X.cacher : X.voir}
              className="absolute inset-y-0 right-1.5 my-auto grid size-9 place-items-center rounded-full text-[var(--cl-doux)] hover:bg-[var(--cl-sable)] hover:text-[var(--cl-encre)]"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
                <circle cx="12" cy="12" r="3" />
                {visible && <path d="M4 4l16 16" className="trait-oeil" />}
              </svg>
            </button>
          </div>
          <p id="mdp-erreur" role="alert" className={`min-h-5 text-sm font-medium text-[var(--cl-rouge)] transition-opacity ${erreur ? 'opacity-100' : 'opacity-0'}`}>
            {erreur ? X[erreur] : ''}
          </p>
          <button
            disabled={enCours || ouvert}
            className={`bouton-verrou relative w-full overflow-hidden rounded-full px-5 py-3 font-semibold ${ouvert ? 'bg-[var(--cl-sapin)] text-[var(--cl-blanc)]' : 'bg-[var(--cl-nuit)] text-[var(--cl-sur-nuit)] hover:bg-[var(--cl-brique)] hover:text-[var(--cl-blanc)]'} disabled:cursor-default`}
          >
            {ouvert ? `✓ ${X.ouvert}` : enCours ? <span className="points-attente">{X.attente}</span> : X.ouvrir}
          </button>
        </form>
        <p className="mt-5 text-xs text-[var(--cl-doux)]">{X.oubli}</p>
      </div>
    </main>
  )
}
