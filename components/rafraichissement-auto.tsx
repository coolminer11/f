'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Tient l'écran à jour sans que personne n'ait à recharger la page.
 *
 * Pourquoi un sondage plutôt qu'une connexion permanente : l'application est
 * faite de composants serveur, et `router.refresh()` redemande exactement ce
 * qu'ils affichent — aucun état client n'est perdu. Une liaison temps réel
 * (WebSocket) obligerait à dupliquer la logique de calcul côté navigateur,
 * pour un gain nul à deux utilisateurs.
 *
 * Trois précautions, chacune pour une gêne observée :
 *   • onglet en arrière-plan : on ne sonde pas, et on rattrape au retour ;
 *   • champ en cours de saisie : on saute le tour, personne n'aime voir une
 *     page bouger pendant qu'il tape un montant ;
 *   • serveur injoignable : on le dit, au lieu de laisser des chiffres figés
 *     passer pour des chiffres à jour.
 */
const INTERVALLE = 12_000

type Etat = 'direct' | 'hors-ligne' | 'expiree'

export default function RafraichissementAuto() {
  const router = useRouter()
  const [etat, setEtat] = useState<Etat>('direct')

  useEffect(() => {
    let vivant = true

    async function battre() {
      if (!vivant || document.hidden) return

      const actif = document.activeElement
      const enSaisie =
        actif instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(actif.tagName) || actif.isContentEditable)

      try {
        const reponse = await fetch('/api/pouls', { cache: 'no-store' })
        if (!vivant) return
        if (reponse.status === 401) {
          setEtat('expiree')
          return
        }
        if (!reponse.ok) {
          setEtat('hors-ligne')
          return
        }
        setEtat('direct')
        if (!enSaisie) router.refresh()
      } catch {
        if (vivant) setEtat('hors-ligne')
      }
    }

    const minuterie = setInterval(battre, INTERVALLE)
    const auRetour = () => {
      if (!document.hidden) battre()
    }
    document.addEventListener('visibilitychange', auRetour)
    window.addEventListener('focus', auRetour)

    return () => {
      vivant = false
      clearInterval(minuterie)
      document.removeEventListener('visibilitychange', auRetour)
      window.removeEventListener('focus', auRetour)
    }
  }, [router])

  if (etat === 'direct') {
    return (
      <span
        className="flex items-center gap-1.5 text-xs text-[var(--color-encre-doux)]"
        title={`Les écrans se mettent à jour tout seuls, toutes les ${INTERVALLE / 1000} secondes.`}
      >
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
        En direct
      </span>
    )
  }

  if (etat === 'expiree') {
    return (
      <a href="/connexion" className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
        Session expirée — se reconnecter
      </a>
    )
  }

  return (
    <span
      className="flex items-center gap-1.5 text-xs font-medium text-red-700"
      title="Le serveur ne répond pas. Les chiffres affichés datent d’avant la coupure."
    >
      <span className="size-1.5 rounded-full bg-red-500" aria-hidden />
      Hors ligne
    </span>
  )
}
