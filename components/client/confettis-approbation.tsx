'use client'

import { useEffect } from 'react'
import { lancerConfettis } from '@/lib/confettis'

/** La maquette vient d'être approuvée : on fête ça (une fois, à l'arrivée sur la page). */
export default function ConfettisApprobation() {
  useEffect(() => {
    const t = setTimeout(() => lancerConfettis({ depuis: document.getElementById('commandes') ?? undefined, nombre: 160 }), 700)
    return () => clearTimeout(t)
  }, [])
  return null
}
