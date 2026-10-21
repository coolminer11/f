'use client'

import { useEffect } from 'react'

/** Une panne passagère (base injoignable…) : on s'excuse en deux langues et on propose de réessayer. */
export default function ErreurService({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Le réseau revient souvent tout seul : un nouvel essai discret quand l'onglet redevient visible.
    const visible = () => document.visibilityState === 'visible' && reset()
    document.addEventListener('visibilitychange', visible)
    return () => document.removeEventListener('visibilitychange', visible)
  }, [reset])
  return (
    <div className="theme-services">
      <div className="sv-racine">
        <div className="sv-introuvable">
          <div className="sv-introuvable-carte sv-entre">
            <span className="sv-introuvable-sceau text-3xl" aria-hidden>
              ☁️
            </span>
            <h1 className="sv-titre mt-6 text-center">Oups, un petit nuage</h1>
            <p lang="en" className="sv-doux mt-2 text-center">
              Something went wrong — it’s not you.
            </p>
            <button type="button" className="sv-bouton sv-bouton-plein mt-7" onClick={() => reset()}>
              Réessayer · Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
