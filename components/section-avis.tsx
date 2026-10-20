import { GraphiqueLignes } from '@/components/graphiques'
import { Tuile } from '@/components/tuiles-cartes'
import { dateCourte, dateLongue, depuisL, locale, textes, type Langue } from '@/lib/langue'
import { resumeAvis, serieAvis } from '@/lib/avis-google'

/**
 * Les avis Google à côté des taps : la preuve que la carte rapporte.
 *
 * Deux mesures d'échelles différentes (des dizaines de taps, des centaines
 * d'avis) : jamais sur un même graphique à deux axes. Les taps ont leur
 * graphique plus haut ; ici, le nombre d'avis seul, et le ratio en clair.
 */
export default async function SectionAvis({
  placeIds,
  jours,
  tapsPeriode,
  pourClient = false,
  langue = 'fr',
  donnees,
}: {
  placeIds: string[]
  jours: number
  tapsPeriode: number
  /** Sur la page du client : pas de consignes de configuration. */
  pourClient?: boolean
  langue?: Langue
  /** Déjà chargés par la page (même période, mêmes fiches) : aucune requête de plus. */
  donnees?: { r: Awaited<ReturnType<typeof resumeAvis>>; serie: Awaited<ReturnType<typeof serieAvis>> }
}) {
  const T = textes(langue)
  const nombreFr = new Intl.NumberFormat(locale(langue))
  if (!placeIds.length) {
    if (pourClient) return null
    return (
      <section className="carte p-5">
        <h2 className="text-sm font-semibold">Avis Google</h2>
        <p className="mt-1 text-sm text-[var(--color-encre-doux)]">
          Entrez le nombre d’avis et la note dans « Avis Google » ci-dessus : ils s’afficheront ici, à côté des taps.
        </p>
      </section>
    )
  }

  const [r, serie] = donnees ? [donnees.r, donnees.serie] : await Promise.all([resumeAvis(placeIds, jours), serieAvis(placeIds, jours)])
  if (r.nb_actuel === null) {
    if (pourClient) return null
    return (
      <section className="carte p-5">
        <h2 className="text-sm font-semibold">Avis Google</h2>
        <p className="mt-1 text-sm text-[var(--color-encre-doux)]">
          Pas encore de chiffre : entrez le nombre d’avis et la note dans « Avis Google » ci-dessus.
        </p>
      </section>
    )
  }

  const gagnes = r.nb_debut !== null ? r.nb_actuel - r.nb_debut : 0
  const parCent = tapsPeriode > 0 && gagnes > 0 ? (gagnes / tapsPeriode) * 100 : null
  const points = serie.filter((p) => p.nb !== null) as { jour: string; nb: number }[]

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tuile
          libelle={T.avisGagnes(jours)}
          valeur={`${gagnes > 0 ? '+' : ''}${nombreFr.format(gagnes)}`}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">{T.surFiche}</span>}
        />
        <Tuile
          libelle={T.avisTotal}
          valeur={nombreFr.format(r.nb_actuel)}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">{r.fiches > 1 ? T.fiches(r.fiches) : T.aujourdhui.toLowerCase()}</span>}
        />
        <Tuile
          libelle={T.noteGoogle}
          valeur={r.note !== null ? `${r.note.toLocaleString(locale(langue), { minimumFractionDigits: 1 })} / 5` : '—'}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">{r.fiches > 1 ? T.voirCartes : T.moyenneFiche}</span>}
        />
        <Tuile
          libelle={T.avisPour100}
          valeur={parCent !== null ? parCent.toLocaleString(locale(langue), { maximumFractionDigits: 1 }) : '—'}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">{T.surPeriode}</span>}
        />
      </div>
      {points.length > 1 && (
        <div className="carte p-5">
          <h2 className="text-sm font-semibold">{T.nbAvis}</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">{T.nbAvisSous(jours, depuisL(r.dernier_releve, langue))}</p>
          <div className="mt-4">
            <GraphiqueLignes
              series={[{ nom: T.unAvis, slot: 1, valeurs: points.map((p) => p.nb) }]}
              etiquettes={points.map((p) => dateCourte(p.jour, langue))}
              details={points.map((p) => dateLongue(p.jour, langue))}
              unite={T.unAvis}
              langue={langue}
              depuisZero={false}
              hauteur={150}
              resume={T.nbAvisResume(jours, points[0].nb, points[points.length - 1].nb)}
            />
          </div>
        </div>
      )}
    </section>
  )
}
