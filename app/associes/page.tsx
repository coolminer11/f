import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  ajouterMouvement,
  basculerApprobation,
  CATEGORIES_DECISION,
  creerDecision,
  exercicesConnus,
  listerAssocies,
  listerDecisions,
  listerMouvements,
  prelevementsExercice,
  soldesAssocies,
  supprimerMouvement,
  TYPES_MOUVEMENT,
} from '@/lib/requetes/associes'
import { argent, dateCourte, dateLongue, pourcent } from '@/lib/format'
import FormulaireMouvement from '@/components/formulaire-mouvement'
import FormulaireDecision from '@/components/formulaire-decision'
import FiltresDecisions from '@/components/filtres-decisions'
import { exigerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const LIBELLES_MOUVEMENT: Record<string, string> = {
  apport: 'Apport',
  prelevement: 'Prélèvement',
  part_profit: 'Part du résultat',
  avance: 'Avance',
  remboursement_avance: 'Remboursement d’avance',
  ajustement: 'Ajustement',
}

const SaisieMouvement = z.object({
  associe_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  compte: z.enum(['capital', 'courant']),
  type: z.string().min(1),
  montant: z.coerce.number().positive('Le montant doit être supérieur à zéro.'),
  description: z.string().trim().max(300).optional(),
})

const SaisieDecision = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  titre: z.string().trim().min(3, 'Le titre est requis.').max(200),
  description: z.string().trim().min(3, 'La description est requise.').max(2000),
  decision: z.string().trim().min(3, 'La décision est requise.').max(2000),
  categorie: z.string().min(1),
  notes: z.string().trim().max(2000).optional(),
})

