'use client'

/**
 * Bouton de suppression d'une ligne du journal.
 *
 * La confirmation est côté navigateur parce qu'elle protège d'un clic de
 * travers, pas d'une intention. Ce qui protège vraiment est en base : une
 * écriture née d'un document est refusée, et tout départ laisse une trace.
 */
export default function BoutonSupprimer({ quoi }: { quoi: string }) {
  return (
    <button
      className="text-xs font-semibold text-[var(--color-negatif)] hover:underline"
      title="Supprimer cette écriture"
      onClick={(e) => {
        if (!confirm(`Supprimer « ${quoi} » ? Cette écriture ne sera pas récupérable.`)) {
          e.preventDefault()
        }
      }}
    >
      Supprimer
    </button>
  )
}
