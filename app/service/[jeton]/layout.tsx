import { notFound } from 'next/navigation'
import { accesPortail } from '@/lib/services/acces'

/**
 * Le lien est vérifié ICI, au-dessus de l'écran de chargement : un lien
 * faux ou périmé reçoit un vrai 404, au lieu d'une page « introuvable »
 * servie avec un code 200 une fois le chargement commencé.
 */
export default async function GabaritPortailJeton({ children, params }: { children: React.ReactNode; params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  if ((await accesPortail(jeton.slice(0, 80))).etat === 'invalide') notFound()
  return children
}
