'use client'

import { useRef } from 'react'

/**
 * Le champ du code : gros chiffres espacés, clavier numérique sur téléphone,
 * remplissage automatique (iOS propose le code), envoi dès le 6e chiffre.
 */
export default function ChampCode({ secours = false }: { secours?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  if (secours) {
    return (
      <div>
        <label className="etiquette" htmlFor="code">Code de secours</label>
        <input
          id="code"
          name="code"
          className="champ code-chiffres !text-xl !tracking-[0.3em]"
          placeholder="xxxx-xxxx"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          required
          autoFocus
          maxLength={9}
        />
        <p className="mt-1.5 text-xs text-[var(--color-encre-doux)]">Un des 10 codes reçus à l’activation. Chacun ne sert qu’une fois.</p>
      </div>
    )
  }
  return (
    <div>
      <label className="etiquette" htmlFor="code">Code à 6 chiffres</label>
      <input
        ref={ref}
        id="code"
        name="code"
        className="champ code-chiffres"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        placeholder="••••••"
        required
        autoFocus
        maxLength={7}
        onChange={(e) => {
          const chiffres = e.target.value.replace(/\D/g, '').slice(0, 6)
          if (chiffres !== e.target.value) e.target.value = chiffres
          if (chiffres.length === 6) e.target.form?.requestSubmit()
        }}
      />
    </div>
  )
}
