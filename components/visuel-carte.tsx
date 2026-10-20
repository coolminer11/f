import type { Visuel } from '@/lib/visuels'

/**
 * Un visuel de carte, avec son bouton « Télécharger » (le PNG d'origine,
 * 1254 × 1254, pour l'imprimeur, une maquette ou une publication). L'aperçu
 * affiché est une version légère ; un clic l'ouvre en grand.
 */
export default function VisuelCarte({ visuel, variante = 'grand', note }: { visuel: Visuel; variante?: 'grand' | 'vignette'; note?: string }) {
  if (variante === 'vignette') {
    return (
      <div className="flex items-center gap-3">
        <a href={visuel.fichier} target="_blank" rel="noreferrer" className="visuel-carte shrink-0" title="Ouvrir en grand">
          <img src={visuel.apercu} alt={visuel.titre} width={72} height={72} loading="lazy" className="size-[72px] rounded-xl object-cover" />
        </a>
        <div className="min-w-0 text-xs">
          <p className="font-semibold text-[var(--color-encre)]">{visuel.titre}</p>
          {note && <p className="text-[var(--color-encre-doux)]">{note}</p>}
          <a href={visuel.fichier} download={visuel.nomFichier} className="mt-1 inline-block font-semibold text-[var(--color-accent)] hover:underline">
            ↓ Télécharger
          </a>
        </div>
      </div>
    )
  }
  return (
    <figure className="carte flex flex-col overflow-hidden">
      <a href={visuel.fichier} target="_blank" rel="noreferrer" className="visuel-carte block bg-[var(--color-fond)] p-5" title="Ouvrir en grand">
        <img src={visuel.apercu} alt={visuel.titre} width={720} height={720} loading="lazy" className="mx-auto aspect-square w-full max-w-sm rounded-2xl object-cover shadow-[0_20px_40px_-24px_rgb(60_40_20/0.6)]" />
      </a>
      <figcaption className="flex flex-1 flex-col p-5">
        <h3 className="font-[family-name:var(--police-fraunces)] text-lg font-semibold">{visuel.titre}</h3>
        <p className="mt-0.5 text-sm font-medium">{visuel.langue}</p>
        <p className="mt-1 flex-1 text-sm leading-relaxed text-[var(--color-encre-doux)]">{visuel.pour}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={visuel.fichier} download={visuel.nomFichier} className="bouton py-1.5 text-sm">
            ↓ Télécharger l’image
          </a>
          <a href={visuel.fichier} target="_blank" rel="noreferrer" className="bouton bouton-secondaire py-1.5 text-sm">
            Ouvrir en grand ↗
          </a>
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-encre-doux)]">PNG · 1254 × 1254 px · qualité impression</p>
      </figcaption>
    </figure>
  )
}
