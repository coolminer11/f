import type { Metadata } from 'next'
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
import { cheminSur, contexteRequete, ouvrirDefi, ralentir, verrouConnexion } from '@/lib/securite'
import { echecConnexion, idParCourriel, reussiteConnexion } from '@/lib/connexion'
import EcranConnexion from '@/components/ecran-connexion'
import BoutonEnvoi from '@/components/bouton-envoi'

export const dynamic = 'force-dynamic'

// Sur iPhone, « Sur l'écran d'accueil » depuis cette page donne la bonne icône.
export const metadata: Metadata = {
  manifest: '/bo-manifeste',
  icons: { apple: '/icones/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Tapora', statusBarStyle: 'default' },
}

const Connexion = z.object({
  courriel: z.string().trim().max(254).email('Courriel invalide.'),
  mot_de_passe: z.string().min(1, 'Le mot de passe est requis.').max(200),
  suite: z.string().max(300).optional(),
})

const PremierCompte = z.object({
  nom: z.string().trim().min(2, 'Le nom est requis.').max(120),
  courriel: z.string().trim().max(254).email('Courriel invalide.'),
  mot_de_passe: z.string().max(200),
  associe_id: z.string().optional(),
})

/** Retour à l'écran de connexion avec un message, en gardant la page demandée. */
function retour(suite: string | undefined, texte: string): string {
  const s = suite ? cheminSur(suite, '') : ''
  return `/connexion?${s ? `suite=${encodeURIComponent(s)}&` : ''}erreur=${encodeURIComponent(texte)}`
}

const attente = (minutes: number) =>
  `Trop d’essais. Par sécurité, réessayez dans ${minutes < 60 ? `${minutes} min` : `${Math.ceil(minutes / 60)} h`}.`

export default async function Connexion_({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; erreur?: string; message?: string }>
}) {
  const { suite, erreur, message } = await searchParams
  const destination = cheminSur(suite)
  if (await utilisateurCourant()) redirect(destination)

  const nbComptes = await nombreUtilisateurs()
  const associes = nbComptes === 0 ? await listerAssocies() : []

  async function seConnecter(donnees: FormData) {
    'use server'
    const analyse = Connexion.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) redirect(retour(undefined, analyse.error.issues[0].message))
    const { courriel, mot_de_passe, suite: demandee } = analyse.data
    const ctx = await contexteRequete()

    // Bloqué ? On ne teste même pas le mot de passe.
    const verrou = await verrouConnexion(courriel, ctx)
    if (verrou.bloque) redirect(retour(demandee, attente(verrou.minutes)))

    const utilisateur = await authentifier(courriel, mot_de_passe)
    if (!utilisateur) {
      const apres = await echecConnexion({ courriel, compte: await idParCourriel(courriel), etape: 'mot_de_passe', ctx })
      await ralentir(courriel, ctx)
      // Un seul message pour « compte inconnu » et « mauvais mot de passe » :
      // dire « ce compte n'existe pas » apprendrait quels courriels sont enregistrés.
      redirect(retour(demandee, apres.bloque ? attente(apres.minutes) : 'Courriel ou mot de passe incorrect.'))
    }

    const cible = cheminSur(demandee)
    if (utilisateur.totp_actif) {
      await ouvrirDefi(utilisateur.id, cible)
      redirect('/connexion/code')
    }
    await reussiteConnexion(utilisateur, ctx)
    redirect(cible)
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
    await ouvrirSession(id, await contexteRequete())
    redirect('/compte/securite')
  }

  return (
    <EcranConnexion
      titre={nbComptes === 0 ? 'Bienvenue' : 'Bon retour'}
      sousTitre={nbComptes === 0 ? 'Aucun compte n’existe encore. Créez le premier : il sera associé complet.' : 'Connectez-vous au back-office Tapora.'}
    >
      {erreur && (
        <p role="alert" className="mb-4 rounded-xl border border-[#f0c4b3] bg-[#fbebe4] px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {erreur}
        </p>
      )}
      {message && (
        <p role="status" className="mb-4 rounded-xl border border-[#cfe3d3] bg-[#e9f2ea] px-4 py-3 text-sm font-medium text-[var(--color-positif)]">
          {message}
        </p>
      )}

      {nbComptes === 0 ? (
        <form action={creerPremierCompte} className="space-y-4">
          <div>
            <label className="etiquette" htmlFor="nom">Votre nom</label>
            <input id="nom" name="nom" className="champ" required autoFocus maxLength={120} />
          </div>
          <div>
            <label className="etiquette" htmlFor="courriel">Courriel</label>
            <input id="courriel" name="courriel" type="email" className="champ" required maxLength={254} />
          </div>
          {associes.length > 0 && (
            <div>
              <label className="etiquette" htmlFor="associe_id">Vous êtes</label>
              <select id="associe_id" name="associe_id" className="champ">
                <option value="">— aucun associé en particulier —</option>
                {associes.map((a) => (
                  <option key={a.id} value={a.id}>{a.nom}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="etiquette" htmlFor="mot_de_passe">Mot de passe</label>
            <input id="mot_de_passe" name="mot_de_passe" type="password" className="champ" required minLength={10} maxLength={200} autoComplete="new-password" />
            <p className="mt-1.5 text-xs text-[var(--color-encre-doux)]">Au moins 10 caractères, lettres et chiffres mêlés.</p>
          </div>
          <BoutonEnvoi className="w-full">Créer le compte et entrer</BoutonEnvoi>
        </form>
      ) : (
        <form action={seConnecter} className="space-y-4">
          <input type="hidden" name="suite" value={suite ? destination : ''} />
          <div>
            <label className="etiquette" htmlFor="courriel">Courriel</label>
            <input id="courriel" name="courriel" type="email" className="champ" autoComplete="username" required autoFocus maxLength={254} />
          </div>
          <div>
            <label className="etiquette" htmlFor="mot_de_passe">Mot de passe</label>
            <input id="mot_de_passe" name="mot_de_passe" type="password" className="champ" autoComplete="current-password" required maxLength={200} />
          </div>
          <BoutonEnvoi className="w-full" attente="Vérification…">Entrer</BoutonEnvoi>
        </form>
      )}
    </EcranConnexion>
  )
}
