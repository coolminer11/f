'use client'

import { useState } from 'react'
import { JOURS, JOURS_COURTS, plage, textes, type Langue } from '@/lib/langue'

/**
 * Graphiques des cartes NFC.
 *
 * Règles suivies partout : barres de 24 px au plus, bout arrondi à 4 px et
 * base carrée, 2 px de fond entre deux barres voisines, grille fine et
 * discrète, une seule échelle. L'info-bulle apparaît au survol ET au focus
 * clavier, et chaque graphique a sa table de données : l'info-bulle ajoute,
 * elle ne cache jamais rien.
 */

const FMT: Record<Langue, Intl.NumberFormat> = { fr: new Intl.NumberFormat('fr-CA'), en: new Intl.NumberFormat('en-CA') }

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
  langue = 'fr',
}: {
  barres: Barre[]
  langue?: Langue
  unite?: string
  /** Une étiquette d'axe toutes les N barres (la dernière est toujours montrée). */
  pasEtiquettes?: number
  hauteur?: number
  /** Phrase lue par les lecteurs d'écran : ce que montre le graphique. */
  resume: string
}) {
  const [actif, setActif] = useState<number | null>(null)
  const fmt = FMT[langue]
  const t = textes(langue)
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
                  className={`barre-graphique w-full max-w-6 rounded-t-[4px] bg-[var(--color-serie-1)] transition-[filter] ${
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
              {t.aucunTap}
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
          {t.voirDonnees}
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
export function BarreRepartition({ segments, resume, langue = 'fr' }: { segments: Segment[]; resume: string; langue?: Langue }) {
  const [actif, setActif] = useState<number | null>(null)
  const fmt = FMT[langue]
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
                className={`segment-repartition relative h-full outline-none first:rounded-l last:rounded-r ${COULEUR[s.serie]} ${
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

// ---------------------------------------------------------------------------
// Carte de chaleur jour × heure
// ---------------------------------------------------------------------------

const NIVEAUX = 6

/**
 * Quand les clients tapent : 7 jours × 24 heures. Une seule teinte, du clair
 * (peu) au foncé (beaucoup) ; une case vide reste presque de la couleur du
 * fond. Six niveaux plutôt qu'un dégradé continu : l'œil compare des marches,
 * pas des nuances.
 */
export function CarteChaleur({
  cases,
  resume,
  langue = 'fr',
}: {
  cases: { jour: number; heure: number; taps: number }[]
  resume: string
  langue?: Langue
}) {
  const [actif, setActif] = useState<{ jour: number; heure: number } | null>(null)
  const fmt = FMT[langue]
  const t = textes(langue)
  const JOURS_COURTS_L = JOURS_COURTS[langue]
  const JOURS_LONGS = JOURS[langue]
  const grille: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const c of cases) grille[c.jour - 1][c.heure] = c.taps
  const max = Math.max(0, ...cases.map((c) => c.taps))
  const niveau = (v: number) => (v === 0 || max === 0 ? 0 : Math.max(1, Math.ceil((v / max) * NIVEAUX)))
  const valeurActive = actif ? grille[actif.jour][actif.heure] : 0

  return (
    <figure className="m-0">
      <div className="relative" role="img" aria-label={resume}>
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: '2.25rem repeat(24, minmax(0, 1fr))' }}>
          {grille.map((ligne, j) => (
            <div key={j} className="contents">
              <div className="pr-1 text-right text-[11px] leading-[18px] text-[var(--color-encre-doux)]">
                {JOURS_COURTS_L[j]}
              </div>
              {ligne.map((v, h) => (
                <div
                  key={h}
                  tabIndex={0}
                  aria-label={`${JOURS_LONGS[j]}, ${plage(h, langue)} : ${fmt.format(v)} ${t.taps}`}
                  onPointerEnter={() => setActif({ jour: j, heure: h })}
                  onPointerLeave={() => setActif(null)}
                  onFocus={() => setActif({ jour: j, heure: h })}
                  onBlur={() => setActif(null)}
                  className={`case-chaleur h-[18px] rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-encre)] ${
                    actif && actif.jour === j && actif.heure === h ? 'ring-2 ring-[var(--color-encre)]' : ''
                  }`}
                  style={{ background: `var(--color-seq-${niveau(v)})` }}
                />
              ))}
            </div>
          ))}
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="chiffre text-center text-[10px] text-[var(--color-encre-doux)]" aria-hidden>
              {h % 3 === 0 ? h : ''}
            </div>
          ))}
        </div>

        {actif && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-[var(--color-encre)] px-2.5 py-1.5 text-center shadow-lg"
            style={{
              left: `calc(2.25rem + (100% - 2.25rem) * ${(actif.heure + 0.5) / 24})`,
              top: actif.jour * 20 - 4,
            }}
          >
            <div className="text-sm font-semibold text-white">{fmt.format(valeurActive)} {t.taps}</div>
            <div className="text-[11px] text-white/70">
              {JOURS_LONGS[actif.jour]}, {plage(actif.heure, langue)}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--color-encre-doux)]">
        <span>{t.moins}</span>
        {Array.from({ length: NIVEAUX + 1 }, (_, i) => (
          <span key={i} className="inline-block size-3 rounded-[2px]" style={{ background: `var(--color-seq-${i})` }} aria-hidden />
        ))}
        <span>{t.plus}</span>
        {max > 0 && <span className="ml-2">· {t.caseForte(fmt.format(max))}</span>}
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-[var(--color-encre-doux)] hover:underline">{t.voirDonnees}</summary>
        <div className="mt-1 overflow-x-auto">
          <table className="text-[11px]">
            <thead>
              <tr>
                <th />
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} className="chiffre px-1 font-medium text-[var(--color-encre-doux)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grille.map((ligne, j) => (
                <tr key={j}>
                  <th className="pr-2 text-left font-medium text-[var(--color-encre-doux)]">{JOURS_COURTS_L[j]}</th>
                  {ligne.map((v, h) => (
                    <td key={h} className="chiffre px-1 text-right">{v || '·'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

// ---------------------------------------------------------------------------
// Courbes : cumul, avis, comparaison
// ---------------------------------------------------------------------------

export type Serie = { nom: string; slot: 1 | 2 | 3 | 4; valeurs: number[] }

const TRAIT: Record<Serie['slot'], string> = {
  1: 'var(--color-serie-1)',
  2: 'var(--color-serie-2)',
  3: 'var(--color-serie-3)',
  4: 'var(--color-serie-4)',
}

/**
 * Une à quatre courbes sur une seule échelle. Trait de 2 px, réticule et
 * info-bulle au survol (et aux flèches du clavier), étiquette directe au bout
 * de chaque courbe, légende dès deux séries, table de données.
 */
export function GraphiqueLignes({
  series,
  etiquettes,
  details,
  unite = 'taps',
  hauteur = 180,
  resume,
  pasEtiquettes,
  depuisZero = true,
  langue = 'fr',
}: {
  series: Serie[]
  /** Étiquette courte de chaque point, pour l'axe. */
  etiquettes: string[]
  /** Libellé long de chaque point, pour l'info-bulle et la table. */
  details: string[]
  unite?: string
  hauteur?: number
  resume: string
  pasEtiquettes?: number
  /** Faux pour un nombre d'avis : l'échelle part du minimum, pas de zéro. */
  depuisZero?: boolean
  langue?: Langue
}) {
  const [actif, setActif] = useState<number | null>(null)
  const fmt = FMT[langue]
  const t = textes(langue)
  const n = etiquettes.length
  const toutes = series.flatMap((s) => s.valeurs)
  const maxBrut = Math.max(0, ...toutes)
  const minBrut = depuisZero ? 0 : Math.min(...toutes)
  const bas = depuisZero ? 0 : Math.max(0, Math.floor(minBrut - Math.max(1, (maxBrut - minBrut) * 0.15)))
  const haut = depuisZero ? plafond(maxBrut) : Math.ceil(maxBrut + Math.max(1, (maxBrut - minBrut) * 0.15))
  const y = (v: number) => (1 - (v - bas) / Math.max(1, haut - bas)) * hauteur
  const x = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100)
  const pas = pasEtiquettes ?? Math.max(1, Math.ceil(n / 6))

  // Étiquettes directes au bout des courbes, écartées d'au moins 14 px.
  const bouts = series
    .map((s) => ({ s, y: y(s.valeurs[s.valeurs.length - 1] ?? 0) }))
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < bouts.length; i++) {
    if (bouts[i].y - bouts[i - 1].y < 14) bouts[i].y = bouts[i - 1].y + 14
  }

  function survol(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1))
    setActif(Math.min(n - 1, Math.max(0, i)))
  }
  function clavier(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight') setActif((a) => Math.min(n - 1, (a ?? -1) + 1))
    else if (e.key === 'ArrowLeft') setActif((a) => Math.max(0, (a ?? n) - 1))
    else return
    e.preventDefault()
  }

  const graduations = [haut, Math.round((haut + bas) / 2), bas]

  return (
    <figure className="m-0">
      {series.length >= 2 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {series.map((s) => (
            <li key={s.nom} className="flex items-center gap-1.5">
              <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: TRAIT[s.slot] }} aria-hidden />
              <span className="text-[var(--color-encre)]">{s.nom}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <div className="chiffre flex w-9 shrink-0 flex-col justify-between text-right text-[11px] text-[var(--color-encre-doux)]" style={{ height: hauteur }} aria-hidden>
          {graduations.map((g, i) => (
            <span key={i} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{fmt.format(g)}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-encre)]"
            style={{ height: hauteur }}
            role="img"
            aria-label={resume}
            tabIndex={0}
            onPointerMove={survol}
            onPointerLeave={() => setActif(null)}
            onKeyDown={clavier}
            onBlur={() => setActif(null)}
          >
            {graduations.map((_, i) => (
              <div key={i} className="absolute inset-x-0 border-t border-[var(--color-grille)]" style={{ top: `${(i / 2) * 100}%` }} aria-hidden />
            ))}
            <svg className="trace-ligne absolute inset-0 size-full overflow-visible" viewBox={`0 0 100 ${hauteur}`} preserveAspectRatio="none" aria-hidden>
              {series.map((s) => (
                <polyline
                  key={s.nom}
                  points={s.valeurs.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
                  fill="none"
                  stroke={TRAIT[s.slot]}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {actif !== null && (
                <line x1={x(actif)} x2={x(actif)} y1={0} y2={hauteur} stroke="var(--color-encre-doux)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              )}
            </svg>
            {actif !== null &&
              series.map((s) => (
                <span
                  key={s.nom}
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                  style={{ left: `${x(actif)}%`, top: y(s.valeurs[actif] ?? 0), background: TRAIT[s.slot] }}
                  aria-hidden
                />
              ))}
            {actif !== null && (
              <div
                className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-md bg-[var(--color-encre)] px-2.5 py-1.5 shadow-lg"
                style={x(actif) > 60 ? { right: `${100 - x(actif)}%`, marginRight: 10 } : { left: `${x(actif)}%`, marginLeft: 10 }}
              >
                <div className="text-[11px] text-white/70">{details[actif]}</div>
                {series.map((s) => (
                  <div key={s.nom} className="flex items-center gap-1.5 text-sm text-white">
                    {series.length > 1 && <span className="inline-block size-2 rounded-full" style={{ background: TRAIT[s.slot] }} aria-hidden />}
                    <span className="font-semibold">{fmt.format(s.valeurs[actif] ?? 0)}</span>
                    <span className="text-white/70">{series.length > 1 ? s.nom : unite}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="relative mt-1.5 h-4 text-[11px] text-[var(--color-encre-doux)]" aria-hidden>
            {etiquettes.map((e, i) =>
              (i % pas === 0 && n - 1 - i >= pas / 2) || i === n - 1 ? (
                <span
                  key={i}
                  // Sur un téléphone, seulement la première et la dernière date : les autres se chevaucheraient.
                  className={`chiffre absolute whitespace-nowrap ${i !== 0 && i !== n - 1 ? 'hidden sm:inline' : ''}`}
                  style={{ left: `${x(i)}%`, transform: i === 0 ? 'none' : i === n - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
                >
                  {e}
                </span>
              ) : null,
            )}
          </div>
        </div>
        {/* Étiquettes directes : valeur finale de chaque courbe, hors du tracé. */}
        <div className="relative w-20 shrink-0 sm:w-24" style={{ height: hauteur }} aria-hidden>
          {bouts.map(({ s, y: hautPx }) => (
            <div key={s.nom} className="absolute inset-x-0 -translate-y-1/2 truncate text-[11px]" style={{ top: hautPx }}>
              <span className="chiffre font-semibold text-[var(--color-encre)]">{fmt.format(s.valeurs[s.valeurs.length - 1] ?? 0)}</span>
              {series.length > 1 && <span className="text-[var(--color-encre-doux)]"> {s.nom}</span>}
            </div>
          ))}
        </div>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-[var(--color-encre-doux)] hover:underline">{t.voirDonnees}</summary>
        <div className="mt-1 max-h-64 overflow-auto">
          <table className="w-full max-w-lg text-xs">
            <thead>
              <tr className="text-left text-[var(--color-encre-doux)]">
                <th className="py-0.5 font-medium" />
                {series.map((s) => (
                  <th key={s.nom} className="py-0.5 text-right font-medium">{series.length > 1 ? s.nom : unite}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {details.map((d, i) => (
                <tr key={i} className="border-b border-[var(--color-ligne)] last:border-0">
                  <td className="py-0.5 text-[var(--color-encre-doux)]">{d}</td>
                  {series.map((s) => (
                    <td key={s.nom} className="chiffre py-0.5 text-right font-medium">{fmt.format(s.valeurs[i] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
