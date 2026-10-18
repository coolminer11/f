import { GraphiqueLignes } from '@/components/graphiques'
import { Tuile, depuis, nombreFr } from '@/components/tuiles-cartes'
import { placesConfigure, resumeAvis, serieAvis } from '@/lib/avis-google'

function dateCourte(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j)).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
function dateLongue(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j)).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

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
}: {
  placeIds: string[]
  jours: number
  tapsPeriode: number
  /** Sur la page du client : pas de consignes de configuration. */
  pourClient?: boolean
}) {
  if (!placeIds.length) {
    if (pourClient) return null
    return (
      <section className="carte p-5">
        <h2 className="text-sm font-semibold">Avis Google</h2>
        <p className="mt-1 text-sm text-[var(--color-encre-doux)]">
          {placesConfigure()
            ? 'Choisissez la fiche Google du commerce dans « Modifier » : le nombre d’avis et la note s’afficheront ici, à côté des taps.'
            : 'Non branché. Ajoutez la clé GOOGLE_PLACES_CLE (DEPLOIEMENT.md, section 7) pour suivre les avis et la note à côté des taps.'}
        </p>
      </section>
    )
  }

  const [r, serie] = await Promise.all([resumeAvis(placeIds, jours), serieAvis(placeIds, jours)])
  if (r.nb_actuel === null) {
    if (pourClient) return null
    return (
      <section className="carte p-5">
        <h2 className="text-sm font-semibold">Avis Google</h2>
        <p className="mt-1 text-sm text-[var(--color-encre-doux)]">Premier relevé en attente : il arrive dans l’heure.</p>
      </section>
    )
  }

  const gagnes = r.nb_debut !== null ? r.nb_actuel - r.nb_debut : 0
  const parCent = tapsPeriode > 0 && gagnes > 0 ? (gagnes / tapsPeriode) * 100 : null
  const points = serie.filter((p) => p.nb !== null) as { jour: string; nb: number }[]

  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tuile
          libelle={`Avis gagnés, ${jours} derniers jours`}
          valeur={`${gagnes > 0 ? '+' : ''}${nombreFr.format(gagnes)}`}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">sur la fiche Google</span>}
        />
        <Tuile
          libelle="Avis au total"
          valeur={nombreFr.format(r.nb_actuel)}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">{r.fiches > 1 ? `${r.fiches} fiches` : 'aujourd’hui'}</span>}
        />
        <Tuile
          libelle="Note Google"
          valeur={r.note !== null ? `${r.note.toLocaleString('fr-CA', { minimumFractionDigits: 1 })} / 5` : '—'}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">{r.fiches > 1 ? 'voir chaque carte' : '★ moyenne de la fiche'}</span>}
        />
        <Tuile
          libelle="Avis pour 100 taps"
          valeur={parCent !== null ? parCent.toLocaleString('fr-CA', { maximumFractionDigits: 1 }) : '—'}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">sur la période</span>}
        />
      </div>
      {points.length > 1 && (
        <div className="carte p-5">
          <h2 className="text-sm font-semibold">Nombre d’avis Google</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
            {jours} derniers jours · dernier relevé {depuis(r.dernier_releve)}
          </p>
          <div className="mt-4">
            <GraphiqueLignes
              series={[{ nom: 'Avis', slot: 1, valeurs: points.map((p) => p.nb) }]}
              etiquettes={points.map((p) => dateCourte(p.jour))}
              details={points.map((p) => dateLongue(p.jour))}
              unite="avis"
              depuisZero={false}
              hauteur={150}
              resume={`Nombre d’avis Google sur ${jours} jours : de ${points[0].nb} à ${points[points.length - 1].nb}.`}
            />
          </div>
        </div>
      )}
    </section>
  )
}
