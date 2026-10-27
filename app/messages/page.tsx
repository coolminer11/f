import Link from 'next/link'
import type { Metadata } from 'next'
import { exigerSession } from '@/lib/auth'
import { compteRendu, filMessages, SUJETS, type Message } from '@/lib/portail'
import { ETAPES } from '@/lib/commandes'
import BoutonEnvoi from '@/components/bouton-envoi'
import { demandeAction, demandeCartesAction, regleAction, repondreAction } from '@/app/messages/actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Messages — Tapora' }

const quand = (d: string | Date) =>
  new Date(d).toLocaleString('fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Toronto' })
function depuis(d: string | Date): string {
  const h = Math.max(0, (Date.now() - new Date(d).getTime()) / 3_600_000)
  if (h < 1) return 'à l’instant'
  if (h < 24) return `depuis ${Math.round(h)} h`
  const j = Math.round(h / 24)
  return `depuis ${j} jour${j > 1 ? 's' : ''}`
}
const nomEtape = (e: string) => ETAPES.find(([c]) => c === e)?.[1] ?? e

/**
 * Le compte rendu de tout ce qui vient des clients : demandes Entreprise du
 * site, messages des portails, cartes demandées, maquettes en attente chez le
 * client, commandes immobiles. Chaque ligne a son geste ; une fois fait,
 * elle quitte la colonne « à traiter ».
 */
