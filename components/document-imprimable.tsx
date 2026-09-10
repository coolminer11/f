import type { Emetteur, VenteComplete } from '@/lib/requetes/ventes'
import { argent, dateLongue, nombre, taux } from '@/lib/format'

/**
 * Le document tel qu'il part chez le client — à l'écran, sur papier, et dans
 * la page publique ouverte depuis le courriel. Une seule mise en page : trois
 * rendus qui divergent finiraient par ne plus dire la même chose.
 */
export default function DocumentImprimable({
  doc,
  societe,
}: {
  doc: VenteComplete
  societe: Emetteur
}) {
  const { definition, regime } = doc
  const affichePrix = definition.affiche_prix
  const estCredit = definition.signe === -1
  const sousTotal = doc.lignes.reduce((s, l) => s + Number(l.montant_ht), 0) * definition.signe
  const aDesRemises = doc.lignes.some((l) => l.remise_ht > 0)

  // Au Québec, un document de 30 $ ou plus doit porter les numéros
  // d'inscription : sans eux, le client ne peut pas réclamer ses crédits.
  const mentionsObligatoires = Math.abs(doc.montant_ttc) >= 30 && affichePrix

  return (
    <article className="mx-auto max-w-[8.5in] bg-white p-[0.6in] text-[13px] leading-relaxed text-[var(--color-encre)] shadow-sm print:max-w-none print:p-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-[var(--color-encre)] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{societe.nom_entreprise}</h1>
          <address className="mt-1 not-italic text-[var(--color-encre-doux)]">
            {societe.adresse && <div>{societe.adresse}</div>}
            {(societe.ville || societe.code_postal) && (
              <div>
                {societe.ville}
                {societe.ville && societe.code_postal ? ' ' : ''}
                {societe.code_postal}
              </div>
            )}
            {societe.telephone && <div>{societe.telephone}</div>}
            {societe.courriel_contact && <div>{societe.courriel_contact}</div>}
            {societe.site_web && <div>{societe.site_web}</div>}
          </address>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold uppercase tracking-wide">{definition.libelle}</div>
          <div className="chiffre mt-1 text-lg font-semibold">{doc.numero}</div>
          <dl className="mt-3 space-y-0.5 text-[var(--color-encre-doux)]">
            <Entete libelle="Date" valeur={dateLongue(doc.date)} />
            {/* Une échéance n'a de sens que si un paiement est attendu ; une
                date de validité, que sur une offre. Une note de crédit n'a ni
                l'une ni l'autre. */}
            {doc.date_echeance &&
              affichePrix &&
              (definition.attend_paiement || !definition.comptabilise_revenu) && (
                <Entete
                  libelle={definition.attend_paiement ? 'Échéance' : 'Valide jusqu’au'}
                  valeur={dateLongue(doc.date_echeance)}
                />
              )}
            {doc.numero_origine && (
              <Entete
                libelle={estCredit ? 'Facture créditée' : 'Référence'}
                valeur={doc.numero_origine}
              />
            )}
            {doc.bon_de_commande && (
              <Entete libelle="Bon de commande" valeur={doc.bon_de_commande} />
            )}
          </dl>
        </div>
      </header>

      <section className="mt-5 flex flex-wrap justify-between gap-6">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-encre-doux)]">
            {affichePrix ? (estCredit ? 'Crédité à' : 'Facturé à') : 'Livré à'}
          </h2>
          <div className="mt-1 font-semibold">{doc.client ?? doc.client_nom ?? '—'}</div>
          {doc.adresse_facturation && (
            <address className="not-italic text-[var(--color-encre-doux)]">
              {doc.adresse_facturation.split('\n').map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </address>
          )}
          {doc.courriel_facturation && (
            <div className="text-[var(--color-encre-doux)]">{doc.courriel_facturation}</div>
          )}
        </div>

        {(doc.transporteur || doc.numero_suivi) && (
          <div className="text-[11px] text-[var(--color-encre-doux)]">
            <h2 className="font-bold uppercase tracking-wider">Expédition</h2>
            {doc.transporteur && <div className="mt-1">{doc.transporteur}</div>}
            {doc.numero_suivi && <div className="chiffre">Suivi : {doc.numero_suivi}</div>}
          </div>
        )}

        {mentionsObligatoires && (societe.numero_tps || societe.numero_tvq) && (
          <div className="text-right text-[11px] text-[var(--color-encre-doux)]">
            <h2 className="font-bold uppercase tracking-wider">Numéros d’inscription</h2>
            {societe.numero_tps && (
              <div className="chiffre mt-1">TPS / TVH : {societe.numero_tps}</div>
            )}
            {societe.numero_tvq && <div className="chiffre">TVQ : {societe.numero_tvq}</div>}
            {societe.neq && <div className="chiffre">NEQ : {societe.neq}</div>}
          </div>
        )}
      </section>

      <table className="mt-6 w-full">
        <thead>
          <tr className="border-b border-[var(--color-encre)] text-left text-[11px] uppercase tracking-wider text-[var(--color-encre-doux)]">
            <th className="pb-1.5 font-bold">Description</th>
            <th className="pb-1.5 text-right font-bold">Qté</th>
            {affichePrix && (
              <>
                <th className="pb-1.5 text-right font-bold">
                  Prix unitaire{doc.prix_avec_taxes ? ' (taxes incl.)' : ''}
                </th>
                {aDesRemises && <th className="pb-1.5 text-right font-bold">Remise</th>}
                <th className="pb-1.5 text-right font-bold">Montant</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {doc.lignes.map((l) => (
            <tr key={l.id} className="border-b border-[var(--color-ligne)]">
              <td className="py-2">
                {l.description}
                {regime.applique_taxes && !l.taxable && (
                  <span className="ml-2 text-[11px] text-[var(--color-encre-doux)]">
                    (non taxable)
                  </span>
                )}
              </td>
              <td className="chiffre py-2 text-right">{nombre(l.quantite)}</td>
              {affichePrix && (
                <>
                  <td className="chiffre py-2 text-right">{argent(l.prix_unitaire_ht)}</td>
                  {aDesRemises && (
                    <td className="chiffre py-2 text-right">
                      {l.remise_ht > 0 ? `− ${argent(l.remise_ht)}` : ''}
                    </td>
                  )}
                  <td className="chiffre py-2 text-right font-medium">
                    {argent(Number(l.montant_ht) * definition.signe)}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {affichePrix && (
        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-xs space-y-1">
            <LigneTotal
              libelle={doc.prix_avec_taxes ? 'Sous-total (taxes incluses)' : 'Sous-total'}
              valeur={argent(sousTotal)}
            />
            {doc.remise_globale > 0 && (
              <LigneTotal libelle="Remise" valeur={`− ${argent(doc.remise_globale)}`} />
            )}
            <LigneTotal libelle="Total hors taxes" valeur={argent(doc.montant_ht)} />
            {doc.taxes.map((t) => (
              <LigneTotal
                key={t.code}
                libelle={`${t.code} ${taux(t.taux)}`}
                valeur={argent(t.montant)}
              />
            ))}
            {!regime.applique_taxes && (
              <LigneTotal libelle={regime.libelle} valeur={argent(0)} />
            )}
            <div className="!mt-2 flex items-baseline justify-between border-t-2 border-[var(--color-encre)] pt-2">
              <dt className="font-bold">
                {estCredit ? 'Total du crédit' : definition.attend_paiement ? 'Total' : 'Total estimé'}
              </dt>
              <dd className="chiffre text-lg font-bold">{argent(doc.montant_ttc)}</dd>
            </div>

            {definition.attend_paiement && doc.montant_paye !== 0 && (
              <>
                <LigneTotal libelle="Paiements reçus" valeur={`− ${argent(doc.montant_paye)}`} />
                <div className="!mt-2 flex items-baseline justify-between border-t border-[var(--color-encre)] pt-2">
                  <dt className="font-bold">Solde dû</dt>
                  <dd className="chiffre text-lg font-bold">{argent(doc.solde)}</dd>
                </div>
              </>
            )}
          </dl>
        </div>
      )}

      {!regime.applique_taxes && affichePrix && (
        <p className="mt-5 border-l-2 border-[var(--color-encre)] pl-3 text-[11px]">
          <span className="font-bold uppercase tracking-wider">{regime.libelle}</span>
          <br />
          {regime.mention_document} {doc.motif_exemption}
          {doc.numero_certificat_exemption && (
            <>
              <br />
              <span className="chiffre">
                Certificat d’exemption n° {doc.numero_certificat_exemption}
              </span>
            </>
          )}
        </p>
      )}

      {definition.attend_paiement && doc.paiements.length > 0 && (
        <section className="mt-5">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-encre-doux)]">
            Paiements reçus
          </h2>
          <ul className="mt-1 space-y-0.5 text-[var(--color-encre-doux)]">
            {doc.paiements.map((p) => (
              <li key={p.id} className="chiffre">
                {dateLongue(p.date)} — {argent(p.montant)}
                {p.note_credit_id
                  ? ` (note de crédit ${p.reference ?? ''})`
                  : p.reference
                    ? ` (${p.reference})`
                    : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      {definition.attend_paiement && doc.solde > 0 && (
        <p className="mt-5 rounded border border-[var(--color-encre)] px-4 py-2 font-semibold">
          Montant à payer : <span className="chiffre">{argent(doc.solde)}</span>
          {doc.conditions_paiement && ` · ${doc.conditions_paiement}`}
          {doc.date_echeance && ` · au plus tard le ${dateLongue(doc.date_echeance)}`}
        </p>
      )}

      {estCredit && (
        <p className="mt-5 rounded border border-[var(--color-encre)] px-4 py-2 font-semibold">
          Crédit de <span className="chiffre">{argent(Math.abs(doc.montant_ttc))}</span>
          {doc.numero_origine && ` porté au compte, en regard de la facture ${doc.numero_origine}`}.
        </p>
      )}

      {!affichePrix && (
        <>
          <p className="mt-5 rounded border border-[var(--color-ligne)] px-4 py-2 text-[11px] text-[var(--color-encre-doux)]">
            Ce bon de livraison ne tient pas lieu de facture. Aucun prix n’y figure.
          </p>
          <section className="mt-8 flex gap-10">
            <div className="flex-1">
              <div className="border-b border-[var(--color-encre)] pb-8" />
              <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--color-encre-doux)]">
                Reçu par (nom en lettres moulées)
              </div>
            </div>
            <div className="flex-1">
              <div className="border-b border-[var(--color-encre)] pb-8" />
              <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--color-encre-doux)]">
                Signature
              </div>
            </div>
            <div className="w-32">
              <div className="border-b border-[var(--color-encre)] pb-8" />
              <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--color-encre-doux)]">
                Date
              </div>
            </div>
          </section>
        </>
      )}

      {doc.notes_facture && (
        <section className="mt-5">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-encre-doux)]">
            Note
          </h2>
          <p className="mt-1 whitespace-pre-line">{doc.notes_facture}</p>
        </section>
      )}

      {doc.conditions_generales && affichePrix && (
        <section className="mt-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-encre-doux)]">
            Conditions
          </h2>
          <p className="mt-1 whitespace-pre-line text-[11px] text-[var(--color-encre-doux)]">
            {doc.conditions_generales}
          </p>
        </section>
      )}

      <footer className="mt-8 border-t border-[var(--color-ligne)] pt-3 text-center text-[11px] text-[var(--color-encre-doux)]">
        {societe.pied_facture}
        {!mentionsObligatoires && affichePrix && (societe.numero_tps || societe.numero_tvq) && (
          <div className="chiffre mt-1">
            {societe.numero_tps && `TPS / TVH : ${societe.numero_tps}`}
            {societe.numero_tps && societe.numero_tvq && ' · '}
            {societe.numero_tvq && `TVQ : ${societe.numero_tvq}`}
          </div>
        )}
      </footer>
    </article>
  )
}

function Entete({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex justify-end gap-3">
      <dt>{libelle}</dt>
      <dd className="chiffre font-medium text-[var(--color-encre)]">{valeur}</dd>
    </div>
  )
}

function LigneTotal({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--color-encre-doux)]">{libelle}</dt>
      <dd className="chiffre">{valeur}</dd>
    </div>
  )
}
