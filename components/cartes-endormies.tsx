import Link from 'next/link'
import { reglerSommeilAction } from '@/app/cartes/actions'
import { JOURS_SOMMEIL, type CarteEndormie } from '@/lib/sommeil'

const fmt = new Intl.NumberFormat('fr-CA')

/**
 * Le bloc « Cartes qui dorment » de l'écran Cartes : à appeler cette
 * semaine. Le même contenu part par courriel le lundi matin.
 */
export default function CartesEndormies({ cartes, ecriture }: { cartes: CarteEndormie[]; ecriture: boolean }) {
  if (!cartes.length) {
    return (
      <p id="sommeil" className="carte scroll-mt-4 flex items-center gap-2 px-4 py-3 text-sm text-[var(--color-encre-doux)]">
        <span className="grid size-6 place-items-center rounded-full bg-[#e9f2ea] text-xs text-[var(--color-positif)]" aria-hidden>✓</span>
        Toutes les cartes ont été tapées dans les {JOURS_SOMMEIL} derniers jours.
      </p>
    )
  }
  return (
    <section id="sommeil" className="carte scroll-mt-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-ligne)] bg-[linear-gradient(100deg,#fdf3dc,transparent_70%)] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#fffaf2] text-xl shadow-sm" aria-hidden>😴</span>
          <div>
            <h2 className="text-sm font-semibold">
              {cartes.length} carte{cartes.length > 1 ? 's' : ''} qui dor{cartes.length > 1 ? 'ment' : 't'} — à appeler cette semaine
            </h2>
            <p className="text-xs text-[var(--color-encre-doux)]">
              Aucun tap depuis {JOURS_SOMMEIL} jours ou plus. Carte cachée, tombée, équipe qui oublie : un appel règle ça. La liste part aussi par courriel le lundi.
            </p>
          </div>
        </div>
      </div>
      <ul className="divide-y divide-[var(--color-ligne)]">
        {cartes.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
            <span
              className={`grid h-9 min-w-12 place-items-center rounded-full px-2 text-sm font-bold tabular-nums ${
                c.total === 0 ? 'bg-[#fbebe4] text-[var(--color-negatif)]' : 'bg-[#fdf3dc] text-[#8a5a00]'
              }`}
              title={c.total === 0 ? 'Jamais tapée' : `Dernier tap il y a ${c.jours} jours`}
            >
              {c.jours} j
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                {c.dossier_id ? (
                  <Link href={`/cartes/dossiers/${c.dossier_id}`} className="truncate font-medium hover:text-[var(--color-accent)]">
                    {c.dossier_nom}
                  </Link>
                ) : (
                  <Link href={`/cartes/${c.id}`} className="truncate font-medium hover:text-[var(--color-accent)]">
                    {c.libelle}
                  </Link>
                )}
                <span className="text-xs text-[var(--color-encre-doux)]">
                  {c.dossier_id ? `${c.libelle} · ` : ''}
                  {c.total === 0 ? 'jamais tapée' : `${fmt.format(c.total)} tap${c.total > 1 ? 's' : ''} au total`}
                </span>
              </div>
              {(c.telephone || c.courriel) && (
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
                  {c.telephone && (
                    <a href={`tel:${c.telephone.replace(/[^\d+]/g, '')}`} className="font-medium text-[var(--color-accent)] hover:underline">
                      📞 {c.telephone}
                    </a>
                  )}
                  {c.courriel && (
                    <a href={`mailto:${c.courriel}`} className="font-medium text-[var(--color-accent)] hover:underline">
                      ✉️ {c.courriel}
                    </a>
                  )}
                </div>
              )}
            </div>
            {ecriture && (
              <form action={reglerSommeilAction}>
                <input type="hidden" name="id" value={c.id} />
                <button className="bouton bouton-secondaire py-1.5 text-xs" title={`Retire la carte de la liste pour ${JOURS_SOMMEIL} jours`}>
                  C’est réglé ✓
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
