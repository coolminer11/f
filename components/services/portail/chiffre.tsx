'use client'

import { useMemo } from 'react'
import Compteur from '@/components/effets/compteur'
import { duree, type LanguePortail } from '@/components/services/portail/textes'

export type GenreChiffre = 'nombre' | 'duree' | 'pct' | 'note'

/**
 * Un chiffre qui roule (components/effets/compteur), utilisable depuis un
 * composant serveur : le format est choisi ici, côté client (une fonction ne
 * traverse pas la frontière serveur → client), et reste stable d'un rendu à
 * l'autre pour ne pas relancer l'animation.
 */
export default function Chiffre({
  valeur,
  genre = 'nombre',
  l,
  className = '',
  duree: ms,
}: {
  valeur: number
  genre?: GenreChiffre
  l: LanguePortail
  className?: string
  duree?: number
}) {
  const format = useMemo(() => {
    const loc = l === 'fr' ? 'fr-CA' : 'en-CA'
    const n = new Intl.NumberFormat(loc)
    const n1 = new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    if (genre === 'duree') return (v: number) => duree(v, l)
    if (genre === 'pct') return (v: number) => `${Math.round(v)} %`
    if (genre === 'note') return (v: number) => n1.format(v)
    return (v: number) => n.format(Math.round(v))
  }, [genre, l])
  return <Compteur valeur={valeur} format={format} className={className} duree={ms} />
}
