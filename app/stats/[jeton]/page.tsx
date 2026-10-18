import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { dossierDuJeton } from '@/lib/lien-stats'
import { dossier as lireDossier } from '@/lib/requetes/dossiers'
import { listerCartes, tapsParCarte, totaux } from '@/lib/requetes/cartes'
import { cleAvis } from '@/lib/avis-manuels'
import { requete } from '@/lib/db'
import { rythmeAvis, resumeAvis } from '@/lib/avis-google'
import { direct, exploits } from '@/lib/requetes/exploits'
import { depuisL, langueValide, locale, textes } from '@/lib/langue'
import DirectAujourdhui from '@/components/client/direct-aujourdhui'
import Paliers from '@/components/client/paliers'
import CommanderCartes from '@/components/client/commander-cartes'
import AjouterEcran from '@/components/client/ajouter-ecran'
import StatsTaps from '@/components/stats-taps'
import SectionAvis from '@/components/section-avis'
import AnimationsClient from '@/components/animations-client'
import { PERIODES, joursDepuis } from '@/components/selecteur-jours'

export const dynamic = 'force-dynamic'

// Les polices du site taporacards.com, servies par l'application elle-même.
const fraunces = localFont({
  src: [
    { path: '../../polices/fraunces.woff2', style: 'normal', weight: '100 900' },
    { path: '../../polices/fraunces-italique.woff2', style: 'italic', weight: '100 900' },
  ],
  variable: '--police-fraunces',
  display: 'swap',
})
const inter = localFont({ src: '../../polices/inter.woff2', weight: '100 900', variable: '--police-inter', display: 'swap' })

/**
 * Les statistiques d'un commerce, vues par le commerce lui-même — aux
 * couleurs et avec les animations du site taporacards.com.
 *
 * Publique, mais fermée : le jeton (HMAC, lib/lien-stats.ts) n'ouvre QUE ce
 * dossier. Uniquement des agrégats de ses propres cartes — ni destination,
 * ni code, ni note interne, ni lien vers le back-office (le menu n'existe que
 * pour une session ouverte). Pas d'indexation, pas d'adresse transmise aux
 * sites vers lesquels elle pointe.
 */
type Props = {
  params: Promise<{ jeton: string }>
  searchParams: Promise<{ p?: string; l?: string; desabonne?: string }>
}

// Une seule lecture du dossier par affichage, partagée avec les métadonnées.
const charger = cache(async (jeton: string) => {
  const id = await dossierDuJeton(jeton)
  return id ? lireDossier(id) : null
})

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { jeton } = await params
  const sp = await searchParams
  const d = await charger(jeton)
  const l = langueValide(sp.l) ?? d?.langue ?? 'fr'
  return {
    title: textes(l).titre,
    robots: { index: false, follow: false, nocache: true },
    referrer: 'no-referrer',
    // « Ajouter à l'écran d'accueil » : la page s'ouvre ensuite comme une app.
    manifest: d ? `/stats/${jeton}/manifeste?l=${l}` : undefined,
    icons: { apple: '/icones/apple-touch-icon.png' },
    appleWebApp: { capable: true, title: 'Tapora', statusBarStyle: 'default' },
  }
}

export const viewport: Viewport = { themeColor: '#f7f1e7' }

// Pose la classe « attente » avant le premier affichage (voir globals.css) ;
// filet de sécurité : tout réapparaît au bout de 2,5 s quoi qu'il arrive.
const ANTI_ECLAIR = `(function(){try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var r=document.documentElement;r.classList.add('attente');setTimeout(function(){r.classList.remove('attente')},2500)}catch(e){}})()`

