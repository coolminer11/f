'use client'

import { usePathname } from 'next/navigation'

/**
 * Le menu, la barre de chargement et les pop-ups du back-office ne
 * s'affichent pas sur les pages de Tapora Services destinées aux clients
 * (/s/…) et au personnel (/service/…), même quand le propriétaire est
 * connecté : ces pages ont leur propre cadre.
 */
export default function ChromeBo({ children }: { children: React.ReactNode }) {
  const chemin = usePathname()
  if (chemin.startsWith('/s/') || chemin.startsWith('/service/')) return null
  return <>{children}</>
}
