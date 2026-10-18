'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { JOURS, heure, locale, type Langue } from '@/lib/langue'
import { lancerConfettis } from '@/lib/confettis'
import { ouvrirPartage } from '@/components/client/partage-palier'
import { IconePartage } from '@/components/client/celebration'
import Logo from '@/components/client/logo'

export type Bilan = {
  annee: number
  nom: string
  total: number
  joursActifs: number
  meilleurJour: string | null
  meilleurJourTaps: number
  heures: number[]
  semaine: number[]
  mois: number[]
  plusLongueSerie: number
  ios: number
  android: number
  star: { libelle: string; taps: number; part: number } | null
  avisGagnes: number | null
  note: number | null
  paliersTaps: number[]
  paliersAvis: number[]
}

const DUREE = 6500

const TX = {
  fr: {
    votreAnnee: 'Votre année Tapora',
    toucher: 'Touchez pour continuer',
    totalAvant: 'Cette année, vos clients ont tapé votre carte',
    fois: 'fois.',
    joursActifs: (n: number) => `Sur ${n} jours différents. Votre carte ne chôme pas.`,
    moisTitre: 'Mois après mois',
    moisFort: (m: string) => `${m} a été votre plus beau mois.`,
    jourTitre: 'Votre plus grosse journée',
    jourTaps: (n: number) => `${n} taps en une seule journée.`,
    heureTitre: 'Votre heure magique',
    jourFort: (j: string) => `Et votre jour fétiche : le ${j}.`,
    starTitre: 'La star de l’année',
    starPart: (p: number) => `${p} % de tous vos taps, à elle seule.`,
    serieTitre: 'Votre plus longue série',
    serieJours: 'jours d’affilée',
    serieSous: 'avec au moins un tap chaque jour. Impressionnant.',
    avisTitre: 'Sur Google, cette année',
    avisGagnes: 'nouveaux avis',
    paliersTitre: 'Débloqués cette année',
    avis: 'avis',
    taps: 'taps',
    telTitre: 'Team iPhone ou team Android ?',
    merci: 'Merci pour cette belle année',
    alAn: (a: number) => `On se revoit en ${a} ?`,
    partager: 'Partager mon année',
    revoir: 'Revoir',
    retour: 'Retour aux statistiques',
    fermer: 'Fermer',
    accroche: 'a vécu une sacrée année',
    libelle: (a: number) => `taps en ${a}`,
    record: 'taps : record d’un jour',
    serieL: 'jours de suite',
    avisL: 'avis Google',
    merciImage: 'Merci à tous nos clients ♥',
  },
  en: {
    votreAnnee: 'Your Tapora year',
    toucher: 'Tap to continue',
    totalAvant: 'This year, your customers tapped your card',
    fois: 'times.',
    joursActifs: (n: number) => `On ${n} different days. Your card never slacks off.`,
    moisTitre: 'Month after month',
    moisFort: (m: string) => `${m} was your best month.`,
    jourTitre: 'Your biggest day',
    jourTaps: (n: number) => `${n} taps in a single day.`,
    heureTitre: 'Your magic hour',
    jourFort: (j: string) => `And your lucky day: ${j}.`,
    starTitre: 'Card of the year',
    starPart: (p: number) => `${p}% of all your taps, all by itself.`,
    serieTitre: 'Your longest streak',
    serieJours: 'days in a row',
    serieSous: 'with at least one tap every day. Impressive.',
    avisTitre: 'On Google this year',
    avisGagnes: 'new reviews',
    paliersTitre: 'Unlocked this year',
    avis: 'reviews',
    taps: 'taps',
    telTitre: 'Team iPhone or team Android?',
    merci: 'Thank you for a wonderful year',
    alAn: (a: number) => `See you in ${a}?`,
    partager: 'Share my year',
    revoir: 'Watch again',
    retour: 'Back to stats',
    fermer: 'Close',
    accroche: 'had quite a year',
    libelle: (a: number) => `taps in ${a}`,
    record: 'taps: best single day',
    serieL: 'days in a row',
    avisL: 'Google reviews',
    merciImage: 'Thank you to all our customers ♥',
  },
}

type Ecran = { id: string; fond: string; clair?: boolean; contenu: React.ReactNode }

/**
 * Le bilan de l'année, façon stories : plein écran, une barre de progression
 * par écran, on touche à droite pour avancer, à gauche pour revenir, on
 * maintient pour mettre en pause. Chaque écran entre en scène (GSAP) :
 * chiffres qui comptent, barres qui poussent, médailles qui tombent.
 */
