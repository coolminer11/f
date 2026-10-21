import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import { lireEtablissement } from '@/lib/services/donnees'
import {
  aujourdhui,
  clientDe,
  clientsPossibles,
  decalerMois,
  facturesEtablissement,
  moisDe,
  moisFactures,
  nomMois,
  regimeSociete,
  type EtatFacture,
} from '@/lib/services/facturation'
import { argent, dateCourte } from '@/lib/format'
import BoutonEnvoi from '@/components/bouton-envoi'
import Chiffre from '@/components/services/bo/chiffre'
import Facturer from '@/components/services/bo/facturer'
import { Bloc, Pastille, PastilleFormule, TuileChiffre, joursEssai } from '@/components/services/bo/elements'
import { choisirClientAction, facturerMoisAction, lierClientAction } from '../../actions-facturation'

export const dynamic = 'force-dynamic'

const ETATS: Record<EtatFacture, { texte: string; ton: 'positif' | 'attention' | 'negatif' | 'neutre' | 'accent' }> = {
  payee: { texte: 'Payée', ton: 'positif' },
  partielle: { texte: 'Payée en partie', ton: 'accent' },
  a_payer: { texte: 'À payer', ton: 'neutre' },
  en_retard: { texte: 'En retard', ton: 'negatif' },
  annulee: { texte: 'Annulée', ton: 'neutre' },
  en_cours: { texte: 'En création…', ton: 'attention' },
}

function Sous({ children, alerte = false }: { children: React.ReactNode; alerte?: boolean }) {
  return <span className={`text-xs ${alerte ? 'font-semibold text-[var(--color-negatif)]' : 'text-[var(--color-encre-doux)]'}`}>{children}</span>
}

