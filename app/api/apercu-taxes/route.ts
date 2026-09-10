import { NextResponse } from 'next/server'
import { sessionOuverte } from '@/lib/auth'
import { apercuTaxes, ventilerTtc } from '@/lib/requetes/transactions'

/**
 * Aperçu des taxes qu'une saisie va produire. Les taux viennent de la base
 * (règles par province), jamais d'une constante côté navigateur : une carte
 * expédiée en Ontario porte 13 % de TVH sur une seule ligne, pas TPS + TVQ.
 */
export async function GET(requete: Request) {
  if (!(await sessionOuverte())) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  }

  const parametres = new URL(requete.url).searchParams
  const montant = Number(parametres.get('montant') ?? '0')
  const province = parametres.get('province') ?? 'QC'
  const date = parametres.get('date') ?? new Date().toISOString().slice(0, 10)
  const taxesIncluses = parametres.get('taxes_incluses') === '1'

  if (!Number.isFinite(montant) || montant < 0) {
    return NextResponse.json({ montant_ht: 0, lignes: [] })
  }

  try {
    const montantHt = taxesIncluses
      ? (await ventilerTtc(montant, province, date)).montant_ht
      : montant
    return NextResponse.json({
      montant_ht: montantHt,
      lignes: await apercuTaxes(montantHt, province, date),
    })
  } catch {
    return NextResponse.json({ montant_ht: 0, lignes: [] })
  }
}
