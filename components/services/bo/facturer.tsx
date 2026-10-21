'use client'

import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFormStatus } from 'react-dom'
import Fenetre from '@/components/effets/fenetre'
import { vibrer } from '@/components/effets/desintegration'

type Option = { mois: string; libelle: string; numero: string | null }

function Envoyer({ libelle, bloque, onClick }: { libelle: string; bloque: boolean; onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending || bloque} onClick={onClick} aria-busy={pending} className="bouton">
      {pending ? (
        <>
          <svg viewBox="0 0 24 24" className="size-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M12 3a9 9 0 1 0 9 9" />
          </svg>
          Création de la facture…
        </>
      ) : (
        libelle
      )}
    </button>
  )
}

/**
 * « Facturer <mois> » : le mois se choisit (par défaut le mois en cours) ; un
 * mois déjà facturé ne se refacture pas ; un établissement en essai, suspendu
 * ou désactivé demande une confirmation dans une fenêtre.
 */
export default function Facturer({
  action,
  etab,
  options,
  defaut,
  montant,
  avertissement,
}: {
  action: (d: FormData) => void | Promise<void>
  etab: string
  options: Option[]
  defaut: string
  montant: string
  avertissement: string | null
}) {
  const [mois, setMois] = useState(defaut)
  const [confirmer, setConfirmer] = useState(false)
  const formulaire = useRef<HTMLFormElement>(null)
  const forcer = useRef<HTMLInputElement>(null)
  const fermer = useCallback(() => setConfirmer(false), [])
  const choisi = options.find((o) => o.mois === mois) ?? options[0]

  return (
    <form ref={formulaire} action={action} className="space-y-3">
      <input type="hidden" name="etab" value={etab} />
      <input ref={forcer} type="hidden" name="forcer" value="0" />
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="etiquette">Mois</span>
          <select name="mois" value={mois} onChange={(e) => setMois(e.target.value)} className="champ !w-56">
            {options.map((o) => (
              <option key={o.mois} value={o.mois}>
                {o.libelle}
                {o.numero ? ` — facturé (${o.numero})` : ''}
              </option>
            ))}
          </select>
        </label>
        <Envoyer
          libelle={`Facturer ${choisi.libelle}`}
          bloque={Boolean(choisi.numero)}
          onClick={(e) => {
            // Un vrai clic : la confirmation s'ouvre (requestSubmit, plus bas, ne repasse pas ici).
            if (!avertissement) return
            e.preventDefault()
            vibrer(10)
            setConfirmer(true)
          }}
        />
      </div>
      <p className="text-xs text-[var(--color-encre-doux)]">
        {choisi.numero ? (
          <>
            {choisi.libelle} est déjà facturé : <strong className="text-[var(--color-encre)]">{choisi.numero}</strong>. Annulez cette facture dans Factures pour la refaire.
          </>
        ) : (
          <>
            Une facture de <strong className="tabular-nums text-[var(--color-encre)]">{montant}</strong> avant taxes, dans le module Factures de la société : même
            numérotation, mêmes taxes, mêmes paiements.
          </>
        )}
      </p>
      {confirmer &&
        createPortal(
          <Fenetre ouverte fermer={fermer} titre={`Facturer ${choisi.libelle} quand même ?`} largeur="max-w-md">
            <p className="text-sm leading-relaxed text-[var(--color-encre-doux)]">{avertissement}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="bouton bouton-secondaire" onClick={fermer}>
                Annuler
              </button>
              <button
                type="button"
                className="bouton"
                onClick={() => {
                  if (forcer.current) forcer.current.value = '1'
                  setConfirmer(false)
                  // Le formulaire est lu pendant l'envoi : « forcer » revient aussitôt à 0 pour la fois suivante.
                  formulaire.current?.requestSubmit()
                  if (forcer.current) forcer.current.value = '0'
                }}
              >
                Facturer quand même
              </button>
            </div>
          </Fenetre>,
          document.body,
        )}
    </form>
  )
}
