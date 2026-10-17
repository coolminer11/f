import QRCode from 'qrcode'
import { exigerSession } from '@/lib/auth'
import { carte } from '@/lib/requetes/cartes'
import { baseCartesAffichee, urlQr } from '@/lib/cartes-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Le code QR d'une carte, à imprimer à côté de la puce. SVG pour l'impression
 * (net à toute taille), PNG haute définition pour les outils qui ne lisent
 * pas le SVG. Correction d'erreur « M » : un QR rayé ou un peu sale se lit
 * encore.
 */
export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigerSession()
  const { id } = await params
  const c = await carte(id)
  if (!c) return new Response('Carte introuvable', { status: 404 })

  const url = urlQr(await baseCartesAffichee(), c.code)
  const format = new URL(requete.url).searchParams.get('format') === 'png' ? 'png' : 'svg'
  const nom = `qr-${c.code}.${format}`

  if (format === 'png') {
    const png = await QRCode.toBuffer(url, { type: 'png', width: 1200, margin: 2, errorCorrectionLevel: 'M' })
    return new Response(new Uint8Array(png), {
      headers: { 'content-type': 'image/png', 'content-disposition': `attachment; filename="${nom}"` },
    })
  }
  const svg = await QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' })
  return new Response(svg, {
    headers: { 'content-type': 'image/svg+xml', 'content-disposition': `attachment; filename="${nom}"` },
  })
}
