import { exigerSession } from '@/lib/auth'
import { sommaire } from '@/lib/requetes/export'
import { periodesDisponibles, rapportTaxes, AUTORITES } from '@/lib/requetes/taxes'
import { argent, dateLongue, nombre } from '@/lib/format'
import SelecteurPeriode from '@/components/selecteur-periode'

export const dynamic = 'force-dynamic'

const FICHIERS = [
  {
    cle: 'grand-livre',
    titre: 'Grand livre',
    aide: 'Chaque écriture avec ses lignes de taxe, sa catégorie et qui l’a saisie.',
  },
  {
    cle: 'balance',
    titre: 'Balance de vérification',
    aide: 'Totaux par catégorie, séparés en produits, charges et stock.',
  },
  {
    cle: 'taxes',
    titre: 'Sommaire des taxes',
    aide: 'Perçu, payé et crédits sur intrants, ventilés par autorité.',
  },
  {
    cle: 'ventes',
    titre: 'Documents de vente',
    aide: 'Factures, reçus et notes de crédit, avec régime de taxe et solde.',
  },
  {
    cle: 'associes',
    titre: 'Mouvements des associés',
    aide: 'Apports, prélèvements, avances et parts de résultat.',
  },
] as const

export default async function PageExport({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>
}) {
  await exigerSession()
  const p = await searchParams
  const periodes = await periodesDisponibles()

  if (periodes.length === 0) {
    return (
      <p className="carte p-8 text-center text-[var(--color-encre-doux)]">
        Aucune transaction : il n’y a rien à exporter.
      </p>
    )
  }

  // Par défaut, l'exercice en cours — c'est la période qu'un comptable demande.
  const anneeCourante = new Date().getFullYear()
  const periode =
    periodes.find((x) => x.valeur === p.periode) ??
    periodes.find((x) => x.valeur === `${anneeCourante}-annee`) ??
    periodes[0]

  const [resume, taxes] = await Promise.all([
    sommaire(periode.debut, periode.fin),
    rapportTaxes(periode.debut, periode.fin),
  ])

  const lien = (cle: string) =>
    `/api/export/${cle}?debut=${periode.debut}&fin=${periode.fin}`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Export comptable</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            {dateLongue(periode.debut)} au {dateLongue(periode.fin)} · {nombre(resume.nb_transactions)}{' '}
            écriture{resume.nb_transactions > 1 ? 's' : ''}, {nombre(resume.nb_documents)} document
            {resume.nb_documents > 1 ? 's' : ''} de vente
          </p>
        </div>
        <SelecteurPeriode periodes={periodes} valeur={periode.valeur} />
      </div>

      <section className="carte p-5">
        <h2 className="text-sm font-bold">Sommaire de la période</h2>
        <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
          Les chiffres que votre comptable regardera en premier. Les achats portés au stock
          n’entrent pas dans le résultat : c’est le coût des cartes sorties qui le charge.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <dl className="space-y-1.5 text-sm">
            <Ligne libelle="Revenus (hors taxes)" valeur={argent(resume.revenus_ht)} />
            <Ligne
              libelle="Coûts variables"
              valeur={`− ${argent(resume.couts_variables)}`}
              aide={`dont ${argent(resume.cout_marchandises)} de cartes sorties du stock`}
            />
            <Ligne libelle="Coûts fixes" valeur={`− ${argent(resume.couts_fixes)}`} />
            <div className="!mt-3 border-t border-[var(--color-ligne)] pt-2">
              <Ligne libelle="Profit net" valeur={argent(resume.profit_net)} fort />
            </div>
          </dl>

          <dl className="space-y-1.5 text-sm">
            <Ligne
              libelle="Achats portés au stock"
              valeur={argent(resume.achats_stock)}
              aide="actif, hors résultat"
            />
            <Ligne
              libelle="Valeur du stock aujourd’hui"
              valeur={argent(resume.valeur_stock)}
              aide="à confirmer par un dénombrement en fin d’exercice"
            />
            <div className="!mt-3 border-t border-[var(--color-ligne)] pt-2">
              <Ligne libelle="Taxes perçues" valeur={argent(resume.taxes_percues)} />
              <Ligne libelle="Crédits sur intrants" valeur={`− ${argent(resume.credits_taxes)}`} />
              <Ligne
                libelle={resume.net_taxes >= 0 ? 'Net à remettre' : 'Net à recevoir'}
                valeur={argent(Math.abs(resume.net_taxes))}
                fort
              />
            </div>
          </dl>
        </div>

        {taxes.totaux.length > 0 && (
          <div className="mt-4 border-t border-[var(--color-ligne)] pt-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--color-encre-doux)]">
              Par autorité
            </h3>
            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {taxes.totaux.map((t) => (
                <li key={t.autorite}>
                  <span className="text-[var(--color-encre-doux)]">
                    {AUTORITES[t.autorite]?.nom ?? t.autorite} :{' '}
                  </span>
                  <span className="chiffre font-semibold">
                    {argent(Math.abs(t.net_a_remettre))}
                  </span>
                  <span className="text-xs text-[var(--color-encre-doux)]">
                    {t.net_a_remettre < 0 ? ' à recevoir' : ' à remettre'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="carte p-5">
        <h2 className="text-sm font-bold">Fichiers</h2>
        <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
          CSV séparé par des points-virgules, décimales à la virgule, encodage UTF-8 avec marque
          d’ordre — Excel en français les ouvre d’un double-clic, sans assistant ni accents cassés.
        </p>

        <ul className="mt-3 divide-y divide-[var(--color-ligne)]">
          {FICHIERS.map((f) => (
            <li key={f.cle} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-56 flex-1">
                <div className="font-semibold">{f.titre}</div>
                <div className="text-xs text-[var(--color-encre-doux)]">{f.aide}</div>
              </div>
              <a href={lien(f.cle)} className="bouton bouton-secondaire" download>
                Télécharger
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Ligne({
  libelle,
  valeur,
  aide,
  fort = false,
}: {
  libelle: string
  valeur: string
  aide?: string
  fort?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={fort ? 'font-semibold' : 'text-[var(--color-encre-doux)]'}>
        {libelle}
        {aide && <span className="block text-xs opacity-80">{aide}</span>}
      </dt>
      <dd className={`chiffre whitespace-nowrap ${fort ? 'text-base font-bold' : ''}`}>{valeur}</dd>
    </div>
  )
}
