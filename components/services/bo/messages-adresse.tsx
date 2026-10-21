'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from '@/components/effets/toasts'

/**
 * Transforme ?message= / ?erreur= en pop-up (et ?aller= en défilement
 * jusqu'à la section), puis nettoie l'adresse. Suit
 * l'adresse (et pas seulement le premier affichage) : après une action
 * serveur, la redirection garde le gabarit monté, c'est donc ici qu'on
 * voit arriver le nouveau message. À poser APRÈS <Toasts />.
 */
export default function MessagesAdresse() {
  const sp = useSearchParams()
  const message = sp.get('message')
  const erreur = sp.get('erreur')
  const aller = sp.get('aller')
  // Garde contre le double passage des effets en développement (un seul pop-up par retour).
  const vu = useRef('')

  useEffect(() => {
    if (!message && !erreur) {
      vu.current = ''
      return
    }
    const cle = `${message}|${erreur}`
    if (vu.current !== cle) {
      vu.current = cle
      if (message) toast(message, { ton: message.includes('Attention') ? 'alerte' : 'succes' })
      if (erreur) toast(erreur, { ton: 'erreur', duree: 7000 })
    }
    // Le routeur écrit l'adresse et remonte en haut de page APRÈS cet effet :
    // le nettoyage et le défilement attendent qu'il ait fini.
    const minuterie = setTimeout(() => {
      if (aller) document.getElementById(aller)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      const u = new URL(location.href)
      u.searchParams.delete('message')
      u.searchParams.delete('erreur')
      u.searchParams.delete('aller')
      history.replaceState(history.state, '', u.toString())
    }, 150)
    return () => clearTimeout(minuterie)
  }, [message, erreur, aller])

  return null
}
