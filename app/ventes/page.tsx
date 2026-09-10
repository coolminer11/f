import Link from 'next/link'
import { listerDocuments, typesDocument } from '@/lib/requetes/ventes'
import { argent, dateCourte, nombre } from '@/lib/format'
import { exigerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const ETATS: Record<string, { libelle: string; classe: string }> = {
  impayee: { libelle: 'Impayée', classe: 'bg-[var(--color-fond)] text-[var(--color-encre-doux)]' },
  partielle: { libelle: 'Partielle', classe: 'bg-orange-50 text-[var(--color-attention)]' },
  payee: { libelle: 'Payée', classe: 'bg-green-50 text-[var(--color-positif)]' },
  remboursee: { libelle: 'Remboursée', classe: 'bg-[var(--color-fond)] text-[var(--color-encre-doux)]' },
  sans_objet: { libelle: '—', classe: 'text-[var(--color-encre-doux)]' },
}

export default async function PageVentes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await exigerSession()
  const p = await searchParams
  const [documents, types] = await Promise.all([
    listerDocuments({ type: p.type, statut_paiement: p.etat, recherche: p.recherche }),
    typesDocument(),
  ])

  const aRecevoir = documents
    .filter((d) => d.attend_paiement && d.statut_paiement !== 'payee')
    .reduce((somme, d) => somme + d.solde, 0)
  const enRetard = documents.filter((d) => d.en_retard)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Factures et devis</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            Un devis ne crée aucun revenu tant qu’il n’est pas accepté.
          </p>
        </div>
        <Link href="/ventes/nouvelle" className="bouton">
          Nouveau document
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Sommaire libelle="À recevoir" valeur={argent(aRecevoir)} />
        <Sommaire
          libelle="En retard"
          valeur={argent(enRetard.reduce((s, d) => s + d.solde, 0))}
          alerte={enRetard.length > 0}
          detail={enRetard.length > 0 ? `${enRetard.length} facture${enRetard.length > 1 ? 's' : ''}` : undefined}
        />
        <Sommaire
          libelle="Documents"
          valeur={nombre(documents.length)}
          detail={`${documents.filter((d) => d.type_document === 'devis').length} devis · ${
            documents.filter((d) => d.type_document === 'note_credit').length
          } note${documents.filter((d) => d.type_document === 'note_credit').length > 1 ? 's' : ''} de crédit`}
        />
      </div>

      <form method="get" className="carte flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-48 flex-1">
          <label className="etiquette" htmlFor="recherche">
            Recherche
          </label>
          <input
            id="recherche"
            name="recherche"
            className="champ"
            placeholder="Client ou numéro…"
            defaultValue={p.recherche ?? ''}
          />
        </div>
        <div>
          <label className="etiquette" htmlFor="type">
            Type
          </label>
          <select id="type" name="type" className="champ w-auto" defaultValue={p.type ?? ''}>
            <option value="">Tous</option>
            {types.map((t) => (
              <option key={t.code} value={t.code}>
                {t.libelle_pluriel}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiquette" htmlFor="etat">
            Paiement
          </label>
          <select id="etat" name="etat" className="champ w-auto" defaultValue={p.etat ?? ''}>
            <option value="">Tous</option>
            <option value="impayee">Impayées</option>
            <option value="partielle">Partielles</option>
            <option value="payee">Payées</option>
            <option value="en_retard">En retard</option>
          </select>
        </div>
        <button className="bouton bouton-secondaire">Filtrer</button>
      </form>

      <div className="carte overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-ligne)] bg-[var(--color-fond)] text-left text-xs uppercase text-[var(--color-encre-doux)]">
                <th className="px-3 py-2 font-semibold">Numéro</th>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Client</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 text-right font-semibold">Solde</th>
                <th className="px-3 py-2 font-semibold">État</th>
                <th className="px-3 py-2 font-semibold">Échéance</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-[var(--color-encre-doux)]">
                    Aucun document pour ces critères.
                  </td>
                </tr>
              )}
              {documents.map((d) => (
                <tr key={d.id} className="border-b border-[var(--color-ligne)] last:border-0">
                  <td className="px-3 py-2">
                    <Link
                      href={`/ventes/${d.id}`}
                      className="chiffre font-semibold text-[var(--color-accent)] hover:underline"
                    >
                      {d.numero}
                    </Link>
                    <span className="ml-2 text-xs text-[var(--color-encre-doux)]">
                      {d.type_libelle}
                    </span>
                  </td>
                  <td className="chiffre whitespace-nowrap px-3 py-2 text-[var(--color-encre-doux)]">
                    {dateCourte(d.date)}
                  </td>
                  <td className="px-3 py-2">{d.client ?? '—'}</td>
                  <td className="chiffre whitespace-nowrap px-3 py-2 text-right font-semibold">
                    {argent(d.montant_ttc)}
                  </td>
                  <td className="chiffre whitespace-nowrap px-3 py-2 text-right">
                    {d.attend_paiement ? argent(d.solde) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {d.statut === 'annulee' ? (
                      <span className="rounded bg-[var(--color-fond)] px-2 py-0.5 text-xs font-semibold text-[var(--color-encre-doux)]">
                        Annulé
                      </span>
                    ) : d.attend_paiement ? (
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          ETATS[d.statut_paiement]?.classe ?? ''
                        }`}
                      >
                        {ETATS[d.statut_paiement]?.libelle ?? d.statut_paiement}
                      </span>
                    ) : (
                      <span className="rounded bg-[var(--color-fond)] px-2 py-0.5 text-xs font-semibold text-[var(--color-encre-doux)]">
                        {d.a_un_suivi ? `Suivi ${d.numero_suivi_document}` : d.statut}
                      </span>
                    )}
                    {d.regime_taxe !== 'taxable' && (
                      <span className="ml-1.5 rounded bg-orange-50 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-attention)]">
                        sans taxe
                      </span>
                    )}
                  </td>
                  <td className="chiffre whitespace-nowrap px-3 py-2 text-xs">
                    {d.date_echeance ? (
                      <span className={d.en_retard ? 'font-semibold text-[var(--color-negatif)]' : ''}>
                        {dateCourte(d.date_echeance)}
                        {d.en_retard && ' · en retard'}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Sommaire({
  libelle,
  valeur,
  detail,
  alerte = false,
}: {
  libelle: string
  valeur: string
  detail?: string
  alerte?: boolean
}) {
  return (
    <div className={`carte px-4 py-3 ${alerte ? 'border-[var(--color-attention)]' : ''}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-encre-doux)]">
        {libelle}
      </div>
      <div
        className={`chiffre mt-1 text-xl font-bold ${alerte ? 'text-[var(--color-attention)]' : ''}`}
      >
        {valeur}
      </div>
      {detail && <div className="text-xs text-[var(--color-encre-doux)]">{detail}</div>}
    </div>
  )
}
