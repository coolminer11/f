'use client'

import { useState } from 'react'
import { argent, moisLong } from '@/lib/format'

export type PointTendance = {
  mois: string
  revenus_ht: number
  couts_variables: number
  couts_fixes: number
  profit_net: number
}

/**
 * Profit net des douze derniers mois.
 *
 * Forme : barres ancrées sur une ligne de zéro. Le signe est porté par la
 * POSITION (au-dessus ou au-dessous de zéro) ; la couleur ne fait que le
 * répéter, elle ne porte jamais l'information seule. Une seule mesure, donc un
 * seul axe. Le détail chiffré est disponible en tableau juste dessous.
 */
const L = 720
const H = 190
const MARGE_HAUT = 14
const MARGE_BAS = 26
const ECART = 2 // gouttière de surface entre barres voisines
const LARGEUR_BARRE_MAX = 46 // deux mois de données ne doivent pas donner deux pavés

export default function TendanceProfit({
  points,
  moisAffiche,
}: {
  points: PointTendance[]
  moisAffiche: string
}) {
  const [survole, setSurvole] = useState<number | null>(null)

  if (points.length === 0) return null

  const amplitude = Math.max(...points.map((p) => Math.abs(p.profit_net)), 1)
  const hauteurUtile = H - MARGE_HAUT - MARGE_BAS
  const zeroY = MARGE_HAUT + hauteurUtile / 2
  const echelle = (valeur: number) => (valeur / amplitude) * (hauteurUtile / 2)

  const largeurBande = L / points.length
  const largeurBarre = Math.min(LARGEUR_BARRE_MAX, Math.max(6, largeurBande - ECART * 2 - 8))

  const actif = survole ?? points.findIndex((p) => p.mois === moisAffiche)
  const point = points[actif] ?? null

  return (
    <figure className="carte p-5">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">
          Profit net mensuel
          <span className="ml-2 font-normal text-[var(--color-encre-doux)]">
            {points.length > 1
              ? `${moisLong(points[0].mois)} → ${moisLong(points[points.length - 1].mois)}`
              : moisLong(points[0].mois)}
          </span>
        </h2>
        <span className="text-xs text-[var(--color-encre-doux)]">
          Barre vers le haut : profit. Vers le bas : perte.
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${L} ${H}`}
        className="mt-2 w-full"
        style={{ height: 190 }}
        role="img"
        aria-label={`Profit net mensuel sur ${points.length} mois, de ${moisLong(points[0].mois)} à ${moisLong(points[points.length - 1].mois)}.`}
      >
        {/* Ligne de zéro : la référence, discrète mais toujours visible. */}
        <line
          x1="0"
          x2={L}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--color-ligne)"
          strokeWidth="1.5"
        />

        {points.map((p, i) => {
          const x = i * largeurBande + (largeurBande - largeurBarre) / 2
          const hauteur = Math.abs(echelle(p.profit_net))
          const positif = p.profit_net >= 0
          const y = positif ? zeroY - hauteur : zeroY
          const estActif = i === actif
          const couleur = positif ? '#2a78d6' : '#e34948'

          return (
            <g key={p.mois}>
              {p.mois === moisAffiche && (
                <rect
                  x={i * largeurBande + 1}
                  y={MARGE_HAUT}
                  width={largeurBande - 2}
                  height={hauteurUtile}
                  fill="var(--color-fond)"
                  rx="6"
                  pointerEvents="none"
                />
              )}
              {/* Zone de survol plus large que la barre. */}
              <rect
                x={i * largeurBande}
                y={MARGE_HAUT}
                width={largeurBande}
                height={hauteurUtile}
                fill="transparent"
                onMouseEnter={() => setSurvole(i)}
                onMouseLeave={() => setSurvole(null)}
                style={{ cursor: 'pointer' }}
              >
                <title>{`${moisLong(p.mois)} : ${argent(p.profit_net)}`}</title>
              </rect>
              <path
                d={cheminBarre(x, y, largeurBarre, Math.max(hauteur, 1.5), positif)}
                fill={couleur}
                opacity={survole === null || estActif ? 1 : 0.35}
                pointerEvents="none"
              />

              <text
                x={i * largeurBande + largeurBande / 2}
                y={H - 8}
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-encre-doux)"
                fontWeight={p.mois === moisAffiche ? 700 : 400}
                pointerEvents="none"
              >
                {etiquetteMois(p.mois)}
              </text>
            </g>
          )
        })}
      </svg>

      {point && (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-[var(--color-ligne)] pt-3 text-sm">
          <span className="font-semibold">{moisLong(point.mois)}</span>
          <span className="text-[var(--color-encre-doux)]">
            Revenus <span className="chiffre font-medium">{argent(point.revenus_ht)}</span>
          </span>
          <span className="text-[var(--color-encre-doux)]">
            Coûts{' '}
            <span className="chiffre font-medium">
              {argent(point.couts_variables + point.couts_fixes)}
            </span>
          </span>
          <span
            className={`chiffre font-bold ${
              point.profit_net >= 0
                ? 'text-[var(--color-positif)]'
                : 'text-[var(--color-negatif)]'
            }`}
          >
            {point.profit_net >= 0 ? 'Profit ' : 'Perte '}
            {argent(Math.abs(point.profit_net))}
          </span>
        </div>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-[var(--color-encre-doux)]">
          Voir les chiffres en tableau
        </summary>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-ligne)] text-left text-xs uppercase text-[var(--color-encre-doux)]">
              <th className="py-1.5 font-semibold">Mois</th>
              <th className="py-1.5 text-right font-semibold">Revenus HT</th>
              <th className="py-1.5 text-right font-semibold">Coûts</th>
              <th className="py-1.5 text-right font-semibold">Profit net</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.mois} className="border-b border-[var(--color-ligne)] last:border-0">
                <td className="py-1.5">{moisLong(p.mois)}</td>
                <td className="chiffre py-1.5 text-right">{argent(p.revenus_ht)}</td>
                <td className="chiffre py-1.5 text-right">
                  {argent(p.couts_variables + p.couts_fixes)}
                </td>
                <td className="chiffre py-1.5 text-right font-semibold">
                  {argent(p.profit_net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

/** Barre à extrémité arrondie, ancrée sur la ligne de zéro. */
function cheminBarre(x: number, y: number, l: number, h: number, versLeHaut: boolean): string {
  const r = Math.min(4, l / 2, h)
  return versLeHaut
    ? `M ${x} ${y + h} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + l - r} ${y} Q ${x + l} ${y} ${x + l} ${y + r} L ${x + l} ${y + h} Z`
    : `M ${x} ${y} L ${x} ${y + h - r} Q ${x} ${y + h} ${x + r} ${y + h} L ${x + l - r} ${y + h} Q ${x + l} ${y + h} ${x + l} ${y + h - r} L ${x + l} ${y} Z`
}

function etiquetteMois(iso: string): string {
  const [a, m] = iso.split('-').map(Number)
  const nom = new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString('fr-CA', {
    month: 'short',
    timeZone: 'UTC',
  })
  return m === 1 ? `${nom} ${String(a).slice(2)}` : nom
}
