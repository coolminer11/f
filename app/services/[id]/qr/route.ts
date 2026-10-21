import { exigerSession } from '@/lib/auth'
import { emplacements, lireEtablissement } from '@/lib/services/donnees'
import { baseCartesAffichee } from '@/lib/cartes-url'
import { plancheQr } from '@/lib/planche-qr'
import { chevaletsPdf } from '@/lib/services/chevalets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function nomFichier(nom: string): string {
  const propre = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  return `qr-${propre || 'etablissement'}.pdf`
}

/**
 * La planche de QR d'un établissement (PDF, 12 par page) — ou ses chevalets
 * de table à plier (?format=chevalets, 2 par page) : tous les emplacements
 * actifs, ceux d'un groupe (?groupe=Terrasse) ou un seul (?e=<id>).
 */
export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  // La même porte que exigerProprietaire(), mais un 404 en texte : la réponse
  // vide de notFound() serait prise pour un téléchargement par le navigateur.
  const introuvable = () => new Response('Introuvable', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
  if (!(await exigerSession()).proprietaire_logiciel) return introuvable()
  const { id } = await params
  const e = await lireEtablissement(id)
  if (!e) return introuvable()
  const q = new URL(requete.url).searchParams
  const groupe = q.get('groupe')
  const seul = q.get('e')
  const base = await baseCartesAffichee()
  const lieux = (await emplacements(e.id))
    .filter((l) => (seul ? l.id === seul : l.actif))
    .filter((l) => !groupe || (l.groupe ?? '') === groupe)
  if (!lieux.length) return new Response('Aucun emplacement à imprimer.', { status: 404 })
  const titre = groupe ? `${e.nom} — ${groupe}` : seul ? `${e.nom} — ${lieux[0].libelle}` : e.nom
  // « ?q » : la visite vient d'un scan, pas d'un tap (statistiques NFC / QR).
  const urlQr = (code: string) => `${base}/s/${code}?q`
  const chevalets = q.get('format') === 'chevalets'
  const pdf = chevalets
    ? await chevaletsPdf(
        { nom: e.nom, type: e.type, couleur: e.couleur, anglais: e.langues.includes('en'), appel: e.options.appel, concierge: e.options.concierge },
        lieux.map((l) => ({ libelle: l.libelle, urlQr: urlQr(l.code) })),
      )
    : await plancheQr(
        titre,
        lieux.map((l) => ({ libelle: l.libelle, code: l.code, urlQr: urlQr(l.code) })),
      )
  return new Response(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${chevalets ? nomFichier(titre).replace(/^qr-/, 'chevalets-') : nomFichier(titre)}"`,
      'cache-control': 'private, no-store',
    },
  })
}