/** La facturation d'un établissement : son abonnement, le client facturé, les factures de chaque mois. */
export default async function FacturationEtablissement({ params }: { params: Promise<{ id: string }> }) {
  await exigerProprietaire()
  const e = await lireEtablissement((await params).id)
  if (!e) notFound()
  const [client, clients, factures, taxes] = await Promise.all([clientDe(e.id), clientsPossibles(), facturesEtablissement(e.id), regimeSociete()])

  const courant = moisDe(aujourdhui())
  const deja = moisFactures(factures)
  const options = [1, 0, -1, -2, -3].map((n) => {
    const mois = decalerMois(courant, n)
    return { mois, libelle: nomMois(mois), numero: deja.get(mois)?.numero ?? (deja.has(mois) ? '…' : null) }
  })
  const prix = e.prix_mensuel ?? 0
  const j = joursEssai(e)
  const avertissement = !e.actif
    ? `« ${e.nom} » est désactivé : ses clients ne voient plus ses pages. Facturez seulement si le mois est réellement dû.`
    : e.formule === 'essai'
      ? `« ${e.nom} » est en essai${j !== null ? (j >= 0 ? ` (encore ${j} j)` : ` (échu depuis ${-j} j)`) : ''}. Passez-le plutôt en formule « Actif » dans Réglages → Abonnement, puis facturez — ou facturez ce mois-ci quand même.`
      : e.formule === 'suspendu'
        ? `« ${e.nom} » est suspendu. Facturez seulement un mois réellement dû.`
        : null

  const valides = factures.filter((f) => f.etat !== 'annulee' && f.vente_id)
  const total = valides.reduce((s, f) => s + f.montant_ttc, 0)
  const paye = valides.reduce((s, f) => s + f.montant_paye, 0)
  const solde = valides.reduce((s, f) => s + f.solde, 0)
  const retard = valides.filter((f) => f.etat === 'en_retard')

  return (
    <div className="space-y-5">
      <div className="cascade grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TuileChiffre icone="🔁" libelle="Abonnement" valeur={prix ? <Chiffre valeur={prix} genre="argent" /> : '—'} sous={<Sous>{prix ? `par mois · ${argent(prix * 12)} par an` : 'aucun prix réglé'}</Sous>} />
        <TuileChiffre icone="🧾" libelle="Facturé à ce jour" valeur={<Chiffre valeur={total} genre="argent" />} sous={<Sous>{`${valides.length} facture${valides.length > 1 ? 's' : ''}`}</Sous>} />
        <TuileChiffre icone="✅" libelle="Encaissé" valeur={<Chiffre valeur={paye} genre="argent" />} sous={<Sous>{total ? `${Math.round((paye / total) * 100)} % du facturé` : 'rien encore'}</Sous>} />
        <TuileChiffre
          icone={retard.length ? '⏰' : '💤'}
          libelle="À recevoir"
          valeur={<Chiffre valeur={solde} genre="argent" />}
          sous={<Sous alerte={retard.length > 0}>{retard.length ? `dont ${retard.length} en retard` : 'aucun retard'}</Sous>}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Bloc
          id="facturer"
          titre="Facturer un mois"
          sous="Chaque mois d’abonnement est une vraie facture de la société, comme une vente de cartes."
          actions={<PastilleFormule e={e} />}
        >
          {!prix ? (
            <p className="rounded-xl border border-dashed border-[var(--color-ligne)] p-4 text-sm text-[var(--color-encre-doux)]">
              Aucun prix mensuel.{' '}
              <Link href={`/services/${e.id}/reglages#abonnement`} className="font-semibold text-[var(--color-accent)] hover:underline">
                Réglez l’abonnement →
              </Link>
            </p>
          ) : (
            <Facturer action={facturerMoisAction} etab={e.id} options={options} defaut={courant} montant={argent(prix)} avertissement={avertissement} />
          )}
          <dl className="mt-5 grid gap-x-6 gap-y-2 border-t border-[var(--color-ligne)] pt-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="etiquette">Taxes</dt>
              <dd>{taxes.libelle}</dd>
            </div>
            <div>
              <dt className="etiquette">Fin de l’essai</dt>
              <dd>
                {e.formule === 'essai' && e.essai_jusqua ? (
                  <>
                    {dateCourte(e.essai_jusqua)}
                    {j !== null && <span className="text-[var(--color-encre-doux)]"> · {j >= 0 ? `dans ${j} j` : `échu depuis ${-j} j`}</span>}
                  </>
                ) : (
                  <span className="text-[var(--color-encre-doux)]">—</span>
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <Link href={`/services/${e.id}/reglages#abonnement`} className="text-xs font-semibold text-[var(--color-accent)] hover:underline">
                Changer la formule, le prix ou la fin de l’essai →
              </Link>
            </div>
          </dl>
        </Bloc>

        <Bloc id="client" titre="Client facturé" sous="La fiche du fichier des clients qui reçoit les factures.">
          {client ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-[var(--color-ligne)] bg-[var(--color-fond)] p-4">
                <p className="font-semibold">{client.nom}</p>
                {client.entreprise && client.entreprise !== client.nom && <p className="text-sm text-[var(--color-encre-doux)]">{client.entreprise}</p>}
                <dl className="mt-2 space-y-0.5 text-sm text-[var(--color-encre-doux)]">
                  <dd>{client.courriel ?? <span className="italic">Aucun courriel — la facture ne pourra pas être envoyée d’un clic.</span>}</dd>
                  {client.telephone && <dd>{client.telephone}</dd>}
                  {client.adresse && <dd className="whitespace-pre-line">{[client.adresse, [client.ville, client.code_postal].filter(Boolean).join(' ')].filter(Boolean).join('\n')}</dd>}
                  <dd>Province : {client.province ?? 'QC'}</dd>
                </dl>
              </div>
              <details className="group">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline">
                  <span className="transition group-open:rotate-90">›</span> Choisir une autre fiche
                </summary>
                <form action={choisirClientAction} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="etab" value={e.id} />
                  <label className="block min-w-0 flex-1">
                    <span className="etiquette">Client</span>
                    <select name="client" defaultValue={client.id} className="champ">
                      <option value="">— Délier la fiche —</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom}
                          {c.courriel ? ` · ${c.courriel}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <BoutonEnvoi secondaire attente="…">
                    Enregistrer
                  </BoutonEnvoi>
                </form>
              </details>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-encre-doux)]">
                Aucune fiche liée. La première facture la crée toute seule à partir des coordonnées de l’établissement
                {e.contact_courriel ? ` (${e.contact_courriel})` : ''} — ou créez-la maintenant pour la vérifier.
              </p>
              <form action={lierClientAction}>
                <input type="hidden" name="etab" value={e.id} />
                <BoutonEnvoi secondaire attente="Création…">
                  Créer la fiche client
                </BoutonEnvoi>
              </form>
              {clients.length > 0 && (
                <form action={choisirClientAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="etab" value={e.id} />
                  <label className="block min-w-0 flex-1">
                    <span className="etiquette">Ou une fiche existante</span>
                    <select name="client" required defaultValue="" className="champ">
                      <option value="" disabled>
                        Choisir…
                      </option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom}
                          {c.courriel ? ` · ${c.courriel}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <BoutonEnvoi secondaire attente="…">
                    Lier
                  </BoutonEnvoi>
                </form>
              )}
            </div>
          )}
        </Bloc>
      </div>

      <Bloc id="historique" titre="Factures" sous={factures.length ? `${factures.length} mois facturé${factures.length > 1 ? 's' : ''}, du plus récent au plus ancien.` : 'Aucune facture pour l’instant.'}>
        {factures.length === 0 ? (
          <div className="grid place-items-center gap-2 py-8 text-center">
            <span className="text-3xl" aria-hidden>
              🧾
            </span>
            <p className="max-w-sm text-sm text-[var(--color-encre-doux)]">La première facture apparaîtra ici, avec son statut de paiement suivi en direct depuis Factures.</p>
          </div>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-ligne)] text-left text-xs text-[var(--color-encre-doux)]">
                  <th className="px-5 py-2 font-medium">Mois</th>
                  <th className="px-2 py-2 font-medium">Facture</th>
                  <th className="px-2 py-2 font-medium">Échéance</th>
                  <th className="px-2 py-2 text-right font-medium">Montant</th>
                  <th className="px-2 py-2 text-right font-medium">Payé</th>
                  <th className="px-2 py-2 text-right font-medium">Solde</th>
                  <th className="px-2 py-2 font-medium">Statut</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody className="cascade divide-y divide-[var(--color-ligne)]">
                {factures.map((f) => {
                  const etat = ETATS[f.etat]
                  return (
                    <tr key={f.mois} className={f.etat === 'annulee' ? 'opacity-55' : ''}>
                      <td className="px-5 py-2.5 font-medium capitalize">{nomMois(f.mois)}</td>
                      <td className="px-2 py-2.5 font-mono text-xs">{f.numero ?? '—'}</td>
                      <td className="px-2 py-2.5 text-[var(--color-encre-doux)]">{f.date_echeance ? dateCourte(f.date_echeance) : '—'}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{argent(f.montant_ttc)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-[var(--color-encre-doux)]">{argent(f.montant_paye)}</td>
                      <td className={`px-2 py-2.5 text-right font-semibold tabular-nums ${f.etat === 'en_retard' ? 'text-[var(--color-negatif)]' : ''}`}>{argent(f.solde)}</td>
                      <td className="px-2 py-2.5">
                        <Pastille ton={etat.ton}>{etat.texte}</Pastille>
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right text-xs font-semibold">
                        {f.vente_id && (
                          <>
                            <Link href={`/ventes/${f.vente_id}`} className="text-[var(--color-accent)] hover:underline">
                              Ouvrir
                            </Link>
                            <span className="mx-1.5 text-[var(--color-ligne)]" aria-hidden>
                              |
                            </span>
                            <a href={`/ventes/${f.vente_id}/pdf`} target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline">
                              PDF
                            </a>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-[var(--color-encre-doux)]">
          Les paiements s’inscrivent sur la facture elle-même (Ouvrir → Paiement). Une facture annulée libère son mois.{' '}
          <Link href={`/ventes?recherche=${encodeURIComponent(client?.nom ?? e.nom)}`} className="font-semibold text-[var(--color-accent)] hover:underline">
            Voir dans Factures →
          </Link>
        </p>
      </Bloc>
    </div>
  )
}
