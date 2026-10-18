'use client'

import { useOptimistic, useRef, useState, useTransition } from 'react'
import { cocherLancement } from '@/app/stats/[jeton]/actions'
import type { EtapeLancement } from '@/lib/lancement'
import type { Langue } from '@/lib/langue'
import { lancerConfettis } from '@/lib/confettis'

const TX = {
  fr: {
    titre: 'Votre liste de lancement',
    sous: 'Cinq minutes, et votre carte part du bon pied.',
    auto: 'fait automatiquement',
    bravo: 'Lancement réussi !',
    bravoSous: 'Votre carte est prête à travailler pour vous. On s’occupe du reste.',
    etapes: {
      tester: 'Testez la carte avec votre propre téléphone',
      visible: 'Placez-la bien en vue, près de la caisse ou du terminal de paiement',
      equipe: 'Montrez-la à toute l’équipe',
      phrase: 'Apprenez la phrase : « Un petit tap ici nous aide énormément — ça prend 10 secondes ! »',
      demande: 'Faites votre première demande à un client',
      ecran: 'Ajoutez cette page à votre écran d’accueil',
      notifs: 'Activez le « Ding ! » à chaque tap (plus bas)',
    } satisfies Record<EtapeLancement, string>,
  },
  en: {
    titre: 'Your launch checklist',
    sous: 'Five minutes, and your card starts on the right foot.',
    auto: 'done automatically',
    bravo: 'Launch complete!',
    bravoSous: 'Your card is ready to work for you. We’ll take care of the rest.',
    etapes: {
      tester: 'Test the card with your own phone',
      visible: 'Put it in plain sight, near the register or payment terminal',
      equipe: 'Show it to the whole team',
      phrase: 'Learn the line: “A quick tap here helps us a ton — it takes 10 seconds!”',
      demande: 'Ask your first customer',
      ecran: 'Add this page to your home screen',
      notifs: 'Turn on the “Ding!” for every tap (below)',
    } satisfies Record<EtapeLancement, string>,
  },
}

/**
 * La liste de lancement : des gestes concrets, cochés par le commerce et
 * gardés dans son dossier (visibles sur tous ses appareils). Deux étapes se
 * cochent toutes seules : le premier tap, et les notifications activées.
 */
export default function ListeLancement({
  jeton,
  langue,
  etapes,
  cochees,
  auto,
}: {
  jeton: string
  langue: Langue
  etapes: readonly EtapeLancement[]
  cochees: string[]
  auto: string[]
}) {
  const T = TX[langue]
  const [etat, setEtat] = useState(() => new Set([...cochees, ...auto]))
  const [optimiste, basculer] = useOptimistic(etat, (s: Set<string>, cle: string) => {
    const n = new Set(s)
    if (n.has(cle)) n.delete(cle)
    else n.add(cle)
    return n
  })
  const [, demarrer] = useTransition()
  const section = useRef<HTMLElement>(null)
  const faites = etapes.filter((e) => optimiste.has(e)).length
  const fini = faites === etapes.length

  function cocher(cle: EtapeLancement) {
    if (auto.includes(cle)) return
    const coche = !optimiste.has(cle)
    demarrer(async () => {
      basculer(cle)
      const ok = await cocherLancement(jeton, cle, coche)
      if (!ok) return
      setEtat((s) => {
        const n = new Set(s)
        if (coche) n.add(cle)
        else n.delete(cle)
        if (coche && etapes.every((e) => n.has(e))) setTimeout(() => lancerConfettis({ depuis: section.current }), 150)
        return n
      })
    })
  }

  return (
    <section ref={section} className="carte p-6 sm:p-7">
      {fini ? (
        <div className="flex items-center gap-4 py-2">
          <span className="coche-merci grid size-14 shrink-0 place-items-center rounded-full bg-[#2f6b4f] text-2xl text-white" aria-hidden>
            ✓
          </span>
          <div>
            <h2 className="titre-client !text-2xl">{T.bravo}</h2>
            <p className="mt-0.5 text-[#6b5d50]">{T.bravoSous}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2>{T.titre}</h2>
              <p className="mt-0.5 text-sm text-[#6b5d50]">{T.sous}</p>
            </div>
            <span className="titre-client text-3xl font-medium tabular-nums">
              {faites}
              <span className="text-lg text-[#6b5d50]">/{etapes.length}</span>
            </span>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#ece2d2]" aria-hidden>
            <div className="h-full rounded-full bg-gradient-to-r from-[#c2552f] to-[#e0794f] transition-[width] duration-700 ease-out" style={{ width: `${(faites / etapes.length) * 100}%` }} />
          </div>
          <ul className="mt-5 space-y-2">
            {etapes.map((e) => {
              const fait = optimiste.has(e)
              const automatique = auto.includes(e)
              return (
                <li key={e} data-etape>
                  <button
                    type="button"
                    onClick={() => cocher(e)}
                    aria-pressed={fait}
                    disabled={automatique}
                    className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition ${fait ? 'bg-[#eef5f0]' : 'hover:bg-[#f8f1e6]'} disabled:cursor-default`}
                  >
                    <span className={`case-lancement ${fait ? 'case-cochee' : ''}`} aria-hidden>
                      <svg viewBox="0 0 16 16" className="size-3.5">
                        <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="text-sm leading-snug">
                      <span className={fait ? 'text-[#6b5d50] line-through decoration-[#2f6b4f]/40' : 'font-medium'}>{T.etapes[e]}</span>
                      {automatique && <span className="ml-1.5 whitespace-nowrap text-xs text-[#2f6b4f]">· {T.auto}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
