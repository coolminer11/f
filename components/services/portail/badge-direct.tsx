'use client'

import { useEffect, useState } from 'react'
import type { FileJson } from '@/lib/services/portail'

/** Événement envoyé par la file (à chaque sondage) et par les avis : les pastilles des onglets suivent sans requête de plus. */
export const EVENEMENT_FILE = 'tapora-portail:file'
export type DetailBadges = { ouvertes?: number; nonLus?: number }
export const annoncerBadges = (d: DetailBadges) => window.dispatchEvent(new CustomEvent<DetailBadges>(EVENEMENT_FILE, { detail: d }))

/**
 * La pastille d'un onglet (demandes en attente, avis non lus), tenue à jour :
 * par la file en direct quand elle est ouverte, sinon par un sondage léger.
 */
export default function BadgeDirect({ jeton, initial, champ, sonder }: { jeton: string; initial: number; champ: 'ouvertes' | 'nonLus'; sonder: boolean }) {
  const [n, setN] = useState(initial)

  useEffect(() => {
    const lire = (d: DetailBadges) => {
      const v = d[champ]
      if (typeof v === 'number') setN(v)
    }
    const ecoute = (e: Event) => lire((e as CustomEvent<DetailBadges>).detail)
    window.addEventListener(EVENEMENT_FILE, ecoute)
    let i: ReturnType<typeof setInterval> | undefined
    if (sonder) {
      i = setInterval(async () => {
        if (document.visibilityState !== 'visible') return
        try {
          const r = await fetch(`/api/service/${jeton}/file`, { cache: 'no-store' })
          if (!r.ok) return
          const d = (await r.json()) as FileJson
          annoncerBadges({ ouvertes: d.pouls.ouvertes, nonLus: d.nonLus })
        } catch {}
      }, 20000)
    }
    return () => {
      window.removeEventListener(EVENEMENT_FILE, ecoute)
      if (i) clearInterval(i)
    }
  }, [jeton, champ, sonder])

  if (n <= 0) return null
  return <span className="pt-pastille">{n > 99 ? '99+' : n}</span>
}
