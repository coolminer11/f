'use client'

import { useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { LigneAClasser, DecisionLigne } from '@/lib/requetes/import'
import type { Categorie } from '@/lib/requetes/transactions'
import { argent, dateCourte, dateLongue } from '@/lib/format'

type Choix = {
  action: DecisionLigne['action'] | 'attente'
  categorie: string
  province: string
  versement: string | null
}

const ACTIONS_DEBIT = [
  ['categoriser', 'Catégoriser'],
  ['mouvement_associe', 'Prélèvement d’associé'],
  ['ignoree', 'Ignorer'],
] as const

const ACTIONS_CREDIT = [
  ['virement_stripe', 'Versement Stripe (déjà comptabilisé)'],
  ['depot_caisse', 'Dépôt de la caisse (déjà comptabilisé)'],
  ['categoriser', 'Catégoriser comme revenu'],
  ['mouvement_associe', 'Apport ou avance d’associé'],
  ['ignoree', 'Ignorer'],
] as const

const LIBELLES_STATUT: Record<string, string> = {
  categorisee: 'écriture créée',
  depot_caisse: 'dépôt de caisse',
  virement_stripe: 'versement Stripe',
  mouvement_associe: 'mouvement d’associé',
  ignoree: 'ignorée',
  doublon: 'doublon',
}

function BoutonAppliquer({ nb }: { nb: number }) {
  const { pending } = useFormStatus()
  return (
    <button className="bouton" disabled={pending || nb === 0}>
      {pending ? 'Application…' : `Appliquer ${nb || ''}`.trim()}
    </button>
  )
}

export default function TableauRapprochement({
  lignes,
  categories,
  provinces,
  appliquer,
  reouvrir,
}: {
  lignes: LigneAClasser[]
  categories: Categorie[]
  provinces: readonly (readonly [string, string])[]
  appliquer: (donnees: FormData) => Promise<void>
  reouvrir: (donnees: FormData) => Promise<void>
}) {
  const aClasser = useMemo(() => lignes.filter((l) => l.statut === 'a_categoriser'), [lignes])
  const traitees = useMemo(() => lignes.filter((l) => l.statut !== 'a_categoriser'), [lignes])

  // Choix initial : la suggestion de la base, jamais appliquée sans validation.
  const [choix, setChoix] = useState<Record<string, Choix>>(() =>
    Object.fromEntries(
      aClasser.map((l) => [
        l.id,
        {
          action: l.rapprochement_suggere
            ? (l.rapprochement_suggere as DecisionLigne['action'])
            : l.categorie_suggeree
              ? 'categoriser'
              : 'attente',
          categorie: l.categorie_suggeree ?? '',
          province: 'QC',
          versement: l.versement_suggere ?? null,
        } satisfies Choix,
      ]),
    ),
  )

  const decisions: DecisionLigne[] = aClasser
    .filter((l) => choix[l.id]?.action && choix[l.id].action !== 'attente')
    .filter((l) => choix[l.id].action !== 'categoriser' || choix[l.id].categorie)
    .map((l) => ({
      ligneId: l.id,
      action: choix[l.id].action as DecisionLigne['action'],
      categorie: choix[l.id].categorie || undefined,
      province: choix[l.id].province,
      versementStripeId: choix[l.id].versement,
    }))

  function definir(id: string, partiel: Partial<Choix>) {
    setChoix((precedent) => ({ ...precedent, [id]: { ...precedent[id], ...partiel } }))
  }

  return (
    <>
      {aClasser.length > 0 && (
        <form action={appliquer} className="mt-3">
          <input type="hidden" name="decisions" value={JSON.stringify(decisions)} />

          <div className="overflow-x-auto rounded-lg border border-[var(--color-ligne)]">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="bg-[var(--color-fond)] text-left text-xs uppercase text-[var(--color-encre-doux)]">
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Description</th>
                  <th className="px-3 py-2 text-right font-semibold">Montant</th>
                  <th className="px-3 py-2 font-semibold">Traitement</th>
                </tr>
              </thead>
              <tbody>
                {aClasser.map((l) => {
                  const c = choix[l.id]
                  const credit = l.montant > 0
                  const actions = credit ? ACTIONS_CREDIT : ACTIONS_DEBIT
                  return (
                    <tr key={l.id} className="border-t border-[var(--color-ligne)] align-top">
                      <td className="chiffre whitespace-nowrap px-3 py-2 text-[var(--color-encre-doux)]">
                        {dateCourte(l.date)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{l.description}</span>
                        {l.versement_suggere && l.versement_date && (
                          <div className="mt-0.5 text-xs text-[var(--color-accent)]">
                            Correspondance trouvée : versement Stripe du{' '}
                            {dateLongue(l.versement_date)} de {argent(l.versement_montant)}
                          </div>
                        )}
                      </td>
                      <td
                        className={`chiffre whitespace-nowrap px-3 py-2 text-right font-semibold ${
                          credit ? 'text-[var(--color-positif)]' : ''
                        }`}
                      >
                        {argent(l.montant)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <select
                            aria-label={`Traitement de ${l.description}`}
                            className="champ w-auto min-w-52 py-1"
                            value={c?.action ?? 'attente'}
                            onChange={(e) =>
                              definir(l.id, { action: e.target.value as Choix['action'] })
                            }
                          >
                            <option value="attente">— laisser en attente —</option>
                            {actions.map(([code, libelle]) => (
                              <option key={code} value={code}>
                                {libelle}
                              </option>
                            ))}
                          </select>

                          {c?.action === 'categoriser' && (
                            <>
                              <select
                                aria-label="Catégorie"
                                className="champ w-auto min-w-44 py-1"
                                value={c.categorie}
                                onChange={(e) => definir(l.id, { categorie: e.target.value })}
                              >
                                <option value="">Choisir une catégorie…</option>
                                {categories
                                  .filter((cat) =>
                                    credit ? cat.type_defaut === 'revenu' : cat.type_defaut === 'depense',
                                  )
                                  .map((cat) => (
                                    <option key={cat.categorie} value={cat.categorie}>
                                      {cat.libelle}
                                    </option>
                                  ))}
                              </select>
                              <select
                                aria-label="Province"
                                className="champ w-auto py-1"
                                value={c.province}
                                onChange={(e) => definir(l.id, { province: e.target.value })}
                              >
                                {provinces.map(([code, nom]) => (
                                  <option key={code} value={code}>
                                    {nom}
                                  </option>
                                ))}
                              </select>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <BoutonAppliquer nb={decisions.length} />
            <span className="text-xs text-[var(--color-encre-doux)]">
              {decisions.length} ligne{decisions.length > 1 ? 's' : ''} prête
              {decisions.length > 1 ? 's' : ''} sur {aClasser.length}. Les lignes laissées en attente
              restent disponibles. Les montants du relevé sont traités comme taxes incluses : c’est
              ce qui a réellement quitté le compte.
            </span>
          </div>
        </form>
      )}

      {traitees.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--color-encre-doux)]">
            Lignes traitées
          </h3>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {traitees.map((l) => (
                <tr key={l.id} className="border-b border-[var(--color-ligne)] last:border-0">
                  <td className="chiffre whitespace-nowrap py-1.5 text-[var(--color-encre-doux)]">
                    {dateCourte(l.date)}
                  </td>
                  <td className="py-1.5">{l.description}</td>
                  <td className="chiffre py-1.5 text-right">{argent(l.montant)}</td>
                  <td className="py-1.5 pl-3 text-xs text-[var(--color-encre-doux)]">
                    {LIBELLES_STATUT[l.statut] ?? l.statut}
                  </td>
                  <td className="py-1.5 pl-3 text-right">
                    <form action={reouvrir}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="text-xs text-[var(--color-encre-doux)] hover:underline">
                        Rouvrir
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-[var(--color-encre-doux)]">
            Rouvrir une ligne supprime l’écriture qu’elle avait créée.
          </p>
        </div>
      )}
    </>
  )
}
