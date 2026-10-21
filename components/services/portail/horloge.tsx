'use client'

import { useEffect, useState } from 'react'
import type { LanguePortail } from '@/components/services/portail/textes'

/** L'heure de l'établissement (son fuseau, pas celui de la tablette), affichée après le chargement : aucun écart d'hydratation. */
export default function Horloge({ fuseau, l }: { fuseau: string; l: LanguePortail }) {
  const [maintenant, setMaintenant] = useState<Date | null>(null)
  useEffect(() => {
    setMaintenant(new Date())
    const i = setInterval(() => setMaintenant(new Date()), 15000)
    return () => clearInterval(i)
  }, [])
  if (!maintenant) return <span className="inline-block h-9 w-24" aria-hidden />
  const loc = l === 'fr' ? 'fr-CA' : 'en-CA'
  let heure = ''
  let jour = ''
  try {
    heure = maintenant.toLocaleTimeString(loc, { timeZone: fuseau, hour: '2-digit', minute: '2-digit' })
    jour = maintenant.toLocaleDateString(loc, { timeZone: fuseau, weekday: 'long', day: 'numeric', month: 'long' })
  } catch {
    heure = maintenant.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
    jour = maintenant.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })
  }
  return (
    <span className="hidden text-right leading-tight sm:block">
      <span className="pt-valeur block text-[1.7rem]">{heure}</span>
      <span className="block text-[11px] font-medium capitalize text-[var(--p-doux)]">{jour}</span>
    </span>
  )
}
