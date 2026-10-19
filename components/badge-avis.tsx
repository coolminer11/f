'use client'

import { useState } from 'react'
import { codeBadge, HAUTEUR_BADGE, LARGEUR_BADGE, urlBadge, type ThemeBadge } from '@/lib/badge-code'
import type { Langue } from '@/lib/langue'

const TEXTES = {
  fr: {
    clair: 'Clair',
    sombre: 'Sombre',
    copier: 'Copier le code',
    copie: 'Copié ✓',
    webmestre: 'Envoyer à mon webmestre',
    objet: 'Badge d’avis Google à ajouter sur notre site',
    corps: 'Bonjour,\n\nPeux-tu coller ce code sur notre site (page d’accueil ou pied de page) ? C’est un badge qui affiche nos avis Google et se met à jour tout seul.\n\n',
    ou: 'Où le coller',
    aide: [
      ['Wix', 'Ajouter → Intégrer du code → Intégrer HTML'],
      ['Squarespace', 'Ajouter un bloc → Code'],
      ['WordPress', 'Bloc « HTML personnalisé »'],
      ['Shopify', 'Personnaliser → Ajouter une section → Liquid personnalisé'],
    ],
    fond: 'Aperçu sur fond',
  },
  en: {
    clair: 'Light',
    sombre: 'Dark',
    copier: 'Copy the code',
    copie: 'Copied ✓',
    webmestre: 'Send to my web person',
    objet: 'Google reviews badge to add to our website',
    corps: 'Hi,\n\nCould you paste this code on our website (home page or footer)? It is a badge that shows our Google reviews and updates itself.\n\n',
    ou: 'Where to paste it',
    aide: [
      ['Wix', 'Add → Embed code → Embed HTML'],
      ['Squarespace', 'Add block → Code'],
      ['WordPress', '“Custom HTML” block'],
      ['Shopify', 'Customize → Add section → Custom Liquid'],
    ],
    fond: 'Preview on',
  },
} as const

/**
 * Le badge d'avis : aperçu clair ou sombre, code à copier, aide pour les
 * plateformes courantes. Sert sur la page client et dans le dossier.
 */
export default function BadgeAvis({
  base,
  cle,
  langue,
  variante,
}: {
  base: string
  cle: string
  langue: Langue
  variante: 'client' | 'bo'
}) {
  const T = TEXTES[langue]
  const [theme, setTheme] = useState<ThemeBadge>('clair')
  const [copie, setCopie] = useState(false)
  const code = codeBadge(base, cle, theme, langue)
  const client = variante === 'client'

  async function copier() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const zone = document.getElementById(`code-badge-${variante}`) as HTMLTextAreaElement | null
      zone?.select()
      document.execCommand('copy')
    }
    setCopie(true)
    setTimeout(() => setCopie(false), 2200)
  }

  const pastille = (actif: boolean) =>
    client
      ? `rounded-full px-4 py-1.5 text-sm font-semibold transition ${actif ? 'bg-[#2a211a] text-[#fffaf2]' : 'bg-[#f3ebdf] text-[#2a211a] hover:bg-[#ede3d3]'}`
      : `rounded-full px-3 py-1 text-xs font-semibold transition ${actif ? 'bg-[var(--color-encre)] text-[var(--color-fond)]' : 'bg-[var(--color-fond)] text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]'}`

  return (
    <div className={`grid gap-5 ${client ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start' : ''}`}>
      <div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={T.fond}>
          {(['clair', 'sombre'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTheme(t)} aria-pressed={theme === t} className={pastille(theme === t)}>
              {T[t]}
            </button>
          ))}
        </div>
        <div
          className={`mt-3 grid place-items-center rounded-2xl px-4 py-7 transition-colors duration-300 ${
            theme === 'sombre' ? 'bg-[#1d1713]' : client ? 'bg-[#f3ebdf]' : 'bg-[var(--color-fond)]'
          }`}
        >
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlBadge(base, cle, theme)}
              alt=""
              width={LARGEUR_BADGE}
              height={HAUTEUR_BADGE}
              className="badge-apercu mx-auto max-w-full drop-shadow-[0_14px_22px_rgba(60,30,10,0.18)]"
            />
            <span className="mt-1 block text-[11px] text-[#8a7b6d]">{langue === 'fr' ? 'propulsé par Tapora' : 'powered by Tapora'}</span>
          </div>
        </div>
      </div>
      <div>
        <textarea
          id={`code-badge-${variante}`}
          readOnly
          value={code}
          rows={client ? 5 : 4}
          onFocus={(e) => e.currentTarget.select()}
          className={
            client
              ? 'block w-full resize-none rounded-2xl border border-[#e2d6c3] bg-[#fffaf2] px-4 py-3 font-mono text-[11px] leading-relaxed text-[#6b5d50] outline-none focus:border-[#c2552f]'
              : 'champ block w-full resize-none font-mono text-[11px] leading-relaxed'
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copier}
            className={
              client
                ? 'rounded-full bg-[#c2552f] px-5 py-2.5 text-sm font-semibold text-[#fffaf2] shadow-[0_10px_24px_-12px_#c2552f] transition hover:-translate-y-0.5 hover:bg-[#a9481f]'
                : 'bouton'
            }
            aria-live="polite"
          >
            {copie ? T.copie : T.copier}
          </button>
          <a
            href={`mailto:?subject=${encodeURIComponent(T.objet)}&body=${encodeURIComponent(T.corps + code)}`}
            className={client ? 'rounded-full px-4 py-2.5 text-sm font-semibold text-[#2a211a] hover:bg-[#f3ebdf]' : 'bouton bouton-secondaire'}
          >
            ✉️ {T.webmestre}
          </a>
        </div>
        <details className="mt-3 text-sm">
          <summary className={`cursor-pointer font-medium ${client ? 'text-[#6b5d50] hover:text-[#2a211a]' : 'text-[var(--color-encre-doux)]'}`}>{T.ou}</summary>
          <ul className={`mt-2 space-y-1 ${client ? 'text-[#6b5d50]' : 'text-[var(--color-encre-doux)]'}`}>
            {T.aide.map(([qui, comment]) => (
              <li key={qui}>
                <strong className={client ? 'text-[#2a211a]' : 'text-[var(--color-encre)]'}>{qui}</strong> : {comment}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  )
}
