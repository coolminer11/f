import Link from 'next/link'
import { exigerSession } from '@/lib/auth'
import { listerCartes, tapsParCarte, tendances, totaux } from '@/lib/requetes/cartes'
import { baseCartesConfiguree } from '@/lib/cartes-url'
import StatsTaps from '@/components/stats-taps'
import SelecteurJours, { joursDepuis } from '@/components/selecteur-jours'
import { Evolution, Tuile, depuis, nombreFr } from '@/components/tuiles-cartes'
import TableauCartes from '@/components/tableau-cartes'

export const dynamic = 'force-dynamic'

export default async function PageCartes({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await exigerSession()
  const jours = joursDepuis((await searchParams).p)
  const [cartes, t, parCarte, courbes] = await Promise.all([
    listerCartes(),
    totaux({}, jours),
    tapsParCarte(jours),
    tendances(14),
  ])

  const actives = cartes.filter((c) => c.actif)
  const moyenne = actives.length ? Math.round(t.courant / actives.length) : 0
  const partQr = t.courant ? Math.round((t.qr / t.courant) * 100) : 0
  const libellePeriode = `vs ${jours} j précédents`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Cartes NFC</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            Chaque carte redirige vers la page de son client — et chaque tap est compté.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/cartes/direct" className="bouton bouton-secondaire">
            <span className="mr-1.5 inline-block size-2 rounded-full bg-[#0ca30c] align-middle" aria-hidden />
            En direct
          </Link>
          <Link href="/cartes/dossiers" className="bouton bouton-secondaire">
            Dossiers
          </Link>
          <Link href="/cartes/nouvelle" className="bouton">
            Nouvelle carte
          </Link>
        </div>
      </div>

      {!baseCartesConfiguree() && (
        <p className="carte border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Ne programmez encore aucune puce.</strong> L’adresse des cartes n’est pas
          configurée (variable <code>URL_CARTES</code>, par exemple{' '}
          <code>https://go.taporacards.com</code>). Une puce écrite avec l’adresse actuelle de
          l’hébergeur cesserait de marcher le jour où il change — et elle ne se reprogramme pas
          chez le client.
        </p>
      )}

      <SelecteurJours chemin="/cartes" jours={jours} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="carte p-4 sm:col-span-2 lg:col-span-1 lg:row-span-1">
          <div className="text-xs font-medium text-[var(--color-encre-doux)]">Taps, {jours} derniers jours</div>
          <div className="mt-1 text-5xl font-semibold tracking-tight" style={{ fontVariantNumeric: 'proportional-nums' }}>
            {nombreFr.format(t.courant)}
          </div>
          <div className="mt-1.5">
            <Evolution courant={t.courant} precedent={t.precedent} libelle={libellePeriode} />
          </div>
        </div>
        <Tuile
          libelle="Cartes actives"
          valeur={`${actives.length}`}
          sous={
            <span className="text-xs text-[var(--color-encre-doux)]">
              {t.cartes_tapees} utilisée{t.cartes_tapees > 1 ? 's' : ''} sur la période
            </span>
          }
        />
        <Tuile
          libelle="Moyenne par carte active"
          valeur={nombreFr.format(moyenne)}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">taps sur {jours} jours</span>}
        />
        <Tuile
          libelle="Dernier tap"
          valeur={depuis(t.dernier_tap)}
          sous={
            <span className="text-xs text-[var(--color-encre-doux)]">
              {partQr} % par code QR sur la période
            </span>
          }
        />
      </div>

      <StatsTaps portee={{}} jours={jours} totaux={t} />

      <TableauCartes
        cartes={cartes}
        parCarte={parCarte}
        courbes={courbes}
        jours={jours}
        vide={
          <>
            Aucune carte pour l’instant.{' '}
            <Link href="/cartes/nouvelle" className="font-semibold text-[var(--color-accent)] hover:underline">
              Créer la première
            </Link>
          </>
        }
      />
    </div>
  )
}
