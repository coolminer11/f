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
      <p role="status" className="rounded-2xl bg-[#e3efe7] px-5 py-4 text-sm font-medium leading-relaxed text-[#2f6b4f]">
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
        className="w-full rounded-xl border border-[#e2d6c3] bg-[#fffaf2] px-4 py-3 text-base outline-none transition focus:border-[#c2552f] focus:ring-2 focus:ring-[#f6dccd]"
      />
      {etat.erreur && <p className="text-sm font-medium text-[#b0402a]">{X.erreur}</p>}
      <button disabled={enCours} className="w-full rounded-full bg-[#2a211a] px-5 py-3 font-semibold text-[#fffaf2] transition hover:bg-[#c2552f] disabled:opacity-60">
        {enCours ? X.attente : X.bouton}
      </button>
    </form>
  )
}
