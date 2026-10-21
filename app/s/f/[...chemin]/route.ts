import { readFile } from 'node:fs/promises'
import { cheminLocal, stockageDistant, urlRecuSignee } from '@/lib/stockage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = { webp: 'image/webp', pdf: 'application/pdf' }

/**
 * Les fichiers publics de Tapora Services (photos, logos, menus PDF) : seuls
 * les chemins services/<uuid>/<quoi>-<uuid>.<webp|pdf> passent ; tout le
 * reste du bucket (les reçus de la société) reste inaccessible.
 */
export async function GET(_r: Request, { params }: { params: Promise<{ chemin: string[] }> }) {
  const chemin = (await params).chemin.join('/')
  if (!/^services\/[0-9a-f-]{36}\/(photo|logo|couverture|pdf)-[0-9a-f-]{36}\.(webp|pdf)$/.test(chemin)) return new Response('Introuvable', { status: 404 })
  if (stockageDistant()) {
    const signee = await urlRecuSignee(chemin)
    return signee
      ? new Response(null, { status: 302, headers: { location: signee, 'cache-control': 'public, max-age=300' } })
      : new Response('Introuvable', { status: 404 })
  }
  try {
    const contenu = await readFile(cheminLocal(chemin))
    return new Response(new Uint8Array(contenu), {
      headers: { 'content-type': TYPES[chemin.split('.').pop() ?? ''] ?? 'application/octet-stream', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' },
    })
  } catch {
    return new Response('Introuvable', { status: 404 })
  }
}
