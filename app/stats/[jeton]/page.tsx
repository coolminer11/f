import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { notFound, redirect } from 'next/navigation'
import { dossierDuJeton } from '@/lib/lien-stats'
import { dossier as lireDossier } from '@/lib/requetes/dossiers'
import { listerCartes, tapsParCarte, totaux } from '@/lib/requetes/cartes'
import { cleAvis } from '@/lib/avis-manuels'
import { requete } from '@/lib/db'
import StatsTaps from '@/components/stats-taps'
import SectionAvis from '@/components/section-avis'
import AnimationsClient from '@/components/animations-client'
import { PERIODES, joursDepuis } from '@/components/selecteur-jours'
import { depuis } from '@/components/tuiles-cartes'

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
export const metadata: Metadata = {
  title: 'Vos statistiques — Tapora Cards',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

// Pose la classe « attente » avant le premier affichage (voir globals.css) ;
// filet de sécurité : tout réapparaît au bout de 2,5 s quoi qu'il arrive.
const ANTI_ECLAIR = `(function(){try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var r=document.documentElement;r.classList.add('attente');setTimeout(function(){r.classList.remove('attente')},2500)}catch(e){}})()`

const nombre = new Intl.NumberFormat('fr-CA')

export default async function StatsClient({
  params,
  searchParams,
}: {
  params: Promise<{ jeton: string }>
  searchParams: Promise<{ p?: string; desabonne?: string }>
}) {
  const { jeton } = await params
  const sp = await searchParams
  const id = await dossierDuJeton(jeton)
  if (!id) notFound()
  const d = await lireDossier(id)
  if (!d) notFound()
  const jours = joursDepuis(sp.p)

  const [cartes, t, parCarte, places] = await Promise.all([
    listerCartes(d.id),
    totaux({ dossier: d.id }, jours),
    tapsParCarte(jours),
    requete<{ place_id: string }>(
      `select distinct place_id from cartes_nfc where dossier_id = $1::uuid and place_id is not null and actif`,
      [d.id],
    ),
  ])
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
    <div className={`${fraunces.variable} ${inter.variable} theme-client`}>
      <script dangerouslySetInnerHTML={{ __html: ANTI_ECLAIR }} />
      <AnimationsClient>
        <div className="mx-auto max-w-5xl space-y-6 pb-10">
          {/* ---- Haut de page */}
          <header className="pt-4">
            <div className="flex flex-wrap items-center justify-between gap-4" data-intro>
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
              <nav className="flex rounded-full bg-[#ede3d3] p-1 text-sm" aria-label="Période">
                {PERIODES.map((p) => (
                  <a
                    key={p}
                    href={`${chemin}?p=${p}`}
                    aria-current={p === jours ? 'page' : undefined}
                    className={`rounded-full px-4 py-1.5 font-medium transition ${
                      p === jours ? 'bg-[#2a211a] text-[#fffaf2]' : 'text-[#6b5d50] hover:text-[#2a211a]'
                    }`}
                  >
                    {p} jours
                  </a>
                ))}
              </nav>
            </div>
            <p className="mt-12 text-sm font-medium text-[#6b5d50]" data-intro>
              <span className="text-[#c2552f]">♥</span> Vos statistiques, en direct
            </p>
            <h1 className="titre-client mt-3 text-5xl font-medium leading-[1.05] sm:text-6xl" data-mots>
              {d.nom}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-[#6b5d50]" data-intro>
              {actives.length} carte{actives.length > 1 ? 's' : ''} sur place · chaque tap compte, dès la seconde où il arrive.
            </p>
          </header>

          {sp.desabonne && (
            <p className="rounded-2xl bg-[#e3efe7] px-5 py-4 text-sm font-medium text-[#2f6b4f]">
              C’est noté : vous ne recevrez plus le rapport mensuel. Cette page reste accessible.
            </p>
          )}

          {/* ---- Les chiffres clés */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="carte col-span-2 p-6" data-tuile>
              <p className="text-sm text-[#6b5d50]">Taps, {jours} derniers jours</p>
              <p className="titre-client mt-1 text-6xl font-medium sm:text-7xl">
                <span data-compteur={t.courant}>{nombre.format(t.courant)}</span>
              </p>
              <p className={`mt-2 text-sm font-medium ${ecart === null || ecart === 0 ? 'text-[#6b5d50]' : ecart > 0 ? 'text-[#2f6b4f]' : 'text-[#b0402a]'}`}>
                {ecart === null
                  ? t.courant > 0
                    ? '▲ vos premiers taps'
                    : 'Les premiers taps arrivent bientôt'
                  : ecart === 0
                    ? '= stable par rapport à la période précédente'
                    : `${ecart > 0 ? '▲ +' : '▼ −'}${Math.abs(ecart)} % par rapport aux ${jours} jours précédents`}
              </p>
            </div>
            <div className="carte p-5 sm:p-6" data-tuile>
              <p className="text-sm text-[#6b5d50]">Par jour, en moyenne</p>
              <p className="titre-client mt-1 text-4xl font-medium">
                <span data-compteur={moyenne}>{moyenne.toLocaleString('fr-CA')}</span>
              </p>
              <p className="mt-2 text-sm text-[#6b5d50]">dernier tap {depuis(t.dernier_tap)}</p>
            </div>
            <div className="carte p-5 sm:p-6" data-tuile>
              <p className="text-sm text-[#6b5d50]">Par code QR</p>
              <p className="titre-client mt-1 text-4xl font-medium">
                <span data-compteur={partQr}>{partQr}</span> %
              </p>
              <p className="mt-2 text-sm text-[#6b5d50]">le reste par la puce NFC</p>
            </div>
          </div>

          <div data-bloc>
            <SectionAvis
              placeIds={[...places.map((p) => p.place_id), cleAvis({ type: 'dossier', id: d.id })]}
              jours={jours}
              tapsPeriode={t.courant}
              pourClient
            />
          </div>

          {classement.length > 1 && (
            <section className="carte p-6">
              <h2>Vos cartes</h2>
              <p className="mt-0.5 text-xs text-[#6b5d50]">Taps sur {jours} jours, et depuis la pose</p>
              <ul className="mt-5 space-y-3">
                {classement.map((c, i) => (
                  <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 text-sm sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
                    <span className="truncate font-medium">{c.libelle}</span>
                    <span className="hidden h-2.5 overflow-hidden rounded-full bg-[#ece2d2] sm:block" aria-hidden>
                      <span data-jauge className="block h-full rounded-full bg-[#c2552f]" style={{ width: `${(c.periode / max) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums">
                      <strong>{nombre.format(c.periode)}</strong>
                      <span className="text-xs text-[#6b5d50]"> · {nombre.format(c.total)} au total</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <StatsTaps portee={{ dossier: d.id }} jours={jours} totaux={t} />

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[#e2d6c3] pt-6 text-sm text-[#6b5d50]">
            <span>
              Fait avec soin par{' '}
              <a href="https://taporacards.com" className="titre-client font-semibold text-[#2a211a] hover:text-[#c2552f]">
                Tapora Cards
              </a>{' '}
              · aucune donnée personnelle de vos clients n’est conservée
            </span>
            {d.rapport_mensuel && (
              <form action={desabonner}>
                <input type="hidden" name="jeton" value={jeton} />
                <button className="hover:text-[#2a211a] hover:underline">Ne plus recevoir le rapport mensuel</button>
              </form>
            )}
          </footer>
        </div>
      </AnimationsClient>
    </div>
  )
}
