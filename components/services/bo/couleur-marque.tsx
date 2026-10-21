'use client'

import { useState } from 'react'

const PALETTE = [
  ['#c2552f', 'Terre cuite'],
  ['#b5472b', 'Brique'],
  ['#9f1239', 'Bordeaux'],
  ['#7c3aed', 'Prune'],
  ['#1d4ed8', 'Royal'],
  ['#1f4e5f', 'Fleuve'],
  ['#0f766e', 'Sarcelle'],
  ['#2f6b4f', 'Sapin'],
  ['#a16207', 'Érable'],
  ['#111827', 'Encre'],
] as const

/** Luminance relative (WCAG) d'une couleur #rrggbb. */
function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrasteBlanc = (hex: string) => 1.05 / (luminance(hex) + 0.05)

/**
 * La couleur de l'établissement, avec l'aperçu en direct de ce que verra le
 * client sur son téléphone : en-tête, boutons d'appel, pastilles.
 */
export default function CouleurMarque({
  couleur,
  nom,
  logo,
  couverture,
  type,
  accueil,
}: {
  couleur: string
  nom: string
  logo: string | null
  couverture: string | null
  type: 'restaurant' | 'hotel'
  accueil: string
}) {
  const [c, setC] = useState(couleur)
  const [saisie, setSaisie] = useState(couleur)
  const valide = /^#[0-9a-fA-F]{6}$/.test(c)
  const ratio = valide ? contrasteBlanc(c) : 21
  const boutons = type === 'restaurant' ? [['🙋', 'Appeler le serveur'], ['🧾', 'L’addition']] : [['🧺', 'Serviettes'], ['🧹', 'Ménage']]

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
      <div className="space-y-3">
        <input type="hidden" name="couleur" value={c} />
        <div className="flex flex-wrap gap-2">
          {PALETTE.map(([hex, n]) => (
            <button
              key={hex}
              type="button"
              title={n}
              aria-label={n}
              aria-pressed={c.toLowerCase() === hex}
              onClick={() => {
                setC(hex)
                setSaisie(hex)
              }}
              className={`size-8 rounded-full border-2 transition hover:scale-110 ${c.toLowerCase() === hex ? 'border-[var(--color-encre)] ring-2 ring-white ring-offset-0' : 'border-white shadow'}`}
              style={{ background: hex }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Choisir une couleur"
            value={valide ? c : '#c2552f'}
            onChange={(e) => {
              setC(e.target.value)
              setSaisie(e.target.value)
            }}
            className="h-9 w-12 cursor-pointer rounded-lg border border-[var(--color-ligne)] bg-transparent p-0.5"
          />
          <input
            className="champ w-32 font-mono uppercase"
            value={saisie}
            maxLength={7}
            aria-label="Code hexadécimal"
            onChange={(e) => {
              const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
              setSaisie(v)
              if (/^#[0-9a-fA-F]{6}$/.test(v)) setC(v)
            }}
          />
          <span className="text-xs text-[var(--color-encre-doux)] tabular-nums">contraste {ratio.toFixed(1)} : 1</span>
        </div>
        {ratio < 3 && (
          <p className="text-xs font-medium text-[var(--color-attention)]">
            Couleur trop pâle : le texte blanc des boutons sera difficile à lire. Choisissez une teinte plus foncée.
          </p>
        )}
      </div>

      {/* Aperçu : le haut de la page client, en miniature. */}
      <div aria-label="Aperçu de la page client" className="mx-auto w-full max-w-[15rem] overflow-hidden rounded-[1.6rem] border-[6px] border-[#1c1712] bg-[#fbf6ee] shadow-xl">
        <div
          className="relative h-20"
          style={{
            background: couverture ? `center / cover url(${couverture})` : `linear-gradient(135deg, ${c}, ${c}cc 55%, #1c1712)`,
          }}
        >
          <div className="absolute -bottom-6 left-3 grid size-12 place-items-center overflow-hidden rounded-2xl border-2 border-white bg-white text-lg shadow" style={{ color: c }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="size-full object-cover" />
            ) : (
              <span className="font-bold">{nom.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
        </div>
        <div className="space-y-2 px-3 pb-4 pt-8 text-[#2a211a]">
          <p className="truncate text-sm font-semibold">{nom}</p>
          <p className="line-clamp-2 text-[10px] leading-snug text-[#6b5d50]">{accueil || 'Votre message d’accueil s’affiche ici.'}</p>
          <div className="flex gap-1">
            {['Menu', 'Demandes', 'Wi-Fi'].map((o, i) => (
              <span key={o} className="rounded-full px-2 py-0.5 text-[9px] font-semibold" style={i === 0 ? { background: c, color: 'white' } : { background: `${c}1a`, color: c }}>
                {o}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {boutons.map(([i, l]) => (
              <span key={l} className="rounded-xl px-2 py-2 text-center text-[10px] font-semibold text-white shadow" style={{ background: c }}>
                <span className="block text-base">{i}</span>
                {l}
              </span>
            ))}
          </div>
          <span className="block rounded-xl border px-2 py-1.5 text-center text-[10px] font-semibold" style={{ borderColor: `${c}55`, color: c }}>
            ★ Laisser un avis Google
          </span>
        </div>
      </div>
    </div>
  )
}
