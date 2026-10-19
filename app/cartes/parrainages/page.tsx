import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { exigerEcriture, exigerSession } from '@/lib/auth'
import { changerStatut, LIBELLES_STATUT, listerParrainages, merciLinkedIn, RABAIS_FILLEUL, STATUTS, type StatutParrainage } from '@/lib/parrainage'
import BoutonCopier from '@/components/bouton-copier'

export const dynamic = 'force-dynamic'

const COULEURS: Record<StatutParrainage, string> = {
  nouveau: 'bg-[#fbebe4] text-[var(--color-accent)]',
  contacte: 'bg-[#fdf3dc] text-[#8a5a00]',
  client: 'bg-[#e9f2ea] text-[var(--color-positif)]',
  perdu: 'bg-[var(--color-fond)] text-[var(--color-encre-doux)]',
}

async function changer(donnees: FormData) {
  'use server'
  await exigerEcriture()
  const statut = String(donnees.get('statut') ?? '') as StatutParrainage
  await changerStatut(String(donnees.get('id') ?? ''), statut)
  revalidatePath('/cartes/parrainages')
}

/**
 * Les recommandations reçues depuis les pages client. Le filleul a 10 % sur
 * sa première commande ; quand il devient client, son parrain devient
 * Ambassadeur et un merci LinkedIn est prêt à copier.
 */
export default async function PageParrainages() {
  const moi = await exigerSession()
  const ecriture = moi.role !== 'lecture'
  const liste = await listerParrainages()
  const compte = (s: StatutParrainage) => liste.filter((p) => p.statut === s).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/cartes" className="text-xs text-[var(--color-encre-doux)] hover:underline">← Cartes</Link>
          <h1 className="mt-1 text-lg font-bold tracking-tight">Recommandations</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            Envoyées par vos clients depuis leur page. Le filleul a {RABAIS_FILLEUL} % sur sa première commande ; le parrain devient Ambassadeur quand il nous rejoint.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUTS.map((s) => (
          <div key={s} className="carte p-4">
            <div className="text-xs font-medium text-[var(--color-encre-doux)]">{LIBELLES_STATUT[s]}</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">{compte(s)}</div>
          </div>
        ))}
      </div>

      {liste.length === 0 ? (
        <p className="carte px-5 py-8 text-center text-sm text-[var(--color-encre-doux)]">
          Aucune recommandation pour l’instant. Le bloc « Recommandez-nous » est sur chaque page client.
        </p>
      ) : (
        <ul className="space-y-3">
          {liste.map((p) => (
            <li key={p.id} className="carte p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold">{p.commerce}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COULEURS[p.statut]}`}>{LIBELLES_STATUT[p.statut]}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
                    Recommandé par{' '}
                    <Link href={`/cartes/dossiers/${p.parrain_id}#parrainage`} className="font-medium text-[var(--color-encre)] hover:text-[var(--color-accent)]">
                      {p.parrain_nom}
                    </Link>{' '}
                    · {new Date(p.cree_le).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', timeZone: 'America/Toronto' })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {p.contact && <span>👤 {p.contact}</span>}
                    {p.telephone && (
                      <a href={`tel:${p.telephone.replace(/[^\d+]/g, '')}`} className="font-medium text-[var(--color-accent)] hover:underline">
                        📞 {p.telephone}
                      </a>
                    )}
                    {p.courriel && (
                      <a href={`mailto:${p.courriel}`} className="font-medium text-[var(--color-accent)] hover:underline">
                        ✉️ {p.courriel}
                      </a>
                    )}
                  </div>
                  {p.message && (
                    <blockquote className="mt-2 border-l-2 border-[var(--color-accent)] pl-3 text-sm text-[var(--color-encre-doux)]">{p.message}</blockquote>
                  )}
                </div>
                {ecriture && (
                  <form action={changer} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <select key={p.statut} name="statut" defaultValue={p.statut} className="champ py-1.5 text-sm" aria-label={`Statut de ${p.commerce}`}>
                      {STATUTS.map((s) => (
                        <option key={s} value={s}>{LIBELLES_STATUT[s]}</option>
                      ))}
                    </select>
                    <button className="bouton py-1.5 text-sm">OK</button>
                  </form>
                )}
              </div>
              {(p.statut === 'nouveau' || p.statut === 'contacte') && (
                <p className="mt-3 rounded-lg bg-[var(--color-fond)] px-3 py-2 text-xs text-[var(--color-encre-doux)]">
                  💡 À dire au téléphone : « {p.parrain_nom} nous a parlé de vous » — et {RABAIS_FILLEUL} % sur sa première commande, à appliquer sur la facture.
                </p>
              )}
              {p.statut === 'client' && (
                <div className="mt-3 rounded-lg bg-[#e9f2ea] px-3 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--color-positif)]">
                      🏅 {p.parrain_nom} est Ambassadeur. Merci LinkedIn prêt à publier :
                    </span>
                    <BoutonCopier texte={merciLinkedIn(p.parrain_nom, p.commerce)} />
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-[var(--color-encre-doux)]">{merciLinkedIn(p.parrain_nom, p.commerce)}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
