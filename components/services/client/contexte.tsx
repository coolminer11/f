'use client'

import { createContext, useContext } from 'react'
import type { DictionnaireUi } from '@/lib/services/ui'

/**
 * Le code de l'emplacement, la langue et les textes de l'interface, posés une
 * fois par le cadre : les composants du navigateur les lisent ici plutôt que
 * de recevoir le dictionnaire entier, encore et encore.
 */
type Lieu = { code: string; langue: string; t: DictionnaireUi }
const Contexte = createContext<Lieu | null>(null)

export function FournisseurLieu({ code, langue, t, children }: Lieu & { children: React.ReactNode }) {
  return <Contexte.Provider value={{ code, langue, t }}>{children}</Contexte.Provider>
}

export function useLieu(): Lieu {
  const v = useContext(Contexte)
  if (!v) throw new Error('useLieu hors du cadre des pages clients.')
  return v
}
