import { accesDossier } from '@/lib/lien-stats'
import { dossier as lireDossier } from '@/lib/requetes/dossiers'
import { exportJournalier } from '@/lib/requetes/classement'
import { langueValide } from '@/lib/langue'
import { joursDepuis } from '@/components/selecteur-jours'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Comme l'export du back-office : une cellule qui commencerait par = + - @ ne devient jamais une formule. */
function cellule(v: string | number): string {
  const texte = String(v)
  const sure = /^[=+\-@\t\r]/.test(texte) ? `'${texte}` : texte
  return `"${sure.replace(/"/g, '""')}"`
}

/**
 * Le détail des taps du client, pour son tableur : une ligne par carte et par
 * jour. Même porte que la page (lien signé, actif, mot de passe s'il y en a
 * un). Point-virgule pour Excel en français, virgule en anglais.
 */
export async function GET(requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  const acces = await accesDossier(jeton)
  if (acces.etat === 'verrouille') return new Response('Mot de passe requis', { status: 401 })
  const d = acces.etat === 'ok' ? await lireDossier(acces.id) : null
  if (!d) return new Response('Introuvable', { status: 404 })
  const sp = new URL(requete.url).searchParams
  const jours = joursDepuis(sp.get('p') ?? undefined)
  const fr = (langueValide(sp.get('l')) ?? d.langue) === 'fr'
  const sep = fr ? ';' : ','

  const lignes = await exportJournalier(d.id, jours)
  const tableau = [
    fr ? ['Date', 'Carte', 'Groupe', 'Taps', 'Puce NFC', 'Code QR'] : ['Date', 'Card', 'Group', 'Taps', 'NFC chip', 'QR code'],
    ...lignes.map((l) => [l.jour, l.libelle, l.groupe ?? '', l.taps, l.nfc, l.qr]),
  ]
  const csv = '﻿' + tableau.map((l) => l.map(cellule).join(sep)).join('\r\n') + '\r\n'
  const nom =
    d.nom
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'tapora'
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="tapora-${nom}-${jours}j.csv"`,
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex',
    },
  })
}
