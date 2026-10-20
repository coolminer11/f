'use client'

import { useState } from 'react'
import { force, faiblesse } from '@/lib/mots-de-passe'

// Des mots simples, sans accent (faciles à taper sur un téléphone et à dicter).
const MOTS = (
  'erable lanterne soleil riviere montagne castor aurore boreal sapin cerise citron nuage tonnerre galet pivoine cannelle marmotte harfang caribou ' +
  'orignal bleuet framboise pommier phare voilier comete lagune colibri toucan prairie verger glacier canyon falaise ruisseau bambou tulipe lilas ' +
  'muguet hibou renard loutre baleine dauphin corail marbre cuivre ambre opale saphir rubis jade perle velours satin lin coton laine cerf ' +
  'lynx ourson panda koala zebre girafe tigre lion aigle faucon heron cygne mouette pinson moineau grive merle tilleul chene bouleau saule ' +
  'olivier mimosa jasmin lavande menthe basilic thym romarin safran paprika vanille caramel praline nougat biscuit gaufre crepe tarte brioche ' +
  'croissant baguette fromage beurre miel sirop cidre orage brise rosee givre neige flocon etoile lune planete fusee boussole carte ancre ' +
  'voile rame barque radeau tambour flute violon piano guitare harpe trompette clairon'
).split(' ')

function hasard(n: number): number {
  const t = new Uint32Array(1)
  crypto.getRandomValues(t)
  return t[0] % n
}

function genere(): string {
  const mots = Array.from({ length: 3 }, () => {
    const m = MOTS[hasard(MOTS.length)]
    return m.charAt(0).toUpperCase() + m.slice(1)
  })
  return `${mots.join('-')}-${10 + hasard(90)}`
}

const LIBELLES = ['Trop faible', 'Correct', 'Solide', 'Excellent'] as const
const COULEURS = ['bg-[var(--color-negatif)]', 'bg-[var(--color-attention)]', 'bg-[var(--color-positif)]', 'bg-[var(--color-positif)]']

/**
 * Le champ du mot de passe d'une page client : « Générer » propose une phrase
 * de passe (trois mots et un nombre, tirés au hasard par le navigateur),
 * l'indicateur dit ce que vaut le mot de passe tapé, « Copier » le met dans
 * le presse-papiers pour l'envoyer au client.
 */
export default function GenerateurMotDePasse({ interdits = [] }: { interdits?: string[] }) {
  const [valeur, setValeur] = useState('')
  const [copie, setCopie] = useState(false)
  const f = force(valeur, interdits)
  const raison = valeur ? faiblesse(valeur, interdits) : null

  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex gap-2">
        <input
          name="mot_de_passe"
          type="text"
          required
          minLength={10}
          maxLength={100}
          autoComplete="off"
          spellCheck={false}
          value={valeur}
          onChange={(e) => {
            setValeur(e.target.value)
            setCopie(false)
          }}
          placeholder="10 caractères ou plus"
          className="champ min-w-0 flex-1 py-1.5 font-mono text-sm"
          aria-label="Nouveau mot de passe"
          aria-describedby="force-mdp"
        />
        <button
          type="button"
          onClick={() => {
            setValeur(genere())
            setCopie(false)
          }}
          className="bouton bouton-secondaire shrink-0 py-1.5 text-xs"
          title="Trois mots et un nombre, tirés au hasard"
        >
          ✨ Générer
        </button>
        {valeur && !raison && (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(valeur).then(() => setCopie(true), () => undefined)}
            className="bouton bouton-secondaire shrink-0 py-1.5 text-xs"
          >
            {copie ? '✓ Copié' : 'Copier'}
          </button>
        )}
      </div>
      {valeur && (
        <div id="force-mdp" className="flex items-center gap-2 text-[11px]" aria-live="polite">
          <span className="flex gap-0.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-1.5 w-6 rounded-full transition-colors ${i < Math.max(f, raison ? 1 : 0) ? COULEURS[f] : 'bg-[var(--color-grille)]'}`} />
            ))}
          </span>
          <span className={raison ? 'text-[var(--color-negatif)]' : 'text-[var(--color-encre-doux)]'}>{raison ?? LIBELLES[f]}</span>
        </div>
      )}
    </div>
  )
}
