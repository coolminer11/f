import { PALIERS_AVIS, PALIERS_TAPS, clePalier, situer } from '@/lib/paliers'
import { locale, textes, type Langue } from '@/lib/langue'
import Celebration from '@/components/client/celebration'
import { BoutonMedaille } from '@/components/client/partage-palier'

const RAYON = 52
const CIRCONFERENCE = 2 * Math.PI * RAYON

/**
 * Les paliers : une jauge vers le prochain (ou vers l'objectif fixé avec le
 * commerce), l'estimation de la date d'arrivée, et la collection des paliers
 * déjà franchis — chacun fêté une fois, la première fois qu'on le voit.
 */
export default function Paliers({
  dossierId,
  langue,
  nbAvis,
  note,
  objectif,
  avisParJour,
  totalTaps,
}: {
  dossierId: string
  langue: Langue
  nbAvis: number | null
  note: number | null
  objectif: number | null
  avisParJour: number | null
  totalTaps: number
}) {
  const T = textes(langue)
  const fmt = new Intl.NumberFormat(locale(langue))
  const partager = langue === 'fr' ? 'Touchez une médaille gagnée pour la partager.' : 'Tap a medal you’ve earned to share it.'
  const court = new Intl.NumberFormat(locale(langue), { notation: 'compact', maximumFractionDigits: 1 })

  const avis = nbAvis !== null ? situer(nbAvis, PALIERS_AVIS) : null
  const taps = situer(totalTaps, PALIERS_TAPS)

  // La jauge principale : les avis quand on les suit, sinon les taps.
  const objectifActif = nbAvis !== null && objectif !== null && objectif > nbAvis
  const objectifAtteint = nbAvis !== null && objectif !== null && objectif <= nbAvis
  const valeur = nbAvis ?? totalTaps
  const s = avis ?? taps
  const cible = objectifActif ? objectif! : s.prochain
  const depart = s.precedent
  const avancement = cible === null ? 1 : Math.max(0, Math.min(1, (valeur - depart) / (cible - depart)))
  const restant = cible === null ? 0 : cible - valeur

  let arrivee: string | null = null
  if (nbAvis !== null && cible !== null && avisParJour) {
    const jours = Math.ceil(restant / avisParJour)
    if (jours > 0 && jours <= 730) {
      const d = new Date(Date.now() + jours * 86_400_000)
      arrivee = d.toLocaleDateString(locale(langue), { day: 'numeric', month: 'long', timeZone: 'America/Toronto' })
    }
  }

  const franchis = [
    ...(avis?.atteints ?? []).map((p) => ({ cle: clePalier('avis', p), titre: T.bravoAvis(fmt.format(p)) })),
    ...taps.atteints.map((p) => ({ cle: clePalier('taps', p), titre: T.bravoTaps(fmt.format(p)) })),
  ]

  return (
    <section className="carte p-6 sm:p-7">
      <div className="grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="relative mx-auto size-40" role="img" aria-label={`${fmt.format(valeur)} / ${cible !== null ? fmt.format(cible) : '—'}`}>
          <svg viewBox="0 0 120 120" className="size-full -rotate-90">
            <circle cx="60" cy="60" r={RAYON} fill="none" style={{ stroke: 'var(--cl-ligne-douce)' }} strokeWidth="10" />
            <circle
              data-anneau={CIRCONFERENCE}
              cx="60"
              cy="60"
              r={RAYON}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRCONFERENCE}
              style={{ stroke: 'var(--cl-brique)', strokeDashoffset: CIRCONFERENCE * (1 - avancement) }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="titre-client text-4xl font-medium leading-none tabular-nums">
                <span data-compteur={valeur}>{fmt.format(valeur)}</span>
              </div>
              {cible !== null && <div className="mt-1 text-xs text-[var(--cl-doux)]">/ {fmt.format(cible)}</div>}
            </div>
          </div>
        </div>

        <div className="text-center sm:text-left">
          <p className="text-sm font-medium text-[var(--cl-brique)]">{objectifActif ? T.objectif : T.prochainPalier}</p>
          {cible !== null ? (
            <>
              <h2 className="titre-client mt-1 !text-3xl sm:!text-4xl">
                {fmt.format(cible)} {nbAvis !== null ? T.avisGoogle : T.taps}
              </h2>
              <p className="mt-2 text-lg">
                {nbAvis !== null ? T.plusQue(restant) : `${fmt.format(restant)} ${T.taps}`}
              </p>
            </>
          ) : (
            <h2 className="titre-client mt-1 !text-3xl">{T.objectifAtteint}</h2>
          )}
          {arrivee && <p className="mt-1 text-sm text-[var(--cl-doux)]">{T.rythme(arrivee)}</p>}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {note !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cl-creme)] px-3 py-1 text-sm">
                <Etoiles note={note} />
                <strong className="tabular-nums">{note.toLocaleString(locale(langue), { minimumFractionDigits: 1 })}</strong>
              </span>
            )}
            {objectifAtteint && (
              <span className="rounded-full bg-[var(--cl-vert-pale)] px-3 py-1 text-sm font-medium text-[var(--cl-sapin)]">✓ {T.objectifAtteint}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-7 grid gap-6 border-t border-dashed border-[var(--cl-ligne)] pt-6 lg:grid-cols-2">
        {avis && <Rangee type="avis" titre={T.paliersAvis} paliers={PALIERS_AVIS} s={avis} court={court} T={T} partager={partager} />}
        <Rangee type="taps" titre={T.trophees} paliers={PALIERS_TAPS} s={taps} court={court} T={T} partager={partager} />
      </div>
      <p className="mt-4 text-xs text-[var(--cl-doux)]">{T.paliersSous} {partager}</p>

      <Celebration dossierId={dossierId} franchis={franchis} langue={langue} />
    </section>
  )
}

function Rangee({
  type,
  titre,
  paliers,
  s,
  court,
  T,
  partager,
}: {
  type: 'avis' | 'taps'
  partager: string
  titre: string
  paliers: number[]
  s: ReturnType<typeof situer>
  court: Intl.NumberFormat
  T: ReturnType<typeof textes>
}) {
  // Les quatre derniers franchis, puis les trois suivants : on voit d'où l'on
  // vient et ce qui reste à débloquer.
  const i = s.atteints.length
  const montres = paliers.slice(Math.max(0, i - 4), i + 3)
  return (
    <div>
      <h3 className="text-sm font-semibold">{titre}</h3>
      <ul className="mt-3 flex flex-wrap gap-2.5">
        {montres.map((p) => {
          const etat = p <= (s.atteints[i - 1] ?? 0) ? 'atteint' : p === s.prochain ? 'prochain' : 'avenir'
          return (
            <li key={p} className={`medaille medaille-${etat}`} title={etat === 'atteint' ? undefined : T.aVenir}>
              {etat === 'atteint' ? (
                <BoutonMedaille medaille={{ type, valeur: p }} libelle={`${court.format(p)} — ${T.atteint} · ${partager}`}>
                  <span className="medaille-rond">{court.format(p)}</span>
                  <span className="medaille-coche" aria-hidden>
                    ✓
                  </span>
                </BoutonMedaille>
              ) : (
                <span className="medaille-rond">{court.format(p)}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Etoiles({ note }: { note: number }) {
  const pct = Math.max(0, Math.min(100, (note / 5) * 100))
  return (
    <span className="relative inline-block text-sm leading-none tracking-[0.1em]" aria-hidden>
      <span className="text-[var(--cl-ligne)]">★★★★★</span>
      <span className="absolute inset-0 overflow-hidden whitespace-nowrap text-[var(--cl-miel)]" style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  )
}
