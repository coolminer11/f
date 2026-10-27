'use client'

import { useActionState } from 'react'
import { demanderAcces, type EtatAcces } from '@/app/portail/actions'
import type { Langue } from '@/lib/langue'

const T = {
  fr: {
    champ: 'Votre courriel',
    bouton: 'Recevoir mon lien',
    attente: 'Envoi…',
    erreur: 'Entrez une adresse courriel valide.',
    envoye: 'C’est parti ! Si cette adresse est celle d’un client Tapora, votre lien arrive dans quelques instants. Pensez à regarder les indésirables.',
  },
  en: {
    champ: 'Your email',
    bouton: 'Send me my link',
    attente: 'Sending…',
    erreur: 'Enter a valid email address.',
    envoye: 'Done! If this address belongs to a Tapora client, your link arrives in a moment. Check your spam folder too.',
  },
}

export default function AccesPortail({ langue }: { langue: Langue }) {
  const X = T[langue]
  const [etat, envoyer, enCours] = useActionState<EtatAcces, FormData>(demanderAcces, { envoye: false, erreur: false })
  if (etat.envoye)
    return (
      <div role="status" className="portail-envoye">
        {/* L'enveloppe s'envole, puis le cercle et la coche se dessinent. */}
        <div className="portail-envoye-scene" aria-hidden>
          <svg viewBox="0 0 64 64" className="portail-enveloppe">
            <rect x="8" y="16" width="48" height="32" rx="6" fill="var(--cl-papier)" stroke="var(--cl-brique)" strokeWidth="3" />
            <path d="M10 19l22 17 22-17" fill="none" stroke="var(--cl-brique)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg viewBox="0 0 64 64" className="portail-reussi">
            <circle className="portail-reussi-cercle" pathLength={1} cx="32" cy="32" r="27" fill="none" stroke="var(--cl-sapin)" strokeWidth="4" strokeLinecap="round" />
            <path className="portail-reussi-coche" pathLength={1} d="M20 33l8 8 16-17" fill="none" stroke="var(--cl-sapin)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="portail-envoye-texte text-sm font-medium leading-relaxed text-[var(--cl-sapin)]">{X.envoye}</p>
      </div>
    )
  return (
    <form action={envoyer} className="space-y-3">
      <label htmlFor="portail-courriel" className="block text-sm font-medium">
        {X.champ}
      </label>
      <input
        id="portail-courriel"
        name="courriel"
        type="email"
        required
        autoComplete="email"
        maxLength={254}
        aria-invalid={etat.erreur || undefined}
        className="portail-champ w-full rounded-xl border border-[var(--cl-ligne)] bg-[var(--cl-papier)] px-4 py-3 text-base outline-none transition focus:border-[var(--cl-brique)] focus:ring-4 focus:ring-[var(--cl-rose-pale)]"
      />
      {etat.erreur && <p className="text-sm font-medium text-[var(--cl-rouge)]">{X.erreur}</p>}
      <button disabled={enCours} className="portail-bouton w-full rounded-full bg-[var(--cl-nuit)] px-5 py-3 font-semibold text-[var(--cl-sur-nuit)] transition hover:bg-[var(--cl-brique)] disabled:opacity-60">
        {enCours ? X.attente : X.bouton}
      </button>
    </form>
  )
}
