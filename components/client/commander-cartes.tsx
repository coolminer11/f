'use client'

import { useActionState, useState } from 'react'
import { commanderCartes, type EtatCommande } from '@/app/stats/[jeton]/actions'
import { textes, type Langue } from '@/lib/langue'

const CHOIX = [1, 3, 5, 10]

/**
 * « Envie d'en ajouter ? » : le commerce demande des cartes de plus en deux
 * touches. Rien n'est payé ici ; on le rappelle, et on confirme le prix avant.
 */
export default function CommanderCartes({ jeton, langue }: { jeton: string; langue: Langue }) {
  const T = textes(langue)
  const [etat, envoyer, enCours] = useActionState<EtatCommande, FormData>(commanderCartes, { ok: false, erreur: null })
  const [quantite, setQuantite] = useState<number | 'autre'>(3)

  return (
    <section className="carte relative overflow-hidden p-6 sm:p-8" id="commander">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[#f6dccd] opacity-70" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 right-24 size-40 rounded-full bg-[#d8ece8] opacity-70" />

      {etat.ok ? (
        <div className="relative flex items-center gap-4 py-4" role="status">
          <span className="coche-merci grid size-14 shrink-0 place-items-center rounded-full bg-[#2f6b4f] text-2xl text-white" aria-hidden>
            ✓
          </span>
          <div>
            <h2 className="titre-client !text-2xl">{T.merci}</h2>
            <p className="mt-0.5 text-[#6b5d50]">{T.merciSous}</p>
          </div>
        </div>
      ) : (
        <form action={envoyer} className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
          <div>
            <h2 className="titre-client !text-2xl sm:!text-3xl">{T.commanderTitre}</h2>
            <p className="mt-2 max-w-sm text-[#6b5d50]">{T.commanderSous}</p>
          </div>
          <div className="space-y-4">
            <input type="hidden" name="jeton" value={jeton} />
            <input type="hidden" name="langue" value={langue} />
            <fieldset>
              <legend className="text-sm font-medium">{T.combien}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {CHOIX.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuantite(n)}
                    aria-pressed={quantite === n}
                    className={`min-w-12 rounded-full px-4 py-2 text-sm font-semibold tabular-nums transition ${
                      quantite === n ? 'bg-[#2a211a] text-[#fffaf2]' : 'bg-[#f3ebdf] text-[#2a211a] hover:bg-[#ede3d3]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setQuantite('autre')}
                  aria-pressed={quantite === 'autre'}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    quantite === 'autre' ? 'bg-[#2a211a] text-[#fffaf2]' : 'bg-[#f3ebdf] text-[#2a211a] hover:bg-[#ede3d3]'
                  }`}
                >
                  {T.autreQte}
                </button>
                {quantite === 'autre' ? (
                  <input
                    name="quantite"
                    type="number"
                    min={1}
                    max={500}
                    required
                    autoFocus
                    defaultValue={20}
                    aria-label={T.combien}
                    className="w-24 rounded-full border border-[#e2d6c3] bg-[#fffaf2] px-4 py-2 text-sm font-semibold tabular-nums outline-none focus:border-[#c2552f]"
                  />
                ) : (
                  <input type="hidden" name="quantite" value={quantite} />
                )}
              </div>
            </fieldset>
            <div>
              <label htmlFor="message-commande" className="text-sm font-medium">
                {T.motPourNous}
              </label>
              <textarea
                id="message-commande"
                name="message"
                maxLength={500}
                rows={2}
                placeholder={T.motExemple}
                className="mt-2 block w-full resize-none rounded-2xl border border-[#e2d6c3] bg-[#fffaf2] px-4 py-3 text-sm outline-none placeholder:text-[#b5a693] focus:border-[#c2552f]"
              />
            </div>
            {etat.erreur && <p className="text-sm font-medium text-[#b0402a]">{etat.erreur}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                disabled={enCours}
                className="rounded-full bg-[#c2552f] px-6 py-3 text-sm font-semibold text-[#fffaf2] shadow-[0_10px_24px_-12px_#c2552f] transition hover:-translate-y-0.5 hover:bg-[#a9481f] disabled:opacity-60"
              >
                {enCours ? T.envoi : T.envoyerDemande}
              </button>
              <span className="text-xs text-[#6b5d50]">{T.sansPaiement}</span>
            </div>
          </div>
        </form>
      )}
    </section>
  )
}
