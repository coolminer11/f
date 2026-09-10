import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  AUTORITES,
  ecrituresDeLaPeriode,
  listerDeclarations,
  marquerDeclaration,
  periodesDisponibles,
  produireDeclaration,
  rapportTaxes,
  supprimerDeclaration,
} from '@/lib/requetes/taxes'
import { argent, dateCourte, dateLongue, taux } from '@/lib/format'
import SelecteurPeriode from '@/components/selecteur-periode'
import { exigerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function PageTaxes({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; autorite?: string; erreur?: string }>
}) {
  await exigerSession()
  const p = await searchParams
  const periodes = await periodesDisponibles()
  const periode = periodes.find((x) => x.valeur === p.periode) ?? periodes[0]

  if (!periode) {
    return (
      <p className="carte p-8 text-center text-[var(--color-encre-doux)]">
        Aucune transaction : il n’y a encore rien à déclarer.
      </p>
    )
  }

  const [{ detail, totaux }, declarations, ecritures] = await Promise.all([
    rapportTaxes(periode.debut, periode.fin),
    listerDeclarations(),
    ecrituresDeLaPeriode(periode.debut, periode.fin, p.autorite),
  ])

  async function produire(donnees: FormData) {
    'use server'
    const autorite = String(donnees.get('autorite'))
    const debut = String(donnees.get('debut'))
    const fin = String(donnees.get('fin'))
    const retour = `/taxes?periode=${encodeURIComponent(periode!.valeur)}`
    try {
      await produireDeclaration(autorite, debut, fin)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inattendue.'
      // La base refuse deux déclarations qui se chevauchent : on l'explique.
      const lisible = message.includes('ex_declarations_sans_chevauchement')
        ? `Une déclaration ${autorite} couvre déjà tout ou partie de cette période.`
        : message
      redirect(`${retour}&erreur=${encodeURIComponent(lisible)}`)
    }
    revalidatePath('/taxes')
    redirect(retour)
  }

  async function changerStatut(donnees: FormData) {
    'use server'
    await marquerDeclaration(
      String(donnees.get('id')),
      donnees.get('statut') as 'brouillon' | 'transmise' | 'payee',
      (String(donnees.get('reference') ?? '') || null) as string | null,
    )
    revalidatePath('/taxes')
  }

  async function supprimer(donnees: FormData) {
    'use server'
    await supprimerDeclaration(String(donnees.get('id')))
    revalidatePath('/taxes')
  }

  const declarationsPeriode = declarations.filter(
    (d) => d.periode_debut === periode.debut && d.periode_fin === periode.fin,
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Remise de taxes</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            {dateLongue(periode.debut)} au {dateLongue(periode.fin)} · une déclaration par autorité
          </p>
        </div>
        <SelecteurPeriode periodes={periodes} valeur={periode.valeur} />
      </div>

      {p.erreur && (
        <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {p.erreur}
        </p>
      )}

      {totaux.length === 0 ? (
        <p className="carte p-8 text-center text-[var(--color-encre-doux)]">
          Aucune taxe sur cette période.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {totaux.map((t) => {
            const lignes = detail.filter((d) => d.autorite === t.autorite)
            const dejaProduite = declarationsPeriode.find((d) => d.autorite === t.autorite)
            const aRecevoir = t.net_a_remettre < 0
            return (
              <section key={t.autorite} className="carte flex flex-col p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-bold">{AUTORITES[t.autorite]?.nom ?? t.autorite}</h2>
                  <span className="rounded border border-[var(--color-ligne)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-encre-doux)]">
                    {t.autorite}
                  </span>
                </div>

                <table className="mt-3 w-full text-sm">
                  <tbody>
                    {lignes.map((l) => (
                      <tr key={l.code}>
                        <td className="py-1 text-[var(--color-encre-doux)]">
                          {l.code} perçue
                          <span className="ml-1 text-xs opacity-70">
                            ({argent(l.taxes_payees)} payée)
                          </span>
                        </td>
                        <td className="chiffre py-1 text-right">{argent(l.taxes_percues)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-1 text-[var(--color-encre-doux)]">
                        Crédits sur intrants
                      </td>
                      <td className="chiffre py-1 text-right">− {argent(t.credits)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="mt-3 border-t border-[var(--color-ligne)] pt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">
                      {aRecevoir ? 'À recevoir' : 'À remettre'}
                    </span>
                    <span
                      className={`chiffre text-xl font-bold ${
                        aRecevoir ? 'text-[var(--color-positif)]' : ''
                      }`}
                    >
                      {argent(Math.abs(t.net_a_remettre))}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  {dejaProduite ? (
                    <div className="rounded-lg bg-[var(--color-fond)] px-3 py-2 text-xs">
                      <div className="font-semibold">
                        Déclaration {dejaProduite.statut}
                        {dejaProduite.date_transmission &&
                          ` le ${dateCourte(dejaProduite.date_transmission)}`}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {dejaProduite.statut !== 'transmise' && (
                          <form action={changerStatut}>
                            <input type="hidden" name="id" value={dejaProduite.id} />
                            <input type="hidden" name="statut" value="transmise" />
                            <button className="rounded border border-[var(--color-ligne)] bg-white px-2 py-1 font-semibold">
                              Transmise
                            </button>
                          </form>
                        )}
                        {dejaProduite.statut !== 'payee' && (
                          <form action={changerStatut}>
                            <input type="hidden" name="id" value={dejaProduite.id} />
                            <input type="hidden" name="statut" value="payee" />
                            <button className="rounded border border-[var(--color-ligne)] bg-white px-2 py-1 font-semibold">
                              Payée
                            </button>
                          </form>
                        )}
                        <form action={supprimer}>
                          <input type="hidden" name="id" value={dejaProduite.id} />
                          <button className="rounded px-2 py-1 text-[var(--color-encre-doux)] hover:underline">
                            Annuler la déclaration
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <form action={produire}>
                      <input type="hidden" name="autorite" value={t.autorite} />
                      <input type="hidden" name="debut" value={periode.debut} />
                      <input type="hidden" name="fin" value={periode.fin} />
                      <button className="bouton bouton-secondaire w-full">
                        Figer la déclaration
                      </button>
                    </form>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <section className="carte p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold">Écritures de la période</h2>
          <p className="text-xs text-[var(--color-encre-doux)]">
            Le détail derrière chaque total : un rapport que l’on ne peut pas vérifier ne sert à rien.
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-ligne)] text-left text-xs uppercase text-[var(--color-encre-doux)]">
                <th className="py-1.5 font-semibold">Date</th>
                <th className="py-1.5 font-semibold">Description</th>
                <th className="py-1.5 font-semibold">Taxe</th>
                <th className="py-1.5 text-right font-semibold">Perçue</th>
                <th className="py-1.5 text-right font-semibold">Payée</th>
                <th className="py-1.5 text-right font-semibold">Crédit</th>
              </tr>
            </thead>
            <tbody>
              {ecritures.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--color-encre-doux)]">
                    Aucune écriture taxable sur cette période.
                  </td>
                </tr>
              )}
              {ecritures.map((e) => (
                <tr key={`${e.id}-${e.code}`} className="border-b border-[var(--color-ligne)] last:border-0">
                  <td className="chiffre whitespace-nowrap py-1.5 text-[var(--color-encre-doux)]">
                    {dateCourte(e.date)}
                  </td>
                  <td className="py-1.5">{e.description}</td>
                  <td className="whitespace-nowrap py-1.5 text-xs text-[var(--color-encre-doux)]">
                    {e.code} {taux(e.taux)} · {e.autorite}
                  </td>
                  <td className="chiffre py-1.5 text-right">
                    {e.type === 'revenu' ? argent(e.montant) : '—'}
                  </td>
                  <td className="chiffre py-1.5 text-right text-[var(--color-encre-doux)]">
                    {e.type === 'depense' ? argent(e.montant) : '—'}
                  </td>
                  <td className="chiffre py-1.5 text-right">
                    {e.type === 'depense' ? argent(e.montant_recuperable) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {declarations.length > 0 && (
        <section className="carte p-5">
          <h2 className="text-sm font-bold">Déclarations produites</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-ligne)] text-left text-xs uppercase text-[var(--color-encre-doux)]">
                <th className="py-1.5 pr-4 font-semibold">Période</th>
                <th className="py-1.5 pr-4 font-semibold">Autorité</th>
                <th className="py-1.5 pr-4 text-right font-semibold">Perçues</th>
                <th className="py-1.5 pr-4 text-right font-semibold">Crédits</th>
                <th className="py-1.5 pr-6 text-right font-semibold">Net</th>
                <th className="py-1.5 font-semibold">État</th>
              </tr>
            </thead>
            <tbody>
              {declarations.map((d) => (
                <tr key={d.id} className="border-b border-[var(--color-ligne)] last:border-0">
                  <td className="whitespace-nowrap py-1.5 pr-4">
                    {dateCourte(d.periode_debut)} – {dateCourte(d.periode_fin)}
                  </td>
                  <td className="py-1.5 pr-4">{d.autorite}</td>
                  <td className="chiffre py-1.5 pr-4 text-right">{argent(d.taxes_percues)}</td>
                  <td className="chiffre py-1.5 pr-4 text-right">{argent(d.credits)}</td>
                  <td className="chiffre py-1.5 pr-6 text-right font-semibold">
                    {argent(d.net_a_remettre)}
                  </td>
                  <td className="py-1.5 text-xs capitalize">{d.statut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
