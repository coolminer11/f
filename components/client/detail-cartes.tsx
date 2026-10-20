import { parGroupe, type LigneClassement } from '@/lib/requetes/classement'
import { depuisL, locale, type Langue } from '@/lib/langue'

const TX = {
  fr: {
    surtitre: 'Statistiques détaillées',
    titre: 'Carte par carte',
    sous: (j: number) => `Les ${j} derniers jours, comparés aux ${j} d’avant.`,
    groupes: 'Par groupe',
    sansGroupe: 'Sans groupe',
    cartes: (n: number) => `${n} carte${n > 1 ? 's' : ''}`,
    carte: 'Carte',
    taps: 'Taps',
    evolution: 'Évolution',
    total: 'Depuis la pose',
    dernier: 'Dernier tap',
    nouveau: 'nouveau',
    silence: (j: number) => `rien depuis ${j} jours`,
    jamais: 'pas encore tapée',
    voirTout: (n: number) => `Voir les ${n} cartes`,
    exporter: 'Télécharger le détail (CSV)',
    exporterSous: 'Une ligne par carte et par jour : à ouvrir dans Excel ou Google Sheets.',
    aVerifier: (n: number) => `${n} carte${n > 1 ? 's' : ''} sans tap depuis 14 jours ou plus : un coup d’œil à leur emplacement ?`,
  },
  en: {
    surtitre: 'Detailed statistics',
    titre: 'Card by card',
    sous: (j: number) => `The last ${j} days, compared with the ${j} before.`,
    groupes: 'By group',
    sansGroupe: 'No group',
    cartes: (n: number) => `${n} card${n > 1 ? 's' : ''}`,
    carte: 'Card',
    taps: 'Taps',
    evolution: 'Change',
    total: 'Since installation',
    dernier: 'Last tap',
    nouveau: 'new',
    silence: (j: number) => `nothing for ${j} days`,
    jamais: 'not tapped yet',
    voirTout: (n: number) => `See all ${n} cards`,
    exporter: 'Download the details (CSV)',
    exporterSous: 'One row per card per day: open it in Excel or Google Sheets.',
    aVerifier: (n: number) => `${n} card${n > 1 ? 's' : ''} without a tap for 14 days or more: worth checking where ${n > 1 ? 'they are' : 'it is'}?`,
  },
}

const VISIBLES = 10
const SILENCE = 14

function Evolution({ courant, precedent, langue }: { courant: number; precedent: number; langue: Langue }) {
  if (precedent === 0)
    return courant > 0 ? <span className="text-xs font-semibold text-[#2f6b4f]">{TX[langue].nouveau}</span> : <span className="text-[#a8998a]">—</span>
  const pct = Math.round(((courant - precedent) / precedent) * 100)
  if (pct === 0) return <span className="text-xs text-[#6b5d50]">=</span>
  return (
    <span className={`text-xs font-semibold tabular-nums ${pct > 0 ? 'text-[#2f6b4f]' : 'text-[#b0402a]'}`}>
      {pct > 0 ? '▲' : '▼'} {Math.abs(pct)}
      {langue === 'fr' ? ' %' : '%'}
    </span>
  )
}

/**
 * Pour les commerces à plusieurs cartes : le classement complet, les totaux
 * par groupe (si Tapora en a défini) et l'export pour le tableur.
 */
