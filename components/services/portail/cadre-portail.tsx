import Link from 'next/link'
import { fraunces, inter } from '@/app/stats/polices'
import { urlFichier } from '@/lib/services/fichiers'
import { TEXTES_PORTAIL, type LanguePortail } from '@/components/services/portail/textes'
import { BasculeLanguePortail, BasculeModePortail } from '@/components/services/portail/bascules'
import BadgeDirect from '@/components/services/portail/badge-direct'
import Horloge from '@/components/services/portail/horloge'

export type Onglet = 'file' | 'controles' | 'stats' | 'avis'

/** Un texte lisible sur la couleur de l'établissement : blanc sur une couleur foncée, encre sur une claire. */
export function texteSurCouleur(hex: string): string {
  const v = /^#([0-9a-f]{6})$/i.exec(hex)?.[1]
  if (!v) return '#ffffff'
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.45 ? '#14141a' : '#ffffff'
}

// Le mode (clair ou sombre) est posé AVANT le premier affichage : jamais d'éclair blanc la nuit.
export const MODE_PORTAIL = `(function(){try{var e=document.currentScript.parentElement;var m=localStorage.getItem('tapora_portail_mode');if(m!=='clair'&&m!=='sombre'){m=matchMedia('(prefers-color-scheme: dark)').matches?'sombre':'clair'}e.setAttribute('data-mode',m)}catch(_){}})()`

/**
 * Le cadre de chaque écran du portail : couleurs de l'établissement, mode
 * clair ou sombre, bandeau d'en-tête (halos lents, filet champagne, heure de
 * la maison) et onglets. Sans `onglet` (écran du mot de passe), ni
 * navigation ni bandeau : la carte du verrou est seule.
 */
export default function CadrePortail({
  etab,
  l,
  jeton,
  onglet,
  nonLus = 0,
  ouvertes = 0,
  fuseau = 'America/Toronto',
  children,
}: {
  etab: { nom: string; type: 'restaurant' | 'hotel'; couleur: string; logo: string | null }
  l: LanguePortail
  jeton: string
  onglet?: Onglet
  nonLus?: number
  ouvertes?: number
  fuseau?: string
  children: React.ReactNode
}) {
  const T = TEXTES_PORTAIL[l]
  const logo = urlFichier(etab.logo)
  const lien = (v: Onglet) => `/service/${jeton}${v === 'file' ? '' : `?v=${v}`}`
  const onglets: [Onglet, string, number][] = [
    ['file', T.onglets.file, ouvertes],
    ['controles', T.onglets.controles, 0],
    ['stats', T.onglets.stats, 0],
    ['avis', T.onglets.avis, nonLus],
  ]
  const anneau = 'ring-1 ring-[color-mix(in_oklab,var(--p-or-clair)_55%,transparent)] ring-offset-2 ring-offset-[var(--p-surface)]'
  const monogramme = logo ? (
    <img src={logo} alt="" className={`size-12 shrink-0 rounded-2xl bg-[var(--p-surface)] object-cover shadow-sm ${anneau}`} />
  ) : (
    <span
      className={`titre-portail grid size-12 shrink-0 place-items-center rounded-2xl text-xl font-medium text-[var(--accent-texte)] shadow-sm ${anneau}`}
      style={{ background: 'linear-gradient(140deg, color-mix(in oklab, var(--accent) 80%, #fff), var(--accent))' }}
    >
      {etab.nom.trim().charAt(0).toUpperCase()}
    </span>
  )

  return (
    <div
      className={`${fraunces.variable} ${inter.variable} theme-portail -mx-4 -my-6 min-h-screen px-4 py-5 sm:px-6`}
      style={{ ['--accent' as string]: etab.couleur, ['--accent-texte' as string]: texteSurCouleur(etab.couleur) }}
      lang={l === 'fr' ? 'fr-CA' : 'en-CA'}
      suppressHydrationWarning
    >
      <script dangerouslySetInnerHTML={{ __html: MODE_PORTAIL }} />
      <div className="mx-auto max-w-6xl">
        {onglet ? (
          <header className="pt-hero fond-maillage px-5 pb-4 pt-5 sm:px-6">
            <span className="pt-filet" aria-hidden />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3.5">
                {monogramme}
                <div className="min-w-0">
                  <p className="pt-surtitre">
                    {T.portail} · {etab.type === 'hotel' ? T.hotel : T.restaurant}
                  </p>
                  <p className="titre-portail mt-0.5 truncate text-[1.45rem] font-medium leading-tight sm:text-[1.65rem]">{etab.nom}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Horloge fuseau={fuseau} l={l} />
                <div className="flex items-center gap-2">
                  <BasculeLanguePortail l={l} />
                  <BasculeModePortail l={l} />
                </div>
              </div>
            </div>
            <nav className="pt-onglets mt-5 w-fit max-w-full" aria-label={T.portail}>
              {onglets.map(([v, libelle, n]) => (
                <Link key={v} href={lien(v)} aria-current={onglet === v ? 'page' : undefined} className="pt-onglet" prefetch={false}>
                  {libelle}
                  {v === 'file' || v === 'avis' ? (
                    // Une seule source sonde : la file si elle est ouverte, sinon la pastille « En direct ».
                    <BadgeDirect jeton={jeton} initial={n} champ={v === 'file' ? 'ouvertes' : 'nonLus'} sonder={onglet !== 'file' && v === 'file'} />
                  ) : (
                    n > 0 && <span className="pt-pastille">{n > 99 ? '99+' : n}</span>
                  )}
                </Link>
              ))}
            </nav>
          </header>
        ) : (
          <header className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {monogramme}
              <p className="truncate text-[1.05rem] font-semibold leading-tight">{etab.nom}</p>
            </div>
            <div className="flex items-center gap-2">
              <BasculeLanguePortail l={l} />
              <BasculeModePortail l={l} />
            </div>
          </header>
        )}
        <div className="mt-6">{children}</div>
        <p className="mt-12 pb-4 text-center text-[11px] uppercase tracking-[0.16em] text-[var(--p-faible)]">{T.propulse}</p>
      </div>
    </div>
  )
}
