'use client'

import { useState } from 'react'

/**
 * Graphiques des cartes NFC.
 *
 * Règles suivies partout : barres de 24 px au plus, bout arrondi à 4 px et
 * base carrée, 2 px de fond entre deux barres voisines, grille fine et
 * discrète, une seule échelle. L'info-bulle apparaît au survol ET au focus
 * clavier, et chaque graphique a sa table de données : l'info-bulle ajoute,
 * elle ne cache jamais rien.
 */

const fmt = new Intl.NumberFormat('fr-CA')

/** Plafond « rond » de l'échelle : 1, 2 ou 5 × 10ⁿ. */
function plafond(max: number): number {
  if (max <= 0) return 4
  const puissance = 10 ** Math.floor(Math.log10(max))
  for (const pas of [1, 2, 2.5, 5, 10]) {
    if (pas * puissance >= max) return pas * puissance
  }
  return 10 * puissance
}

export type Barre = { etiquette: string; detail: string; valeur: number }

export function GraphiqueColonnes({
  barres,
  unite = 'taps',
  pasEtiquettes = 1,
  hauteur = 160,
  resume,
}: {
  barres: Barre[]
  unite?: string
  /** Une étiquette d'axe toutes les N barres (la dernière est toujours montrée). */
  pasEtiquettes?: number
  hauteur?: number
  /** Phrase lue par les lecteurs d'écran : ce que montre le graphique. */
  resume: string
}) {
  const [actif, setActif] = useState<number | null>(null)
  const max = Math.max(0, ...barres.map((b) => b.valeur))
  const haut = plafond(max)
  const graduations = [haut, haut / 2, 0]
  const vide = max === 0

  return (
    <figure className="m-0">
      <div className="flex gap-2" role="img" aria-label={resume}>
        <div
          className="chiffre flex w-7 shrink-0 flex-col justify-between text-right text-[11px] text-[var(--color-encre-doux)]"
          style={{ height: hauteur }}
          aria-hidden
        >
          {graduations.map((g) => (
            <span key={g} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {fmt.format(g)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Grille : un trait fin à chaque graduation, sous les barres. */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: hauteur }} aria-hidden>
            {graduations.map((g, i) => (
              <div
                key={g}
                className="absolute inset-x-0 border-t border-[var(--color-grille)]"
                style={{ top: `${(i / (graduations.length - 1)) * 100}%` }}
              />
            ))}
          </div>

          <div className="relative flex items-end gap-[2px]" style={{ height: hauteur }}>
            {barres.map((b, i) => (
              <div
                key={b.etiquette + i}
                tabIndex={0}
                aria-label={`${b.detail} : ${fmt.format(b.valeur)} ${unite}`}
                onPointerEnter={() => setActif(i)}
                onPointerLeave={() => setActif(null)}
                onFocus={() => setActif(i)}
                onBlur={() => setActif(null)}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
              >
                <div
                  className={`w-full max-w-6 rounded-t-[4px] bg-[var(--color-serie-1)] transition-[filter] ${
                    actif === i ? 'brightness-110' : actif !== null ? 'opacity-70' : ''
                  } group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-encre)] group-focus-visible:ring-offset-2`}
                  style={{ height: `${(b.valeur / haut) * 100}%`, minHeight: b.valeur > 0 ? 2 : 0 }}
                />
                {actif === i && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-encre)] px-2.5 py-1.5 text-center shadow-lg">
                    <div className="text-sm font-semibold text-white">
                      {fmt.format(b.valeur)} {unite}
                    </div>
                    <div className="text-[11px] text-white/70">{b.detail}</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {vide && (
            <div
              className="absolute inset-x-0 top-0 grid place-items-center text-sm text-[var(--color-encre-doux)]"
              style={{ height: hauteur }}
            >
              Aucun tap sur la période
            </div>
          )}

          <div className="mt-1.5 flex gap-[2px]" aria-hidden>
            {barres.map((b, i) => (
              <div key={b.etiquette + i} className="chiffre flex flex-1 justify-center whitespace-nowrap text-[11px] text-[var(--color-encre-doux)]">
                {i % pasEtiquettes === 0 || i === barres.length - 1 ? b.etiquette : ''}
              </div>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-[var(--color-encre-doux)] hover:underline">
          Voir les données
        </summary>
        <table className="mt-1 w-full max-w-sm text-xs">
          <tbody>
            {barres.map((b, i) => (
              <tr key={b.etiquette + i} className="border-b border-[var(--color-ligne)] last:border-0">
                <td className="py-0.5 text-[var(--color-encre-doux)]">{b.detail}</td>
                <td className="chiffre py-0.5 text-right font-medium">{fmt.format(b.valeur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

export type Segment = { nom: string; valeur: number; serie: 1 | 2 | 'attenuee' }

const COULEUR: Record<Segment['serie'], string> = {
  1: 'bg-[var(--color-serie-1)]',
  2: 'bg-[var(--color-serie-2)]',
  attenuee: 'bg-[var(--color-serie-attenuee)]',
}

/**
 * Une barre à 100 % en deux ou trois segments, avec sa légende chiffrée.
 * Préférée au camembert : les parts se comparent sur une même longueur.
 */
export function BarreRepartition({ segments, resume }: { segments: Segment[]; resume: string }) {
  const [actif, setActif] = useState<number | null>(null)
  const total = segments.reduce((s, x) => s + x.valeur, 0)
  const visibles = segments.filter((s) => s.valeur > 0)
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0)

  return (
    <figure className="m-0">
      <div className="relative" role="img" aria-label={resume}>
        {total === 0 ? (
          <div className="h-3 rounded bg-[var(--color-grille)]" />
        ) : (
          <div className="flex h-3 gap-[2px]">
            {visibles.map((s, i) => (
              <div
                key={s.nom}
                tabIndex={0}
                aria-label={`${s.nom} : ${fmt.format(s.valeur)} (${pct(s.valeur)} %)`}
                onPointerEnter={() => setActif(i)}
                onPointerLeave={() => setActif(null)}
                onFocus={() => setActif(i)}
                onBlur={() => setActif(null)}
                className={`relative h-full outline-none first:rounded-l last:rounded-r ${COULEUR[s.serie]} ${
                  actif !== null && actif !== i ? 'opacity-60' : ''
                } focus-visible:ring-2 focus-visible:ring-[var(--color-encre)] focus-visible:ring-offset-2`}
                style={{ flexGrow: s.valeur, flexBasis: 0 }}
              >
                {actif === i && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-encre)] px-2.5 py-1.5 text-center shadow-lg">
                    <div className="text-sm font-semibold text-white">
                      {fmt.format(s.valeur)} · {pct(s.valeur)} %
                    </div>
                    <div className="text-[11px] text-white/70">{s.nom}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {segments.map((s) => (
          <li key={s.nom} className="flex items-center gap-1.5">
            <span className={`inline-block size-2.5 rounded-sm ${COULEUR[s.serie]}`} aria-hidden />
            <span className="text-[var(--color-encre-doux)]">{s.nom}</span>
            <span className="chiffre font-semibold">{fmt.format(s.valeur)}</span>
            <span className="chiffre text-xs text-[var(--color-encre-doux)]">{pct(s.valeur)} %</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
