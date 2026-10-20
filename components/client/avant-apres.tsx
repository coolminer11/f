import { locale, type Langue } from '@/lib/langue'

const TX = {
  fr: {
    titre: 'Avant / après Tapora',
    avant: 'Avant Tapora',
    apres: 'Depuis Tapora',
    parMois: 'avis / mois',
    fois: (x: string) => `×${x} plus d’avis chaque mois`,
    depuis: (n: number, d: string) => `+${n} avis Google depuis la pose des cartes, le ${d}.`,
    sansAvant: 'Chaque avis gagné depuis la pose, c’est la carte qui travaille.',
  },
  en: {
    titre: 'Before / after Tapora',
    avant: 'Before Tapora',
    apres: 'Since Tapora',
    parMois: 'reviews / month',
    fois: (x: string) => `×${x} more reviews every month`,
    depuis: (n: number, d: string) => `+${n} Google reviews since the cards were placed on ${d}.`,
    sansAvant: 'Every review gained since installation is the card at work.',
  },
}

/**
 * La preuve : le rythme d'avis avant la pose des cartes contre le rythme
 * depuis. On ne montre la comparaison que si elle est mesurable (au moins
 * deux semaines de recul) et si le rythme avant est connu ; sinon, le
 * simple gain depuis la pose.
 */
export default function AvantApres({
  langue,
  pose,
  avisPose,
  avisMaintenant,
  avisMoisAvant,
}: {
  langue: Langue
  pose: string
  avisPose: number
  avisMaintenant: number
  avisMoisAvant: number | null
}) {
  const T = TX[langue]
  const loc = locale(langue)
  const jours = Math.max(1, Math.round((Date.now() - new Date(pose + 'T12:00:00Z').getTime()) / 86_400_000))
  const gagnes = avisMaintenant - avisPose
  if (jours < 14 || gagnes <= 0) return null
  const apres = gagnes / (jours / 30.44)
  const dateDePose = new Date(pose + 'T12:00:00Z').toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const un = (x: number) => x.toLocaleString(loc, { maximumFractionDigits: 1 })
  const comparer = avisMoisAvant !== null && apres > avisMoisAvant
  const max = Math.max(apres, avisMoisAvant ?? 0)

  return (
    <section className="carte p-6 sm:p-7">
      <h2>{T.titre}</h2>
      {comparer ? (
        <>
          <div className="mt-5 space-y-4">
            <Barre libelle={T.avant} valeur={un(avisMoisAvant!)} unite={T.parMois} largeur={(avisMoisAvant! / max) * 100} couleur="bg-[var(--cl-ligne-forte)]" />
            <Barre libelle={T.apres} valeur={un(apres)} unite={T.parMois} largeur={100} couleur="bg-gradient-to-r from-[var(--cl-brique)] to-[var(--cl-brique-clair)]" fort />
          </div>
          {avisMoisAvant! > 0 && (
            <p className="titre-client mt-5 text-2xl font-medium text-[var(--cl-sapin)]">{T.fois(un(apres / avisMoisAvant!))}</p>
          )}
        </>
      ) : (
        <p className="titre-client mt-4 text-5xl font-medium text-[var(--cl-sapin)]">
          +<span data-compteur={gagnes}>{gagnes}</span>
        </p>
      )}
      <p className="mt-2 text-sm text-[var(--cl-doux)]">{T.depuis(gagnes, dateDePose)}</p>
      {!comparer && <p className="mt-1 text-sm text-[var(--cl-doux)]">{T.sansAvant}</p>}
    </section>
  )
}

function Barre({ libelle, valeur, unite, largeur, couleur, fort }: { libelle: string; valeur: string; unite: string; largeur: number; couleur: string; fort?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className={fort ? 'font-semibold' : 'text-[var(--cl-doux)]'}>{libelle}</span>
        <span>
          <strong className="titre-client text-xl font-medium tabular-nums">{valeur}</strong> <span className="text-xs text-[var(--cl-doux)]">{unite}</span>
        </span>
      </div>
      <div className="mt-1.5 h-3.5 overflow-hidden rounded-full bg-[var(--cl-creme)]" aria-hidden>
        <div data-jauge className={`h-full rounded-full ${couleur}`} style={{ width: `${Math.max(3, largeur)}%` }} />
      </div>
    </div>
  )
}
