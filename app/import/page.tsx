import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  annulerClassement,
  appliquerDecisions,
  lignesAClasser,
  listerImports,
  supprimerImport,
  type DecisionLigne,
} from '@/lib/requetes/import'
import { listerCategories, PROVINCES } from '@/lib/requetes/transactions'
import { argent, dateCourte } from '@/lib/format'
import TeleversementReleve from '@/components/televersement-releve'
import TableauRapprochement from '@/components/tableau-rapprochement'
import { exigerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function PageImport({
  searchParams,
}: {
  searchParams: Promise<{ import?: string; tout?: string; message?: string; erreur?: string }>
}) {
  await exigerSession()
  const p = await searchParams
  const inclureTraitees = p.tout === '1'

  const [imports, categories] = await Promise.all([listerImports(), listerCategories()])
  const importChoisi = p.import && imports.some((i) => i.id === p.import) ? p.import : null
  const lignes = await lignesAClasser(importChoisi, inclureTraitees)

  const retour = `/import${importChoisi ? `?import=${importChoisi}` : ''}`

  async function appliquer(donnees: FormData) {
    'use server'
    const brut = String(donnees.get('decisions') ?? '[]')
    let decisions: DecisionLigne[]
    try {
      decisions = JSON.parse(brut) as DecisionLigne[]
    } catch {
      redirect(`${retour}${retour.includes('?') ? '&' : '?'}erreur=Sélection illisible.`)
    }
    if (!Array.isArray(decisions) || decisions.length === 0) {
      redirect(
        `${retour}${retour.includes('?') ? '&' : '?'}erreur=${encodeURIComponent('Aucune ligne sélectionnée.')}`,
      )
    }

    let traitees = 0
    try {
      traitees = await appliquerDecisions(decisions)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Application impossible.'
      redirect(`${retour}${retour.includes('?') ? '&' : '?'}erreur=${encodeURIComponent(message)}`)
    }
    revalidatePath('/import')
    redirect(
      `${retour}${retour.includes('?') ? '&' : '?'}message=${encodeURIComponent(
        `${traitees} ligne${traitees > 1 ? 's' : ''} traitée${traitees > 1 ? 's' : ''}.`,
      )}`,
    )
  }

  async function reouvrir(donnees: FormData) {
    'use server'
    await annulerClassement(String(donnees.get('id')))
    revalidatePath('/import')
  }

  async function retirerImport(donnees: FormData) {
    'use server'
    await supprimerImport(String(donnees.get('id')))
    revalidatePath('/import')
    redirect('/import')
  }

  const aClasser = lignes.filter((l) => l.statut === 'a_categoriser').length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Import du relevé bancaire</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          Un crédit au relevé est souvent de l’argent déjà comptabilisé : le rapprocher, plutôt que
          le catégoriser, évite de compter la même vente deux fois.
        </p>
      </div>

      {p.message && (
        <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">
          {p.message}
        </p>
      )}
      {p.erreur && (
        <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {p.erreur}
        </p>
      )}

      <TeleversementReleve />

      {imports.length > 0 && (
        <section className="carte p-5">
          <h2 className="text-sm font-bold">Relevés importés</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-ligne)] text-left text-xs uppercase text-[var(--color-encre-doux)]">
                <th className="py-1.5 font-semibold">Fichier</th>
                <th className="py-1.5 font-semibold">Importé le</th>
                <th className="py-1.5 text-right font-semibold">Lignes</th>
                <th className="py-1.5 text-right font-semibold">Traitées</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {imports.map((i) => (
                <tr key={i.id} className="border-b border-[var(--color-ligne)] last:border-0">
                  <td className="py-1.5">
                    <a
                      href={`/import?import=${i.id}`}
                      className={`font-medium hover:underline ${
                        importChoisi === i.id ? 'text-[var(--color-accent)]' : ''
                      }`}
                    >
                      {i.nom_fichier}
                    </a>
                  </td>
                  <td className="py-1.5 text-[var(--color-encre-doux)]">
                    {dateCourte(i.date_import.slice(0, 10))}
                  </td>
                  <td className="chiffre py-1.5 text-right">{i.nb_lignes}</td>
                  <td className="chiffre py-1.5 text-right">{i.nb_traitees}</td>
                  <td className="py-1.5 text-right">
                    <form action={retirerImport}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className="text-xs text-[var(--color-encre-doux)] hover:underline">
                        Supprimer
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {importChoisi && (
            <a href="/import" className="mt-3 inline-block text-xs text-[var(--color-accent)] hover:underline">
              Voir tous les relevés
            </a>
          )}
        </section>
      )}

      <section className="carte p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold">
            Rapprochement
            {aClasser > 0 && (
              <span className="ml-2 rounded bg-[var(--color-accent-doux)] px-2 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
                {aClasser} à traiter
              </span>
            )}
          </h2>
          <a
            href={`/import?${new URLSearchParams({
              ...(importChoisi ? { import: importChoisi } : {}),
              ...(inclureTraitees ? {} : { tout: '1' }),
            })}`}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            {inclureTraitees ? 'Masquer les lignes traitées' : 'Afficher les lignes traitées'}
          </a>
        </div>

        {lignes.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--color-encre-doux)]">
            Rien à rapprocher. Importez un relevé pour commencer.
          </p>
        ) : (
          <TableauRapprochement
            lignes={lignes}
            categories={categories.filter((c) => c.saisie_manuelle)}
            provinces={PROVINCES}
            appliquer={appliquer}
            reouvrir={reouvrir}
          />
        )}
      </section>
    </div>
  )
}
