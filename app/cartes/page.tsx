import Link from 'next/link'
import { exigerSession } from '@/lib/auth'
import { listerCartes, tapsParCarte, tendances, totaux } from '@/lib/requetes/cartes'
import { baseCartesConfiguree } from '@/lib/cartes-url'
import StatsTaps from '@/components/stats-taps'
import SelecteurJours, { joursDepuis } from '@/components/selecteur-jours'
import { Evolution, Tuile, depuis, nombreFr } from '@/components/tuiles-cartes'
import TableauCartes from '@/components/tableau-cartes'
import SuiviAvis from '@/components/suivi-avis'
import { suiviAvis } from '@/lib/avis-manuels'
import { demandesCartes } from '@/lib/requetes/dossiers'
import CartesEndormies from '@/components/cartes-endormies'
import { cartesEndormies } from '@/lib/sommeil'
import { parrainagesOuverts } from '@/lib/parrainage'
import { alertesStock, etatStock } from '@/lib/stock'

export const dynamic = 'force-dynamic'

export default async function PageCartes({ searchParams }: { searchParams: Promise<{ p?: string; erreur?: string; message?: string }> }) {
  const moi = await exigerSession()
  const sp = await searchParams
  const jours = joursDepuis(sp.p)
  const [cartes, t, parCarte, courbes, suivis, demandes, endormies, recos, stock, alertes] = await Promise.all([
    listerCartes(),
    totaux({}, jours),
    tapsParCarte(jours),
    tendances(14),
    suiviAvis(),
    demandesCartes(),
    cartesEndormies(),
    parrainagesOuverts(),
    etatStock(),
    alertesStock(),
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
          <Link href="/cartes/parrainages" className="bouton bouton-secondaire">
            Recommandations
          </Link>
          <Link href="/cartes/stock" className="bouton bouton-secondaire">
            Stock{stock.produit_id ? ` · ${stock.quantite}` : ''}
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

      {sp.erreur && (
        <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">{sp.erreur}</p>
      )}
      {sp.message && (
        <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">{sp.message}</p>
      )}

      {demandes.length > 0 && (
        <div className="carte flex flex-wrap items-center justify-between gap-3 border-[var(--color-accent)] px-4 py-3">
          <p className="text-sm">
            <strong>🛒 {demandes.length} demande{demandes.length > 1 ? 's' : ''} de cartes</strong>{' '}
            <span className="text-[var(--color-encre-doux)]">
              — {demandes.map((q) => `${q.dossier_nom} (${q.quantite})`).join(', ')}
            </span>
          </p>
          <Link href={`/cartes/dossiers/${demandes[0].dossier_id}#demandes`} className="bouton bouton-secondaire text-xs">Voir</Link>
        </div>
      )}
      {alertes.map((a) => (
        <div key={a.produit_id} className="carte flex flex-wrap items-center justify-between gap-3 border-[var(--color-attention)] px-4 py-3">
          <p className="text-sm">
            <strong>📦 {a.nom} : {a.quantite < 0 ? `stock négatif (${a.quantite})` : `plus que ${a.quantite} carte${a.quantite > 1 ? 's' : ''} en stock`}</strong>{' '}
            <span className="text-[var(--color-encre-doux)]">— {a.quantite < 0 ? 'des cartes vendues n’ont pas de réception inscrite.' : 'pensez à commander.'}</span>
          </p>
          <Link href="/cartes/stock" className="bouton bouton-secondaire text-xs">{a.quantite < 0 ? 'Corriger' : 'Voir le stock'}</Link>
        </div>
      ))}
      {recos.n > 0 && (
        <div className="carte flex flex-wrap items-center justify-between gap-3 border-[var(--color-accent)] px-4 py-3">
          <p className="text-sm">
            <strong>🤝 {recos.n} recommandation{recos.n > 1 ? 's' : ''} à contacter</strong>{' '}
            <span className="text-[var(--color-encre-doux)]">— {recos.noms.join(', ')}{recos.n > recos.noms.length ? '…' : ''}</span>
          </p>
          <Link href="/cartes/parrainages" className="bouton bouton-secondaire text-xs">Voir</Link>
        </div>
      )}
      <CartesEndormies cartes={endormies} ecriture={moi.role !== 'lecture'} />
      {moi.role !== 'lecture' && <SuiviAvis suivis={suivis} retour="/cartes" />}

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
