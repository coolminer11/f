import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { sessionOuverte } from '@/lib/auth'
import { urlRecuSignee, stockageDistant } from '@/lib/stockage'

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  pdf: 'application/pdf',
}

/**
 * Point d'accès unique aux reçus. Le bucket Supabase est PRIVÉ : on redirige
 * vers une URL signée qui expire. En développement local sans Supabase, on
 * sert le fichier depuis ./recus-local.
 *
 * Dans les deux cas, la session est vérifiée : un reçu n'est pas public.
 */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ chemin: string[] }> },
) {
  if (!(await sessionOuverte())) {
    return new NextResponse('Non autorisé', { status: 401 })
  }

  const { chemin } = await params
  const relatif = path.normalize(chemin.join('/')).replace(/^(\.\.[/\\])+/, '')

  if (stockageDistant()) {
    const signee = await urlRecuSignee(relatif)
    if (!signee) return new NextResponse('Reçu introuvable', { status: 404 })
    return NextResponse.redirect(signee)
  }

  try {
    const contenu = await readFile(path.join(process.cwd(), 'recus-local', relatif))
    const extension = relatif.split('.').pop()?.toLowerCase() ?? ''
    return new NextResponse(new Uint8Array(contenu), {
      headers: {
        'Content-Type': TYPES[extension] ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch {
    return new NextResponse('Reçu introuvable', { status: 404 })
  }
}