export default function DetailCartes({ lignes, jours, langue, lienExport }: { lignes: LigneClassement[]; jours: number; langue: Langue; lienExport: string }) {
  if (lignes.length < 2) return null
  const T = TX[langue]
  const nf = new Intl.NumberFormat(locale(langue))
  const groupes = lignes.some((l) => l.groupe) ? parGroupe(lignes) : []
  const max = Math.max(1, ...lignes.map((l) => l.courant))
  const aVerifier = lignes.filter((l) => l.jours_silence !== null && l.jours_silence >= SILENCE).length

  const ligne = (l: LigneClassement, i: number) => {
    // « Bar » dans le groupe « Bar » : inutile de le dire deux fois.
    const groupe = l.groupe && l.groupe.toLowerCase() !== l.libelle.toLowerCase() ? l.groupe : null
    return (
      <tr key={l.id} className="border-t border-[#efe5d6]">
        <td className="w-8 py-2.5 pr-2 text-right text-xs tabular-nums text-[#a8998a]">{i + 1}</td>
        <td className="py-2.5 pr-3">
          <span className="block font-medium">{l.libelle}</span>
          <span className="relative mt-1 block h-1.5 overflow-hidden rounded-full bg-[#f3ebdf]" aria-hidden>
            <span className="absolute inset-y-0 left-0 rounded-full bg-[#c2552f]" style={{ width: `${(l.courant / max) * 100}%` }} />
          </span>
          {(groupe || l.jours_silence === null || l.jours_silence >= SILENCE) && (
            <span className="mt-1 block text-xs text-[#6b5d50]">
              {groupe}
              {groupe && (l.jours_silence === null || l.jours_silence >= SILENCE) ? ' · ' : ''}
              {l.jours_silence === null ? T.jamais : l.jours_silence >= SILENCE ? <span className="text-[#b0402a]">{T.silence(l.jours_silence)}</span> : null}
            </span>
          )}
        </td>
        <td className="py-2.5 pr-3 text-right text-base font-semibold tabular-nums">{nf.format(l.courant)}</td>
        <td className="py-2.5 pr-3 text-right">
          <Evolution courant={l.courant} precedent={l.precedent} langue={langue} />
        </td>
        <td className="hidden py-2.5 pr-3 text-right tabular-nums text-[#6b5d50] sm:table-cell">{nf.format(l.total)}</td>
        <td className="hidden py-2.5 text-right text-xs text-[#6b5d50] md:table-cell">{depuisL(l.dernier_tap, langue)}</td>
      </tr>
    )
  }
  const entete = (
    <thead>
      <tr className="text-left text-xs text-[#6b5d50]">
        <th className="pb-2 pr-2 font-medium" />
        <th className="pb-2 pr-3 font-medium">{T.carte}</th>
        <th className="pb-2 pr-3 text-right font-medium">{T.taps}</th>
        <th className="pb-2 pr-3 text-right font-medium">{T.evolution}</th>
        <th className="hidden pb-2 pr-3 text-right font-medium sm:table-cell">{T.total}</th>
        <th className="hidden pb-2 text-right font-medium md:table-cell">{T.dernier}</th>
      </tr>
    </thead>
  )

  return (
    <section className="carte p-6 sm:p-8" id="detail" data-bloc>
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c2552f]">{T.surtitre}</span>
      <h2 className="titre-client mt-2 !text-2xl sm:!text-3xl">{T.titre}</h2>
      <p className="mt-1 text-[#6b5d50]">{T.sous(jours)}</p>

      {groupes.length > 1 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">{T.groupes}</h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groupes.map((g) => (
              <li key={g.nom ?? '—'} className="rounded-2xl bg-[#f7f1e7] p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{g.nom ?? T.sansGroupe}</span>
                  <span className="text-xs text-[#6b5d50]">{T.cartes(g.cartes)}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="titre-client text-3xl font-medium tabular-nums">{nf.format(g.courant)}</span>
                  <Evolution courant={g.courant} precedent={g.precedent} langue={langue} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#ede3d3]" aria-hidden>
                    <span className="absolute inset-y-0 left-0 rounded-full bg-[#2a211a]" style={{ width: `${g.part}%` }} />
                  </span>
                  <span className="text-xs font-semibold tabular-nums">
                    {g.part}
                    {langue === 'fr' ? ' %' : '%'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {aVerifier > 0 && <p className="mt-6 rounded-2xl bg-[#fdf3dc] px-4 py-3 text-sm text-[#6b4a05]">{T.aVerifier(aVerifier)}</p>}

      {/* Au-delà de dix cartes, le reste se déplie (une case à cocher : pas de JavaScript). */}
      <div className="group mt-6 overflow-x-auto">
        <input type="checkbox" id="detail-tout" className="sr-only" />
        <table className="w-full text-sm">
          {entete}
          <tbody>{lignes.slice(0, VISIBLES).map(ligne)}</tbody>
          {lignes.length > VISIBLES && (
            <tbody className="hidden group-has-[:checked]:table-row-group">{lignes.slice(VISIBLES).map((l, i) => ligne(l, i + VISIBLES))}</tbody>
          )}
        </table>
        {lignes.length > VISIBLES && (
          <label
            htmlFor="detail-tout"
            className="mt-3 inline-block cursor-pointer text-sm font-semibold text-[#c2552f] hover:underline group-has-[:checked]:hidden"
          >
            {T.voirTout(lignes.length)}
          </label>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-dashed border-[#e2d6c3] pt-5">
        <a href={lienExport} className="rounded-full bg-[#2a211a] px-5 py-2.5 text-sm font-semibold text-[#fffaf2] transition hover:bg-[#c2552f]" download>
          ↓ {T.exporter}
        </a>
        <span className="text-xs text-[#6b5d50]">{T.exporterSous}</span>
      </div>
    </section>
  )
}
