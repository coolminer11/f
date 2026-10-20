'use server'

import { contexteRequete } from '@/lib/securite'
import { envoyerAccesPortail } from '@/lib/portail'

export type EtatAcces = { envoye: boolean; erreur: boolean }

const COURRIEL = /^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$/i

/** Même réponse, client ou pas : la page ne révèle jamais qui est client de Tapora. */
export async function demanderAcces(_: EtatAcces, donnees: FormData): Promise<EtatAcces> {
  const courriel = String(donnees.get('courriel') ?? '').trim().slice(0, 254)
  if (!COURRIEL.test(courriel)) return { envoye: false, erreur: true }
  await envoyerAccesPortail(courriel, await contexteRequete())
  return { envoye: true, erreur: false }
}
