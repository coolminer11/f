'use client'

import { useActionState } from 'react'
import { deverrouillerPage, type EtatVerrou } from '@/app/stats/[jeton]/actions'
import type { Langue } from '@/lib/langue'
import Logo from '@/components/client/logo'

const T = {
  fr: {
    protegee: 'Page protégée',
    sous: 'Entrez le mot de passe que Tapora vous a donné. Cet appareil s’en souviendra 30 jours.',
    champ: 'Mot de passe',
    ouvrir: 'Ouvrir',
    attente: 'Vérification…',
    faux: 'Mot de passe incorrect.',
    bloque: 'Trop d’essais. Réessayez dans 15 minutes.',
    invalide: 'Ce lien n’est plus valide.',
    oubli: 'Oublié ? Écrivez-nous : on vous en donne un nouveau.',
  },
  en: {
    protegee: 'Protected page',
    sous: 'Enter the password Tapora gave you. This device will remember it for 30 days.',
    champ: 'Password',
    ouvrir: 'Open',
    attente: 'Checking…',
    faux: 'Wrong password.',
    bloque: 'Too many attempts. Try again in 15 minutes.',
    invalide: 'This link is no longer valid.',
    oubli: 'Forgot it? Write to us and we’ll set a new one.',
  },
}

/** L'écran qui remplace la page client tant que le mot de passe n'est pas entré. */
export default function Verrou({ jeton, nom, langue, l }: { jeton: string; nom: string; langue: Langue; l?: string }) {
  const X = T[langue]
  const [etat, envoyer, enCours] = useActionState<EtatVerrou, FormData>(deverrouillerPage, { erreur: null })

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="carte p-7 sm:p-9">
        <Logo className="size-11" />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#c2552f]">🔒 {X.protegee}</p>
        <h1 className="titre-client mt-2 text-3xl font-medium leading-tight">{nom}</h1>
        <p className="mt-2 text-[#6b5d50]">{X.sous}</p>
        <form action={envoyer} className="mt-6 space-y-3">
          <input type="hidden" name="jeton" value={jeton} />
          {l && <input type="hidden" name="l" value={l} />}
          <label className="block text-sm font-medium" htmlFor="mdp">
            {X.champ}
          </label>
          <input
            id="mdp"
            name="mot_de_passe"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            maxLength={200}
            aria-invalid={etat.erreur ? true : undefined}
            aria-describedby={etat.erreur ? 'mdp-erreur' : undefined}
            className="w-full rounded-xl border border-[#e2d6c3] bg-[#fffaf2] px-4 py-3 text-base outline-none transition focus:border-[#c2552f] focus:ring-2 focus:ring-[#f6dccd]"
          />
          {etat.erreur && (
            <p id="mdp-erreur" role="alert" className="text-sm font-medium text-[#b0402a]">
              {X[etat.erreur]}
            </p>
          )}
          <button
            disabled={enCours}
            className="w-full rounded-full bg-[#2a211a] px-5 py-3 font-semibold text-[#fffaf2] transition hover:bg-[#c2552f] disabled:opacity-60"
          >
            {enCours ? X.attente : X.ouvrir}
          </button>
        </form>
        <p className="mt-5 text-xs text-[#6b5d50]">{X.oubli}</p>
      </div>
    </main>
  )
}
