import 'server-only'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { clientSupabase } from '@/lib/secrets'
import { cheminLocal, stockageDistant } from '@/lib/stockage'

/**
 * Les fichiers publics des établissements : photos des plats, logo, image de
 * couverture, menus PDF. Les images sont redimensionnées et converties en
 * WebP (une photo de 6 Mo prise au téléphone devient ~150 Ko) ; tout est
 * rangé sous services/<établissement>/ et servi par /s/f/… .
 */
export type QuoiFichier = 'photo' | 'logo' | 'couverture' | 'pdf'

const LARGEUR: Record<Exclude<QuoiFichier, 'pdf'>, number> = { photo: 1400, logo: 600, couverture: 2000 }
const IMAGES = /\.(jpe?g|png|webp|heic|heif|gif)$/i

export async function televerserFichierService(fichier: File, etabId: string, quoi: QuoiFichier): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(etabId)) throw new Error('Établissement introuvable.')
  if (fichier.size > 15 * 1024 * 1024) throw new Error('Fichier trop volumineux (15 Mo au plus).')
  const brut = Buffer.from(await fichier.arrayBuffer())
  let contenu: Buffer
  let extension: string
  let type: string
  if (quoi === 'pdf') {
    if (!/\.pdf$/i.test(fichier.name) || brut.subarray(0, 4).toString() !== '%PDF') throw new Error('Un fichier PDF, s’il vous plaît.')
    contenu = brut
    extension = 'pdf'
    type = 'application/pdf'
  } else {
    if (!IMAGES.test(fichier.name)) throw new Error('Une image, s’il vous plaît (JPG, PNG, HEIC, WebP).')
    try {
      contenu = await sharp(brut, { failOn: 'error' })
        .rotate()
        .resize({ width: LARGEUR[quoi], withoutEnlargement: true })
        .webp({ quality: quoi === 'logo' ? 90 : 80 })
        .toBuffer()
    } catch {
      throw new Error('Cette image est illisible : essayez un JPG ou un PNG.')
    }
    extension = 'webp'
    type = 'image/webp'
  }
  const chemin = `services/${etabId}/${quoi}-${randomUUID()}.${extension}`
  if (stockageDistant()) {
    const { error } = await clientSupabase().storage.from('recus').upload(chemin, contenu, { contentType: type, upsert: false })
    if (error) throw new Error('Téléversement impossible pour l’instant.')
    return chemin
  }
  const destination = cheminLocal(chemin)
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, contenu)
  return chemin
}

/** L'adresse publique d'un fichier (photo, logo, PDF). */
export const urlFichier = (chemin: string | null | undefined) => (chemin ? `/s/f/${chemin}` : null)
