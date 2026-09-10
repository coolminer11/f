import Link from 'next/link'
import {
  depensesParCategorie,
  historique,
  moisDisponibles,
  resultatDuMois,
  revenusParCanal,
  valeurStock,
} from '@/lib/requetes/resultats'
import { argent, moisCourant, moisLong, moisPrecedent, moisSuivant, nombre, pourcent } from '@/lib/format'
import TendanceProfit from '@/components/tendance-profit'
import { exigerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const CANAUX: Record<string, string> = {
  stripe: 'Stripe',
  comptant: 'Comptant',
  en_ligne: 'En ligne',
  autre: 'Autre',
}

export default async function PageResultats({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>
}) {
  await exigerSession()
  const { mois: moisDemande } = await searchParams
  const disponibles = await moisDisponibles()
  const mois =
    moisDemande && disponibles.includes(moisDemande)
      ? moisDemande
      : (disponibles.find((m) => m === moisCourant()) ?? disponibles[0] ?? moisCourant())

  const [resultat, categories, canaux, points, stock] = await Promise.all([
    resultatDuMois(mois),
    depensesParCategorie(mois),
    revenusParCanal(mois),
    historique(mois),
    valeurStock(),
  ])

  if (!resultat) {
    return (
      <p className="carte p-8 text-center text-[var(--color-encre-doux)]">
        Aucune donnée pour {moisLong(mois)}.
      </p>
    )
  }

  const precedent = moisPrecedent(mois)
  const suivant = moisSuivant(mois)
  const variables = categories.filter((c) => c.nature === 'variable' && (c.cout_reel || c.cout_reel_precedent))
  const fixes = categories.filter((c) => c.nature === 'fixe' && (c.cout_reel || c.cout_reel_precedent))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">État des résultats</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            {moisLong(mois)} · comparé à {moisLong(precedent)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {disponibles.includes(precedent) && (
            <Link className="bouton bouton-secondaire" href={`/resultats?mois=${precedent}`}>
              ← {moisLong(precedent)}
            </Link>
          )}
          {disponibles.includes(suivant) && (
            <Link className="bouton bouton-secondaire" href={`/resultats?mois=${suivant}`}>
              {moisLong(suivant)} →
            </Link>
          )}
        </div>
      </div>

      {/* Cascade du résultat : chaque étage découle du précédent. */}
      <div className="carte divide-y divide-[var(--color-ligne)]">
        <Etage
          libelle="Revenus (hors taxes)"
          detail={`${nombre(resultat.cartes_vendues)} carte${resultat.cartes_vendues > 1 ? 's' : ''} · ${nombre(resultat.nb_ventes)} vente${resultat.nb_ventes > 1 ? 's' : ''}`}
          montant={resultat.revenus_ht}
          precedent={resultat.revenus_ht_precedent}
          moisPrecedent={precedent}
          variationPct={resultat.variation_revenus_pct}
        />
        <Etage
          libelle="Coûts variables"
          detail={`dont ${argent(resultat.cout_marchandises)} de cartes sorties du stock`}
          montant={resultat.couts_variables}
          precedent={resultat.couts_variables_precedent}
          moisPrecedent={precedent}
          genre="cout"
        />
        <Etage
          libelle="Marge brute"
          detail={resultat.marge_brute_pct !== null ? `${pourcent(resultat.marge_brute_pct)} des revenus` : undefined}
          montant={resultat.marge_brute}
          precedent={resultat.marge_brute_precedent}
          moisPrecedent={precedent}
          genre="intermediaire"
        />
        <Etage
          libelle="Coûts fixes"
          detail="engagés même à zéro vente"
          montant={resultat.couts_fixes}
          precedent={resultat.couts_fixes_precedent}
          moisPrecedent={precedent}
          genre="cout"
        />
        <Etage
          libelle="Profit net"
          detail={resultat.profit_net_pct !== null ? `${pourcent(resultat.profit_net_pct)} des revenus` : undefined}
          montant={resultat.profit_net}
          precedent={resultat.profit_net_precedent}
          moisPrecedent={precedent}
          variationPct={resultat.variation_profit_pct}
          genre="total"
        />
      </div>

      <p className="text-xs text-[var(--color-encre-doux)]">
        Les taxes perçues n’apparaissent nulle part ci-dessus : elles ne sont pas un revenu. Les{' '}
        {nombre(stock.quantite_en_stock)} cartes encore en stock ({argent(stock.valeur_stock)}) sont
        un actif, pas une dépense de l’exercice.
      </p>

      <TendanceProfit points={points} moisAffiche={mois} />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="carte p-5">
          <h2 className="text-sm font-bold">Revenus par canal</h2>
          {canaux.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-encre-doux)]">Aucune vente ce mois-ci.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-ligne)] text-left text-xs uppercase text-[var(--color-encre-doux)]">
                  <th className="py-1.5 font-semibold">Canal</th>
                  <th className="py-1.5 text-right font-semibold">Cartes</th>
                  <th className="py-1.5 text-right font-semibold">Ventes</th>
                  <th className="py-1.5 text-right font-semibold">Revenus HT</th>
                </tr>
              </thead>
              <tbody>
                {canaux.map((c) => (
                  <tr key={c.canal} className="border-b border-[var(--color-ligne)] last:border-0">
                    <td className="py-1.5">{CANAUX[c.canal] ?? c.canal}</td>
                    <td className="chiffre py-1.5 text-right">{nombre(c.cartes_vendues)}</td>
                    <td className="chiffre py-1.5 text-right">{nombre(c.nb_ventes)}</td>
                    <td className="chiffre py-1.5 text-right font-semibold">
                      {argent(c.revenus_ht)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="carte p-5">
          <h2 className="text-sm font-bold">Dépenses par catégorie</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
            Au coût réel : la taxe non récupérable est incluse.
          </p>
          {variables.length + fixes.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-encre-doux)]">Aucune dépense ce mois-ci.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <tbody>
                {variables.length > 0 && <EnTeteGroupe libelle="Coûts variables" />}
                {variables.map((c) => (
                  <LigneCategorie key={c.categorie} categorie={c} />
                ))}
                {fixes.length > 0 && <EnTeteGroupe libelle="Coûts fixes" />}
                {fixes.map((c) => (
                  <LigneCategorie key={c.categorie} categorie={c} />
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}

/**
 * Un étage de la cascade du résultat.
 *
 * Les lignes de coût sont exprimées en MAGNITUDE positive : « 146,56 $ de
 * coûts », affiché « − 146,56 $ ». L'écart se lit donc dans le même sens que
 * ce que la personne a sous les yeux — « +113,82 $ » veut dire « 113,82 $ de
 * coûts en plus », et c'est rouge. Comparer deux nombres négatifs entre eux
 * produisait un écart dont le signe disait le contraire de son sens.
 */
function Etage({
  libelle,
  detail,
  montant,
  precedent,
  moisPrecedent: moisAvant,
  variationPct,
  genre = 'normal',
}: {
  libelle: string
  detail?: string
  montant: number
  precedent: number | null
  moisPrecedent: string
  variationPct?: number | null
  genre?: 'normal' | 'cout' | 'intermediaire' | 'total'
}) {
  const estCout = genre === 'cout'
  const ecart = precedent === null ? null : montant - precedent
  // Sur un coût, une hausse est défavorable. Partout ailleurs, c'est l'inverse.
  const favorable = ecart === null ? null : estCout ? ecart <= 0 : ecart >= 0

  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3 ${
        genre === 'intermediaire' || genre === 'total' ? 'bg-[var(--color-fond)]' : ''
      }`}
    >
      <div className="min-w-44 flex-1">
        <div className={genre === 'total' ? 'text-base font-bold' : 'font-semibold'}>
          {libelle}
        </div>
        {detail && <div className="text-xs text-[var(--color-encre-doux)]">{detail}</div>}
      </div>
      <div className="text-right">
        <div
          className={`chiffre ${genre === 'total' ? 'text-2xl' : 'text-lg'} font-bold ${
            genre === 'total'
              ? montant >= 0
                ? 'text-[var(--color-positif)]'
                : 'text-[var(--color-negatif)]'
              : ''
          }`}
        >
          {estCout ? `− ${argent(montant)}` : argent(montant)}
        </div>
        {ecart !== null && precedent !== null && (
          <div className="text-xs text-[var(--color-encre-doux)]">
            {argent(precedent)} en {moisLong(moisAvant)}
            {' · '}
            <span
              className={favorable ? 'text-[var(--color-positif)]' : 'text-[var(--color-negatif)]'}
            >
              {ecart >= 0 ? '+' : '−'}
              {argent(Math.abs(ecart))}
              {variationPct !== null && variationPct !== undefined && ` (${pourcent(variationPct)})`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function EnTeteGroupe({ libelle }: { libelle: string }) {
  return (
    <tr>
      <td
        colSpan={3}
        className="border-b border-[var(--color-ligne)] pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-encre-doux)]"
      >
        {libelle}
      </td>
    </tr>
  )
}

function LigneCategorie({
  categorie,
}: {
  categorie: {
    categorie: string
    categorie_libelle: string
    cout_reel: number
    taxes_recuperables: number
    cout_reel_precedent: number | null
  }
}) {
  const ecart =
    categorie.cout_reel_precedent === null
      ? null
      : categorie.cout_reel - categorie.cout_reel_precedent

  return (
    <tr className="border-b border-[var(--color-ligne)] last:border-0">
      <td className="py-1.5">{categorie.categorie_libelle}</td>
      <td className="chiffre py-1.5 text-right text-xs text-[var(--color-encre-doux)]">
        {ecart === null ? (
          'nouveau'
        ) : ecart === 0 ? (
          '='
        ) : (
          <span className={ecart > 0 ? 'text-[var(--color-negatif)]' : 'text-[var(--color-positif)]'}>
            {ecart > 0 ? '+' : '−'}
            {argent(Math.abs(ecart))}
          </span>
        )}
      </td>
      <td className="chiffre py-1.5 text-right font-semibold">{argent(categorie.cout_reel)}</td>
    </tr>
  )
}
