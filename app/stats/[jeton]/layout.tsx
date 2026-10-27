import { notFound } from 'next/navigation'
import { lienStatsValide } from '@/lib/lien-stats'

/**
 * Le lien est vérifié ICI, au-dessus de l'écran de chargement : un lien
 * faux, périmé ou désactivé reçoit un vrai 404, au lieu d'une page
 * « introuvable » servie avec un code 200. Le mot de passe, lui, reste
 * demandé par la page.
 */
export default async function GabaritStats({ children, params }: { children: React.ReactNode; params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  if (!(await lienStatsValide(jeton.slice(0, 80)))) notFound()
  return children
}
