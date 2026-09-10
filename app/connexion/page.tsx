import { redirect } from 'next/navigation'
import { motDePasseValide, ouvrirSession, sessionOuverte } from '@/lib/auth'

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; erreur?: string }>
}) {
  const { suite, erreur } = await searchParams
  if (await sessionOuverte()) redirect(suite || '/transactions')

  async function seConnecter(donnees: FormData) {
    'use server'
    const saisie = String(donnees.get('mot_de_passe') ?? '')
    const destination = String(donnees.get('suite') ?? '') || '/transactions'
    if (!(await motDePasseValide(saisie))) {
      redirect(`/connexion?erreur=1${suite ? `&suite=${encodeURIComponent(suite)}` : ''}`)
    }
    await ouvrirSession()
    redirect(destination)
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="text-lg font-bold">Back-office Tapora</h1>
      <p className="mt-1 text-sm text-[var(--color-encre-doux)]">
        Accès réservé aux deux associés.
      </p>

      <form action={seConnecter} className="carte mt-5 space-y-4 p-5">
        <input type="hidden" name="suite" value={suite ?? ''} />
        <div>
          <label className="etiquette" htmlFor="mot_de_passe">
            Mot de passe
          </label>
          <input
            id="mot_de_passe"
            name="mot_de_passe"
            type="password"
            className="champ"
            autoFocus
            required
          />
        </div>
        {erreur && (
          <p className="text-sm font-medium text-[var(--color-negatif)]">
            Mot de passe incorrect.
          </p>
        )}
        <button className="bouton w-full">Entrer</button>
      </form>
    </div>
  )
}
