import CadreClient from '@/components/client/cadre-client'
import SqueletteClient from '@/components/client/squelette-client'

/** Affiché dès le clic sur le lien : la page n'est jamais blanche pendant que les chiffres arrivent. */
export default function Chargement() {
  return (
    <CadreClient lang="fr-CA">
      <SqueletteClient />
    </CadreClient>
  )
}
