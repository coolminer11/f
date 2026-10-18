import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigerSession } from '@/lib/auth'
import { courrielRapport, donneesRapport, moisPrecedent, nomMois } from '@/lib/rapports'
import { baseCartesAffichee } from '@/lib/cartes-url'

export const dynamic = 'force-dynamic'

/** Aperçu du rapport mensuel, tel que le client le recevra. */
export default async function ApercuRapport({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mois?: string }>
}) {
  await exigerSession()
  const { id } = await params
  const { mois: brut } = await searchParams
  const mois = brut && /^\d{4}-(0[1-9]|1[0-2])$/.test(brut) ? `${brut}-01` : await moisPrecedent()
  const r = await donneesRapport(id, mois)
  if (!r) notFound()
  const c = await courrielRapport(r, await baseCartesAffichee())

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/cartes/dossiers/${id}#rapport`} className="text-sm text-[var(--color-encre-doux)] hover:underline">← {r.dossier.nom}</Link>
        <h1 className="mt-1 text-lg font-bold tracking-tight">Aperçu du rapport — {nomMois(mois)}</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">Objet : {c.objet}</p>
      </div>
      {/* Bac à sable : le courriel s'affiche sans pouvoir exécuter quoi que ce soit. */}
      <iframe title="Aperçu du courriel" sandbox="" srcDoc={c.html} className="h-[900px] w-full rounded-xl border border-[var(--color-ligne)] bg-white" />
    </div>
  )
}
