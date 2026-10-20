import { NextResponse } from 'next/server'
import { sessionOuverte } from '@/lib/auth'
import { exercicesConnus } from '@/lib/requetes/associes'
import { partages, resumeAnnee } from '@/lib/profits'
import { emetteur } from '@/lib/requetes/ventes'
import { versCsv } from '@/lib/requetes/export'
import { stockAu } from '@/lib/stock'

export const dynamic = 'force-dynamic'

type Ligne = { section: string; libelle: string; montant: number | string | null }

const pct = (p: number) => `${(Math.round(p * 10000) / 100).toLocaleString('fr-CA', { maximumFractionDigits: 2 })} %`

/**
 * Le résumé fiscal d'un associé pour une année, à remettre au comptable :
 * les chiffres de la société, sa part (selon le partage de chaque période),
 * ses prélèvements, l'historique des partages et le détail par catégorie.
 * Même format que les autres exports (point-virgule, virgule décimale).
 */
export async function GET(requete: Request) {
  if (!(await sessionOuverte())) return new NextResponse('Non autorisé', { status: 401 })
  const p = new URL(requete.url).searchParams
  const annee = Number(p.get('annee'))
  if (!(await exercicesConnus()).some((e) => e.annee === annee)) return new NextResponse('Année inconnue', { status: 400 })
  const auj = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date())
  const finStock = auj.startsWith(String(annee)) ? auj : `${annee}-12-31`
  const [r, histo, societe, stockDebut, stockFin] = await Promise.all([resumeAnnee(annee), partages(), emetteur(), stockAu(`${annee - 1}-12-31`), stockAu(finStock)])
  const a = r.associes.find((x) => x.associe_id === p.get('associe'))
  if (!a) return new NextResponse('Associé inconnu', { status: 400 })

  const debutAnnee = `${annee}-01-01`
  const finAnnee = `${annee}-12-31`
  const lignes: Ligne[] = [
    { section: 'Société', libelle: `${societe.nom_entreprise}${societe.neq ? ` (NEQ ${societe.neq})` : ''} — exercice du ${debutAnnee} au ${finAnnee}`, montant: null },
    { section: 'Société', libelle: 'Revenus (avant taxes)', montant: r.societe.revenus },
    { section: 'Société', libelle: 'Dépenses', montant: r.societe.depenses },
    { section: 'Société', libelle: 'Bénéfice net', montant: r.societe.benefice },
    { section: 'Société', libelle: 'Repas et représentation non déductibles (50 %)', montant: r.societe.repas_non_deductible },
    { section: 'Société', libelle: 'Bénéfice imposable estimé', montant: r.societe.benefice_fiscal },
    { section: 'Coût des produits vendus', libelle: `Stock au ${annee}-01-01 (${Math.max(0, stockDebut.quantite)} cartes)`, montant: stockDebut.valeur },
    { section: 'Coût des produits vendus', libelle: 'Achats de cartes de l’année (au stock)', montant: stockFin.achats },
    { section: 'Coût des produits vendus', libelle: `Stock au ${finStock} (${Math.max(0, stockFin.quantite)} cartes)`, montant: stockFin.valeur },
    { section: 'Coût des produits vendus', libelle: 'Coût des cartes vendues (inclus dans les dépenses)', montant: stockFin.cogs },
    { section: 'Associé', libelle: a.nom, montant: null },
    { section: 'Associé', libelle: 'Part du bénéfice imposable estimé (revenu d’entreprise à déclarer)', montant: a.fiscal },
    { section: 'Associé', libelle: 'Part du bénéfice net', montant: a.comptable },
    { section: 'Associé', libelle: 'Part moyenne de l’année', montant: r.societe.benefice !== 0 ? pct(a.comptable / r.societe.benefice) : '—' },
    { section: 'Associé', libelle: 'Prélèvements de l’année (non imposables en soi)', montant: a.prelevements },
    { section: 'Associé', libelle: 'Apports de l’année', montant: a.apports },
    ...histo.appliques
      .filter((x) => x.debut <= finAnnee)
      .slice()
      .reverse()
      .map((x) => ({
        section: 'Partage',
        libelle: x.premier ? 'Depuis le début' : `À partir du ${x.debut}`,
        montant: x.parts.map((y) => `${y.nom} ${pct(y.part)}`).join(' · '),
      })),
    ...r.mois.map((m) => ({ section: `Mois ${m.mois.slice(0, 7)}`, libelle: `Profit de la société : ${m.profit.toFixed(2).replace('.', ',')} $ — part de ${a.nom}`, montant: m.parts[a.associe_id] ?? 0 })),
    ...r.categories.map((c) => ({ section: c.type === 'revenu' ? 'Revenus par catégorie' : 'Dépenses par catégorie', libelle: c.libelle, montant: c.montant })),
  ]
  const csv = versCsv(lignes, [
    { entete: 'Section', valeur: (l) => l.section },
    { entete: 'Libellé', valeur: (l) => l.libelle },
    { entete: 'Montant', valeur: (l) => l.montant, montant: true },
  ])
  const nom = a.nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tapora-resume-fiscal-${annee}-${nom}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
