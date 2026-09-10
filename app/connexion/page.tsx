import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  authentifier,
  creerUtilisateur,
  nombreUtilisateurs,
  ouvrirSession,
  utilisateurCourant,
  verifierForceMotDePasse,
} from '@/lib/auth'
import { listerAssocies } from '@/lib/requetes/associes'

export const dynamic = 'force-dynamic'

const Connexion = z.object({
  courriel: z.string().trim().email('Courriel invalide.'),
  mot_de_passe: z.string().min(1, 'Le mot de passe est requis.'),
  suite: z.string().optional(),
})

const PremierCompte = z.object({
  nom: z.string().trim().min(2, 'Le nom est requis.').max(120),
  courriel: z.string().trim().email('Courriel invalide.'),
  mot_de_passe: z.string(),
  associe_id: z.string().optional(),
})

export default async function Connexion_({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; erreur?: string }>
}) {
  const { suite, erreur } = await searchParams
  if (await utilisateurCourant()) redirect(suite || '/transactions')

  const nbComptes = await nombreUtilisateurs()
  const associes = nbComptes === 0 ? await listerAssocies() : []
  const destination = suite && suite.startsWith('/') ? suite : '/transactions'

  async function seConnecter(donnees: FormData) {
    'use server'
    const analyse = Connexion.safeParse(Object.fromEntries(donnees))
    const retour = `/connexion${suite ? `?suite=${encodeURIComponent(suite)}` : ''}`
    if (!analyse.success) {
      redirect(`${retour}${suite ? '&' : '?'}erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)
    }
    const utilisateur = await authentifier(analyse.data.courriel, analyse.data.mot_de_passe)
    if (!utilisateur) {
      // Un seul message pour les deux cas : dire « ce compte n'existe pas »
      // apprendrait quels courriels sont enregistrés.
      redirect(
        `${retour}${suite ? '&' : '?'}erreur=${encodeURIComponent('Courriel ou mot de passe incorrect.')}`,
      )
    }
    const entetes = await headers()
    await ouvrirSession(utilisateur.id, entetes.get('user-agent') ?? undefined)
    redirect(destination)
  }

  async function creerPremierCompte(donnees: FormData) {
    'use server'
    if ((await nombreUtilisateurs()) > 0) redirect('/connexion')

    const analyse = PremierCompte.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) {
      redirect(`/connexion?erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)
    }
    const v = analyse.data
    const faiblesse = verifierForceMotDePasse(v.mot_de_passe)
    if (faiblesse) redirect(`/connexion?erreur=${encodeURIComponent(faiblesse)}`)

    const id = await creerUtilisateur({
      courriel: v.courriel,
      nom: v.nom,
      motDePasse: v.mot_de_passe,
      associeId: v.associe_id?.length ? v.associe_id : null,
      role: 'associe',
    })
    const entetes = await headers()
    await ouvrirSession(id, entetes.get('user-agent') ?? undefined)
    redirect('/transactions')
  }

  return (
    <div className="mx-auto mt-12 max-w-md">
      <h1 className="text-lg font-bold">Back-office Tapora</h1>
      <p className="mt-1 text-sm text-[var(--color-encre-doux)]">
        {nbComptes === 0
          ? 'Aucun compte n’existe encore. Créez le premier — il sera associé complet.'
          : 'Accès réservé aux associés.'}
      </p>

      {erreur && (
        <p className="carte mt-4 border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {erreur}
        </p>
      )}

      {nbComptes === 0 ? (
        <form action={creerPremierCompte} className="carte mt-5 space-y-4 p-5">
          <div>
            <label className="etiquette" htmlFor="nom">
              Votre nom
            </label>
            <input id="nom" name="nom" className="champ" required autoFocus maxLength={120} />
          </div>
          <div>
            <label className="etiquette" htmlFor="courriel">
              Courriel
            </label>
            <input id="courriel" name="courriel" type="email" className="champ" required />
          </div>
          {associes.length > 0 && (
            <div>
              <label className="etiquette" htmlFor="associe_id">
                Vous êtes
              </label>
              <select id="associe_id" name="associe_id" className="champ">
                <option value="">— aucun associé en particulier —</option>
                {associes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="etiquette" htmlFor="mot_de_passe">
              Mot de passe
            </label>
            <input
              id="mot_de_passe"
              name="mot_de_passe"
              type="password"
              className="champ"
              required
              minLength={10}
            />
            <p className="mt-1.5 text-xs text-[var(--color-encre-doux)]">
              Au moins 10 caractères, lettres et chiffres mêlés.
            </p>
          </div>
          <button className="bouton w-full">Créer le compte et entrer</button>
        </form>
      ) : (
        <form action={seConnecter} className="carte mt-5 space-y-4 p-5">
          <input type="hidden" name="suite" value={suite ?? ''} />
          <div>
            <label className="etiquette" htmlFor="courriel">
              Courriel
            </label>
            <input
              id="courriel"
              name="courriel"
              type="email"
              className="champ"
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="etiquette" htmlFor="mot_de_passe">
              Mot de passe
            </label>
            <input
              id="mot_de_passe"
              name="mot_de_passe"
              type="password"
              className="champ"
              autoComplete="current-password"
              required
            />
          </div>
          <button className="bouton w-full">Entrer</button>
        </form>
      )}
    </div>
  )
}
