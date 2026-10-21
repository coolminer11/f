import { Suspense } from 'react'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import MessagesAdresse from '@/components/services/bo/messages-adresse'

/**
 * La porte de toute la section : vérifiée ICI, au-dessus de l'écran de
 * chargement, pour qu'un autre compte reçoive un vrai 404 — sans même voir
 * le squelette de la page passer. Les retours des actions (?message= /
 * ?erreur=) deviennent des pop-ups (celles du gabarit racine, toujours
 * présentes ici : la section exige une session à double authentification).
 */
export default async function LayoutServices({ children }: { children: React.ReactNode }) {
  await exigerProprietaire()
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <MessagesAdresse />
      </Suspense>
    </>
  )
}
