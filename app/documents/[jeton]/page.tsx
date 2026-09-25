import { notFound } from 'next/navigation'
import { documentParJeton } from '@/lib/requetes/envois'
import { emetteur } from '@/lib/requetes/ventes'
import DocumentImprimable from '@/components/document-imprimable'
import BoutonImprimer from '@/components/bouton-imprimer'

export const dynamic = 'force-dynamic'

/**
 * Page publique du document, celle qu'ouvre le client depuis son courriel.
 *
 * Aucune session n'est requise, MAIS le jeton n'ouvre que CE document : il est
 * tiré au hasard sur 24 octets, ne se devine pas, se révoque d'un clic, et
 * n'ouvre aucun autre écran du back-office.
 */
export default async function PageDocumentPublic({
  params,
}: {
  params: Promise<{ jeton: string }>
}) {
  const { jeton } = await params
  const doc = await documentParJeton(jeton)
  if (!doc) notFound()
  const societe = await emetteur()

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-[8.5in] flex-wrap items-center justify-between gap-2 print:hidden">
        <span className="text-sm text-[var(--color-encre-doux)]">
          {doc.definition.libelle} {doc.numero} · {societe.nom_entreprise}
        </span>
        <div className="flex items-center gap-2">
          <a href={`/documents/${jeton}/pdf`} className="bouton bouton-secondaire">
            Télécharger le PDF
          </a>
          <BoutonImprimer />
        </div>
      </div>
      <DocumentImprimable doc={doc} societe={societe} />
    </>
  )
}
