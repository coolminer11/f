'use client'

import { useEffect, useState } from 'react'
import { TEXTES_PORTAIL, type LanguePortail } from '@/components/services/portail/textes'

const CLE = 'tapora_portail_astuce_installation'

/**
 * « Ajoutez le portail à l'écran d'accueil » : seulement sur téléphone ou
 * tablette, jamais une fois installé, et plus jamais une fois fermé.
 */
export default function AstuceInstallation({ l }: { l: LanguePortail }) {
  const T = TEXTES_PORTAIL[l]
  const [systeme, setSysteme] = useState<'ios' | 'android' | null>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(CLE)) return
    } catch {}
    const installe = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (installe) return
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) setSysteme('ios')
    else if (/Android/.test(ua)) setSysteme('android')
  }, [])

  if (!systeme) return null

  function fermer() {
    setSysteme(null)
    try {
      localStorage.setItem(CLE, '1')
    } catch {}
  }

  return (
    <div className="pt-carte pt-apparait mt-4 flex items-start gap-4 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-pale)] text-xl" aria-hidden>
        📱
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{T.installer}</p>
        <p className="mt-0.5 text-[var(--p-doux)]">{systeme === 'ios' ? T.installerIos : T.installerAndroid}</p>
      </div>
      <button type="button" onClick={fermer} className="pt-bouton-fantome !px-3 !py-2 text-xs">
        {T.compris}
      </button>
    </div>
  )
}
