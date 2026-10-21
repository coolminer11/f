'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Feuille from './feuille'
import { balise, lireTemoin, NOM_TEMOIN_LANGUE, NOM_TEMOIN_VU, poserTemoin } from './outils'

export type LangueOfferte = { code: string; nom: string; drapeau: string }

/** Passer à une autre langue : retenue pour les prochaines visites (tous les établissements Tapora), comptée, affichée. */
function useChangerLangue(code: string) {
  const router = useRouter()
  const [enCours, demarrer] = useTransition()
  const changer = (langue: string) => {
    poserTemoin(NOM_TEMOIN_LANGUE, langue, '/s', 365 * 86_400)
    balise(code, 'langue', langue, langue)
    const u = new URL(location.href)
    u.searchParams.set('l', langue)
    demarrer(() => router.replace(`${u.pathname}${u.search}`, { scroll: false }))
  }
  return { changer, enCours }
}

export function SelecteurLangue({
  code,
  langue,
  langues,
  titre,
  fermer,
}: {
  code: string
  langue: string
  langues: LangueOfferte[]
  titre: string
  fermer: string
}) {
  const [ouverte, setOuverte] = useState(false)
  const [choisie, setChoisie] = useState<string | null>(null)
  const { changer, enCours } = useChangerLangue(code)
  useEffect(() => {
    if (!enCours) setChoisie(null)
  }, [enCours])
  if (langues.length < 2) return null
  const actuelle = langues.find((l) => l.code === langue) ?? langues[0]

  return (
    <>
      <button type="button" className="sv-pastille sv-verre" onClick={() => setOuverte(true)} aria-label={`${titre} — ${actuelle.nom}`} aria-haspopup="dialog">
        <span aria-hidden>{actuelle.drapeau}</span>
        <span className="uppercase tracking-wide">{actuelle.code}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <Feuille ouverte={ouverte} onFermer={() => setOuverte(false)} titre={titre} fermer={fermer}>
        <ul className="sv-langues" role="list">
          {langues.map((l) => {
            const active = l.code === langue
            return (
              <li key={l.code}>
                <button
                  type="button"
                  className="sv-langue"
                  aria-current={active}
                  lang={l.code}
                  dir={l.code === 'ar' ? 'rtl' : 'ltr'}
                  disabled={enCours}
                  onClick={() => {
                    if (active) return setOuverte(false)
                    setChoisie(l.code)
                    changer(l.code)
                    setTimeout(() => setOuverte(false), 120)
                  }}
                >
                  <span className="text-2xl leading-none" aria-hidden>
                    {l.drapeau}
                  </span>
                  <span className="flex-1 text-start font-semibold">{l.nom}</span>
                  {active && !choisie && <Coche />}
                  {choisie === l.code && <span className="sv-rond" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      </Feuille>
    </>
  )
}

/** « Read in English » : on SUGGÈRE la langue du téléphone, sans l'imposer. Refuser garde la langue affichée. */
export function SuggestionLangue({ code, langue, cible, texte, drapeau, fermer }: { code: string; langue: string; cible: string; texte: string; drapeau: string; fermer: string }) {
  const [cachee, setCachee] = useState(false)
  const { changer, enCours } = useChangerLangue(code)
  if (cachee) return null
  return (
    <div className="sv-suggestion sv-entre" lang={cible} dir={cible === 'ar' ? 'rtl' : 'ltr'}>
      <button type="button" className="sv-suggestion-oui" onClick={() => changer(cible)} disabled={enCours}>
        <span className="text-lg leading-none" aria-hidden>
          {drapeau}
        </span>
        <span>{texte}</span>
        {enCours ? <span className="sv-rond" aria-hidden /> : <span aria-hidden>→</span>}
      </button>
      <button
        type="button"
        className="sv-suggestion-non"
        aria-label={fermer}
        onClick={() => {
          poserTemoin(NOM_TEMOIN_LANGUE, langue, '/s', 365 * 86_400)
          setCachee(true)
        }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}

/**
 * Ce que le navigateur retient : la langue arrivée par ?l= (un lien imprimé
 * « English ») et ce qui a déjà été compté ici dans la demi-heure.
 */
export function Memoire({ code, langue, vu }: { code: string; langue?: string | null; vu?: string | null }) {
  useEffect(() => {
    if (langue) poserTemoin(NOM_TEMOIN_LANGUE, langue, '/s', 365 * 86_400)
    if (vu) {
      const deja = (lireTemoin(NOM_TEMOIN_VU) ?? '').split('.').filter(Boolean)
      if (!deja.includes(vu)) poserTemoin(NOM_TEMOIN_VU, [...deja.slice(-12), vu].join('.'), `/s/${code}`, 30 * 60)
    }
  }, [code, langue, vu])
  return null
}

function Coche() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--sv-accent-texte)]" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
