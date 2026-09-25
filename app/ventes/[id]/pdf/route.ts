import { exigerSession } from '@/lib/auth'
import { documentComplet, emetteur } from '@/lib/requetes/ventes'
import { documentEnPdf, nomFichierPdf } from '@/lib/pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_requete: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigerSession()
  const { id } = await params
  const [doc, societe] = await Promise.all([documentComplet(id), emetteur()])
  if (!doc) return new Response('Document introuvable', { status: 404 })

  const pdf = await documentEnPdf(doc, societe)
  return new Response(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      // « attachment » déclenche un vrai téléchargement : sans cela, le
      // navigateur affiche le PDF et l'utilisateur doit encore l'enregistrer.
      'content-disposition': `attachment; filename="${nomFichierPdf(doc)}"`,
      'cache-control': 'no-store',
    },
  })
}
