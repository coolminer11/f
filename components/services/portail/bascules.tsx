'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LanguePortail } from '@/components/services/portail/textes'
import { TEXTES_PORTAIL } from '@/components/services/portail/textes'

type Mode = 'clair' | 'sombre'
const CLE_MODE = 'tapora_portail_mode'

const lire = (): Mode => (document.querySelector('.theme-portail')?.getAttribute('data-mode') === 'sombre' ? 'sombre' : 'clair')

/** Soleil ou lune : le mode du portail, retenu sur cet appareil (une tablette de nuit au comptoir reste sombre). */
export function BasculeModePortail({ l }: { l: LanguePortail }) {
  const T = TEXTES_PORTAIL[l]
  const [mode, setMode] = useState<Mode>('clair')
  useEffect(() => setMode(lire()), [])
  function basculer() {
    const suivant: Mode = lire() === 'sombre' ? 'clair' : 'sombre'
    try {
      localStorage.setItem(CLE_MODE, suivant)
    } catch {}
    document.querySelectorAll('.theme-portail').forEach((e) => e.setAttribute('data-mode', suivant))
    setMode(suivant)
  }
  const libelle = mode === 'sombre' ? T.modeClair : T.modeSombre
  return (
    <button type="button" onClick={basculer} className="pt-bouton-doux !p-0 size-10" aria-label={libelle} title={libelle}>
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {mode === 'sombre' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
          </>
        ) : (
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
        )}
      </svg>
    </button>
  )
}

/** FR / EN : la langue du portail, retenue un an (témoin), sans recharger la page. */
export function BasculeLanguePortail({ l }: { l: LanguePortail }) {
  const router = useRouter()
  const autre: LanguePortail = l === 'fr' ? 'en' : 'fr'
  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = `tapora_portail_langue=${autre}; path=/service; max-age=31536000; samesite=lax`
        router.refresh()
      }}
      className="pt-bouton-doux !px-3 h-10 text-xs uppercase tracking-wider"
      aria-label={TEXTES_PORTAIL[l].autreLangue}
      title={TEXTES_PORTAIL[l].autreLangue}
    >
      {autre}
    </button>
  )
}
