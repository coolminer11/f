'use client'

import { usePathname } from 'next/navigation'

/**
 * Le menu, la barre de chargement et les pop-ups du back-office ne
 * s'affichent jamais sur les pages destinées aux clients, même quand le
 * propriétaire est connecté : l'espace client (/portail), la page de
 * statistiques d'un client (/stats/…), ses documents (/documents/…), et
 * Tapora Services (/s/… pour les clients, /service/… pour le personnel).
 * Ces pages ont leur propre cadre.
 */
// Avec la barre finale : « /service/ » ne touche pas « /services » (le back-office du propriétaire).
const PREFIXES_CLIENTS = ['/s/', '/service/', '/stats/', '/documents/', '/portail/']

export function pageClient(chemin: string): boolean {
  return chemin === '/portail' || PREFIXES_CLIENTS.some((p) => chemin.startsWith(p))
}

export default function ChromeBo({ children }: { children: React.ReactNode }) {
  if (pageClient(usePathname())) return null
  return <>{children}</>
}