export default async function PageAssocies({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await exigerSession()
  const p = await searchParams
  const exercices = await exercicesConnus()
  // Par défaut, l'exercice en cours — pas le plus récent connu : la table
  // contient des exercices futurs, ouverts d'avance.
  const anneeCourante = new Date().getFullYear()
  const annee =
    Number(p.annee) ||
    exercices.find((e) => e.annee === anneeCourante)?.annee ||
    exercices[0]?.annee ||
    anneeCourante

  const [soldes, prelevements, mouvements, associes, registre] = await Promise.all([
    soldesAssocies(),
    prelevementsExercice(annee),
    listerMouvements({ annee, associe: p.associe, compte: p.compte }),
    listerAssocies(),
    listerDecisions({
      categorie: p.categorie,
      statut: p.statut,
      recherche: p.recherche,
      annee: p.annee_decision ? Number(p.annee_decision) : undefined,
    }),
  ])

  const alerte = prelevements.find((x) => x.alerte_desequilibre)
  const retour = `/associes?annee=${annee}`

  async function enregistrerMouvement(donnees: FormData) {
    'use server'
    const analyse = SaisieMouvement.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) {
      redirect(`${retour}&erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)
    }
    const v = analyse.data
    try {
      await ajouterMouvement({
        associeId: v.associe_id,
        date: v.date,
        compte: v.compte,
        type: v.type,
        montant: v.montant,
        description: v.description?.length ? v.description : null,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Enregistrement impossible.'
      redirect(`${retour}&erreur=${encodeURIComponent(message)}`)
    }
    revalidatePath('/associes')
    redirect(retour)
  }

  async function retirerMouvement(donnees: FormData) {
    'use server'
    await supprimerMouvement(String(donnees.get('id')))
    revalidatePath('/associes')
  }

  async function enregistrerDecision(donnees: FormData) {
    'use server'
    const analyse = SaisieDecision.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) {
      redirect(`${retour}&erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)
    }
    const v = analyse.data
    await creerDecision({
      date: v.date,
      titre: v.titre,
      description: v.description,
      decision: v.decision,
      categorie: v.categorie,
      notes: v.notes?.length ? v.notes : null,
    })
    revalidatePath('/associes')
    redirect(retour)
  }

  async function approuver(donnees: FormData) {
    'use server'
    await basculerApprobation(
      String(donnees.get('decision_id')),
      String(donnees.get('associe_id')),
      donnees.get('approuve') === '1',
    )
    revalidatePath('/associes')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Associés</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            Capital, comptes courants et registre des décisions unanimes · exercice {annee}
          </p>
        </div>
        <form method="get" className="flex items-center gap-2 text-sm">
          <label className="text-[var(--color-encre-doux)]" htmlFor="annee">
            Exercice
          </label>
          <select id="annee" name="annee" className="champ w-auto" defaultValue={String(annee)}>
            {exercices.map((e) => (
              <option key={e.annee} value={e.annee}>
                {e.annee}
                {e.statut === 'clos' ? ' (clos)' : ''}
              </option>
            ))}
          </select>
          <button className="bouton bouton-secondaire">Voir</button>
        </form>
      </div>

      {p.erreur && (
        <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {p.erreur}
        </p>
      )}

      {alerte && (
        <div className="carte border-[var(--color-attention)] bg-orange-50 px-4 py-3">
          <p className="text-sm font-semibold text-[var(--color-attention)]">
            Prélèvements déséquilibrés depuis le début de l’exercice
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-encre)]">
            {alerte.nom} a prélevé {argent(alerte.ecart)} de moins que{' '}
            {prelevements.find((x) => x.prelevements === alerte.prelevement_le_plus_eleve)?.nom}.
            Dans une société en nom collectif à parts égales, un écart durable finit par se régler
            au capital : mieux vaut le voir maintenant.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {soldes.map((s) => (
          <section key={s.associe_id} className="carte p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-bold">{s.nom}</h2>
              <span className="text-xs font-semibold text-[var(--color-encre-doux)]">
                {pourcent(s.part * 100)} des profits
              </span>
            </div>

            <dl className="mt-4 space-y-1.5 text-sm">
              <Ligne libelle="Apports" valeur={argent(s.apports)} />
              <Ligne libelle="Part des résultats attribuée" valeur={argent(s.profits_attribues)} />
              <Ligne
                libelle="Part de l’exercice en cours"
                valeur={argent(s.part_profit_exercice_courant)}
                aide="non attribuée tant que l’exercice n’est pas clos"
              />
              <Ligne libelle="Prélèvements" valeur={`− ${argent(s.prelevements)}`} />
              <div className="!mt-3 border-t border-[var(--color-ligne)] pt-2">
                <Ligne libelle="Compte de capital" valeur={argent(s.solde_capital)} fort />
              </div>
              <div className="!mt-3 border-t border-[var(--color-ligne)] pt-2">
                <Ligne
                  libelle="Compte courant (avances)"
                  valeur={argent(s.solde_compte_courant)}
                  aide="prêt à la société, remboursable sans toucher au capital"
                />
                <Ligne libelle="Total dû à l’associé" valeur={argent(s.total_du_a_lassocie)} fort />
              </div>
            </dl>
          </section>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section className="carte p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold">Mouvements de l’exercice {annee}</h2>
            <form method="get" className="flex items-center gap-2 text-xs">
              <input type="hidden" name="annee" value={annee} />
              <select name="associe" className="champ w-auto py-1" defaultValue={p.associe ?? ''}>
                <option value="">Les deux associés</option>
                {associes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom}
                  </option>
                ))}
              </select>
              <select name="compte" className="champ w-auto py-1" defaultValue={p.compte ?? ''}>
                <option value="">Les deux comptes</option>
                <option value="capital">Capital</option>
                <option value="courant">Compte courant</option>
              </select>
              <button className="bouton bouton-secondaire py-1">Filtrer</button>
            </form>
          </div>

          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-ligne)] text-left text-xs uppercase text-[var(--color-encre-doux)]">
                <th className="py-1.5 font-semibold">Date</th>
                <th className="py-1.5 font-semibold">Associé</th>
                <th className="py-1.5 font-semibold">Nature</th>
                <th className="py-1.5 text-right font-semibold">Montant</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mouvements.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--color-encre-doux)]">
                    Aucun mouvement pour ces critères.
                  </td>
                </tr>
              )}
              {mouvements.map((m) => (
                <tr key={m.id} className="border-b border-[var(--color-ligne)] last:border-0">
                  <td className="chiffre whitespace-nowrap py-1.5 text-[var(--color-encre-doux)]">
                    {dateCourte(m.date)}
                  </td>
                  <td className="py-1.5">{m.nom}</td>
                  <td className="py-1.5">
                    {LIBELLES_MOUVEMENT[m.type] ?? m.type}
                    <span className="ml-1.5 text-xs text-[var(--color-encre-doux)]">
                      {m.compte === 'capital' ? 'capital' : 'compte courant'}
                    </span>
                    {m.description && (
                      <div className="text-xs text-[var(--color-encre-doux)]">{m.description}</div>
                    )}
                  </td>
                  <td
                    className={`chiffre whitespace-nowrap py-1.5 text-right font-semibold ${
                      m.montant_signe < 0 ? 'text-[var(--color-negatif)]' : ''
                    }`}
                  >
                    {m.montant_signe >= 0 ? '+' : '−'}
                    {argent(Math.abs(m.montant_signe))}
                  </td>
                  <td className="py-1.5 text-right">
                    {m.type !== 'part_profit' && (
                      <form action={retirerMouvement}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="text-xs text-[var(--color-encre-doux)] hover:underline">
                          Supprimer
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <FormulaireMouvement
          action={enregistrerMouvement}
          associes={associes}
          types={TYPES_MOUVEMENT}
        />
      </div>

      <section className="carte p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold">Registre des décisions unanimes</h2>
            <p className="text-xs text-[var(--color-encre-doux)]">
              L’unanimité se déduit des approbations : elle ne se coche pas à la main.
            </p>
          </div>
        </div>

        <FiltresDecisions
          categories={CATEGORIES_DECISION}
          valeurs={p}
          annee={annee}
        />

        <div className="mt-4 space-y-3">
          {registre.decisions.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--color-encre-doux)]">
              Aucune décision pour ces critères.
            </p>
          )}
          {registre.decisions.map((d) => {
            const approbations = registre.approbations.filter((a) => a.decision_id === d.id)
            return (
              <article
                key={d.id}
                className="rounded-lg border border-[var(--color-ligne)] p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="chiffre text-xs font-semibold text-[var(--color-encre-doux)]">
                    N° {d.numero}
                  </span>
                  <h3 className="font-semibold">{d.titre}</h3>
                  <span className="text-xs text-[var(--color-encre-doux)]">
                    {dateLongue(d.date)} · {d.categorie}
                  </span>
                  <span
                    className={`ml-auto rounded px-2 py-0.5 text-xs font-semibold ${
                      d.est_unanime
                        ? 'bg-green-50 text-[var(--color-positif)]'
                        : d.nb_approbations > 0
                          ? 'bg-orange-50 text-[var(--color-attention)]'
                          : 'bg-[var(--color-fond)] text-[var(--color-encre-doux)]'
                    }`}
                  >
                    {d.est_unanime
                      ? 'Unanime'
                      : `${d.nb_approbations} approbation sur ${d.nb_associes}`}
                  </span>
                </div>

                <p className="mt-2 text-sm text-[var(--color-encre-doux)]">{d.description}</p>
                <p className="mt-2 rounded bg-[var(--color-fond)] px-3 py-2 text-sm">
                  <span className="font-semibold">Décision : </span>
                  {d.decision}
                </p>
                {d.notes && (
                  <p className="mt-2 text-xs text-[var(--color-encre-doux)]">Notes : {d.notes}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {approbations.map((a) => (
                    <form action={approuver} key={a.associe_id}>
                      <input type="hidden" name="decision_id" value={d.id} />
                      <input type="hidden" name="associe_id" value={a.associe_id} />
                      <input type="hidden" name="approuve" value={a.approuve ? '0' : '1'} />
                      <button
                        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                          a.approuve
                            ? 'border-[var(--color-positif)] bg-green-50 text-[var(--color-positif)]'
                            : 'border-[var(--color-ligne)] bg-white text-[var(--color-encre-doux)]'
                        }`}
                      >
                        <span aria-hidden>{a.approuve ? '☑' : '☐'}</span>
                        <span className="font-medium">{a.nom}</span>
                        {a.approuve && a.date_approbation && (
                          <span className="text-xs opacity-80">
                            {dateCourte(a.date_approbation.slice(0, 10))}
                          </span>
                        )}
                      </button>
                    </form>
                  ))}
                </div>
              </article>
            )
          })}
        </div>

        <FormulaireDecision action={enregistrerDecision} categories={CATEGORIES_DECISION} />
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