export default async function StatsClient({ params, searchParams }: Props) {
  const { jeton } = await params
  const sp = await searchParams
  const d = await charger(jeton)
  if (!d) notFound()
  const jours = joursDepuis(sp.p)
  const langue = langueValide(sp.l) ?? d.langue
  const T = textes(langue)
  const nombre = new Intl.NumberFormat(locale(langue))
  // La langue choisie suit le visiteur de lien en lien ; sinon, celle du dossier.
  const suffixeL = sp.l ? `&l=${langue}` : ''

  const [cartes, t, parCarte, places, maintenant, records] = await Promise.all([
    listerCartes(d.id),
    totaux({ dossier: d.id }, jours),
    tapsParCarte(jours),
    requete<{ place_id: string }>(
      `select distinct place_id from cartes_nfc where dossier_id = $1::uuid and place_id is not null and actif`,
      [d.id],
    ),
    direct(d.id),
    exploits(d.id),
  ])
  const avisIds = [...places.map((p) => p.place_id), cleAvis({ type: 'dossier', id: d.id })]
  const [avis, avisParJour] = await Promise.all([resumeAvis(avisIds, jours), rythmeAvis(avisIds)])
  const actives = cartes.filter((c) => c.actif)
  const classement = actives
    .map((c) => ({ libelle: c.libelle, periode: parCarte[c.id]?.courant ?? 0, total: c.taps_total }))
    .sort((a, b) => b.periode - a.periode || b.total - a.total)
  const max = Math.max(1, ...classement.map((c) => c.periode))
  const chemin = `/stats/${jeton}`
  const ecart = t.precedent > 0 ? Math.round(((t.courant - t.precedent) / t.precedent) * 100) : null
  const moyenne = Math.round((t.courant / jours) * 10) / 10
  const partQr = t.courant ? Math.round((t.qr / t.courant) * 100) : 0

  async function desabonner(donnees: FormData) {
    'use server'
    // Le jeton est revérifié ici : une action serveur s'appelle sans la page.
    const j = String(donnees.get('jeton') ?? '')
    const dossierId = await dossierDuJeton(j)
    if (!dossierId) return
    await requete(`update dossiers_cartes set rapport_mensuel = false where id = $1::uuid`, [dossierId])
    redirect(`/stats/${j}?desabonne=1`)
  }

  return (
    <div className={`${fraunces.variable} ${inter.variable} theme-client`} lang={langue === 'en' ? 'en-CA' : 'fr-CA'}>
      <script dangerouslySetInnerHTML={{ __html: ANTI_ECLAIR }} />
      <AnimationsClient langue={langue}>
        <div className="mx-auto max-w-5xl space-y-6 pb-10">
          {/* ---- Haut de page */}
          <header className="pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3" data-intro>
              <a href="https://taporacards.com" className="flex items-center gap-2.5" aria-label="Tapora Cards">
                <svg viewBox="0 0 64 64" className="size-8" aria-hidden>
                  <rect width="64" height="64" rx="18" fill="#c2552f" />
                  <g fill="none" stroke="#fffaf2" strokeWidth="5" strokeLinecap="round">
                    <path d="M25 22a14 14 0 0 1 0 20" />
                    <path d="M33 15a23 23 0 0 1 0 34" />
                    <path d="M41 9a31 31 0 0 1 0 46" opacity=".55" />
                  </g>
                  <circle cx="17.5" cy="32" r="4.2" fill="#fffaf2" />
                </svg>
                <span className="titre-client text-xl font-semibold">Tapora</span>
              </a>
              <div className="flex items-center gap-2">
              <nav className="flex rounded-full bg-[#ede3d3] p-1 text-sm" aria-label={langue === 'en' ? 'Period' : 'Période'}>
                {PERIODES.map((p) => (
                  <a
                    key={p}
                    href={`${chemin}?p=${p}${suffixeL}`}
                    aria-current={p === jours ? 'page' : undefined}
                    className={`rounded-full px-4 py-1.5 font-medium transition ${
                      p === jours ? 'bg-[#2a211a] text-[#fffaf2]' : 'text-[#6b5d50] hover:text-[#2a211a]'
                    }`}
                  >
                    {T.periode(p)}
                  </a>
                ))}
              </nav>
              <a
                href={`${chemin}?p=${jours}&l=${langue === 'en' ? 'fr' : 'en'}`}
                hrefLang={langue === 'en' ? 'fr' : 'en'}
                className="rounded-full bg-[#ede3d3] px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#6b5d50] transition hover:text-[#2a211a]"
                aria-label={T.langueAutre}
              >
                {langue === 'en' ? 'FR' : 'EN'}
              </a>
              </div>
            </div>
            <p className="mt-12 text-sm font-medium text-[#6b5d50]" data-intro>
              <span className="text-[#c2552f]">♥</span> {T.etiquette}
            </p>
            <h1 className="titre-client mt-3 text-5xl font-medium leading-[1.05] sm:text-6xl" data-mots>
              {d.nom}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-[#6b5d50]" data-intro>
              {T.sousTitre(actives.length)}
            </p>
          </header>

          {sp.desabonne && (
            <p className="rounded-2xl bg-[#e3efe7] px-5 py-4 text-sm font-medium text-[#2f6b4f]">
              {T.desabonne}
            </p>
          )}

          {/* ---- Aujourd'hui, en direct */}
          <DirectAujourdhui
            jeton={jeton}
            langue={langue}
            initial={maintenant}
            record={{ taps: records.record_taps, jour: records.record_jour }}
            serie={{ jours: records.serie, inclutAujourdhui: records.serie_inclut_aujourdhui }}
          />

          {/* ---- Les chiffres de la période */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="carte col-span-2 p-6" data-tuile>
              <p className="text-sm text-[#6b5d50]">{T.tapsPeriode(jours)}</p>
              <p className="titre-client mt-1 text-6xl font-medium sm:text-7xl">
                <span data-compteur={t.courant}>{nombre.format(t.courant)}</span>
              </p>
              <p className={`mt-2 text-sm font-medium ${ecart === null || ecart === 0 ? 'text-[#6b5d50]' : ecart > 0 ? 'text-[#2f6b4f]' : 'text-[#b0402a]'}`}>
                {ecart === null ? (t.courant > 0 ? T.premiersTaps : T.bientot) : ecart === 0 ? T.stable : T.ecart(ecart, jours)}
              </p>
            </div>
            <div className="carte p-5 sm:p-6" data-tuile>
              <p className="text-sm text-[#6b5d50]">{T.parJour}</p>
              <p className="titre-client mt-1 text-4xl font-medium">
                <span data-compteur={moyenne}>{moyenne.toLocaleString(locale(langue))}</span>
              </p>
              <p className="mt-2 text-sm text-[#6b5d50]">
                {T.dernierTap} {depuisL(t.dernier_tap, langue)}
              </p>
            </div>
            <div className="carte p-5 sm:p-6" data-tuile>
              <p className="text-sm text-[#6b5d50]">{T.parQr}</p>
              <p className="titre-client mt-1 text-4xl font-medium">
                <span data-compteur={partQr}>{partQr}</span>{langue === 'en' ? '%' : ' %'}
              </p>
              <p className="mt-2 text-sm text-[#6b5d50]">{T.resteNfc}</p>
            </div>
          </div>

          {/* ---- Paliers : la jauge vers le prochain, et la collection */}
          <Paliers
            dossierId={d.id}
            langue={langue}
            nbAvis={avis.nb_actuel}
            note={avis.fiches === 1 ? avis.note : null}
            objectif={d.objectif_avis}
            avisParJour={avisParJour}
            totalTaps={records.total}
          />

          <div data-bloc>
            <SectionAvis placeIds={avisIds} jours={jours} tapsPeriode={t.courant} pourClient langue={langue} />
          </div>

          {classement.length > 1 && (
            <section className="carte p-6">
              <h2>{T.vosCartes}</h2>
              <p className="mt-0.5 text-xs text-[#6b5d50]">{T.vosCartesSous(jours)}</p>
              <ul className="mt-5 space-y-3">
                {classement.map((c, i) => (
                  <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 text-sm sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
                    <span className="truncate font-medium">{c.libelle}</span>
                    <span className="hidden h-2.5 overflow-hidden rounded-full bg-[#ece2d2] sm:block" aria-hidden>
                      <span data-jauge className="block h-full rounded-full bg-[#c2552f]" style={{ width: `${(c.periode / max) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums">
                      <strong>{nombre.format(c.periode)}</strong>
                      <span className="text-xs text-[#6b5d50]"> · {nombre.format(c.total)} {T.auTotal}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <StatsTaps portee={{ dossier: d.id }} jours={jours} totaux={t} langue={langue} />

          <CommanderCartes jeton={jeton} langue={langue} />

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[#e2d6c3] pt-6 text-sm text-[#6b5d50]">
            <span>
              {T.faitPar}{' '}
              <a href="https://taporacards.com" className="titre-client font-semibold text-[#2a211a] hover:text-[#c2552f]">
                Tapora Cards
              </a>{' '}
              · {T.viePrivee}
            </span>
            {d.rapport_mensuel && (
              <form action={desabonner}>
                <input type="hidden" name="jeton" value={jeton} />
                <button className="hover:text-[#2a211a] hover:underline">{T.desabonner}</button>
              </form>
            )}
          </footer>
        </div>
      </AnimationsClient>
      {/* Calque des fenêtres flottantes (bravo, écran d'accueil) : hors des blocs animés. */}
      <div id="calque-client" />
      <AjouterEcran langue={langue} />
    </div>
  )
}
