import { NextResponse } from 'next/server'
import { exigerEcriture } from '@/lib/auth'
import { urlDeTeleversement } from '@/lib/requetes/tutoriels'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Donne au navigateur une adresse de dépôt signée.
 *
 * La vidéo va directement du portable au seau Supabase, sans passer par notre
 * serveur : le forfait gratuit de l'hébergeur offre 512 Mo de mémoire vive, et
 * un fichier de 200 Mo qui transite en mémoire le tuerait — sans compter la
 * limite de durée d'une requête.
 */
export async function POST(requete: Request) {
  await exigerEcriture()
  const { nom } = (await requete.json()) as { nom?: string }
  if (!nom) return NextResponse.json({ erreur: 'Nom de fichier manquant.' }, { status: 400 })

  try {
    return NextResponse.json(await urlDeTeleversement(nom))
  } catch (e) {
    return NextResponse.json(
      { erreur: e instanceof Error ? e.message : 'Dépôt impossible.' },
      { status: 400 },
    )
  }
}
