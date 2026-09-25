import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { exigerSession } from '@/lib/auth'
import { stockageDistant } from '@/lib/stockage'
import {
  ajouterTutoriel,
  deplacerTutoriel,
  listerTutoriels,
  supprimerTutoriel,
} from '@/lib/requetes/tutoriels'
import FormulaireTutoriel from '@/components/formulaire-tutoriel'
import { dateLongue } from '@/lib/format'

export const dynamic = 'force-dynamic'

const Saisie = z
  .object({
    titre: z.string().trim().min(1, 'Donnez un titre à la vidéo.').max(150),
    description: z.string().trim().max(400).optional(),
    lien: z.string().trim().url('Adresse invalide.').optional().or(z.literal('')),
    chemin: z.string().trim().optional().or(z.literal('')),
    taille: z.coerce.number().optional(),
  })
  .refine((v) => Boolean(v.lien) !== Boolean(v.chemin), {
    message: 'Il faut un lien ou un fichier, pas les deux.',
  })

export default async function PageAide({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>
}) {
  const moi = await exigerSession()
  const { erreur } = await searchParams
  const [tutoriels, stockage] = [await listerTutoriels(), stockageDistant()]
  const peutEcrire = moi.role !== 'lecture'

  async function enregistrer(donnees: FormData) {
    'use server'
    const utilisateur = await exigerSession()
    const analyse = Saisie.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) {
      redirect(`/aide?erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)
    }
    const v = analyse.data
    await ajouterTutoriel({
      titre: v.titre,
      description: v.description || null,
      lien: v.lien || null,
      chemin: v.chemin || null,
      taille: v.taille ?? null,
      par: utilisateur.courriel,
    })
    revalidatePath('/aide')
  }

  async function retirer(donnees: FormData) {
    'use server'
    await exigerSession()
    await supprimerTutoriel(String(donnees.get('id')))
    revalidatePath('/aide')
  }

  async function deplacer(donnees: FormData) {
    'use server'
    await exigerSession()
    await deplacerTutoriel(String(donnees.get('id')), Number(donnees.get('sens')) as -1 | 1)
    revalidatePath('/aide')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Aide</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          Les vidéos qui montrent comment se servir de l’application. Chacun les voit, chacun
          peut en ajouter.
        </p>
      </div>

      {erreur && (
        <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {erreur}
        </p>
      )}

      {tutoriels.length === 0 && (
        <p className="carte px-4 py-10 text-center text-sm text-[var(--color-encre-doux)]">
          Aucune vidéo pour l’instant. Enregistrez votre écran pendant que vous saisissez une
          vraie dépense — trois minutes valent mieux qu’une page d’explications.
        </p>
      )}

      <div className="space-y-4">
        {tutoriels.map((t, i) => (
          <article key={t.id} className="carte overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-ligne)] p-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">{t.titre}</h2>
                {t.description && (
                  <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">{t.description}</p>
                )}
                <p className="mt-1 text-xs text-[var(--color-encre-doux)]">
                  Ajoutée le {dateLongue(t.cree_le.slice(0, 10))}
                  {t.cree_par ? ` par ${t.cree_par}` : ''}
                  {t.taille ? ` · ${Math.round(t.taille / 1024 / 1024)} Mo` : ''}
                </p>
              </div>
              {peutEcrire && (
                <div className="flex shrink-0 gap-1">
                  {i > 0 && (
                    <form action={deplacer}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="sens" value={-1} />
                      <button className="bouton bouton-secondaire" title="Monter">
                        ↑
                      </button>
                    </form>
                  )}
                  {i < tutoriels.length - 1 && (
                    <form action={deplacer}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="sens" value={1} />
                      <button className="bouton bouton-secondaire" title="Descendre">
                        ↓
                      </button>
                    </form>
                  )}
                  <form action={retirer}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="bouton bouton-secondaire" title="Retirer">
                      ✕
                    </button>
                  </form>
                </div>
              )}
            </div>

            {t.integration ? (
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={t.integration}
                  title={t.titre}
                  className="size-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : t.fichier ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={t.fichier} controls preload="metadata" className="w-full bg-black" />
            ) : t.lien ? (
              <p className="p-4 text-sm">
                <a
                  href={t.lien}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[var(--color-accent)] hover:underline"
                >
                  Ouvrir la vidéo
                </a>{' '}
                <span className="text-[var(--color-encre-doux)]">
                  — cette adresse ne s’affiche pas dans la page.
                </span>
              </p>
            ) : (
              <p className="p-4 text-sm text-[var(--color-negatif)]">
                Vidéo entreposée, mais l’entreposage n’est pas configuré : voyez l’écran État.
              </p>
            )}
          </article>
        ))}
      </div>

      {peutEcrire && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Ajouter une vidéo</h2>
          {!stockage && (
            <p className="carte border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              L’entreposage n’est pas branché : seuls les liens sont possibles pour l’instant.
              Voyez l’écran <strong>État</strong> pour le régler.
            </p>
          )}
          <FormulaireTutoriel enregistrer={enregistrer} stockageActif={stockage} />
        </section>
      )}
    </div>
  )
}
