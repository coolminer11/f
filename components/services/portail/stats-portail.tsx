import Link from 'next/link'
import type { StatsService } from '@/lib/services/stats'
import { drapeau, nomLangue } from '@/lib/services/langues'
import { CarteChaleur, GraphiqueColonnes, GraphiqueLignes } from '@/components/graphiques'
import Inclinaison from '@/components/effets/inclinaison'
import { TEXTES_PORTAIL, type LanguePortail } from '@/components/services/portail/textes'
import Chiffre, { type GenreChiffre } from '@/components/services/portail/chiffre'

export const PERIODES = [7, 30, 90] as const
export type Periode = (typeof PERIODES)[number]

const locale = (l: LanguePortail) => (l === 'fr' ? 'fr-CA' : 'en-CA')

/** Variation en % contre la période d'avant (null : rien à comparer). */
function variation(actuel: number, avant: number): number | 'nouveau' | null {
  if (!avant) return actuel ? 'nouveau' : null
  return Math.round(((actuel - avant) / avant) * 100)
}

/**
 * Les statistiques de l'établissement, vues par l'équipe : visites, demandes,
 * rapidité, notes, et ce que les clients regardent. Rendu serveur ; seuls les
 * graphiques (survol, clavier) sont des composants client.
 */
export default function StatsPortail({
  s,
  l,
  jeton,
  periode,
  type,
  fuseau,
}: {
  s: StatsService
  l: LanguePortail
  jeton: string
  periode: Periode
  type: 'restaurant' | 'hotel'
  fuseau: string
}) {
  const T = TEXTES_PORTAIL[l]
  const n = new Intl.NumberFormat(locale(l))
  const n1 = new Intl.NumberFormat(locale(l), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const jourCourt = (j: string) => new Date(`${j}T12:00:00`).toLocaleDateString(locale(l), { day: 'numeric', month: 'short' })
  const jourLong = (j: string) => new Date(`${j}T12:00:00`).toLocaleDateString(locale(l), { weekday: 'long', day: 'numeric', month: 'long' })
  const heure = (h: number) => (l === 'fr' ? `${h} h` : `${h}:00`)
  const vide = s.ouvertures === 0 && s.demandes === 0 && s.nbRetours === 0
  const totalLangues = s.langues.reduce((a, x) => a + x.n, 0)
  const maxType = Math.max(1, ...s.parType.map((x) => x.n))
  const maxPlat = Math.max(1, ...s.topPlats.map((x) => x.vues))
  const maxRub = Math.max(1, ...s.topRubriques.map((x) => x.vues))
  const maxNote = Math.max(1, ...s.repartition)
  const lieux = [...s.parEmplacement].sort((a, b) => b.demandes - a.demandes || b.ouvertures - a.ouvertures)

  return (
    <div className="space-y-5">
      {/* ---- Période */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="titre-portail text-2xl font-medium">{T.onglets.stats}</h1>
        <nav className="pt-onglets" aria-label={T.periode(periode)}>
          {PERIODES.map((p) => (
            <Link key={p} href={`/service/${jeton}?v=stats&p=${p}`} className="pt-onglet" aria-current={p === periode ? 'page' : undefined} scroll={false}>
              {T.periode(p)}
            </Link>
          ))}
        </nav>
      </div>

      {/* ---- Indicateurs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          l={l}
          libelle={T.visites}
          valeur={s.ouvertures}
          sous={T.visitesSous}
          delta={variation(s.ouvertures, s.ouverturesPrec)}
          etincelle={s.parJour.map((j) => j.ouvertures)}
          premium
        />
        <Kpi
          l={l}
          libelle={T.demandes}
          valeur={s.demandes}
          sous={T.periode(periode)}
          delta={variation(s.demandes, s.demandesPrec)}
          etincelle={s.parJour.map((j) => j.demandes)}
        />
        <Kpi l={l} libelle={T.reponse} valeur={s.reponseMediane === null ? null : Math.round(s.reponseMediane)} genre="duree" sous={T.reponseSous} />
        <Kpi
          l={l}
          libelle={T.rapides}
          valeur={s.pctRapides}
          genre="pct"
          ton={s.pctRapides === null ? undefined : s.pctRapides >= 80 ? 'vert' : s.pctRapides >= 50 ? 'ambre' : 'rouge'}
        />
        <Kpi
          l={l}
          libelle={T.note}
          valeur={s.note}
          genre="note"
          suffixe=" ★"
          sous={T.noteSous(s.nbRetours)}
          ton={s.note === null ? undefined : s.note >= 4.3 ? 'vert' : s.note >= 3.5 ? 'ambre' : 'rouge'}
        />
        <Kpi l={l} libelle={T.google} valeur={s.googleClics} sous={T.googleSous} />
      </div>

      {vide ? (
        <div className="pt-carte-plate flex flex-col items-center gap-2 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-[var(--p-surface)] text-2xl shadow-sm" aria-hidden>
            📊
          </span>
          <p className="max-w-sm text-sm text-[var(--p-doux)]">{T.rien}</p>
        </div>
      ) : (
        <>
          {/* ---- Jour par jour */}
          <Carte titre={T.parJour} sous={T.parJourSous}>
            <GraphiqueLignes
              langue={l}
              series={[
                { nom: T.visites, slot: 1, valeurs: s.parJour.map((j) => j.ouvertures) },
                { nom: T.demandes, slot: 2, valeurs: s.parJour.map((j) => j.demandes) },
              ]}
              etiquettes={s.parJour.map((j) => jourCourt(j.jour))}
              details={s.parJour.map((j) => jourLong(j.jour))}
              unite=""
              hauteur={200}
              pasEtiquettes={periode === 7 ? 1 : periode === 30 ? 5 : 15}
              resume={`${T.parJour} : ${n.format(s.ouvertures)} ${T.visites.toLowerCase()}, ${n.format(s.demandes)} ${T.demandes.toLowerCase()}`}
            />
          </Carte>

          <div className="cascade grid gap-5 lg:grid-cols-2">
            <Carte titre={T.parHeure} sous={T.parHeureSous}>
              <GraphiqueColonnes
                langue={l}
                barres={s.parHeure.map((h) => ({ etiquette: heure(h.heure), detail: `${heure(h.heure)} – ${heure((h.heure + 1) % 24)}`, valeur: h.demandes }))}
                unite={T.demandes.toLowerCase()}
                pasEtiquettes={3}
                hauteur={180}
                resume={T.parHeureSous}
              />
            </Carte>
            <Carte titre={T.chaleur} sous={T.chaleurSous}>
              <CarteChaleur langue={l} cases={s.grille.map((c) => ({ jour: c.jour, heure: c.heure, taps: c.n }))} resume={T.chaleurSous} />
            </Carte>
          </div>

          {/* ---- Ce que les clients font */}
          <div className="cascade grid gap-5 lg:grid-cols-2">
            <Carte titre={T.parType}>
              {s.parType.length === 0 ? (
                <Rien l={l} />
              ) : (
                <ul className="space-y-3">
                  {s.parType.map((x) => (
                    <Ligne
                      key={x.cle}
                      icone={x.icone ?? '🔔'}
                      libelle={x.libelle}
                      valeur={n.format(x.n)}
                      pct={x.n / maxType}
                      sous={s.demandes ? `${Math.round((x.n / s.demandes) * 100)} %` : undefined}
                    />
                  ))}
                </ul>
              )}
            </Carte>

            {type === 'hotel' && s.topRubriques.length > 0 ? (
              <Carte titre={T.topRubriques}>
                <ul className="space-y-3">
                  {s.topRubriques.map((x, i) => (
                    <Ligne key={x.id} icone={String(i + 1)} libelle={x.titre} valeur={`${n.format(x.vues)} ${T.vues}`} pct={x.vues / maxRub} rang />
                  ))}
                </ul>
              </Carte>
            ) : (
              <Carte titre={T.topPlats} sous={`${n.format(s.vuesMenu)} × ${T.menu.toLowerCase()}`}>
                {s.topPlats.length === 0 ? (
                  <Rien l={l} />
                ) : (
                  <ul className="space-y-3">
                    {s.topPlats.map((x, i) => (
                      <Ligne key={x.id} icone={String(i + 1)} libelle={x.nom} valeur={`${n.format(x.vues)} ${T.vues}`} pct={x.vues / maxPlat} rang />
                    ))}
                  </ul>
                )}
              </Carte>
            )}
          </div>

          {/* Un hôtel avec room service : les plats aussi. */}
          {type === 'hotel' && s.topRubriques.length > 0 && s.topPlats.length > 0 && (
            <Carte titre={T.topPlats} sous={`${n.format(s.vuesMenu)} × ${T.menu.toLowerCase()}`}>
              <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                {s.topPlats.map((x, i) => (
                  <Ligne key={x.id} icone={String(i + 1)} libelle={x.nom} valeur={`${n.format(x.vues)} ${T.vues}`} pct={x.vues / maxPlat} rang />
                ))}
              </ul>
            </Carte>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Carte titre={T.langues}>
              {totalLangues === 0 ? (
                <Rien l={l} />
              ) : (
                <ul className="space-y-3">
                  {s.langues.map((x) => (
                    <Ligne
                      key={x.langue}
                      icone={drapeau(x.langue)}
                      libelle={nomLangue(x.langue)}
                      valeur={`${Math.round((x.n / totalLangues) * 100)} %`}
                      pct={x.n / totalLangues}
                    />
                  ))}
                </ul>
              )}
              <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-sep pt-4 text-sm">
                <div>
                  <p className="text-xs text-[var(--p-doux)]">📶 {T.wifi}</p>
                  <p className="pt-valeur mt-1 text-2xl">{n.format(s.wifi)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--p-doux)]">📄 {T.pdf}</p>
                  <p className="pt-valeur mt-1 text-2xl">{n.format(s.pdf)}</p>
                </div>
              </div>
            </Carte>

            <Carte titre={T.parEmplacement}>
              {lieux.length === 0 ? (
                <Rien l={l} />
              ) : (
                <div className="-mx-2 max-h-[26rem] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[var(--p-surface)] text-left text-xs text-[var(--p-faible)]">
                      <tr>
                        <th className="px-2 py-2 font-semibold">{T.emplacement}</th>
                        <th className="px-2 py-2 text-right font-semibold">{T.visites}</th>
                        <th className="px-2 py-2 text-right font-semibold">{T.demandes}</th>
                        <th className="px-2 py-2 text-right font-semibold">{T.note}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--p-ligne)]">
                      {lieux.map((x) => (
                        <tr key={x.id}>
                          <td className="px-2 py-2.5">
                            <span className="font-semibold">{x.libelle}</span>
                            {x.groupe && <span className="ml-2 text-xs text-[var(--p-faible)]">{x.groupe}</span>}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums">{n.format(x.ouvertures)}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums">{n.format(x.demandes)}</td>
                          <td className={`px-2 py-2.5 text-right tabular-nums ${x.note !== null && x.note < 3.5 ? 'font-semibold text-[var(--p-rouge)]' : ''}`}>
                            {x.note === null ? '—' : `${n1.format(x.note)} ★`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Carte>
          </div>

          {/* ---- Notes */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Carte titre={T.repartition} sous={T.noteSous(s.nbRetours)}>
              <div className="flex items-end gap-4">
                <p className="pt-valeur text-5xl">{s.note === null ? '—' : <Chiffre valeur={s.note} genre="note" l={l} />}</p>
                <p className="pb-1.5 text-lg tracking-[0.1em] text-[var(--p-ambre)]" aria-hidden>
                  {'★'.repeat(Math.round(s.note ?? 0))}
                  <span className="text-[var(--p-ligne-forte)]">{'★'.repeat(5 - Math.round(s.note ?? 0))}</span>
                </p>
              </div>
              <ul className="mt-5 space-y-2">
                {[5, 4, 3, 2, 1].map((etoiles) => {
                  const v = s.repartition[etoiles - 1] ?? 0
                  return (
                    <li key={etoiles} className="flex items-center gap-3 text-sm">
                      <span className="w-8 shrink-0 tabular-nums text-[var(--p-doux)]">{etoiles} ★</span>
                      <span className="pt-barre flex-1">
                        <span
                          style={{
                            width: `${(v / maxNote) * 100}%`,
                            background: etoiles >= 4 ? 'var(--p-vert)' : etoiles === 3 ? 'var(--p-ambre)' : 'var(--p-rouge)',
                          }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right tabular-nums">{n.format(v)}</span>
                    </li>
                  )
                })}
              </ul>
            </Carte>

            <Carte titre={T.derniersCommentaires}>
              {s.commentaires.length === 0 ? (
                <Rien l={l} />
              ) : (
                <ul className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
                  {s.commentaires.map((c, i) => (
                    <li
                      key={i}
                      className={`rounded-2xl border p-4 ${c.note <= 2 ? 'border-[color-mix(in_oklab,var(--p-rouge)_35%,transparent)] bg-[var(--p-rouge-pale)]' : c.note === 3 ? 'border-transparent bg-[var(--p-ambre-pale)]' : 'border-transparent bg-[var(--p-surface-2)]'}`}
                    >
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold tracking-[0.08em] text-[var(--p-ambre)]">
                          {'★'.repeat(c.note)}
                          <span className="text-[var(--p-ligne-forte)]">{'★'.repeat(5 - c.note)}</span>
                        </span>
                        <span className="text-[var(--p-faible)]">
                          {c.emplacement ?? ''}
                          {c.emplacement ? ' · ' : ''}
                          {new Date(c.cree_le).toLocaleDateString(locale(l), { day: 'numeric', month: 'short', timeZone: fuseau })}
                        </span>
                      </div>
                      <p className={`mt-2 text-[15px] leading-relaxed ${c.commentaire ? '' : 'italic text-[var(--p-faible)]'}`}>
                        {c.commentaire ?? T.sansCommentaire}
                      </p>
                      {c.google && <p className="mt-2 text-xs font-semibold text-[var(--p-vert)]">↗ {T.googleClique}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          </div>
        </>
      )}
    </div>
  )
}

const TON = { vert: 'text-[var(--p-vert)]', ambre: 'text-[var(--p-ambre)]', rouge: 'text-[var(--p-rouge)]' } as const

/** Une petite courbe (aire + trait) qui se dessine à l'arrivée ; pathLength=1 rend le tracé indépendant de la longueur. */
function Etincelle({ valeurs }: { valeurs: number[] }) {
  if (valeurs.length < 2) return null
  const max = Math.max(1, ...valeurs)
  const pts = valeurs.map((v, i) => [(i / (valeurs.length - 1)) * 100, 28 - (v / max) * 24] as const)
  const trait = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  return (
    <svg className="pt-etincelle mt-3 h-8 w-full overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
      <path className="pt-aire" d={`${trait} L100,30 L0,30 Z`} fill="var(--accent-pale)" opacity="0.8" />
      <path
        className="pt-trait"
        d={trait}
        pathLength={1}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function Kpi({
  l,
  libelle,
  valeur,
  genre = 'nombre',
  suffixe,
  sous,
  delta,
  ton,
  etincelle,
  premium,
}: {
  l: LanguePortail
  libelle: string
  valeur: number | null
  genre?: GenreChiffre
  suffixe?: string
  sous?: string
  delta?: number | 'nouveau' | null
  ton?: 'vert' | 'ambre' | 'rouge'
  etincelle?: number[]
  premium?: boolean
}) {
  const T = TEXTES_PORTAIL[l]
  return (
    // L'apparition anime le support, l'inclinaison la carte.
    <div className="pt-apparait">
      <Inclinaison className="h-full" intensite={6}>
        <div className={`pt-kpi flex h-full flex-col ${premium ? 'reflet-premium' : ''}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--p-doux)]">{libelle}</p>
          <p className={`pt-valeur mt-2 text-[2rem] ${ton ? TON[ton] : ''}`}>
            {valeur === null ? '—' : <Chiffre valeur={valeur} genre={genre} l={l} />}
            {valeur !== null && suffixe && <span className="ml-1 text-[0.6em] text-[var(--p-or)]">{suffixe.trim()}</span>}
          </p>
          {etincelle && <Etincelle valeurs={etincelle} />}
          <p className="mt-auto pt-2 text-xs text-[var(--p-faible)]">
            {delta === 'nouveau' ? (
              <span className="pt-hausse font-semibold">{T.nouveau}</span>
            ) : typeof delta === 'number' ? (
              <span className={delta > 0 ? 'pt-hausse font-semibold' : delta < 0 ? 'pt-baisse font-semibold' : ''}>
                {delta > 0 ? '↑ ' : delta < 0 ? '↓ ' : ''}
                {delta === 0 ? T.stable : T.vsAvant(delta)}
              </span>
            ) : (
              sous
            )}
          </p>
        </div>
      </Inclinaison>
    </div>
  )
}

function Carte({ titre, sous, children }: { titre: string; sous?: string; children: React.ReactNode }) {
  return (
    <section className="pt-carte p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="titre-portail text-lg font-medium leading-tight">{titre}</h2>
        {sous && <p className="mt-0.5 text-sm text-[var(--p-doux)]">{sous}</p>}
      </div>
      {children}
    </section>
  )
}

function Ligne({ icone, libelle, valeur, pct, sous, rang }: { icone: string; libelle: string; valeur: string; pct: number; sous?: string; rang?: boolean }) {
  return (
    <li>
      <div className="flex items-center gap-3 text-sm">
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-lg ${rang ? 'bg-[var(--p-surface-2)] text-xs font-bold text-[var(--p-doux)]' : 'text-base'}`}
          aria-hidden
        >
          {icone}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{libelle}</span>
        {sous && <span className="text-xs text-[var(--p-faible)]">{sous}</span>}
        <span className="shrink-0 font-semibold tabular-nums">{valeur}</span>
      </div>
      <div className="pt-barre ml-10 mt-1.5">
        <span style={{ width: `${Math.max(2, Math.round(pct * 100))}%` }} />
      </div>
    </li>
  )
}

function Rien({ l }: { l: LanguePortail }) {
  return <p className="py-6 text-center text-sm text-[var(--p-doux)]">{TEXTES_PORTAIL[l].rien}</p>
}
