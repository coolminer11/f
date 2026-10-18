import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { dossierDuJeton } from '@/lib/lien-stats'
import { dossier as lireDossier } from '@/lib/requetes/dossiers'
import { listerCartes, tapsParCarte, totaux } from '@/lib/requetes/cartes'
import { requete } from '@/lib/db'
import StatsTaps from '@/components/stats-taps'
import SectionAvis from '@/components/section-avis'
import SelecteurJours, { joursDepuis } from '@/components/selecteur-jours'
import { Evolution, Tuile, depuis, nombreFr } from '@/components/tuiles-cartes'

export const dynamic = 'force-dynamic'

/**
 * Les statistiques d'un commerce, vues par le commerce lui-même.
 *
 * Publique, mais fermée : le jeton (HMAC, lib/lien-stats.ts) n'ouvre QUE ce
 * dossier. La page ne montre que des agrégats de ses propres cartes — ni
 * destination, ni code, ni note interne, ni lien vers le back-office (le
 * menu n'existe que pour une session ouverte). Elle n'est pas indexée et
 * n'envoie pas son adresse aux sites vers lesquels elle pointe.
 */
export const metadata: Metadata = {
  title: 'Vos statistiques — Tapora Cards',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

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
    .map((c) => ({ libelle: c.libelle, periode: parCarte[c.id]?.courant ?? 0, total: c.taps_total, dernier: c.dernier_tap }))
    .sort((a, b) => b.periode - a.periode || b.total - a.total)
  const max = Math.max(1, ...classement.map((c) => c.periode))
  const chemin = `/stats/${jeton}`

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
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-ligne)] pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-encre-doux)]">Tapora Cards · statistiques</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{d.nom}</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            {actives.length} carte{actives.length > 1 ? 's' : ''} active{actives.length > 1 ? 's' : ''} · mis à jour en direct
          </p>
        </div>
        <SelecteurJours chemin={chemin} jours={jours} />
      </header>

      {sp.desabonne && (
        <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">
          C’est noté : vous ne recevrez plus le rapport mensuel. Cette page reste accessible.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="carte p-4">
          <div className="text-xs font-medium text-[var(--color-encre-doux)]">Taps, {jours} derniers jours</div>
          <div className="mt-1 text-5xl font-semibold tracking-tight" style={{ fontVariantNumeric: 'proportional-nums' }}>{nombreFr.format(t.courant)}</div>
          <div className="mt-1.5"><Evolution courant={t.courant} precedent={t.precedent} libelle={`vs ${jours} j précédents`} /></div>
        </div>
        <Tuile libelle="Moyenne par jour" valeur={(t.courant / jours).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} sous={<span className="text-xs text-[var(--color-encre-doux)]">sur {jours} jours</span>} />
        <Tuile libelle="Dernier tap" valeur={depuis(t.dernier_tap)} />
        <Tuile libelle="Par code QR" valeur={`${t.courant ? Math.round((t.qr / t.courant) * 100) : 0} %`} sous={<span className="text-xs text-[var(--color-encre-doux)]">le reste par la puce NFC</span>} />
      </div>

      <SectionAvis placeIds={places.map((p) => p.place_id)} jours={jours} tapsPeriode={t.courant} pourClient />

      {classement.length > 1 && (
        <section className="carte p-5">
          <h2 className="text-sm font-semibold">Vos cartes</h2>
          <ul className="mt-3 space-y-2">
            {classement.map((c, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-sm sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
                <span className="truncate font-medium">{c.libelle}</span>
                <span className="hidden h-2 overflow-hidden rounded-r bg-[var(--color-grille)] sm:block" aria-hidden>
                  <span className="block h-full rounded-r bg-[var(--color-serie-1)]" style={{ width: `${(c.periode / max) * 100}%` }} />
                </span>
                <span className="chiffre text-right">
                  <strong>{nombreFr.format(c.periode)}</strong>
                  <span className="text-xs text-[var(--color-encre-doux)]"> · {nombreFr.format(c.total)} au total</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <StatsTaps portee={{ dossier: d.id }} jours={jours} totaux={t} />

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-ligne)] pt-4 text-xs text-[var(--color-encre-doux)]">
        <span>
          Propulsé par{' '}
          <a href="https://taporacards.com" className="font-semibold text-[var(--color-encre)] hover:underline">Tapora Cards</a>
          {' '}· aucune donnée personnelle de vos clients n’est conservée
        </span>
        {d.rapport_mensuel && (
          <form action={desabonner}>
            <input type="hidden" name="jeton" value={jeton} />
            <button className="hover:underline">Ne plus recevoir le rapport mensuel</button>
          </form>
        )}
      </footer>
    </div>
  )
}
