'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import Fenetre from '@/components/effets/fenetre'

/**
 * Un bouton qui ouvre une fenêtre contenant un formulaire (créer, importer…).
 * Le formulaire arrive du serveur en `children`. La fenêtre se referme d'elle-
 * même quand l'action est revenue (l'adresse change : ?message= / ?erreur=).
 */
export default function BoutonFenetre({
  libelle,
  titre,
  children,
  className = 'bouton',
  largeur = 'max-w-lg',
}: {
  libelle: React.ReactNode
  titre: string
  children: React.ReactNode
  className?: string
  largeur?: string
}) {
  const [ouverte, setOuverte] = useState(false)
  const adresse = useSearchParams().toString()
  const premiere = useRef(true)
  const fermer = useCallback(() => setOuverte(false), [])

  useEffect(() => {
    if (premiere.current) {
      premiere.current = false
      return
    }
    setOuverte(false)
  }, [adresse])

  return (
    <>
      <button type="button" className={className} onClick={() => setOuverte(true)}>
        {libelle}
      </button>
      {ouverte &&
        createPortal(
          <Fenetre ouverte fermer={fermer} titre={titre} largeur={largeur}>
            {children}
          </Fenetre>,
          document.body,
        )}
    </>
  )
}
