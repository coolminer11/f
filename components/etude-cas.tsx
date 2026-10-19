'use client'

import { useEffect, useState } from 'react'
import { dessinerEtude, type ChiffresEtude } from '@/lib/image-etude'
import type { Langue } from '@/lib/langue'

/**
 * L'étude de cas en un clic : l'image LinkedIn d'un dossier, en français ou
 * en anglais, dessinée dans le navigateur. À publier avec l'accord du
 * commerce.
 */
export default function EtudeCas({ chiffres, nomFichier }: { chiffres: ChiffresEtude; nomFichier: string }) {
  const [langue, setLangue] = useState<Langue>('fr')
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let annule = false
    let cree: string | null = null
    dessinerEtude(chiffres, langue)
      .then((b) => {
        if (annule) return
        cree = URL.createObjectURL(b)
        setUrl(cree)
      })
      .catch(() => {})
    return () => {
      annule = true
      if (cree) URL.revokeObjectURL(cree)
    }
  }, [chiffres, langue])

  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:items-start">
      <div className="overflow-hidden rounded-xl border border-[var(--color-ligne)] bg-[var(--color-fond)] shadow-sm" style={{ aspectRatio: '1080 / 1350' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt="Aperçu de l’étude de cas" className="block size-full" />}
      </div>
      <div className="space-y-3">
        <div className="flex gap-1.5" role="group" aria-label="Langue de l’image">
          {(['fr', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLangue(l)}
              aria-pressed={langue === l}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                langue === l ? 'bg-[var(--color-encre)] text-[var(--color-fond)]' : 'bg-[var(--color-fond)] text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]'
              }`}
            >
              {l === 'fr' ? 'Français' : 'English'}
            </button>
          ))}
        </div>
        <a
          href={url ?? undefined}
          download={`etude-de-cas-${nomFichier}-${langue}.png`}
          aria-disabled={!url}
          className={`bouton inline-flex ${url ? '' : 'pointer-events-none opacity-60'}`}
        >
          Télécharger l’image
        </a>
        <p className="text-xs leading-relaxed text-[var(--color-encre-doux)]">
          Format portrait LinkedIn (1080 × 1350). Les chiffres viennent des relevés d’avis et des taps, depuis la date de pose. <strong>Publiez seulement avec l’accord du commerce</strong> — et identifiez-le dans la publication : il la repartagera.
        </p>
      </div>
    </div>
  )
}
