const CAD = new Intl.NumberFormat('fr-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
})

const NOMBRE = new Intl.NumberFormat('fr-CA')

const POURCENT = new Intl.NumberFormat('fr-CA', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function argent(valeur: number | string | null | undefined): string {
  if (valeur === null || valeur === undefined) return '—'
  // Signe moins typographique (U+2212) : même glyphe partout, et il ne se
  // confond pas avec un trait d'union au milieu d'un tableau de chiffres.
  return CAD.format(Number(valeur)).replace('-', '−')
}

export function nombre(valeur: number | string | null | undefined): string {
  if (valeur === null || valeur === undefined) return '—'
  return NOMBRE.format(Number(valeur))
}

export function pourcent(valeur: number | string | null | undefined): string {
  if (valeur === null || valeur === undefined) return '—'
  return `${POURCENT.format(Number(valeur)).replace('-', '−')} %`
}

/** Taux 0,09975 -> « 9,975 % », séparateur décimal français. */
export function taux(valeur: number | string): string {
  return `${new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 3 }).format(
    Number(valeur) * 100,
  )} %`
}

/** Date AAAA-MM-JJ -> « 4 septembre 2026 », sans décalage de fuseau. */
export function dateLongue(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j)).toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function dateCourte(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j)).toLocaleDateString('fr-CA', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })
}

/** Mois AAAA-MM-01 -> « septembre 2026 ». */
export function moisLong(iso: string): string {
  const [a, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString('fr-CA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function moisPrecedent(iso: string): string {
  const [a, m] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export function moisSuivant(iso: string): string {
  const [a, m] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(a, m, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export function moisCourant(): string {
  const maintenant = new Date()
  return `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}-01`
}

export function aujourdhui(): string {
  const maintenant = new Date()
  return `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}-${String(maintenant.getDate()).padStart(2, '0')}`
}
