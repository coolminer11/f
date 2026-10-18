import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requeteUne } from '@/lib/db'
import type { Utilisateur } from '@/lib/auth'
import { verifierCodeCompte, codesRestants } from '@/lib/double-auth'
import { cheminSur, contexteRequete, echecDefi, fermerDefi, lireDefi, ralentir, verrouConnexion } from '@/lib/securite'
import { echecConnexion, reussiteConnexion } from '@/lib/connexion'
import EcranConnexion from '@/components/ecran-connexion'
import BoutonEnvoi from '@/components/bouton-envoi'
import ChampCode from '@/components/champ-code'

export const dynamic = 'force-dynamic'

const Saisie = z.object({ code: z.string().trim().min(6, 'Entrez le code à 6 chiffres.').max(20) })

/**
 * Deuxième étape de la connexion : le code de l'application
 * d'authentification (ou un code de secours). Le défi dure 5 minutes et
 * accepte 5 essais ; les échecs comptent aussi dans les freins anti-robots.
 */
export default async function PageCode({ searchParams }: { searchParams: Promise<{ erreur?: string; secours?: string }> }) {
  const { erreur, secours } = await searchParams
  const defi = await lireDefi()
  if (!defi) redirect(`/connexion?erreur=${encodeURIComponent('La vérification a expiré. Reconnectez-vous.')}`)

  async function verifier(donnees: FormData) {
    'use server'
    const d = await lireDefi()
    if (!d) redirect(`/connexion?erreur=${encodeURIComponent('La vérification a expiré. Reconnectez-vous.')}`)
    const ctx = await contexteRequete()
    const verrou = await verrouConnexion(d.courriel, ctx)
    if (verrou.bloque) {
      await fermerDefi(d)
      redirect(`/connexion?erreur=${encodeURIComponent(`Trop d’essais. Par sécurité, réessayez dans ${verrou.minutes} min.`)}`)
    }
    const analyse = Saisie.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) redirect(`/connexion/code?erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)

    const resultat = await verifierCodeCompte(d.utilisateurId, analyse.data.code)
    if (!resultat) {
      await echecConnexion({ courriel: d.courriel, compte: { id: d.utilisateurId, courriel: d.courriel, nom: d.nom }, etape: 'code', ctx })
      const restants = await echecDefi(d)
      await ralentir(d.courriel, ctx)
      if (restants === 0) redirect(`/connexion?erreur=${encodeURIComponent('Trop de codes incorrects. Reconnectez-vous.')}`)
      redirect(`/connexion/code?erreur=${encodeURIComponent(`Code incorrect. Encore ${restants} essai${restants > 1 ? 's' : ''}.`)}`)
    }

    await fermerDefi(d)
    const u = await requeteUne<Utilisateur>(
      `select id, courriel, nom, role, associe_id, actif, totp_actif from utilisateurs where id = $1::uuid and actif`,
      [d.utilisateurId],
    )
    if (!u) redirect('/connexion')
    await reussiteConnexion(u, ctx)
    if (resultat === 'secours') {
      const n = await codesRestants(u.id)
      redirect(`/compte/securite?message=${encodeURIComponent(`Code de secours utilisé. Il vous en reste ${n}.`)}`)
    }
    redirect(cheminSur(d.suite))
  }

  return (
    <EcranConnexion titre="Votre code" sousTitre={`Ouvrez votre application d’authentification et entrez le code à 6 chiffres de Tapora (${defi.courriel}).`}>
      {erreur && (
        <p role="alert" className="mb-4 rounded-xl border border-[#f0c4b3] bg-[#fbebe4] px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {erreur}
        </p>
      )}
      <form action={verifier} className="space-y-4">
        <ChampCode secours={secours === '1'} />
        <BoutonEnvoi className="w-full" attente="Vérification…">
          Vérifier
        </BoutonEnvoi>
      </form>
      <div className="mt-5 flex flex-wrap justify-between gap-2 text-xs text-[var(--color-encre-doux)]">
        {secours === '1' ? (
          <a href="/connexion/code" className="underline-offset-2 hover:underline">← Revenir au code de l’application</a>
        ) : (
          <a href="/connexion/code?secours=1" className="underline-offset-2 hover:underline">Téléphone perdu ? Utiliser un code de secours</a>
        )}
        <a href="/connexion" className="underline-offset-2 hover:underline">Recommencer</a>
      </div>
    </EcranConnexion>
  )
}
