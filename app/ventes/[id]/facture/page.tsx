import { notFound } from 'next/navigation'
import Link from 'next/link'
import { exigerSession } from '@/lib/auth'
import { documentComplet, emetteur } from '@/lib/requetes/ventes'
import DocumentImprimable from '@/components/document-imprimable'
import BoutonImprimer from '@/components/bouton-imprimer'

export const dynamic = 'force-dynamic'

export default async function PageDocumentImprimable({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigerSession()
  const { id } = await params
  const [doc, societe] = await Promise.all([documentComplet(id), emetteur()])
  if (!doc) notFound()

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-[8.5in] flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/ventes/${doc.id}`}
          className="text-sm text-[var(--color-encre-doux)] hover:underline"
        >
          ← Retour au document
        </Link>
        <div className="flex items-center gap-2">
          <a href={`/ventes/${doc.id}/pdf`} className="bouton bouton-secondaire">
            Télécharger le PDF
          </a>
          <BoutonImprimer />
        </div>
      </div>
      <DocumentImprimable doc={doc} societe={societe} />
    </>
  )
}
