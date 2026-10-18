import { noterAvisAction } from '@/app/cartes/actions'
import { RYTHME_JOURS, type Suivi } from '@/lib/avis-manuels'

const fmt = new Intl.NumberFormat('fr-CA')

function quand(s: Suivi): string {
  if (s.jours === null) return 'jamais relevé'
  if (s.jours === 0) return 'aujourd’hui'
  if (s.jours === 1) return 'hier'
  return `il y a ${s.jours} jours`
}

/**
 * Le compte à rebours d'un commerce : une barre qui se remplit sur sept
 * jours, puis « À mettre à jour ». Le formulaire est sur la même ligne :
 * un coup d'œil à la fiche Google, deux chiffres, Entrée.
 */
export function LigneSuivi({ s, retour, avecNom = true }: { s: Suivi; retour: string; avecNom?: boolean }) {
  const progression = s.jours === null ? 1 : Math.min(1, s.jours / RYTHME_JOURS)
  const restant = s.jours === null ? 0 : Math.max(0, RYTHME_JOURS - s.jours)
  const google = `https://www.google.com/search?q=${encodeURIComponent(s.nom + ' avis')}`
  return (
    <form action={noterAvisAction} className="grid grid-cols-1 items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <input type="hidden" name="type" value={s.type} />
      <input type="hidden" name="id" value={s.id} />
      <input type="hidden" name="retour" value={retour} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {avecNom && <span className="truncate font-medium">{s.nom}</span>}
          {s.a_faire ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-[var(--color-attention)]">
              <span aria-hidden>●</span> À mettre à jour
            </span>
          ) : (
            <span className="rounded-full bg-[var(--color-fond)] px-2 py-0.5 text-xs text-[var(--color-encre-doux)]">
              dans {restant} jour{restant > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--color-encre-doux)]">
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-grille)]" aria-hidden>
            <span
              className={`block h-full rounded-full ${s.a_faire ? 'bg-[var(--color-attention)]' : 'bg-[var(--color-serie-1)]'}`}
              style={{ width: `${progression * 100}%` }}
            />
          </span>
          <span>
            {s.nb_avis !== null ? `${fmt.format(s.nb_avis)} avis` : 'aucun chiffre'}
            {s.note !== null && ` · ${String(s.note).replace('.', ',')} ★`} · {quand(s)}
          </span>
          <a href={google} target="_blank" rel="noreferrer" className="font-medium text-[var(--color-accent)] hover:underline">
            Voir sur Google ↗
          </a>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <label className="flex flex-col text-xs text-[var(--color-encre-doux)]">
          Avis
          <input
            name="nb"
            type="number"
            min={0}
            max={10000000}
            required
            inputMode="numeric"
            defaultValue={s.nb_avis ?? undefined}
            className="champ mt-0.5 py-1.5"
            style={{ width: '6.5rem' }}
            aria-label={`Nombre d’avis Google de ${s.nom}`}
          />
        </label>
        <label className="flex flex-col text-xs text-[var(--color-encre-doux)]">
          Note
          <input
            name="note"
            inputMode="decimal"
            pattern="[1-5]([.,][0-9])?"
            placeholder="4,6"
            defaultValue={s.note !== null ? String(s.note).replace('.', ',') : ''}
            className="champ mt-0.5 py-1.5"
            style={{ width: '4.5rem' }}
            aria-label={`Note Google de ${s.nom}`}
          />
        </label>
        <button className="bouton py-1.5 text-sm">Enregistrer</button>
      </div>
    </form>
  )
}

/** Le bloc « Avis Google à mettre à jour » de l'écran Cartes. */
export default function SuiviAvis({ suivis, retour }: { suivis: Suivi[]; retour: string }) {
  if (!suivis.length) return null
  const aFaire = suivis.filter((s) => s.a_faire)
  const prochain = suivis.filter((s) => !s.a_faire).reduce<number | null>(
    (min, s) => Math.min(min ?? 99, RYTHME_JOURS - (s.jours ?? 0)),
    null,
  )
  return (
    <section id="avis" className="carte scroll-mt-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {aFaire.length
            ? `Avis Google : ${aFaire.length} commerce${aFaire.length > 1 ? 's' : ''} à mettre à jour`
            : 'Avis Google : tout est à jour ✓'}
        </h2>
        <span className="text-xs text-[var(--color-encre-doux)]">
          Une fois par semaine : regardez la fiche Google, entrez le nombre d’avis et la note.
          {!aFaire.length && prochain !== null && ` Prochaine dans ${prochain} jour${prochain > 1 ? 's' : ''}.`}
        </span>
      </div>
      {aFaire.length > 0 && (
        <div className="mt-2 divide-y divide-[var(--color-ligne)]">
          {aFaire.map((s) => (
            <LigneSuivi key={s.type + s.id} s={s} retour={retour} />
          ))}
        </div>
      )}
      {suivis.length > aFaire.length && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-[var(--color-encre-doux)] hover:underline">
            {suivis.length - aFaire.length === 1 ? 'Voir celui qui est à jour' : `Voir les ${suivis.length - aFaire.length} qui sont à jour`}
          </summary>
          <div className="mt-1 divide-y divide-[var(--color-ligne)]">
            {suivis
              .filter((s) => !s.a_faire)
              .map((s) => (
                <LigneSuivi key={s.type + s.id} s={s} retour={retour} />
              ))}
          </div>
        </details>
      )}
    </section>
  )
}
