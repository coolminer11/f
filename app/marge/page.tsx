import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  COMPOSANTES,
  coutsReference,
  definirCoutReference,
  definirHypotheses,
  definirPrixProduit,
  hypotheses,
  margeReelle,
  margeReference,
  seuilRentabilite,
} from '@/lib/requetes/marge'
import { listerProduits } from '@/lib/requetes/ventes'
import { argent, nombre, pourcent, taux } from '@/lib/format'

export const dynamic = 'force-dynamic'

const CANAUX: Record<string, string> = {
  stripe: 'Stripe',
  comptant: 'Comptant',
  en_ligne: 'En ligne',
  autre: 'Autre',
}

const SaisieCouts = z.object({
  carte_vierge: z.coerce.number().min(0),
  impression: z.coerce.number().min(0),
  expedition: z.coerce.number().min(0),
  emballage: z.coerce.number().min(0),
  date_effet: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const SaisieHypotheses = z.object({
  jours_fenetre: z.coerce.number().int().min(30).max(730),
  mois_lissage: z.coerce.number().int().min(1).max(12),
})

export default async function PageMarge({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; message?: string }>
}) {
  const p = await searchParams
  const [reelles, references, seuil, couts, produits, hypo] = await Promise.all([
    margeReelle(),
    margeReference(),
    seuilRentabilite(),
    coutsReference(),
    listerProduits(),
    hypotheses(),
  ])

  const coutParComposante = Object.fromEntries(couts.map((c) => [c.composante, c.montant_ht]))

  async function enregistrerCouts(donnees: FormData) {
    'use server'
    const analyse = SaisieCouts.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) {
      redirect(`/marge?erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)
    }
    const v = analyse.data
    for (const [composante] of COMPOSANTES) {
      await definirCoutReference(composante, v[composante as keyof typeof v] as number, v.date_effet)
    }

    for (const produit of produits) {
      const prix = donnees.get(`prix_${produit.id}`)
      if (prix !== null && prix !== '') {
        const valeur = Number(prix)
        if (Number.isFinite(valeur) && valeur >= 0) await definirPrixProduit(produit.id, valeur)
      }
    }

    revalidatePath('/marge')
    redirect('/marge?message=' + encodeURIComponent('Coûts de référence mis à jour.'))
  }

  async function enregistrerHypotheses(donnees: FormData) {
    'use server'
    const analyse = SaisieHypotheses.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) {
      redirect(`/marge?erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)
    }
    await definirHypotheses({
      joursFenetre: analyse.data.jours_fenetre,
      moisLissage: analyse.data.mois_lissage,
    })
    revalidatePath('/marge')
    redirect('/marge?message=' + encodeURIComponent('Hypothèses mises à jour.'))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Marge unitaire et seuil de rentabilité</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          Les deux marges sont toujours affichées côte à côte. Celle observée sur les ventes réelles
          n’est jamais substituée à celle des coûts de référence sans que ce soit visible.
        </p>
      </div>

      {p.message && (
        <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">
          {p.message}
        </p>
      )}
      {p.erreur && (
        <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {p.erreur}
        </p>
      )}

      {/* --- Seuil de rentabilité : les deux scénarios --- */}
      {seuil && (
        <section className="carte p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold">Combien de cartes par mois pour couvrir les coûts fixes</h2>
            <span className="text-xs text-[var(--color-encre-doux)]">
              Coûts fixes lissés sur {seuil.mois_lisses} mois : {argent(seuil.couts_fixes_mensuels)}{' '}
              par mois ({argent(seuil.couts_fixes_annualises)} par an)
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Scenario
              titre="Marge observée"
              soustitre={
                seuil.cartes_observees > 0
                  ? `${nombre(seuil.cartes_observees)} carte${seuil.cartes_observees > 1 ? 's' : ''} sur ${nombre(seuil.ventes_observees)} vente${seuil.ventes_observees > 1 ? 's' : ''}, ${seuil.fenetre_jours} derniers jours`
                  : `Aucune vente sur les ${seuil.fenetre_jours} derniers jours`
              }
              marge={seuil.marge_unitaire_reelle}
              cartes={seuil.cartes_par_mois_marge_reelle}
              accent
            />
            <Scenario
              titre="Coûts de référence"
              soustitre="Prix courant moins les coûts unitaires saisis plus bas"
              marge={seuil.marge_unitaire_reference}
              cartes={seuil.cartes_par_mois_marge_reference}
            />
          </div>

          <p className="mt-4 border-t border-[var(--color-ligne)] pt-3 text-sm">
            <span className="text-[var(--color-encre-doux)]">Ce mois-ci : </span>
            <span className="chiffre font-semibold">{nombre(seuil.cartes_mois_courant)}</span>{' '}
            <span className="text-[var(--color-encre-doux)]">
              carte{seuil.cartes_mois_courant > 1 ? 's' : ''} vendue
              {seuil.cartes_mois_courant > 1 ? 's' : ''}.
            </span>
            {seuil.cartes_par_mois_marge_reelle !== null && (
              <span className="ml-1">
                {seuil.cartes_mois_courant >= seuil.cartes_par_mois_marge_reelle ? (
                  <span className="font-semibold text-[var(--color-positif)]">
                    Le seuil de la marge observée est atteint.
                  </span>
                ) : (
                  <>
                    Encore{' '}
                    <span className="chiffre font-semibold">
                      {nombre(seuil.cartes_par_mois_marge_reelle - seuil.cartes_mois_courant)}
                    </span>{' '}
                    pour atteindre le seuil de la marge observée.
                  </>
                )}
              </span>
            )}
          </p>
        </section>
      )}

      {/* --- Marge observée par canal --- */}
      <section className="carte p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold">Marge observée, par canal de vente</h2>
          <span className="text-xs text-[var(--color-encre-doux)]">
            Fenêtre glissante de {hypo.jours_fenetre_marge} jours
          </span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
          Une vente comptant ne supporte aucun frais de transaction : c’est ce qui distingue les
          canaux, à prix égal.
        </p>

        {reelles.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-encre-doux)]">
            Aucune vente de carte sur la fenêtre. La marge de référence prend le relais dans le
            seuil ci-dessus, et c’est indiqué.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-ligne)] text-left text-xs uppercase text-[var(--color-encre-doux)]">
                  <th className="py-1.5 font-semibold">Canal</th>
                  <th className="py-1.5 text-right font-semibold">Cartes</th>
                  <th className="py-1.5 text-right font-semibold">Prix moyen HT</th>
                  <th className="py-1.5 text-right font-semibold">Coût carte</th>
                  <th className="py-1.5 text-right font-semibold">Autres coûts</th>
                  <th className="py-1.5 text-right font-semibold">Frais</th>
                  <th className="py-1.5 text-right font-semibold">Marge</th>
                </tr>
              </thead>
              <tbody>
                {reelles.map((r) => (
                  <tr key={r.canal} className="border-b border-[var(--color-ligne)] last:border-0">
                    <td className="py-1.5 font-medium">{CANAUX[r.canal] ?? r.canal}</td>
                    <td className="chiffre py-1.5 text-right">{nombre(r.cartes)}</td>
                    <td className="chiffre py-1.5 text-right">{argent(r.prix_moyen_ht)}</td>
                    <td className="chiffre py-1.5 text-right text-[var(--color-encre-doux)]">
                      − {argent(r.cout_carte_moyen)}
                    </td>
                    <td className="chiffre py-1.5 text-right text-[var(--color-encre-doux)]">
                      − {argent(r.autres_couts_variables)}
                    </td>
                    <td className="chiffre py-1.5 text-right text-[var(--color-encre-doux)]">
                      − {argent(r.frais_transaction_moyen)}
                    </td>
                    <td
                      className={`chiffre py-1.5 text-right font-bold ${
                        (r.marge_unitaire ?? 0) > 0
                          ? 'text-[var(--color-positif)]'
                          : 'text-[var(--color-negatif)]'
                      }`}
                    >
                      {argent(r.marge_unitaire)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Marge de référence --- */}
      <section className="carte p-5">
        <h2 className="text-sm font-bold">Marge de référence, par produit et canal</h2>
        <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
          Calculée à partir du prix courant et des coûts unitaires saisis, avec les frais Stripe de{' '}
          {taux(hypo.frais_stripe_pct)} plus {argent(hypo.frais_stripe_fixe)} par transaction.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-ligne)] text-left text-xs uppercase text-[var(--color-encre-doux)]">
                <th className="py-1.5 font-semibold">Produit</th>
                <th className="py-1.5 font-semibold">Canal</th>
                <th className="py-1.5 text-right font-semibold">Prix HT</th>
                <th className="py-1.5 text-right font-semibold">Carte</th>
                <th className="py-1.5 text-right font-semibold">Impression</th>
                <th className="py-1.5 text-right font-semibold">Expédition</th>
                <th className="py-1.5 text-right font-semibold">Emballage</th>
                <th className="py-1.5 text-right font-semibold">Frais</th>
                <th className="py-1.5 text-right font-semibold">Marge</th>
                <th className="py-1.5 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {references.map((r) => (
                <tr
                  key={`${r.produit_id}-${r.canal}`}
                  className="border-b border-[var(--color-ligne)] last:border-0"
                >
                  <td className="py-1.5 font-medium">{r.nom}</td>
                  <td className="py-1.5">{CANAUX[r.canal] ?? r.canal}</td>
                  <td className="chiffre py-1.5 text-right">{argent(r.prix_vente_ht)}</td>
                  <td className="chiffre py-1.5 text-right text-[var(--color-encre-doux)]">
                    {argent(r.cout_carte)}
                  </td>
                  <td className="chiffre py-1.5 text-right text-[var(--color-encre-doux)]">
                    {argent(r.cout_impression)}
                  </td>
                  <td className="chiffre py-1.5 text-right text-[var(--color-encre-doux)]">
                    {argent(r.cout_expedition)}
                  </td>
                  <td className="chiffre py-1.5 text-right text-[var(--color-encre-doux)]">
                    {argent(r.cout_emballage)}
                  </td>
                  <td className="chiffre py-1.5 text-right text-[var(--color-encre-doux)]">
                    {argent(r.frais_transaction)}
                  </td>
                  <td className="chiffre py-1.5 text-right font-bold">
                    {argent(r.marge_unitaire)}
                  </td>
                  <td className="chiffre py-1.5 text-right text-[var(--color-encre-doux)]">
                    {r.prix_vente_ht > 0
                      ? pourcent((r.marge_unitaire / r.prix_vente_ht) * 100)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- Réglages --- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <form action={enregistrerCouts} className="carte p-5">
          <h2 className="text-sm font-bold">Coûts unitaires de référence</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
            Un coût ne s’écrase pas : il est enregistré avec sa date d’effet, pour qu’un rapport sur
            une période passée continue de voir le coût qui avait cours à l’époque.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {COMPOSANTES.map(([code, libelle]) => (
              <div key={code}>
                <label className="etiquette" htmlFor={`cout_${code}`}>
                  {libelle}
                </label>
                <input
                  id={`cout_${code}`}
                  name={code}
                  type="number"
                  step="0.0001"
                  min="0"
                  inputMode="decimal"
                  className="champ"
                  defaultValue={coutParComposante[code] ?? 0}
                  required
                />
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {produits.map((produit) => (
              <div key={produit.id}>
                <label className="etiquette" htmlFor={`prix_${produit.id}`}>
                  Prix de vente — {produit.nom}
                </label>
                <input
                  id={`prix_${produit.id}`}
                  name={`prix_${produit.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className="champ"
                  defaultValue={produit.prix_vente_ht}
                />
              </div>
            ))}
            <div>
              <label className="etiquette" htmlFor="date_effet">
                Date d’effet
              </label>
              <input
                id="date_effet"
                name="date_effet"
                type="date"
                className="champ"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
          </div>

          <button className="bouton mt-4">Enregistrer les coûts</button>
        </form>

        <form action={enregistrerHypotheses} className="carte h-fit p-5">
          <h2 className="text-sm font-bold">Hypothèses de calcul</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="etiquette" htmlFor="jours_fenetre">
                Fenêtre de la marge observée (jours)
              </label>
              <input
                id="jours_fenetre"
                name="jours_fenetre"
                type="number"
                min="30"
                max="730"
                className="champ"
                defaultValue={hypo.jours_fenetre_marge}
                required
              />
              <p className="mt-1 text-xs text-[var(--color-encre-doux)]">
                Au-delà, des coûts anciens polluent la marge d’aujourd’hui.
              </p>
            </div>
            <div>
              <label className="etiquette" htmlFor="mois_lissage">
                Lissage des coûts fixes (mois)
              </label>
              <input
                id="mois_lissage"
                name="mois_lissage"
                type="number"
                min="1"
                max="12"
                className="champ"
                defaultValue={hypo.mois_lissage_couts_fixes}
                required
              />
              <p className="mt-1 text-xs text-[var(--color-encre-doux)]">
                Le mois en cours est exclu : il est incomplet.
              </p>
            </div>
          </div>
          <button className="bouton mt-4">Enregistrer les hypothèses</button>
        </form>
      </div>
    </div>
  )
}

function Scenario({
  titre,
  soustitre,
  marge,
  cartes,
  accent = false,
}: {
  titre: string
  soustitre: string
  marge: number | null
  cartes: number | null
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-doux)]'
          : 'border-[var(--color-ligne)]'
      }`}
    >
      <h3 className="text-sm font-bold">{titre}</h3>
      <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">{soustitre}</p>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-sm text-[var(--color-encre-doux)]">Marge par carte</span>
        <span className="chiffre text-lg font-bold">{argent(marge)}</span>
      </div>

      <div className="mt-2 border-t border-[var(--color-ligne)] pt-2">
        {cartes === null ? (
          <p className="text-sm text-[var(--color-encre-doux)]">
            {marge === null
              ? 'Pas assez de données pour calculer ce scénario.'
              : 'À cette marge, aucun volume ne couvre les coûts fixes.'}
          </p>
        ) : (
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">Cartes à vendre par mois</span>
            <span className="chiffre text-2xl font-bold">{nombre(cartes)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
