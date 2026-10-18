import { exigerSession } from '@/lib/auth'
import { dossier as lireDossier } from '@/lib/requetes/dossiers'
import { listerCartes } from '@/lib/requetes/cartes'
import { baseCartesAffichee, urlPuce, urlQr } from '@/lib/cartes-url'
import { plancheQr } from '@/lib/planche-qr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Un tableur ouvre un CSV et EXÉCUTE une cellule qui commence par = + - @ :
 * un nom de carte piégé deviendrait une formule. On la neutralise d'une
 * apostrophe, et on met chaque valeur entre guillemets.
 */
function cellule(v: string): string {
  const sure = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return `"${sure.replace(/"/g, '""')}"`
}

function nomFichier(nom: string, extension: string): string {
  const propre = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  return `cartes-${propre || 'dossier'}.${extension}`
}

export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigerSession()
  const { id } = await params
  const d = await lireDossier(id)
  if (!d) return new Response('Introuvable', { status: 404 })
  const format = new URL(requete.url).searchParams.get('format')
  const base = await baseCartesAffichee()
  const cartes = (await listerCartes(d.id)).sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr', { numeric: true }))

  if (format === 'pdf') {
    const pdf = await plancheQr(
      d.nom,
      cartes.map((c) => ({ libelle: c.libelle, code: c.code, urlQr: urlQr(base, c.code) })),
    )
    return new Response(new Uint8Array(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${nomFichier(d.nom, 'pdf')}"`,
        'cache-control': 'private, no-store',
      },
    })
  }

  const lignes = [
    ['Nom de la carte', 'Code', 'Adresse à écrire sur la puce', 'Adresse du QR', 'Active'],
    ...cartes.map((c) => [c.libelle, c.code, urlPuce(base, c.code), urlQr(base, c.code), c.actif ? 'oui' : 'non']),
  ]
  // BOM : Excel ouvre ainsi les accents correctement.
  const csv = '﻿' + lignes.map((l) => l.map(cellule).join(',')).join('\r\n') + '\r\n'
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${nomFichier(d.nom, 'csv')}"`,
      'cache-control': 'private, no-store',
    },
  })
}
