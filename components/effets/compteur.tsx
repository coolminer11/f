'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Un nombre qui roule, chiffre par chiffre, comme sur un relevé bancaire :
 * chaque chiffre est une colonne 0–9 qui glisse jusqu'à sa valeur, les
 * colonnes de droite un peu après celles de gauche. Les séparateurs ($, %,
 * espaces, virgules) restent fixes. Au premier affichage, il part de zéro.
 */
export default function Compteur({
  valeur,
  format = (v) => new Intl.NumberFormat('fr-CA').format(v),
  className = '',
  duree = 1400,
}: {
  valeur: number
  format?: (v: number) => string
  className?: string
  duree?: number
}) {
  const [affiche, setAffiche] = useState(() => format(0).replace(/\d/g, '0'))
  const [pret, setPret] = useState(false)
  const premiere = useRef(true)

  useEffect(() => {
    const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches
    const cible = format(valeur)
    if (reduit) {
      setAffiche(cible)
      setPret(true)
      return
    }
    // Un cadre pour poser les colonnes à zéro, puis la transition jusqu'à la valeur.
    const t = setTimeout(
      () => {
        setAffiche(cible)
        setPret(true)
      },
      premiere.current ? 60 : 0,
    )
    premiere.current = false
    return () => clearTimeout(t)
  }, [valeur, format])

  const caracteres = [...affiche]
  const chiffres = caracteres.filter((c) => /\d/.test(c)).length
  let rang = 0
  return (
    <span className={`compteur inline-flex items-baseline tabular-nums ${className}`}>
      {/* Le vrai nombre, pour les lecteurs d'écran (les colonnes qui roulent leur sont cachées). */}
      <span className="sr-only">{format(valeur)}</span>
      {caracteres.map((c, i) => {
        if (!/\d/.test(c)) {
          return (
            <span key={`s${i}`} aria-hidden className="compteur-signe">
              {c}
            </span>
          )
        }
        const d = Number(c)
        const position = rang++
        return (
          <span key={`d${caracteres.length - i}`} aria-hidden className="compteur-chiffre">
            <span
              className="compteur-colonne"
              style={{
                transform: `translateY(-${d * 10}%)`,
                transitionDuration: pret ? `${duree}ms` : '0ms',
                transitionDelay: pret ? `${(position / Math.max(1, chiffres)) * 260}ms` : '0ms',
              }}
            >
              {'0123456789'.split('').map((x) => (
                <span key={x}>{x}</span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}
