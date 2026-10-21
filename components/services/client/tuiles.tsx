'use client'

import { forwardRef, useState } from 'react'
import Link from 'next/link'
import Inclinaison from '@/components/effets/inclinaison'
import { useLieu } from './contexte'
import Feuille from './feuille'
import CarteWifi, { compterWifi } from './wifi'
import BlocAvis from './avis'

type ProprietesTuile = {
  icone: React.ReactNode
  titre: string
  sous?: string
  accent?: boolean
  large?: boolean
  href?: string
  onClick?: () => void
  occupe?: boolean
  etiquette?: string
}

/**
 * Une tuile de l'accueil : un lien (menu, concierge) ou un bouton (une
 * demande, le Wi-Fi). Elle s'incline sous le doigt, comme une carte qu'on
 * tient dans la lumière.
 */
export const Tuile = forwardRef<HTMLElement, ProprietesTuile>(function Tuile({ icone, titre, sous, accent, large, href, onClick, occupe, etiquette }, ref) {
  const classe = `sv-tuile ${accent ? 'sv-tuile-accent' : ''} ${large ? 'sv-tuile-large' : ''}`
  const contenu = (
    <>
      <span className="sv-tuile-icone" aria-hidden>
        {occupe ? <span className="sv-rond" /> : icone}
      </span>
      <span className="min-w-0">
        <span className="sv-tuile-titre">{titre}</span>
        {sous && <span className="sv-tuile-sous">{sous}</span>}
      </span>
      {large && (
        <svg className="sv-tuile-fleche" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 5l7 7-7 7" />
        </svg>
      )}
    </>
  )
  return (
    <Inclinaison className={`sv-tuile-cadre ${large ? 'sv-tuile-cadre-large' : ''}`} intensite={7}>
      {href ? (
        <Link ref={ref as React.Ref<HTMLAnchorElement>} href={href} prefetch={false} className={classe} aria-label={etiquette}>
          {contenu}
        </Link>
      ) : (
        <button ref={ref as React.Ref<HTMLButtonElement>} type="button" className={classe} onClick={onClick} aria-busy={occupe} aria-label={etiquette}>
          {contenu}
        </button>
      )}
    </Inclinaison>
  )
})

export function TuileWifi({ nom, motDePasse, large }: { nom: string; motDePasse: string | null; large?: boolean }) {
  const { code, langue, t } = useLieu()
  const [ouverte, setOuverte] = useState(false)
  return (
    <>
      <Tuile
        icone={<IconeWifi />}
        titre={t.wifi}
        sous={t.wifiSous}
        large={large}
        onClick={() => {
          setOuverte(true)
          // Sans mot de passe, il n'y a rien à copier : l'ouverture compte.
          if (!motDePasse) compterWifi(code, langue)
        }}
      />
      <Feuille ouverte={ouverte} onFermer={() => setOuverte(false)} titre={t.wifi} fermer={t.fermer}>
        <CarteWifi code={code} langue={langue} nom={nom} motDePasse={motDePasse} t={t} />
      </Feuille>
    </>
  )
}

export function TuileAvis({ google, large }: { google: string | null; large?: boolean }) {
  const { code, langue, t } = useLieu()
  const [ouverte, setOuverte] = useState(false)
  const [cle, setCle] = useState(0)
  return (
    <>
      <Tuile
        icone="★"
        titre={t.avis}
        sous={t.avisSous}
        large={large}
        onClick={() => {
          setCle((c) => c + 1)
          setOuverte(true)
        }}
      />
      <Feuille ouverte={ouverte} onFermer={() => setOuverte(false)} fermer={t.fermer}>
        <BlocAvis key={cle} code={code} langue={langue} t={t} demandeId={null} google={google} onFini={() => setOuverte(false)} />
      </Feuille>
    </>
  )
}

export function IconeWifi() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M2 8.8a15 15 0 0 1 20 0M5 12.3a10.5 10.5 0 0 1 14 0M8.3 15.7a6 6 0 0 1 7.4 0" />
      <circle cx="12" cy="19" r="1.1" fill="currentColor" />
    </svg>
  )
}
