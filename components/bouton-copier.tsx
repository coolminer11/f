'use client'

import { useState } from 'react'

export default function BoutonCopier({ texte }: { texte: string }) {
  const [copie, setCopie] = useState(false)
  return (
    <button
      type="button"
      className="bouton bouton-secondaire shrink-0 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(texte)
        setCopie(true)
        setTimeout(() => setCopie(false), 1500)
      }}
    >
      {copie ? 'Copié ✓' : 'Copier'}
    </button>
  )
}
