import Link from 'next/link'
import type { Metadata } from 'next'
import { exigerSession } from '@/lib/auth'
import { equipe, MESURES, type Membre } from '@/lib/equipe'
import OngletsAssocies from '@/components/onglets-associes'
import { enregistrerRoleAction, enregistrerSemaineAction } from '@/app/associes/actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Qui fait quoi — Tapora' }

const jourCourt = (iso: string, plus = 0) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) + plus * 86_400_000).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', timeZone: 'UTC' })

const initiales = (nom: string) =>
  nom
    .split(/\s+/)
    .map((m) => m[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

function couleurScore(s: number | null): string {
  if (s === null) return 'bg-[var(--color-fond)] text-[var(--color-encre-doux)]'
  if (s >= 0.8) return 'bg-[#e9f2ea] text-[var(--color-positif)]'
  if (s >= 0.5) return 'bg-[#fdf3dc] text-[#8a5a00]'
  return 'bg-[#fbebe4] text-[var(--color-negatif)]'
}
const pct = (s: number | null) => (s === null ? '—' : `${Math.round(s * 100)} %`)

/**
 * Qui fait quoi : le rôle de chacun, ses responsabilités et ses objectifs de
 * la semaine. Chacun entre ses propres chiffres ; les chiffres comptés par
 * l'app ne se discutent pas. Le point se fait le lundi.
 */
export default async function PageRoles({ searchParams }: { searchParams: Promise<{ semaine?: string; message?: string; erreur?: string }> }) {
  const moi = await exigerSession()
  const sp = await searchParams
  const membres = await equipe()
  const semaines = membres[0]?.semaines.map((s) => s.semaine) ?? []
  const semaine = semaines.includes(sp.semaine ?? '') ? sp.semaine! : semaines[0]
  const rang = semaines.indexOf(semaine)
  const ecriture = moi.role !== 'lecture'
  // Seules les semaines où au moins un objectif comptait vont dans l'historique.
  const historique = semaines.filter((s) => membres.some((m) => m.semaines.find((c) => c.semaine === s)?.score !== null))

  return (
    <div className="space-y-5">
      <OngletsAssocies actif="/associes/roles" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--police-fraunces)] text-2xl font-semibold tracking-tight">Qui fait quoi</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            Le rôle de chacun et ses objectifs de la semaine. Chacun entre ses propres chiffres ; ceux marqués « auto » sont comptés par l’app.
          </p>
        </div>
        {semaine && (
          <nav className="flex items-center gap-1 rounded-full bg-[var(--color-fond)] p-1 text-sm" aria-label="Semaine">
            {rang < semaines.length - 1 ? (
              <Link href={`?semaine=${semaines[rang + 1]}`} className="rounded-full px-3 py-1 text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]" aria-label="Semaine précédente">
                ‹
              </Link>
            ) : (
              <span className="px-3 py-1 opacity-30">‹</span>
            )}
            <span className="px-2 font-medium">
              {rang === 0 ? 'Cette semaine' : `Semaine du ${jourCourt(semaine)}`}
              <span className="ml-1.5 text-xs text-[var(--color-encre-doux)]">
                {jourCourt(semaine)} – {jourCourt(semaine, 6)}
              </span>
            </span>
            {rang > 0 ? (
              <Link href={rang === 1 ? '?' : `?semaine=${semaines[rang - 1]}`} className="rounded-full px-3 py-1 text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]" aria-label="Semaine suivante">
                ›
              </Link>
            ) : (
              <span className="px-3 py-1 opacity-30">›</span>
            )}
          </nav>
        )}
      </div>

      {sp.erreur && <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">{sp.erreur}</p>}
      {sp.message && <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">{sp.message}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        {membres.map((m) => (
          <CarteMembre key={m.associe_id} m={m} semaine={semaine} mien={m.associe_id === moi.associe_id} ecriture={ecriture} />
        ))}
      </div>

      {historique.length > 0 && (
        <section className="carte overflow-x-auto p-5">
          <h2 className="text-sm font-semibold">Les dernières semaines</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">Part des objectifs atteints, chacun plafonné à 100 %.</p>
          <table className="mt-3 w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-encre-doux)]">
                <th className="py-1.5 pr-3 font-medium" />
                {historique.map((s) => (
                  <th key={s} className="px-1 py-1.5 text-center font-medium">
                    {s === semaines[0] ? 'Cette sem.' : jourCourt(s)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {membres.map((m) => (
                <tr key={m.associe_id} className="border-t border-[var(--color-ligne)]">
                  <td className="whitespace-nowrap py-2 pr-3 font-medium">{m.nom.split(' ')[0]}</td>
                  {historique.map((s) => {
                    const c = m.semaines.find((x) => x.semaine === s)
                    return (
                      <td key={s} className="px-1 py-2 text-center">
                        <Link href={s === semaines[0] ? '?' : `?semaine=${s}`} className={`inline-block min-w-14 rounded-full px-2 py-1 text-xs font-semibold tabular-nums ${couleurScore(c?.score ?? null)} ${s === semaine ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''}`}>
                          {pct(c?.score ?? null)}
                        </Link>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="carte p-5">
        <h2 className="text-sm font-semibold">Le point du lundi — 15 minutes</h2>
        <ol className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Les chiffres', 'Chacun entre sa semaine ici avant le point. On regarde, on ne débat pas des chiffres.'],
            ['Ce qui a bloqué', 'Un obstacle chacun, et qui peut aider.'],
            ['La semaine qui vient', 'On ajuste les objectifs si besoin, ensemble.'],
            ['Une décision ?', 'Elle va au registre des décisions, et chacun l’approuve.'],
          ].map(([titre, texte], i) => (
            <li key={titre} className="rounded-xl bg-[var(--color-fond)] p-3">
              <span className="text-xs font-semibold text-[var(--color-accent)]">{i + 1}</span>
              <strong className="mt-0.5 block">{titre}</strong>
              <span className="text-xs leading-relaxed text-[var(--color-encre-doux)]">{texte}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function CarteMembre({ m, semaine, mien, ecriture }: { m: Membre; semaine: string; mien: boolean; ecriture: boolean }) {
  const c = m.semaines.find((s) => s.semaine === semaine)
  const saisie = mien && ecriture && m.objectifs.some((o) => o.mesure === 'manuel' && c && o.id in c.valeurs)
  const lignes = (
    <ul className="space-y-3">
      {m.objectifs.map((o) => {
        const compte = !!c && o.id in c.valeurs
        const valeur = c?.valeurs[o.id] ?? null
        const ratio = Math.min(1, (valeur ?? 0) / o.cible)
        const auto = o.mesure !== 'manuel'
        return (
          <li key={o.id} className={compte ? '' : 'opacity-50'}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{o.libelle}</span>
                {auto && (
                  <span className="ml-1.5 rounded-full bg-[var(--color-fond)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-encre-doux)]" title={MESURES[o.mesure]}>
                    auto
                  </span>
                )}
              </span>
              {saisie && !auto ? (
                <span className="flex shrink-0 items-center gap-1.5 text-sm tabular-nums">
                  <input
                    name={`val_${o.id}`}
                    type="number"
                    min={0}
                    max={100000}
                    inputMode="numeric"
                    defaultValue={valeur ?? ''}
                    placeholder="0"
                    className="champ py-1 text-right"
                    style={{ width: '4.25rem' }}
                    aria-label={`${o.libelle}, cette semaine`}
                  />
                  <span className="whitespace-nowrap text-[var(--color-encre-doux)]">/ {o.cible}</span>
                </span>
              ) : (
                <span className="shrink-0 whitespace-nowrap text-sm tabular-nums">
                  <strong>{compte ? (valeur ?? '—') : '—'}</strong>
                  <span className="text-[var(--color-encre-doux)]"> / {o.cible}</span>
                </span>
              )}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-grille)]" aria-hidden>
              <div
                className={`h-full rounded-full transition-[width] duration-700 ${ratio >= 1 ? 'bg-[var(--color-positif)]' : 'bg-[var(--color-accent)]'}`}
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )

  return (
    <section className={`carte overflow-hidden ${mien ? 'ring-1 ring-[var(--color-accent)]/40' : ''}`}>
      <div className="flex items-start gap-4 border-b border-[var(--color-ligne)] bg-[linear-gradient(110deg,var(--color-accent-doux),transparent_75%)] p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-accent)] text-base font-bold text-white shadow-sm">{initiales(m.nom)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{m.nom}</span>
            {mien && <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">Vous</span>}
          </div>
          <h2 className="mt-0.5 font-[family-name:var(--police-fraunces)] text-xl font-semibold leading-tight">{m.titre ?? 'Rôle à définir'}</h2>
          {m.mission && <p className="mt-1 text-sm leading-relaxed text-[var(--color-encre-doux)]">{m.mission}</p>}
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-encre-doux)]">Responsabilités</h3>
          {m.responsabilites.length ? (
            <ul className="mt-2 space-y-2">
              {m.responsabilites.map((r) => (
                <li key={r.id} className="flex gap-2 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" aria-hidden />
                  <span>
                    <span className="font-medium">{r.libelle}</span>
                    {r.detail && <span className="block text-xs leading-relaxed text-[var(--color-encre-doux)]">{r.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[var(--color-encre-doux)]">Aucune pour l’instant.</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-encre-doux)]">Objectifs de la semaine</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${couleurScore(c?.score ?? null)}`}>{pct(c?.score ?? null)}</span>
          </div>
          <div className="mt-2">
            {!m.objectifs.length ? (
              <p className="text-sm text-[var(--color-encre-doux)]">Aucun objectif.</p>
            ) : saisie ? (
              <form action={enregistrerSemaineAction} className="space-y-3">
                <input type="hidden" name="semaine" value={semaine} />
                {lignes}
                <button className="bouton w-full py-1.5 text-sm">Enregistrer ma semaine</button>
              </form>
            ) : (
              lignes
            )}
          </div>
        </div>
      </div>

      {ecriture && (
        <details className="border-t border-[var(--color-ligne)] px-5 py-3 print:hidden">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]">
            Modifier le rôle{m.maj_le && <span className="font-normal"> · modifié le {new Date(m.maj_le).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', timeZone: 'America/Toronto' })}{m.maj_par ? ` par ${m.maj_par}` : ''}</span>}
          </summary>
          <form action={enregistrerRoleAction} className="mt-3 space-y-3">
            <input type="hidden" name="associe_id" value={m.associe_id} />
            <div>
              <label className="etiquette" htmlFor={`titre-${m.associe_id}`}>Titre du rôle</label>
              <input id={`titre-${m.associe_id}`} name="titre" className="champ" required maxLength={80} defaultValue={m.titre ?? ''} />
            </div>
            <div>
              <label className="etiquette" htmlFor={`mission-${m.associe_id}`}>Mission</label>
              <textarea id={`mission-${m.associe_id}`} name="mission" rows={2} maxLength={400} className="champ resize-y" defaultValue={m.mission ?? ''} />
            </div>
            <div>
              <label className="etiquette" htmlFor={`resp-${m.associe_id}`}>Responsabilités — une par ligne, « Libellé — détail »</label>
              <textarea
                id={`resp-${m.associe_id}`}
                name="responsabilites"
                rows={Math.max(4, m.responsabilites.length + 1)}
                className="champ resize-y font-mono text-xs"
                defaultValue={m.responsabilites.map((r) => (r.detail ? `${r.libelle} — ${r.detail}` : r.libelle)).join('\n')}
              />
            </div>
            <fieldset>
              <legend className="etiquette">Objectifs de la semaine</legend>
              <input type="hidden" name="obj_n" value={m.objectifs.length + 2} />
              <div className="space-y-2">
                {[...m.objectifs, null, null].map((o, i) => (
                  <div key={o?.id ?? `nouveau-${i}`} className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,11rem)_auto] sm:items-center">
                    <input type="hidden" name={`obj_${i}_id`} value={o?.id ?? ''} />
                    <input name={`obj_${i}_libelle`} className="champ py-1.5 text-sm" maxLength={80} defaultValue={o?.libelle ?? ''} placeholder={o ? '' : 'Nouvel objectif'} aria-label="Objectif" />
                    <input name={`obj_${i}_cible`} type="number" min={1} max={1000} className="champ py-1.5 text-sm" defaultValue={o?.cible ?? 1} aria-label="Cible par semaine" />
                    <select name={`obj_${i}_mesure`} className="champ col-span-2 py-1.5 text-sm sm:col-span-1" defaultValue={o?.mesure ?? 'manuel'} aria-label="Comment c’est mesuré">
                      {Object.entries(MESURES).map(([k, libelle]) => (
                        <option key={k} value={k}>{libelle}</option>
                      ))}
                    </select>
                    {o ? (
                      <label className="col-span-2 flex items-center gap-1.5 text-xs text-[var(--color-encre-doux)] sm:col-span-1">
                        <input type="checkbox" name={`obj_${i}_supprimer`} className="size-3.5 accent-[var(--color-negatif)]" /> Retirer
                      </label>
                    ) : (
                      <span className="hidden sm:block" />
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-[var(--color-encre-doux)]">« Compté par l’app » vaut pour toute l’équipe : l’app ne note pas qui a créé un dossier ou une carte.</p>
            </fieldset>
            <button className="bouton text-sm">Enregistrer le rôle</button>
          </form>
        </details>
      )}
    </section>
  )
}
