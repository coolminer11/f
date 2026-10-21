'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import Fenetre from '@/components/effets/fenetre'
import { desintegrer, vibrer } from '@/components/effets/desintegration'

/**
 * Une action qui se confirme dans une fenêtre (suppression, nouveau lien…).
 * Avec `poussiere`, la ligne qui la contient ([data-ligne]) se désintègre
 * AVANT l'envoi : le geste se voit, puis le serveur confirme par un pop-up.
 * Si le serveur refuse, la ligne réapparaît.
 *
 * Les champs envoyés : ceux du formulaire qui contient le bouton, ou `champs`.
 */
export default function Confirmer({
  action,
  titre,
  texte,
  libelle,
  confirmer = 'Supprimer',
  danger = true,
  poussiere = false,
  saisie,
  champs,
  className = 'text-xs font-semibold text-[var(--color-negatif)] hover:underline',
  titreBouton,
}: {
  action: (donnees: FormData) => void | Promise<void>
  titre: string
  texte?: React.ReactNode
  libelle: React.ReactNode
  confirmer?: string
  danger?: boolean
  poussiere?: boolean
  /** Texte à retaper pour confirmer (envoyé comme `confirmation`). */
  saisie?: string
  champs?: Record<string, string>
  className?: string
  titreBouton?: string
}) {
  const [ouverte, setOuverte] = useState(false)
  const [tape, setTape] = useState('')
  const [enCours, demarrer] = useTransition()
  const bouton = useRef<HTMLButtonElement>(null)
  const cible = useRef<HTMLElement | null>(null)
  const adresse = useSearchParams().toString()
  const fermer = useCallback(() => setOuverte(false), [])

  // La page est revenue du serveur : si la ligne est toujours là (refus), elle réapparaît.
  useEffect(() => {
    const el = cible.current
    if (el?.isConnected) {
      el.style.opacity = ''
      el.style.transform = ''
      el.style.filter = ''
      el.style.willChange = ''
    }
    cible.current = null
  }, [adresse])

  async function executer() {
    const fd = new FormData(bouton.current?.form ?? undefined)
    for (const [k, v] of Object.entries(champs ?? {})) fd.set(k, v)
    if (saisie) fd.set('confirmation', tape)
    setOuverte(false)
    vibrer(danger ? [10, 40, 18] : 12)
    if (poussiere) {
      const ligne = bouton.current?.closest<HTMLElement>('[data-ligne]') ?? null
      cible.current = ligne
      await desintegrer(ligne)
    }
    demarrer(async () => {
      await action(fd)
    })
  }

  return (
    <>
      <button ref={bouton} type="button" title={titreBouton} disabled={enCours} className={className} onClick={() => setOuverte(true)}>
        {enCours ? '…' : libelle}
      </button>
      {ouverte &&
        createPortal(
          <Fenetre ouverte fermer={fermer} titre={titre} largeur="max-w-md">
            {texte && <div className="text-sm leading-relaxed text-[var(--color-encre-doux)]">{texte}</div>}
            {saisie && (
              <label className="mt-4 block">
                <span className="etiquette">
                  Tapez <strong className="text-[var(--color-encre)]">{saisie}</strong> pour confirmer
                </span>
                <input value={tape} onChange={(e) => setTape(e.target.value)} className="champ" autoComplete="off" spellCheck={false} />
              </label>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="bouton bouton-secondaire" onClick={fermer}>
                Annuler
              </button>
              <button type="button" className={`bouton ${danger ? 'bouton-danger' : ''}`} disabled={saisie ? tape !== saisie : false} onClick={() => void executer()}>
                {confirmer}
              </button>
            </div>
          </Fenetre>,
          document.body,
        )}
    </>
  )
}
