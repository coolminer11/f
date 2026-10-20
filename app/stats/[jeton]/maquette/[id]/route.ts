import { readFile } from 'node:fs/promises'
import { accesDossier } from '@/lib/lien-stats'
import { cheminMaquette } from '@/lib/portail'
import { cheminLocal, stockageDistant, urlRecuSignee } from '@/lib/stockage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }

/**
 * La maquette d'une commande, vue par le client depuis son portail. Même
 * porte que la page (lien signé, actif, mot de passe s'il y en a un), et la
 * commande doit être celle de CE dossier. Le fichier reste privé : une URL
 * signée qui expire, ou le fichier local en développement.
 */
export async function GET(_r: Request, { params }: { params: Promise<{ jeton: string; id: string }> }) {
  const { jeton, id } = await params
  const acces = await accesDossier(jeton)
  if (acces.etat !== 'ok' || !/^[0-9a-f-]{36}$/i.test(id)) return new Response('Introuvable', { status: 404 })
  const chemin = await cheminMaquette(acces.id, id)
  if (!chemin) return new Response('Introuvable', { status: 404 })

  if (stockageDistant()) {
    const signee = await urlRecuSignee(chemin)
    return signee ? Response.redirect(signee, 302) : new Response('Introuvable', { status: 404 })
  }
  try {
    const contenu = await readFile(cheminLocal(chemin))
    const extension = chemin.split('.').pop()?.toLowerCase() ?? ''
    return new Response(new Uint8Array(contenu), {
      headers: {
        'content-type': TYPES[extension] ?? 'application/octet-stream',
        'content-disposition': TYPES[extension] ? 'inline' : 'attachment',
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    })
  } catch {
    return new Response('Introuvable', { status: 404 })
  }
}
