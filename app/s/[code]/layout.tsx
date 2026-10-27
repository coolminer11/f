import { notFound } from 'next/navigation'
import { parCode } from '@/lib/services/donnees'

/**
 * Le code est vérifié ICI, au-dessus de l'écran de chargement : un code
 * inconnu, une carte désactivée ou un établissement suspendu reçoit un vrai
 * 404 (la page « carte pas encore activée » d'app/s/not-found.tsx).
 */
export default async function GabaritLieu({ children, params }: { children: React.ReactNode; params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!(await parCode(code.slice(0, 16)))) notFound()
  return children
}
