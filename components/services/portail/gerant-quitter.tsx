'use client'

import { useState } from 'react'
import { toast } from '@/components/effets/toasts'
import { TEXTES_PORTAIL, type LanguePortail } from '@/components/services/portail/textes'

/** « Quitter » : le mode gérant se referme sur cet appareil, retour à la file. */
export default function QuitterGerant({ jeton, l }: { jeton: string; l: LanguePortail }) {
  const G = TEXTES_PORTAIL[l].gerant
  const [enCours, setEnCours] = useState(false)

  async function quitter() {
    setEnCours(true)
    const d = new FormData()
    d.set('quitter', '1')
    const ok = await fetch(`/service/${jeton}/gerant`, { method: 'POST', body: d }).then((r) => r.ok, () => false)
    if (!ok) {
      setEnCours(false)
      toast(TEXTES_PORTAIL[l].erreur, { ton: 'erreur' })
      return
    }
    window.location.replace(`/service/${jeton}`)
  }

  return (
    <button type="button" onClick={() => void quitter()} disabled={enCours} className="pt-bouton-fantome !py-1.5 text-xs" title={G.quitterTitre}>
      {G.quitter}
    </button>
  )
}