export default function AnneeTapora({ bilan: b, langue, retour }: { bilan: Bilan; langue: Langue; retour: string }) {
  const T = TX[langue]
  const loc = locale(langue)
  const nf = useMemo(() => new Intl.NumberFormat(loc), [loc])
  const [i, setI] = useState(0)
  const [pause, setPause] = useState(false)
  const scene = useRef<HTMLDivElement>(null)
  const barre = useRef<HTMLSpanElement>(null)
  const debut = useRef(0)
  const ecoule = useRef(0)
  const appui = useRef<{ t: number; x: number } | null>(null)

  const nomMois = (m: number) => {
    const s = new Date(Date.UTC(b.annee, m, 1)).toLocaleDateString(loc, { month: 'long', timeZone: 'UTC' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  const moisFort = b.mois.indexOf(Math.max(...b.mois))
  const heureForte = b.heures.indexOf(Math.max(...b.heures))
  const jourFort = b.semaine.indexOf(Math.max(...b.semaine))
  const maxMois = Math.max(1, ...b.mois)
  const maxHeure = Math.max(1, ...b.heures)
  const tel = b.ios + b.android

  const ecrans: Ecran[] = [
    {
      id: 'intro',
      fond: 'bg-[#2a211a]',
      contenu: (
        <div className="text-center">
          <div data-a className="mx-auto flex w-fit items-center gap-2.5">
            <Logo className="size-9" />
            <span className="titre-client text-2xl font-semibold">Tapora</span>
          </div>
          <p data-a className="mt-10 text-lg text-[#fffaf2]/70">{b.nom}</p>
          <p data-pop className="titre-client mt-2 font-medium leading-none text-[#f6c9a8]" style={{ fontSize: 'clamp(6rem, 28vw, 12rem)' }}>
            {b.annee}
          </p>
          <p data-a className="titre-client mt-4 text-3xl font-medium sm:text-4xl">{T.votreAnnee}</p>
          <p data-a className="annee-indice mt-16 text-sm text-[#fffaf2]/60">
            {T.toucher} →
          </p>
        </div>
      ),
    },
    {
      id: 'total',
      fond: 'bg-[#c2552f]',
      contenu: (
        <div>
          <p data-a className="titre-client text-3xl font-medium leading-tight sm:text-4xl">{T.totalAvant}</p>
          <p className="titre-client my-6 font-medium leading-none tabular-nums" style={{ fontSize: 'clamp(5rem, 24vw, 10rem)' }}>
            <span data-compte={b.total}>{nf.format(b.total)}</span>
          </p>
          <p data-a className="titre-client text-3xl font-medium">{T.fois}</p>
          <p data-a className="mt-6 text-lg text-[#fffaf2]/80">{T.joursActifs(b.joursActifs)}</p>
        </div>
      ),
    },
    {
      id: 'mois',
      fond: 'bg-[#f7f1e7]',
      clair: true,
      contenu: (
        <div>
          <p data-a className="text-sm font-semibold uppercase tracking-[0.2em] text-[#c2552f]">{T.moisTitre}</p>
          <div className="mt-8 flex h-56 items-end gap-1.5 sm:gap-2" aria-hidden>
            {b.mois.map((v, m) => (
              <div key={m} className="flex flex-1 flex-col items-center gap-2">
                <div data-barre-v className={`w-full rounded-t-lg ${m === moisFort ? 'bg-[#c2552f]' : 'bg-[#e8b394]'}`} style={{ height: `${Math.max(3, (v / maxMois) * 200)}px` }} />
                <span className="text-[10px] text-[#6b5d50]">{nomMois(m).slice(0, 1)}</span>
              </div>
            ))}
          </div>
          <p data-a className="titre-client mt-8 text-3xl font-medium sm:text-4xl">{T.moisFort(nomMois(moisFort))}</p>
          <p data-a className="mt-2 text-lg text-[#6b5d50]">
            {nf.format(b.mois[moisFort])} {T.taps}
          </p>
        </div>
      ),
    },
    ...(b.meilleurJour
      ? [
          {
            id: 'jour',
            fond: 'bg-[#008a7e]',
            contenu: (
              <div>
                <p data-a className="text-sm font-semibold uppercase tracking-[0.2em] text-[#bfe8e2]">{T.jourTitre}</p>
                <p data-pop className="titre-client mt-6 text-5xl font-medium leading-tight sm:text-6xl">
                  {new Date(b.meilleurJour + 'T12:00:00Z').toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                </p>
                <p className="titre-client mt-8 font-medium leading-none tabular-nums" style={{ fontSize: 'clamp(5rem, 22vw, 9rem)' }}>
                  <span data-compte={b.meilleurJourTaps}>{nf.format(b.meilleurJourTaps)}</span>
                </p>
                <p data-a className="mt-3 text-xl text-[#fffaf2]/85">{T.jourTaps(b.meilleurJourTaps)}</p>
              </div>
            ),
          },
        ]
      : []),
    {
      id: 'heure',
      fond: 'bg-[#2a211a]',
      contenu: (
        <div>
          <p data-a className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f6c9a8]">{T.heureTitre}</p>
          <p data-pop className="titre-client mt-6 font-medium leading-none" style={{ fontSize: 'clamp(5rem, 22vw, 9rem)' }}>
            {heure(heureForte, langue)}
          </p>
          <div className="mt-8 flex h-24 items-end gap-[3px]" aria-hidden>
            {b.heures.map((v, h) => (
              <div key={h} data-barre-v className={`flex-1 rounded-t ${h === heureForte ? 'bg-[#eda100]' : 'bg-white/20'}`} style={{ height: `${Math.max(2, (v / maxHeure) * 96)}px` }} />
            ))}
          </div>
          <p data-a className="titre-client mt-8 text-3xl font-medium">{T.jourFort(JOURS[langue][jourFort])}</p>
        </div>
      ),
    },
    ...(b.star
      ? [
          {
            id: 'star',
            fond: 'bg-[#eda100]',
            clair: true,
            contenu: (
              <div>
                <p data-a className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7a4a0c]">{T.starTitre}</p>
                <p data-pop className="mt-6 text-7xl" aria-hidden>
                  ⭐
                </p>
                <p data-a className="titre-client mt-4 text-5xl font-medium leading-tight sm:text-6xl">
                  {langue === 'fr' ? `« ${b.star.libelle} »` : `“${b.star.libelle}”`}
                </p>
                <p data-a className="mt-4 text-xl text-[#2a211a]/80">
                  {nf.format(b.star.taps)} {T.taps} · {T.starPart(b.star.part)}
                </p>
              </div>
            ),
          },
        ]
      : []),
    ...(b.plusLongueSerie >= 2
      ? [
          {
            id: 'serie',
            fond: 'bg-[#7e3a1d]',
            contenu: (
              <div className="text-center">
                <p data-a className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f6c9a8]">{T.serieTitre}</p>
                <p data-pop className="mt-6 text-8xl" aria-hidden>
                  🔥
                </p>
                <p className="titre-client mt-4 font-medium leading-none tabular-nums" style={{ fontSize: 'clamp(5rem, 24vw, 10rem)' }}>
                  <span data-compte={b.plusLongueSerie}>{b.plusLongueSerie}</span>
                </p>
                <p data-a className="titre-client mt-2 text-3xl font-medium">{T.serieJours}</p>
                <p data-a className="mt-4 text-lg text-[#fffaf2]/80">{T.serieSous}</p>
              </div>
            ),
          },
        ]
      : []),
    ...(b.avisGagnes !== null && b.avisGagnes > 0
      ? [
          {
            id: 'avis',
            fond: 'bg-[#f7f1e7]',
            clair: true,
            contenu: (
              <div className="text-center">
                <p data-a className="text-sm font-semibold uppercase tracking-[0.2em] text-[#c2552f]">{T.avisTitre}</p>
                <p className="titre-client mt-8 font-medium leading-none tabular-nums text-[#2f6b4f]" style={{ fontSize: 'clamp(5rem, 24vw, 10rem)' }}>
                  +<span data-compte={b.avisGagnes}>{nf.format(b.avisGagnes)}</span>
                </p>
                <p data-a className="titre-client mt-2 text-3xl font-medium">{T.avisGagnes}</p>
                {b.note !== null && (
                  <p data-pop className="mt-8 text-4xl tracking-[0.15em] text-[#eda100]">
                    ★★★★★ <span className="titre-client tracking-normal text-[#2a211a]">{b.note.toLocaleString(loc, { minimumFractionDigits: 1 })}</span>
                  </p>
                )}
              </div>
            ),
          },
        ]
      : []),
    ...(b.paliersTaps.length + b.paliersAvis.length > 0
      ? [
          {
            id: 'paliers',
            fond: 'bg-[#2a211a]',
            contenu: (
              <div className="text-center">
                <p data-a className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f6c9a8]">{T.paliersTitre}</p>
                <div className="mt-10 flex flex-wrap justify-center gap-5">
                  {[...b.paliersAvis.map((v) => ({ v, l: T.avis })), ...b.paliersTaps.map((v) => ({ v, l: T.taps }))].map((m) => (
                    <div key={m.l + m.v} data-pop className="flex flex-col items-center gap-2">
                      <span className="medaille-annee titre-client grid size-24 place-items-center rounded-full text-2xl font-semibold">{nf.format(m.v)}</span>
                      <span className="text-sm text-[#fffaf2]/70">{m.l}</span>
                    </div>
                  ))}
                </div>
              </div>
            ),
          },
        ]
      : []),
    ...(tel >= 10
      ? [
          {
            id: 'telephones',
            fond: 'bg-[#008a7e]',
            contenu: (
              <div>
                <p data-a className="titre-client text-4xl font-medium leading-tight">{T.telTitre}</p>
                <div className="mt-10 space-y-6">
                  {[
                    { l: 'iPhone', v: b.ios },
                    { l: 'Android', v: b.android },
                  ].map((x) => (
                    <div key={x.l}>
                      <div className="flex items-baseline justify-between text-xl">
                        <span>{x.l}</span>
                        <span className="titre-client text-4xl font-medium tabular-nums">{Math.round((x.v / tel) * 100)}{langue === 'fr' ? ' %' : '%'}</span>
                      </div>
                      <div className="mt-2 h-4 overflow-hidden rounded-full bg-white/15">
                        <div data-barre-h className="h-full rounded-full bg-[#fffaf2]" style={{ width: `${(x.v / tel) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ),
          },
        ]
      : []),
    {
      id: 'merci',
      fond: 'bg-[#c2552f] annee-fin',
      contenu: (
        <div className="text-center">
          <p data-pop className="text-7xl" aria-hidden>
            ♥
          </p>
          <p data-a className="titre-client mt-6 text-4xl font-medium leading-tight sm:text-5xl">{T.merci}</p>
          <p data-a className="mt-3 text-xl text-[#fffaf2]/85">{T.alAn(b.annee + 1)}</p>
          <div data-a className="mt-10 flex flex-col items-center gap-3" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <button
              onClick={() =>
                ouvrirPartage({
                  contenu: {
                    nom: b.nom,
                    langue,
                    chiffre: nf.format(b.total),
                    libelle: T.libelle(b.annee),
                    accroche: T.accroche,
                    merci: T.merciImage,
                    lignes: [
                      ...(b.avisGagnes ? [{ valeur: `+${nf.format(b.avisGagnes)}`, libelle: T.avisL }] : []),
                      ...(b.meilleurJourTaps ? [{ valeur: nf.format(b.meilleurJourTaps), libelle: T.record }] : []),
                      ...(b.plusLongueSerie >= 2 ? [{ valeur: String(b.plusLongueSerie), libelle: T.serieL }] : []),
                    ],
                  },
                })
              }
              className="inline-flex items-center gap-2 rounded-full bg-[#fffaf2] px-7 py-3.5 text-base font-semibold text-[#2a211a] transition hover:-translate-y-0.5"
            >
              <IconePartage className="size-4" /> {T.partager}
            </button>
            <div className="flex gap-2">
              <button onClick={() => aller(0)} className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-medium hover:bg-white/25">
                ↺ {T.revoir}
              </button>
              <a href={retour} className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-medium hover:bg-white/25">
                {T.retour}
              </a>
            </div>
          </div>
          <p data-a className="mt-10 text-sm font-semibold text-[#fffaf2]/70">taporacards.com</p>
        </div>
      ),
    },
  ]
  const n = ecrans.length
  const dernier = i === n - 1

  const aller = useCallback(
    (k: number) => {
      ecoule.current = 0
      debut.current = performance.now()
      setI(Math.max(0, Math.min(n - 1, k)))
    },
    [n],
  )

  // Entrée en scène de chaque écran.
  useEffect(() => {
    const el = scene.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from(el, { opacity: 0, scale: 1.04, duration: 0.5 })
      tl.from('[data-a]', { y: 36, opacity: 0, duration: 0.8, stagger: 0.12 }, 0.1)
      tl.from('[data-pop]', { scale: 0.3, opacity: 0, rotation: -8, duration: 0.9, ease: 'back.out(1.8)', stagger: 0.08 }, 0.2)
      tl.from('[data-barre-v]', { scaleY: 0, transformOrigin: '50% 100%', duration: 0.9, stagger: 0.04 }, 0.3)
      tl.from('[data-barre-h]', { scaleX: 0, transformOrigin: '0% 50%', duration: 1.1, stagger: 0.15 }, 0.4)
      el.querySelectorAll<HTMLElement>('[data-compte]').forEach((c) => {
        const cible = Number(c.dataset.compte)
        const o = { v: 0 }
        tl.to(o, { v: cible, duration: 1.8, ease: 'power2.out', onUpdate: () => (c.textContent = nf.format(Math.round(o.v))) }, 0.3)
      })
    }, el)
    if (ecrans[i]?.id === 'merci') setTimeout(() => lancerConfettis({ nombre: 200 }), 400)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  // L'avancée automatique et la barre de progression de l'écran en cours.
  useEffect(() => {
    debut.current = performance.now() - ecoule.current
    let id = 0
    const image = (t: number) => {
      if (pause || dernier) return
      ecoule.current = t - debut.current
      const p = Math.min(1, ecoule.current / DUREE)
      if (barre.current) barre.current.style.transform = `scaleX(${p})`
      if (p >= 1) return aller(i + 1)
      id = requestAnimationFrame(image)
    }
    if (barre.current) barre.current.style.transform = `scaleX(${dernier ? 1 : Math.min(1, ecoule.current / DUREE)})`
    id = requestAnimationFrame(image)
    return () => cancelAnimationFrame(id)
  }, [i, pause, dernier, aller])

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') aller(i + 1)
      else if (e.key === 'ArrowLeft') aller(i - 1)
      else if (e.key === 'Escape') window.location.href = retour
    }
    document.addEventListener('keydown', touche)
    return () => document.removeEventListener('keydown', touche)
  }, [i, aller, retour])

  const ecran = ecrans[i]
  return (
    <div
      className={`annee fixed inset-0 select-none overflow-hidden transition-colors duration-500 ${ecran.fond} ${ecran.clair ? 'text-[#2a211a]' : 'text-[#fffaf2]'}`}
      onPointerDown={(e) => {
        appui.current = { t: Date.now(), x: e.clientX }
        setPause(true)
      }}
      onPointerUp={(e) => {
        const a = appui.current
        appui.current = null
        setPause(false)
        if (!a || Date.now() - a.t > 300) return // appui long = pause, pas navigation
        if (e.clientX < window.innerWidth / 3) aller(i - 1)
        else if (!dernier) aller(i + 1)
      }}
      onPointerCancel={() => setPause(false)}
      role="region"
      aria-roledescription="carrousel"
      aria-label={T.votreAnnee}
    >
      <div aria-hidden className="annee-grain pointer-events-none absolute inset-0" />
      <div className="absolute inset-x-0 top-0 z-10 flex gap-1.5 p-3 sm:p-4">
        {ecrans.map((e, k) => (
          <span key={e.id} className={`h-1 flex-1 overflow-hidden rounded-full ${ecran.clair ? 'bg-[#2a211a]/15' : 'bg-white/25'}`}>
            {k < i && <span className={`block h-full w-full ${ecran.clair ? 'bg-[#2a211a]' : 'bg-[#fffaf2]'}`} />}
            {k === i && <span ref={barre} className={`block h-full w-full origin-left ${ecran.clair ? 'bg-[#2a211a]' : 'bg-[#fffaf2]'}`} style={{ transform: 'scaleX(0)' }} />}
          </span>
        ))}
      </div>
      <a
        href={retour}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        className={`absolute right-3 top-7 z-10 grid size-10 place-items-center rounded-full text-lg sm:right-4 ${ecran.clair ? 'hover:bg-[#2a211a]/10' : 'hover:bg-white/15'}`}
        aria-label={T.fermer}
      >
        ✕
      </a>
      <div key={ecran.id} ref={scene} className="relative flex h-full items-center justify-center px-7 py-20" aria-live="polite">
        <div className="w-full max-w-xl">{ecran.contenu}</div>
      </div>
    </div>
  )
}
