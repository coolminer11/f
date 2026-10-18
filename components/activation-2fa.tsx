'use client'

import { useActionState, useState } from 'react'
import BoutonEnvoi from '@/components/bouton-envoi'

export type EtatCodes = { ok: boolean; codes?: string[]; erreur?: string }

/**
 * Les deux formulaires qui révèlent des codes de secours : activer la double
 * authentification, et regénérer les codes. Les codes s'affichent UNE fois,
 * ici, sans jamais passer par l'adresse de la page ni par la base en clair.
 */
export default function FormulaireCodes({
  action,
  libelle,
  champMotDePasse = false,
  autoFocus = false,
}: {
  action: (avant: EtatCodes, donnees: FormData) => Promise<EtatCodes>
  libelle: string
  champMotDePasse?: boolean
  autoFocus?: boolean
}) {
  const [etat, envoyer] = useActionState(action, { ok: false })
  const [copie, setCopie] = useState(false)

  if (etat.ok && etat.codes) {
    const texte = etat.codes.join('\n')
    return (
      <div className="rounded-2xl border border-[#cfe3d3] bg-[#f2f8f2] p-5">
        <p className="font-semibold text-[var(--color-positif)]">✓ C’est fait. Voici vos 10 codes de secours.</p>
        <p className="mt-1 text-sm text-[var(--color-encre-doux)]">
          Gardez-les dans votre gestionnaire de mots de passe ou sur papier. Chacun ouvre votre compte une fois si vous perdez votre téléphone. Ils ne seront plus jamais affichés.
        </p>
        <ol className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
          {etat.codes.map((c) => (
            <li key={c} className="rounded-lg border border-[var(--color-ligne)] bg-white px-2 py-1.5 text-center tracking-wider">
              {c}
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="bouton bouton-secondaire text-xs"
            onClick={async () => {
              await navigator.clipboard.writeText(texte)
              setCopie(true)
            }}
          >
            {copie ? 'Copié ✓' : 'Copier les codes'}
          </button>
          <a
            className="bouton bouton-secondaire text-xs"
            download="tapora-codes-de-secours.txt"
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Tapora — codes de secours (un usage chacun)\n\n${texte}\n`)}`}
          >
            Télécharger (.txt)
          </a>
          <a href="/compte/securite" className="bouton text-xs">J’ai mis mes codes en lieu sûr</a>
        </div>
      </div>
    )
  }

  return (
    <form action={envoyer} className="space-y-3">
      {etat.erreur && (
        <p role="alert" className="rounded-xl border border-[#f0c4b3] bg-[#fbebe4] px-3 py-2 text-sm font-medium text-[var(--color-negatif)]">
          {etat.erreur}
        </p>
      )}
      {champMotDePasse && (
        <div>
          <label className="etiquette" htmlFor={`mdp-${libelle}`}>Mot de passe actuel</label>
          <input id={`mdp-${libelle}`} name="mot_de_passe" type="password" className="champ" autoComplete="current-password" required maxLength={200} />
        </div>
      )}
      <div>
        <label className="etiquette" htmlFor={`code-${libelle}`}>Code à 6 chiffres de l’application</label>
        <input
          id={`code-${libelle}`}
          name="code"
          className="champ code-chiffres !text-xl"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          placeholder="••••••"
          required
          maxLength={7}
          autoFocus={autoFocus}
        />
      </div>
      <BoutonEnvoi attente="Vérification…">{libelle}</BoutonEnvoi>
    </form>
  )
}
