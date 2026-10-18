import Link from 'next/link'
import { redirect } from 'next/navigation'
import { exigerEcriture, exigerSession } from '@/lib/auth'
import { creerDossier, listerDossiers } from '@/lib/requetes/dossiers'
import { listerClients } from '@/lib/requetes/ventes'
import ChampsDossier, { SaisieDossier, valeursDossier } from '@/components/champs-dossier'
import SelecteurJours, { joursDepuis } from '@/components/selecteur-jours'
import { Evolution, depuis, nombreFr } from '@/components/tuiles-cartes'

export const dynamic = 'force-dynamic'

export default async function PageDossiers({ searchParams }: { searchParams: Promise<{ p?: string; erreur?: string }> }) {
  const moi = await exigerSession()
  const sp = await searchParams
  const jours = joursDepuis(sp.p)
  const [dossiers, clients] = await Promise.all([listerDossiers(jours), listerClients()])
  const maxPeriode = Math.max(1, ...dossiers.map((d) => d.taps_periode))

  async function creer(donnees: FormData) {
    'use server'
    await exigerEcriture()
    const analyse = SaisieDossier.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) redirect(`/cartes/dossiers?erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)
    const id = await creerDossier(valeursDossier(analyse.data))
    redirect(`/cartes/dossiers/${id}`)
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/cartes" className="text-sm text-[var(--color-encre-doux)] hover:underline">← Toutes les cartes</Link>
        <h1 className="mt-1 text-lg font-bold tracking-tight">Dossiers</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          Un dossier par commerce : ses cartes ensemble, ses statistiques, son lien client et son rapport mensuel.
        </p>
      </div>

      {sp.erreur && (
        <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">{sp.erreur}</p>
      )}

      <SelecteurJours chemin="/cartes/dossiers" jours={jours} />

      <section className="carte overflow-hidden">
        {dossiers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-encre-doux)]">Aucun dossier pour l’instant. Créez le premier ci-dessous.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-ligne)] bg-[var(--color-fond)] text-left text-xs uppercase tracking-wide text-[var(--color-encre-doux)]">
                  <th className="px-4 py-2 font-semibold">Commerce</th>
                  <th className="px-4 py-2 text-right font-semibold">Cartes</th>
                  <th className="px-4 py-2 font-semibold">Taps · {jours} j</th>
                  <th className="px-4 py-2 font-semibold">Évolution</th>
                  <th className="px-4 py-2 font-semibold">Dernier tap</th>
                  <th className="px-4 py-2 font-semibold">Rapport</th>
                </tr>
              </thead>
              <tbody>
                {dossiers.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--color-ligne)] last:border-0 hover:bg-[var(--color-fond)]">
                    <td className="px-4 py-2.5">
                      <Link href={`/cartes/dossiers/${d.id}`} className="font-medium hover:underline">{d.nom}</Link>
                      {d.client_nom && <div className="text-xs text-[var(--color-encre-doux)]">client : {d.client_nom}</div>}
                    </td>
                    <td className="chiffre px-4 py-2.5 text-right">
                      {d.nb_actives}
                      {d.nb_cartes !== d.nb_actives && <span className="text-xs text-[var(--color-encre-doux)]"> / {d.nb_cartes}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="chiffre w-12 text-right font-semibold">{nombreFr.format(d.taps_periode)}</span>
                        <span className="h-2 w-28 overflow-hidden rounded-r bg-[var(--color-grille)]" aria-hidden>
                          <span className="block h-full rounded-r bg-[var(--color-serie-1)]" style={{ width: `${(d.taps_periode / maxPeriode) * 100}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><Evolution courant={d.taps_periode} precedent={d.taps_precedent} libelle="" /></td>
                    <td className="px-4 py-2.5 text-[var(--color-encre-doux)]">{depuis(d.dernier_tap)}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {d.rapport_mensuel ? <span className="font-medium text-[var(--color-positif)]">✓ mensuel</span> : <span className="text-[var(--color-encre-doux)]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {moi.role !== 'lecture' && (
        <section className="carte p-5">
          <h2 className="text-sm font-semibold">Nouveau dossier</h2>
          <form action={creer} className="mt-3 space-y-4">
            <ChampsDossier clients={clients} complet={false} />
            <button className="bouton">Créer le dossier</button>
          </form>
        </section>
      )}
    </div>
  )
}
