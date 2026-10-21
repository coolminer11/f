'use client'

import Compteur from '@/components/effets/compteur'
import { duree } from '@/components/services/bo/elements'

const CAD = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' })
const ENTIER = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 0 })
const CAD0 = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
const NOTE = new Intl.NumberFormat('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// Des fonctions de module : stables d'un rendu à l'autre (le compteur ne repart pas de zéro à chaque rafraîchissement).
const FORMATS = {
  nombre: (v: number) => ENTIER.format(v),
  argent: (v: number) => CAD.format(v).replace('-', '−'),
  argentRond: (v: number) => CAD0.format(v).replace('-', '−'),
  note: (v: number) => `${NOTE.format(v)} ★`,
  pourcent: (v: number) => `${ENTIER.format(v)} %`,
  duree: (v: number) => duree(v),
}

/** Un chiffre clé qui roule jusqu'à sa valeur (relevé bancaire). Pour les pages serveur : le format se choisit par son nom. */
export default function Chiffre({ valeur, genre = 'nombre', className = '' }: { valeur: number | null | undefined; genre?: keyof typeof FORMATS; className?: string }) {
  if (valeur === null || valeur === undefined || !Number.isFinite(valeur)) return <span className={className}>—</span>
  return <Compteur valeur={valeur} format={FORMATS[genre]} className={className} />
}
