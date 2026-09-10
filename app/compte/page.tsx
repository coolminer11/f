import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  basculerActif,
  changerMotDePasse,
  creerUtilisateur,
  exigerSession,
  fermerToutesSessions,
  listerUtilisateurs,
  motDePasseCorrespond,
  verifierForceMotDePasse,
} from '@/lib/auth'
import { listerAssocies } from '@/lib/requetes/associes'
import { requeteUne } from '@/lib/db'
import { dateLongue } from '@/lib/format'

export const dynamic = 'force-dynamic'

const NouveauCompte = z.object({
  nom: z.string().trim().min(2, 'Le nom est requis.').max(120),
  courriel: z.string().trim().email('Courriel invalide.'),
  mot_de_passe: z.string(),
  associe_id: z.string().optional(),
  role: z.enum(['associe', 'lecture']),
})

const Changement = z.object({
  actuel: z.string().min(1, 'Le mot de passe actuel est requis.'),
  nouveau: z.string(),
  confirmation: z.string(),
})

export default async function PageCompte({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; message?: string }>
}) {
  const moi = await exigerSession()
  const p = await searchParams
  const [comptes, associes] = await Promise.all([listerUtilisateurs(), listerAssocies()])

  async function ajouterCompte(donnees: FormData) {
    'use server'
    const utilisateur = await exigerSession()
    if (utilisateur.role !== 'associe') {
      redirect(`/compte?erreur=${encodeURIComponent('Votre compte est en lecture seule.')}`)
    }

    const analyse = NouveauCompte.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) {
      redirect(`/compte?erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)
    }
    const v = analyse.data
    const faiblesse = verifierForceMotDePasse(v.mot_de_passe)
    if (faiblesse) redirect(`/compte?erreur=${encodeURIComponent(faiblesse)}`)

    try {
      await creerUtilisateur({
        courriel: v.courriel,
        nom: v.nom,
        motDePasse: v.mot_de_passe,
        associeId: v.associe_id?.length ? v.associe_id : null,
        role: v.role,
      })
    } catch (e) {
      const message =
        e instanceof Error && e.message.includes('uq_utilisateurs_courriel')
          ? 'Un compte utilise déjà ce courriel.'
          : 'Création impossible.'
      redirect(`/compte?erreur=${encodeURIComponent(message)}`)
    }
    revalidatePath('/compte')
    redirect(`/compte?message=${encodeURIComponent('Compte créé.')}`)
  }

  async function changerMonMotDePasse(donnees: FormData) {
    'use server'
    const utilisateur = await exigerSession()
    const analyse = Changement.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) {
      redirect(`/compte?erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)
    }
    const v = analyse.data
    if (v.nouveau !== v.confirmation) {
      redirect(`/compte?erreur=${encodeURIComponent('Les deux mots de passe ne correspondent pas.')}`)
    }
    const faiblesse = verifierForceMotDePasse(v.nouveau)
    if (faiblesse) redirect(`/compte?erreur=${encodeURIComponent(faiblesse)}`)

    const ligne = await requeteUne<{ empreinte: string }>(
      `select empreinte from utilisateurs where id = $1::uuid`,
      [utilisateur.id],
    )
    if (!ligne || !(await motDePasseCorrespond(v.actuel, ligne.empreinte))) {
      redirect(`/compte?erreur=${encodeURIComponent('Mot de passe actuel incorrect.')}`)
    }

    await changerMotDePasse(utilisateur.id, v.nouveau)
    // Toutes les sessions viennent d'être fermées, y compris la nôtre.
    redirect('/connexion')
  }

  async function activerDesactiver(donnees: FormData) {
    'use server'
    const utilisateur = await exigerSession()
    if (utilisateur.role !== 'associe') redirect('/compte')
    const cible = String(donnees.get('id'))
    if (cible === utilisateur.id) {
      redirect(`/compte?erreur=${encodeURIComponent('Vous ne pouvez pas désactiver votre propre compte.')}`)
    }
    await basculerActif(cible, donnees.get('actif') === '1')
    revalidatePath('/compte')
  }

  async function deconnecterPartout(donnees: FormData) {
    'use server'
    const utilisateur = await exigerSession()
    if (utilisateur.role !== 'associe') redirect('/compte')
    await fermerToutesSessions(String(donnees.get('id')))
    revalidatePath('/compte')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Comptes</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          Un compte par associé. Fermer un compte révoque immédiatement ses sessions ouvertes.
        </p>
      </div>

      {p.erreur && (
        <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">
          {p.erreur}
        </p>
      )}
      {p.message && (
        <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">
          {p.message}
        </p>
      )}

      <section className="carte overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-ligne)] bg-[var(--color-fond)] text-left text-xs uppercase text-[var(--color-encre-doux)]">
              <th className="px-4 py-2 font-semibold">Personne</th>
              <th className="px-4 py-2 font-semibold">Rôle</th>
              <th className="px-4 py-2 font-semibold">Dernière connexion</th>
              <th className="px-4 py-2 text-right font-semibold">Sessions</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {comptes.map((c) => (
              <tr key={c.id} className="border-b border-[var(--color-ligne)] last:border-0">
                <td className="px-4 py-2">
                  <span className="font-medium">{c.nom}</span>
                  {c.id === moi.id && (
                    <span className="ml-2 rounded bg-[var(--color-accent-doux)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-accent)]">
                      vous
                    </span>
                  )}
                  {!c.actif && (
                    <span className="ml-2 rounded bg-[var(--color-fond)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-encre-doux)]">
                      désactivé
                    </span>
                  )}
                  <div className="text-xs text-[var(--color-encre-doux)]">
                    {c.courriel}
                    {c.associe_nom && ` · associé ${c.associe_nom}`}
                  </div>
                </td>
                <td className="px-4 py-2 text-[var(--color-encre-doux)]">
                  {c.role === 'associe' ? 'Accès complet' : 'Lecture seule'}
                </td>
                <td className="px-4 py-2 text-[var(--color-encre-doux)]">
                  {c.derniere_connexion ? dateLongue(c.derniere_connexion.slice(0, 10)) : 'jamais'}
                </td>
                <td className="chiffre px-4 py-2 text-right">{c.sessions_actives}</td>
                <td className="px-4 py-2 text-right">
                  {moi.role === 'associe' && c.id !== moi.id && (
                    <div className="flex justify-end gap-2 text-xs">
                      {c.sessions_actives > 0 && (
                        <form action={deconnecterPartout}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="text-[var(--color-encre-doux)] hover:underline">
                            Fermer ses sessions
                          </button>
                        </form>
                      )}
                      <form action={activerDesactiver}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="actif" value={c.actif ? '0' : '1'} />
                        <button className="text-[var(--color-encre-doux)] hover:underline">
                          {c.actif ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <form action={changerMonMotDePasse} className="carte space-y-3 p-5">
          <h2 className="text-sm font-bold">Changer mon mot de passe</h2>
          <p className="text-xs text-[var(--color-encre-doux)]">
            Toutes vos sessions seront fermées, y compris celle-ci.
          </p>
          <div>
            <label className="etiquette" htmlFor="actuel">
              Mot de passe actuel
            </label>
            <input
              id="actuel"
              name="actuel"
              type="password"
              className="champ"
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label className="etiquette" htmlFor="nouveau">
              Nouveau mot de passe
            </label>
            <input
              id="nouveau"
              name="nouveau"
              type="password"
              className="champ"
              autoComplete="new-password"
              required
              minLength={10}
            />
          </div>
          <div>
            <label className="etiquette" htmlFor="confirmation">
              Confirmation
            </label>
            <input
              id="confirmation"
              name="confirmation"
              type="password"
              className="champ"
              autoComplete="new-password"
              required
              minLength={10}
            />
          </div>
          <button className="bouton">Changer le mot de passe</button>
        </form>

        {moi.role === 'associe' && (
          <form action={ajouterCompte} className="carte space-y-3 p-5">
            <h2 className="text-sm font-bold">Ajouter un compte</h2>
            <div>
              <label className="etiquette" htmlFor="nom_nouveau">
                Nom
              </label>
              <input id="nom_nouveau" name="nom" className="champ" required maxLength={120} />
            </div>
            <div>
              <label className="etiquette" htmlFor="courriel_nouveau">
                Courriel
              </label>
              <input
                id="courriel_nouveau"
                name="courriel"
                type="email"
                className="champ"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="etiquette" htmlFor="associe_nouveau">
                  Associé
                </label>
                <select id="associe_nouveau" name="associe_id" className="champ">
                  <option value="">— aucun —</option>
                  {associes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="etiquette" htmlFor="role_nouveau">
                  Rôle
                </label>
                <select id="role_nouveau" name="role" className="champ" defaultValue="associe">
                  <option value="associe">Accès complet</option>
                  <option value="lecture">Lecture seule</option>
                </select>
              </div>
            </div>
            <div>
              <label className="etiquette" htmlFor="mdp_nouveau">
                Mot de passe provisoire
              </label>
              <input
                id="mdp_nouveau"
                name="mot_de_passe"
                type="password"
                className="champ"
                required
                minLength={10}
              />
              <p className="mt-1.5 text-xs text-[var(--color-encre-doux)]">
                Au moins 10 caractères, lettres et chiffres. La personne le changera elle-même.
              </p>
            </div>
            <button className="bouton">Créer le compte</button>
          </form>
        )}
      </div>
    </div>
  )
}
