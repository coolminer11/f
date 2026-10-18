'use client'

import { useFormStatus } from 'react-dom'

/** Bouton de formulaire qui se désactive pendant l'envoi (pas de double clic). */
export default function BoutonEnvoi({
  children,
  attente = 'Un instant…',
  className = '',
  secondaire = false,
  name,
  value,
}: {
  children: React.ReactNode
  attente?: string
  className?: string
  secondaire?: boolean
  name?: string
  value?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button name={name} value={value} disabled={pending} className={`bouton ${secondaire ? 'bouton-secondaire' : ''} ${className}`} aria-busy={pending}>
      {pending ? (
        <>
          <svg viewBox="0 0 24 24" className="size-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M12 3a9 9 0 1 0 9 9" />
          </svg>
          {attente}
        </>
      ) : (
        children
      )}
    </button>
  )
}