export default async function PageMessages({ searchParams }: { searchParams: Promise<{ message?: string; erreur?: string }> }) {
  const moi = await exigerSession()
  const sp = await searchParams
  const ecriture = moi.role !== 'lecture'
  const r = await compteRendu()
  const ouvertes = r.conversations.filter((c) => c.a_traiter > 0)
  const fils = new Map<string, Message[]>(await Promise.all(r.conversations.slice(0, 15).map(async (c) => [c.dossier_id, await filMessages(c.dossier_id)] as const)))
  const demandesOuvertes = r.demandes.filter((d) => !d.traitee_le)

  const tuiles: [string, number, string, string][] = [
    ['À répondre', ouvertes.length, '#conversations', 'conversation'],
    ['Demandes Entreprise', demandesOuvertes.length, '#demandes', 'demande'],
    ['Cartes demandées', r.cartes.length, '#cartes', 'demande'],
    ['Maquettes chez le client', r.maquettes.length, '#commandes', 'commande'],
    ['Commandes immobiles', r.bloquees.length, '#commandes', 'commande'],
  ]
  const rien = tuiles.every(([, n]) => n === 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-[family-name:var(--police-fraunces)] text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          Le compte rendu de vos clients : ce qu’ils écrivent depuis leur portail, les demandes du site, et ce qui attend un geste.
        </p>
      </div>

      {sp.erreur && <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">{sp.erreur}</p>}
      {sp.message && <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">{sp.message}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tuiles.map(([libelle, n, ancre]) => (
          <a key={libelle} href={ancre} className={`carte p-4 transition hover:-translate-y-0.5 ${n ? '' : 'opacity-60'}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-encre-doux)]">{libelle}</div>
            <div className={`mt-0.5 text-3xl font-semibold tabular-nums ${n ? 'text-[var(--color-accent)]' : ''}`}>{n}</div>
          </a>
        ))}
      </div>
      {rien && <p className="carte px-5 py-6 text-center text-sm text-[var(--color-encre-doux)]">Rien n’attend : tout est à jour ✓</p>}

      {/* ---- Demandes Entreprise (site) */}
      <section id="demandes" className="scroll-mt-20 space-y-3">
        <h2 className="text-sm font-semibold">Demandes Entreprise du site</h2>
        {r.demandes.length === 0 ? (
          <p className="carte px-5 py-4 text-sm text-[var(--color-encre-doux)]">Aucune demande. Elles arrivent ici depuis le formulaire « Entreprises » de taporacards.com.</p>
        ) : (
          r.demandes.map((d) => (
            <article key={d.id} id={`demande-${d.id}`} className={`carte scroll-mt-20 p-5 ${d.traitee_le ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    {d.entreprise} <span className="font-normal text-[var(--color-encre-doux)]">· {d.quantite} cartes · {d.lieu === 'QC' ? 'au Québec' : d.lieu === 'LES_DEUX' ? 'Québec et hors Québec (2 designs)' : 'hors Québec'}</span>
                  </h3>
                  <p className="mt-0.5 text-sm">
                    {d.contact_nom} ·{' '}
                    <a href={`mailto:${d.courriel}`} className="font-medium text-[var(--color-accent)] hover:underline">
                      {d.courriel}
                    </a>
                    {d.telephone && (
                      <>
                        {' · '}
                        <a href={`tel:${d.telephone.replace(/[^+\d]/g, '')}`} className="font-medium text-[var(--color-accent)] hover:underline">
                          {d.telephone}
                        </a>
                      </>
                    )}
                    <span className="text-[var(--color-encre-doux)]"> · {d.langue === 'fr' ? 'français' : 'anglais'} · {quand(d.cree_le)}</span>
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${d.traitee_le ? 'bg-[var(--color-fond)] text-[var(--color-encre-doux)]' : 'bg-[var(--color-accent)] text-white'}`}
                >
                  {d.traitee_le ? 'Traitée' : `Nouvelle · ${depuis(d.cree_le)}`}
                </span>
              </div>
              {d.message && <p className="mt-3 whitespace-pre-line rounded-lg bg-[var(--color-fond)] px-4 py-3 text-sm leading-relaxed">{d.message}</p>}
              {ecriture && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {d.commande_id ? (
                    <Link href={`/commandes/${d.commande_id}`} className="bouton bouton-secondaire py-1.5 text-sm">
                      Commande {d.commande_numero} ↗
                    </Link>
                  ) : (
                    <Link href={`/commandes?nouvelle=1&demande=${d.id}#nouvelle`} className="bouton py-1.5 text-sm">
                      Créer la commande
                    </Link>
                  )}
                  <form action={demandeAction}>
                    <input type="hidden" name="demande" value={d.id} />
                    <input type="hidden" name="traitee" value={d.traitee_le ? '0' : '1'} />
                    <button className="bouton bouton-secondaire py-1.5 text-sm">{d.traitee_le ? 'Rouvrir' : 'Marquer traitée'}</button>
                  </form>
                </div>
              )}
            </article>
          ))
        )}
      </section>

      {/* ---- Conversations des portails */}
      <section id="conversations" className="scroll-mt-20 space-y-3">
        <h2 className="text-sm font-semibold">Messages des clients</h2>
        {r.conversations.length === 0 ? (
          <p className="carte px-5 py-4 text-sm text-[var(--color-encre-doux)]">
            Aucun message. Vos clients vous écrivent depuis leur page privée (section « Écrivez-nous ») ; vous recevez aussi un courriel.
          </p>
        ) : (
          r.conversations.map((c) => {
            const fil = fils.get(c.dossier_id) ?? []
            return (
              <article key={c.dossier_id} id={`d-${c.dossier_id}`} className="carte scroll-mt-20 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-ligne)] px-5 py-3">
                  <div>
                    <Link href={`/cartes/dossiers/${c.dossier_id}`} className="font-semibold hover:text-[var(--color-accent)]">
                      {c.nom}
                    </Link>
                    <span className="ml-2 text-xs text-[var(--color-encre-doux)]">{c.courriel ?? 'pas de courriel : la réponse reste sur son portail'}</span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c.a_traiter ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-fond)] text-[var(--color-encre-doux)]'}`}
                  >
                    {c.a_traiter ? `À répondre · ${depuis(c.attente_depuis ?? c.dernier_le)}` : 'Réglée'}
                  </span>
                </div>
                {fil.length > 0 ? (
                  <ol className="max-h-80 space-y-2 overflow-y-auto px-5 py-4">
                    {fil.map((m) => (
                      <li key={m.id} className={`flex ${m.auteur === 'tapora' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.auteur === 'tapora' ? 'rounded-br-md bg-[var(--color-accent)] text-white' : 'rounded-bl-md bg-[var(--color-fond)]'}`}
                        >
                          {m.auteur === 'client' && <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{SUJETS[m.sujet]?.fr}</p>}
                          <p className="whitespace-pre-line leading-relaxed">{m.texte}</p>
                          <p className="mt-0.5 text-[11px] opacity-70">
                            {m.auteur === 'tapora' ? (m.par_nom ?? 'Tapora') : 'Client'} · {quand(m.cree_le)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="px-5 py-3 text-sm text-[var(--color-encre-doux)]">{c.dernier_texte}</p>
                )}
                {ecriture && (
                  <div className="border-t border-[var(--color-ligne)] bg-[var(--color-fond)]/40 px-5 py-3">
                    <form action={repondreAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <input type="hidden" name="dossier" value={c.dossier_id} />
                      <textarea name="texte" required rows={2} maxLength={2000} placeholder="Votre réponse…" className="champ min-w-0 flex-1 resize-y" aria-label={`Répondre à ${c.nom}`} />
                      <BoutonEnvoi attente="Envoi…" className="shrink-0">
                        Répondre
                      </BoutonEnvoi>
                    </form>
                    {c.a_traiter > 0 && (
                      <form action={regleAction} className="mt-2">
                        <input type="hidden" name="dossier" value={c.dossier_id} />
                        <button className="text-xs font-semibold text-[var(--color-encre-doux)] hover:text-[var(--color-encre)] hover:underline">Marquer comme réglée sans répondre</button>
                      </form>
                    )}
                  </div>
                )}
              </article>
            )
          })
        )}
      </section>

      {/* ---- Cartes demandées + commandes qui attendent */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section id="cartes" className="carte scroll-mt-20 p-5">
          <h2 className="text-sm font-semibold">Cartes demandées depuis les portails</h2>
          {r.cartes.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-encre-doux)]">Aucune demande en attente.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--color-ligne)]">
              {r.cartes.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0">
                    <Link href={`/cartes/dossiers/${q.dossier_id}#demandes`} className="font-semibold hover:text-[var(--color-accent)]">
                      {q.nom}
                    </Link>{' '}
                    veut {q.quantite} carte{q.quantite > 1 ? 's' : ''}
                    <span className="text-[var(--color-encre-doux)]"> · {depuis(q.cree_le)}</span>
                    {q.message && <span className="block text-xs text-[var(--color-encre-doux)]">« {q.message} »</span>}
                  </span>
                  {ecriture && (
                    <form action={demandeCartesAction}>
                      <input type="hidden" name="demande" value={q.id} />
                      <button className="bouton bouton-secondaire py-1 text-xs">Traité</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="commandes" className="carte scroll-mt-20 p-5">
          <h2 className="text-sm font-semibold">Commandes qui attendent</h2>
          {r.maquettes.length === 0 && r.bloquees.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-encre-doux)]">Aucune : toutes avancent.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--color-ligne)]">
              {r.maquettes.map((c) => (
                <li key={c.id} className="py-2.5 text-sm">
                  <Link href={`/commandes/${c.id}`} className="font-semibold hover:text-[var(--color-accent)]">
                    {c.numero} · {c.client_nom}
                  </Link>
                  <span className="block text-xs text-[var(--color-encre-doux)]">Maquette envoyée, pas encore approuvée par le client ({depuis(c.depuis)}).</span>
                </li>
              ))}
              {r.bloquees.map((c) => (
                <li key={c.id} className="py-2.5 text-sm">
                  <Link href={`/commandes/${c.id}`} className="font-semibold hover:text-[var(--color-accent)]">
                    {c.numero} · {c.client_nom}
                  </Link>
                  <span className="block text-xs text-[var(--color-encre-doux)]">
                    À l’étape « {nomEtape(c.etape)} » {depuis(c.depuis)} : la prochaine étape attend.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
