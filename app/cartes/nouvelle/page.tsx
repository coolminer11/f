import Link from 'next/link'
import { redirect } from 'next/navigation'
import { exigerEcriture, exigerSession } from '@/lib/auth'
import { creerCarte } from '@/lib/requetes/cartes'
import { nomsDossiers } from '@/lib/requetes/dossiers'
import { placesConfigure } from '@/lib/avis-google'
import { preparerCarte, premierReleve } from '@/lib/saisie-carte'
import ChampsCarte, { SaisieCarte } from '@/components/champs-carte'

export const dynamic = 'force-dynamic'

export default async function NouvelleCarte({ searchParams }: { searchParams: Promise<{ erreur?: string; dossier?: string }> }) {
  await exigerSession()
  const { erreur, dossier } = await searchParams
  const dossiers = await nomsDossiers()
  const dossierParDefaut = dossiers.some((d) => d.id === dossier) ? dossier! : null

  async function creer(donnees: FormData) {
    'use server'
    await exigerEcriture()
    const analyse = SaisieCarte.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) {
      redirect(`/cartes/nouvelle?erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)
    }
    const saisie = await preparerCarte(analyse.data)
    const id = await creerCarte(saisie)
    await premierReleve(saisie.placeId)
    redirect(`/cartes/${id}?nouvelle=1`)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href="/cartes" className="text-sm text-[var(--color-encre-doux)] hover:underline">
          ← Cartes NFC
        </Link>
        <h1 className="mt-1 text-lg font-bold tracking-tight">Nouvelle carte</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          Le code de la carte est attribué à l’enregistrement et ne change jamais. La destination,
          elle, se modifie quand vous voulez.
        </p>
      </div>
      {erreur && (
        <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {erreur}
        </p>
      )}
      <form action={creer} className="carte space-y-4 p-5">
        <ChampsCarte
          dossiers={dossiers}
          googleConfigure={placesConfigure()}
          valeurs={
            dossierParDefaut
              ? { libelle: '', dossier_id: dossierParDefaut, destination: '', note: null, place_id: null, fiche_nom: null }
              : undefined
          }
        />
        <button className="bouton">Créer la carte</button>
      </form>
    </div>
  )
}
