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
      <p role="status" className="rounded-2xl bg-[var(--cl-vert-pale)] px-5 py-4 text-sm font-medium leading-relaxed text-[var(--cl-sapin)]">
        ✓ {X.envoye}
      </p>
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
        className="w-full rounded-xl border border-[var(--cl-ligne)] bg-[var(--cl-papier)] px-4 py-3 text-base outline-none transition focus:border-[var(--cl-brique)] focus:ring-2 focus:ring-[var(--cl-rose-pale)]"
      />
      {etat.erreur && <p className="text-sm font-medium text-[var(--cl-rouge)]">{X.erreur}</p>}
      <button disabled={enCours} className="w-full rounded-full bg-[var(--cl-nuit)] px-5 py-3 font-semibold text-[var(--cl-sur-nuit)] transition hover:bg-[var(--cl-brique)] disabled:opacity-60">
        {enCours ? X.attente : X.bouton}
      </button>
    </form>
  )
}
