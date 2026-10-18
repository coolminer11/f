import { redirect } from 'next/navigation'
import { z } from 'zod'
import { changerMotDePasse, verifierForceMotDePasse } from '@/lib/auth'
import { requete } from '@/lib/db'
import { consommerJetonsPasMoi, lireJetonPasMoi } from '@/lib/securite'
import EcranConnexion from '@/components/ecran-connexion'
import BoutonEnvoi from '@/components/bouton-envoi'

export const dynamic = 'force-dynamic'

const Saisie = z.object({ j: z.string().max(80), nouveau: z.string().max(200), confirmation: z.string().max(200) })

/**
 * « Ce n'était pas moi » : le lien des courriels d'alerte.
 *
 * Rien ne se passe à l'ouverture du lien (les messageries ouvrent parfois
 * les liens toutes seules pour les analyser) : il faut confirmer en
 * choisissant un nouveau mot de passe. Alors toutes les sessions sont
 * fermées, les liens envoyés deviennent caducs, et l'intrus est dehors.
 */
export default async function PasMoi({ searchParams }: { searchParams: Promise<{ j?: string; erreur?: string; fait?: string }> }) {
  const { j = '', erreur, fait } = await searchParams

  if (fait === '1') {
    return (
      <EcranConnexion titre="Compte sécurisé" sousTitre="Toutes les sessions ont été fermées et votre nouveau mot de passe est en place.">
        <ul className="space-y-2 text-sm text-[var(--color-encre-doux)]">
          <li>✓ Toutes les sessions ouvertes sont fermées, partout.</li>
          <li>✓ L’ancien mot de passe ne fonctionne plus.</li>
          <li>✓ Les autres liens de sécurité envoyés sont désactivés.</li>
        </ul>
        <p className="mt-4 text-sm">Conseil : activez la double authentification dès votre retour, et prévenez votre associé.</p>
        <a href="/connexion" className="bouton mt-6 w-full">Me connecter</a>
      </EcranConnexion>
    )
  }

  const compte = await lireJetonPasMoi(j)
  if (!compte) {
    return (
      <EcranConnexion titre="Lien expiré" sousTitre="Ce lien de sécurité a déjà servi ou a plus de 24 heures.">
        <p className="text-sm text-[var(--color-encre-doux)]">
          Si vous pensez que quelqu’un utilise votre compte, connectez-vous et changez votre mot de passe dans « Sécurité », ou demandez à votre associé de fermer vos sessions.
        </p>
        <a href="/connexion" className="bouton mt-6 w-full">Aller à la connexion</a>
      </EcranConnexion>
    )
  }

  async function securiser(donnees: FormData) {
    'use server'
    const analyse = Saisie.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) redirect('/connexion')
    const v = analyse.data
    const retour = (t: string) => redirect(`/securite/pas-moi?j=${encodeURIComponent(v.j)}&erreur=${encodeURIComponent(t)}`)
    const c = await lireJetonPasMoi(v.j)
    if (!c) redirect(`/securite/pas-moi?j=${encodeURIComponent(v.j)}`)
    if (v.nouveau !== v.confirmation) retour('Les deux mots de passe ne correspondent pas.')
    const faiblesse = verifierForceMotDePasse(v.nouveau)
    if (faiblesse) retour(faiblesse)
    await consommerJetonsPasMoi(c.utilisateurId)
    // Change le mot de passe ET ferme toutes les sessions.
    await changerMotDePasse(c.utilisateurId, v.nouveau)
    await requete(`delete from defis_connexion where utilisateur_id = $1::uuid`, [c.utilisateurId])
    redirect('/securite/pas-moi?fait=1')
  }

  return (
    <EcranConnexion titre="Sécuriser mon compte" sousTitre={`${compte.nom} · ${compte.courriel}`}>
      <p className="mb-5 rounded-xl border border-[#f0cdb6] bg-[#fbe7da] px-4 py-3 text-sm leading-relaxed">
        Choisissez un nouveau mot de passe. Dès que vous confirmez, <strong>toutes les sessions sont fermées</strong> — y compris celle d’un éventuel intrus — et l’ancien mot de passe cesse de fonctionner.
      </p>
      {erreur && (
        <p role="alert" className="mb-4 rounded-xl border border-[#f0c4b3] bg-[#fbebe4] px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {erreur}
        </p>
      )}
      <form action={securiser} className="space-y-4">
        <input type="hidden" name="j" value={j} />
        <div>
          <label className="etiquette" htmlFor="nouveau">Nouveau mot de passe</label>
          <input id="nouveau" name="nouveau" type="password" className="champ" autoComplete="new-password" required minLength={10} maxLength={200} autoFocus />
        </div>
        <div>
          <label className="etiquette" htmlFor="confirmation">Confirmation</label>
          <input id="confirmation" name="confirmation" type="password" className="champ" autoComplete="new-password" required minLength={10} maxLength={200} />
        </div>
        <BoutonEnvoi className="w-full" attente="Sécurisation…">Fermer toutes les sessions et changer le mot de passe</BoutonEnvoi>
      </form>
    </EcranConnexion>
  )
}
