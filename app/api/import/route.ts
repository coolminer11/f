import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sessionOuverte } from '@/lib/auth'
import { enregistrerImport } from '@/lib/requetes/import'

const Corps = z.object({
  nomFichier: z.string().min(1).max(200),
  empreinteFichier: z.string().regex(/^[0-9a-f]{64}$/, 'Empreinte invalide.'),
  compte: z.string().max(100).nullable(),
  lignes: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        description: z.string().min(1).max(500),
        montant: z.number().finite(),
        solde: z.number().finite().nullable(),
      }),
    )
    .min(1, 'Le fichier ne contient aucune ligne exploitable.')
    .max(5000, 'Fichier trop volumineux (5000 lignes maximum).'),
})

/**
 * Réception d'un relevé déjà analysé et cartographié par le navigateur.
 * L'empreinte du FICHIER empêche de réimporter deux fois le même relevé ;
 * l'empreinte de chaque LIGNE, calculée côté serveur, empêche de recréer une
 * écriture déjà saisie même si elle arrive dans un autre fichier.
 */
export async function POST(requete: Request) {
  if (!(await sessionOuverte())) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  }

  let corps: unknown
  try {
    corps = await requete.json()
  } catch {
    return NextResponse.json({ erreur: 'Corps de requête illisible.' }, { status: 400 })
  }

  const analyse = Corps.safeParse(corps)
  if (!analyse.success) {
    return NextResponse.json(
      { erreur: analyse.error.issues[0]?.message ?? 'Données invalides.' },
      { status: 400 },
    )
  }

  try {
    return NextResponse.json(await enregistrerImport(analyse.data))
  } catch (e) {
    return NextResponse.json(
      { erreur: e instanceof Error ? e.message : 'Import impossible.' },
      { status: 500 },
    )
  }
}
