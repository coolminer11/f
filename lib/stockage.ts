import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BUCKET = 'recus'
const DUREE_URL_SIGNEE = 60 * 10 // 10 minutes

/**
 * Les reçus vivent dans un bucket Supabase PRIVÉ : les URL sont signées côté
 * serveur, à la demande, et expirent. Rien n'est accessible publiquement.
 *
 * En développement local, sans projet Supabase configuré, les fichiers sont
 * écrits dans ./recus-local et servis par /api/recus. Ce repli n'a aucune
 * valeur en production : il n'existe que pour pouvoir faire tourner
 * l'application sans dépendre du réseau.
 */
export function stockageDistant(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function cheminLocal(chemin: string): string {
  // Empêche toute remontée hors du dossier de dépôt.
  const normalise = path.normalize(chemin).replace(/^(\.\.[/\\])+/, '')
  return path.join(process.cwd(), 'recus-local', normalise)
}

export async function televerserRecu(fichier: File): Promise<string> {
  const extension = (fichier.name.split('.').pop() ?? 'jpg').toLowerCase().slice(0, 5)
  const maintenant = new Date()
  const chemin = `${maintenant.getFullYear()}/${String(maintenant.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${extension}`
  const contenu = Buffer.from(await fichier.arrayBuffer())

  if (stockageDistant()) {
    const { error } = await client()
      .storage.from(BUCKET)
      .upload(chemin, contenu, { contentType: fichier.type, upsert: false })
    if (error) throw new Error(`Téléversement du reçu impossible : ${error.message}`)
    return chemin
  }

  const destination = cheminLocal(chemin)
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, contenu)
  return chemin
}

/** URL temporaire, signée, pour consulter un reçu entreposé chez Supabase. */
export async function urlRecuSignee(chemin: string): Promise<string | null> {
  const { data, error } = await client()
    .storage.from(BUCKET)
    .createSignedUrl(chemin, DUREE_URL_SIGNEE)
  if (error) return null
  return data.signedUrl
}

/**
 * Lien à afficher dans l'interface. Toujours interne : la signature de l'URL
 * n'est demandée qu'au moment où le reçu est réellement ouvert, jamais pour
 * chaque ligne d'une liste de cinquante transactions.
 */
export function lienRecu(chemin: string | null): string | null {
  return chemin ? `/api/recus/${chemin}` : null
}
