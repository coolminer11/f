'use client'

import { useState } from 'react'
import Inclinaison from '@/components/effets/inclinaison'
import { toast } from '@/components/effets/toasts'
import { vibrer } from '@/components/effets/desintegration'
import { balise } from './outils'
import { useLieu } from './contexte'

/** Une seule statistique « Wi-Fi » par affichage de page, même si le client copie trois fois. */
let compte = false
export function compterWifi(code: string, langue: string) {
  if (compte) return
  compte = true
  balise(code, 'wifi', null, langue)
}

async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte)
    return true
  } catch {
    // Vieux navigateurs, ou page sans permission : l'ancienne méthode.
    try {
      const zone = document.createElement('textarea')
      zone.value = texte
      zone.setAttribute('readonly', '')
      zone.style.cssText = 'position:fixed;opacity:0'
      document.body.append(zone)
      zone.select()
      const ok = document.execCommand('copy')
      zone.remove()
      return ok
    } catch {
      return false
    }
  }
}

/** La carte Wi-Fi : sombre, profonde, qui s'incline ; le mot de passe se copie d'un geste. */
export default function CarteWifi({
  code,
  langue,
  nom,
  motDePasse,
  t,
}: {
  code: string
  langue: string
  nom: string
  motDePasse: string | null
  t: { wifi: string; reseau: string; motDePasse: string; copier: string; copie: string; sansMotDePasse: string; mdpCopie: string; mdpCopieSous: string; erreur: string }
}) {
  const [copie, setCopie] = useState(false)

  async function copierMdp() {
    if (!motDePasse) return
    const ok = await copier(motDePasse)
    compterWifi(code, langue)
    if (!ok) return toast(t.erreur, { ton: 'erreur' })
    vibrer(14)
    setCopie(true)
    toast(t.mdpCopie, { texte: t.mdpCopieSous, ton: 'succes' })
    setTimeout(() => setCopie(false), 2200)
  }

  return (
    <Inclinaison className="sv-wifi-cadre" intensite={6}>
      <div className="sv-wifi reflet-premium">
        <svg className="sv-wifi-ondes" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M2 8.8a15 15 0 0 1 20 0M5 12.3a10.5 10.5 0 0 1 14 0M8.3 15.7a6 6 0 0 1 7.4 0" />
          <circle cx="12" cy="19" r="1.2" fill="currentColor" />
        </svg>
        <div className="relative z-[2]">
          <p className="sv-wifi-sur">{t.wifi}</p>
          <p className="sv-wifi-etiquette mt-4">{t.reseau}</p>
          <p className="sv-code mt-1 text-[1.15rem] font-semibold">{nom}</p>
          <div className="sv-wifi-ligne" aria-hidden />
          {motDePasse ? (
            <>
              <p className="sv-wifi-etiquette">{t.motDePasse}</p>
              <div className="mt-1.5 flex items-center gap-3">
                <p className="sv-code min-w-0 flex-1 select-all text-[1.15rem] font-semibold">{motDePasse}</p>
                <button type="button" className="sv-wifi-copier" data-copie={copie} onClick={() => void copierMdp()} aria-live="polite">
                  {copie ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="9" y="9" width="11" height="11" rx="2.5" />
                      <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
                    </svg>
                  )}
                  {copie ? t.copie : t.copier}
                </button>
              </div>
            </>
          ) : (
            <p className="sv-wifi-etiquette">{t.sansMotDePasse}</p>
          )}
        </div>
      </div>
    </Inclinaison>
  )
}

/** La même carte, avec le code, la langue et les textes du cadre (pour les pages serveur). */
export function CarteWifiLieu({ nom, motDePasse }: { nom: string; motDePasse: string | null }) {
  const { code, langue, t } = useLieu()
  return <CarteWifi code={code} langue={langue} nom={nom} motDePasse={motDePasse} t={t} />
}
