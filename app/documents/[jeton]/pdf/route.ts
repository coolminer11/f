import { documentParJeton } from '@/lib/requetes/envois'
import { emetteur } from '@/lib/requetes/ventes'
import { documentEnPdf, nomFichierPdf } from '@/lib/pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Le même PDF, pour le client qui a reçu le lien. Le jeton n'ouvre que ce
 * document : aucune session, aucun autre écran.
 */
export async function GET(_requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  const doc = await documentParJeton(jeton)
  if (!doc) return new Response('Document introuvable', { status: 404 })
  const societe = await emetteur()

  const pdf = await documentEnPdf(doc, societe)
  return new Response(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${nomFichierPdf(doc)}"`,
      'cache-control': 'no-store',
    },
  })
}
