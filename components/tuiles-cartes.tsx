/**
 * Tuiles chiffrées et mini-courbes — rendues côté serveur, sans interaction :
 * chaque valeur y est écrite en clair.
 */

const fmt = new Intl.NumberFormat('fr-CA')

/** Évolution contre la période précédente : signée, fléchée, jamais par la couleur seule. */
export function Evolution({ courant, precedent, libelle }: { courant: number; precedent: number; libelle: string }) {
  if (precedent === 0 && courant === 0) {
    return <span className="text-xs text-[var(--color-encre-doux)]">— {libelle}</span>
  }
  if (precedent === 0) {
    return (
      <span className="text-xs font-medium text-[var(--color-positif)]">
        ▲ nouveau <span className="font-normal text-[var(--color-encre-doux)]">{libelle}</span>
      </span>
    )
  }
  const ecart = Math.round(((courant - precedent) / precedent) * 100)
  if (ecart === 0) {
    return (
      <span className="text-xs font-medium text-[var(--color-encre-doux)]">
        = stable <span className="font-normal">{libelle}</span>
      </span>
    )
  }
  const hausse = ecart > 0
  return (
    <span className={`text-xs font-medium ${hausse ? 'text-[var(--color-positif)]' : 'text-[var(--color-negatif)]'}`}>
      {hausse ? '▲' : '▼'} {hausse ? '+' : '−'}
      {Math.abs(ecart)} % <span className="font-normal text-[var(--color-encre-doux)]">{libelle}</span>
    </span>
  )
}

export function Tuile({
  libelle,
  valeur,
  sous,
}: {
  libelle: string
  valeur: string
  sous?: React.ReactNode
}) {
  return (
    <div className="carte p-4">
      <div className="text-xs font-medium text-[var(--color-encre-doux)]">{libelle}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight" style={{ fontVariantNumeric: 'proportional-nums' }}>
        {valeur}
      </div>
      {sous && <div className="mt-1">{sous}</div>}
    </div>
  )
}

/** Mini-courbe de tendance : ligne discrète, dernier point dans la teinte de série. */
export function MiniCourbe({ serie, largeur = 84, hauteur = 24 }: { serie: number[]; largeur?: number; hauteur?: number }) {
  if (!serie.length) return null
  const max = Math.max(1, ...serie)
  const pas = serie.length > 1 ? (largeur - 8) / (serie.length - 1) : 0
  const pts = serie.map((v, i) => [4 + i * pas, hauteur - 4 - (v / max) * (hauteur - 8)] as const)
  const [dx, dy] = pts[pts.length - 1]
  return (
    <svg
      width={largeur}
      height={hauteur}
      viewBox={`0 0 ${largeur} ${hauteur}`}
      role="img"
      aria-label={`Taps des ${serie.length} derniers jours : ${serie.map((v) => fmt.format(v)).join(', ')}`}
    >
      <polyline
        points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="var(--color-serie-attenuee)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={dx} cy={dy} r={3.5} fill="var(--color-serie-1)" stroke="white" strokeWidth={2} />
    </svg>
  )
}

/** « il y a 3 h », « hier », « le 12 octobre ». */
export function depuis(iso: string | null): string {
  if (!iso) return 'jamais'
  const secondes = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (secondes < 60) return 'à l’instant'
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.round(minutes / 60)
  if (heures < 24) return `il y a ${heures} h`
  const jours = Math.round(heures / 24)
  if (jours === 1) return 'hier'
  if (jours < 30) return `il y a ${jours} jours`
  return new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', timeZone: 'America/Toronto' })
}

export { fmt as nombreFr }
