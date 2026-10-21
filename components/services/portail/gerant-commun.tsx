'use client'

import { useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { drapeau, nomLangue, type Texte } from '@/lib/services/langues'
import Fenetre from '@/components/effets/fenetre'
import { TEXTES_PORTAIL, type LanguePortail } from '@/components/services/portail/textes'

/**
 * Ce que partagent les écrans du mode gérant : la barre des langues (une
 * seule pour tous les champs d'une fenêtre), la confirmation d'une
 * suppression, la relecture des données après un geste.
 */

export const versChamps = (t: Texte | null | undefined, langues: string[]): Record<string, string> =>
  Object.fromEntries(langues.map((c) => [c, (t as Record<string, string> | undefined)?.[c] ?? '']))

/** 16.5 → « 16,50 » (fr) ou « 16.50 » (en) ; null → vide. */
export function prixVersSaisie(p: number | null | undefined, l: LanguePortail): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return ''
  const t = Number.isInteger(p) ? String(p) : p.toFixed(2)
  return l === 'fr' ? t.replace('.', ',') : t
}

export function prixAffiche(p: number | null | undefined, l: LanguePortail): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return ''
  return new Intl.NumberFormat(l === 'fr' ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD' }).format(p)
}

export const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Après un geste réussi : les données de la page sont relues du serveur, sans recharger. */
export function useRelire(): [() => void, boolean] {
  const router = useRouter()
  const [enCours, demarrer] = useTransition()
  const relire = useCallback(() => demarrer(() => router.refresh()), [router])
  return [relire, enCours]
}

/** Remet en place un élément désintégré quand le serveur a refusé le geste. */
export function reapparaitre(el: HTMLElement | null) {
  if (!el) return
  el.style.opacity = ''
  el.style.transform = ''
  el.style.filter = ''
  el.style.willChange = ''
  el.getAnimations().forEach((a) => a.cancel())
}

/**
 * Les onglets de langue d'une fenêtre d'édition : la langue principale
 * d'abord ; une pastille ambre marque une langue « à traduire ».
 */
export function OngletsLangues({
  l,
  langues,
  active,
  choisir,
  manquantes,
}: {
  l: LanguePortail
  langues: string[]
  active: string
  choisir: (c: string) => void
  manquantes: Set<string>
}) {
  const T = TEXTES_PORTAIL[l].gerant
  if (langues.length < 2) return null
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-0.5" role="tablist" aria-label={TEXTES_PORTAIL[l].traductions}>
        {langues.map((c, i) => (
          <button key={c} type="button" role="tab" aria-selected={active === c} aria-pressed={active === c} onClick={() => choisir(c)} className="pt-puce">
            {drapeau(c)} {nomLangue(c)}
            {i === 0 && <span className="ml-1 font-normal text-[var(--p-faible)]">· {T.principale}</span>}
            {manquantes.has(c) && (
              <span className="ml-1 text-[var(--p-ambre)]" title={T.manque} aria-label={T.manque}>
                •
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--p-faible)]">{T.traductionsAide}</p>
    </div>
  )
}

/** Les langues où un texte de la langue principale n'a pas encore sa traduction. */
export function languesManquantes(textes: Record<string, string>[], langues: string[]): Set<string> {
  const [principale, ...autres] = langues
  const sortie = new Set<string>()
  for (const t of textes) for (const c of autres) if (t[principale]?.trim() && !t[c]?.trim()) sortie.add(c)
  return sortie
}

/** La confirmation d'une suppression, dans une fenêtre aux couleurs du portail. */
export function Confirmation({
  l,
  ouverte,
  fermer,
  titre,
  texte,
  confirmer,
  onConfirmer,
}: {
  l: LanguePortail
  ouverte: boolean
  fermer: () => void
  titre: string
  texte: string
  confirmer?: string
  onConfirmer: () => void
}) {
  const T = TEXTES_PORTAIL[l].gerant
  return (
    <Fenetre ouverte={ouverte} fermer={fermer} titre={titre} largeur="max-w-md">
      <p className="text-sm leading-relaxed text-[var(--p-doux)]">{texte}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="pt-bouton-doux" onClick={fermer}>
          {T.annuler}
        </button>
        <button
          type="button"
          className="pt-bouton !bg-[var(--p-rouge)] !bg-none !text-white !shadow-none"
          onClick={() => {
            fermer()
            onConfirmer()
          }}
        >
          {confirmer ?? T.supprimer}
        </button>
      </div>
    </Fenetre>
  )
}
