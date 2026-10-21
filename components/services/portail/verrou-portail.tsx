'use client'

import { useRef, useState } from 'react'
import { TEXTES_PORTAIL, type LanguePortail } from '@/components/services/portail/textes'
import { vibrer } from '@/components/effets/desintegration'

type Erreur = 'faux' | 'bloque' | 'invalide'

/**
 * L'écran du portail protégé : un mauvais mot de passe secoue la carte, le
 * bon ouvre le cadenas, puis le portail apparaît. Le même écran ouvre le
 * mode gérant (`mode="gerant"`), avec le mot de passe du gérant.
 */
export default function VerrouPortail({
  jeton,
  nom,
  l,
  mode = 'portail',
  suite,
}: {
  jeton: string
  nom: string
  l: LanguePortail
  mode?: 'portail' | 'gerant'
  /** Où aller une fois ouvert (par défaut, la file). */
  suite?: string
}) {
  const T = TEXTES_PORTAIL[l]
  const G = T.gerant
  const gerant = mode === 'gerant'
  const idChamp = gerant ? 'mdp-gerant' : 'mdp-portail'
  const [erreur, setErreur] = useState<Erreur | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [ouvert, setOuvert] = useState(false)
  const [visible, setVisible] = useState(false)
  const [secousses, setSecousses] = useState(0)
  const champ = useRef<HTMLInputElement>(null)

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEnCours(true)
    let etat = 'invalide'
    try {
      const r = await fetch(`/service/${jeton}/${gerant ? 'gerant' : 'deverrouiller'}`, { method: 'POST', body: new FormData(e.currentTarget) })
      etat = (await r.json()).etat
    } catch {
      etat = 'invalide'
    }
    setEnCours(false)
    if (etat === 'ok') {
      setErreur(null)
      setOuvert(true)
      vibrer(20)
      setTimeout(() => window.location.replace(suite ?? `/service/${jeton}`), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 750)
      return
    }
    // « absent » (plus de mot de passe de gérant) se lit comme un lien qui ne sert plus.
    setErreur(etat === 'faux' || etat === 'bloque' ? etat : 'invalide')
    setSecousses((n) => n + 1)
    vibrer([30, 40, 30])
    requestAnimationFrame(() => champ.current?.select())
  }

  return (
    <main className={`mx-auto flex max-w-md flex-col justify-center py-6 ${gerant ? 'min-h-[50vh]' : 'min-h-[70vh]'}`}>
      <div
        key={secousses}
        className={`pt-carte pt-verrou fond-maillage reflet-premium relative overflow-hidden p-7 sm:p-9 ${secousses ? 'pt-secoue' : ''} ${ouvert ? 'pt-ouvert' : ''}`}
      >
        <span className="pt-filet absolute inset-x-[12%] top-0 h-px bg-[linear-gradient(90deg,transparent,var(--p-or-clair),transparent)] opacity-60" aria-hidden />
        <span
          className={`grid size-14 place-items-center rounded-2xl transition-colors ${ouvert ? 'bg-[var(--p-vert-pale)] text-[var(--p-vert)]' : 'bg-[var(--accent-pale)] text-[var(--accent)]'}`}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path className="pt-anse" d="M8 11V7.5a4 4 0 0 1 8 0V11" />
            <rect x="5" y="11" width="14" height="10" rx="2.5" />
            <path d="M12 15v2" />
          </svg>
        </span>
        <p className="pt-surtitre mt-6">{gerant ? `✦ ${G.verrouTitre}` : T.verrouTitre}</p>
        <h1 className="titre-portail mt-2 text-3xl font-medium leading-tight">{nom}</h1>
        <p className="mt-2 text-[var(--p-doux)]">{gerant ? G.verrouSous : T.verrouSous}</p>
        <form onSubmit={envoyer} className="mt-6 space-y-3">
          <label className="pt-etiquette" htmlFor={idChamp}>
            {T.motDePasse}
          </label>
          <div className="relative">
            <input
              ref={champ}
              id={idChamp}
              name="mot_de_passe"
              type={visible ? 'text' : 'password'}
              required
              autoFocus
              autoComplete="current-password"
              maxLength={200}
              disabled={ouvert}
              aria-invalid={erreur ? true : undefined}
              aria-describedby={erreur ? `${idChamp}-erreur` : undefined}
              className={`pt-champ !py-3 !pr-12 text-base tracking-wide ${erreur ? '!border-[var(--p-rouge)]' : ''}`}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? T.cacher : T.voir}
              title={visible ? T.cacher : T.voir}
              className="absolute inset-y-0 right-1.5 my-auto grid size-9 place-items-center rounded-full text-[var(--p-doux)] hover:bg-[var(--p-surface-2)] hover:text-[var(--p-encre)]"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
                <circle cx="12" cy="12" r="3" />
                {visible && <path d="M4 4l16 16" />}
              </svg>
            </button>
          </div>
          <p id={`${idChamp}-erreur`} role="alert" className={`min-h-5 text-sm font-medium text-[var(--p-rouge)] transition-opacity ${erreur ? 'opacity-100' : 'opacity-0'}`}>
            {erreur ? T[erreur] : ''}
          </p>
          <button disabled={enCours || ouvert} className={`pt-bouton pt-bouton-grand w-full ${ouvert ? 'pt-bouton-vert' : ''}`}>
            {ouvert ? `✓ ${gerant ? G.ouvert : T.ouvert}` : enCours ? T.verification : gerant ? G.ouvrir : T.ouvrir}
          </button>
        </form>
        <p className="mt-5 text-xs text-[var(--p-doux)]">{gerant ? G.oubli : T.oubli}</p>
      </div>
    </main>
  )
}
