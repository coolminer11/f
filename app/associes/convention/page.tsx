import Link from 'next/link'
import type { Metadata } from 'next'
import { exigerSession } from '@/lib/auth'
import { CROCHETS, lireConvention, versions } from '@/lib/convention'
import { listerAssocies } from '@/lib/requetes/associes'
import { lienRecu } from '@/lib/stockage'
import { pourcent } from '@/lib/format'
import OngletsAssocies from '@/components/onglets-associes'
import DocumentConvention from '@/components/document-convention'
import BoutonImprimer from '@/components/bouton-imprimer'
import BoutonEnvoi from '@/components/bouton-envoi'
import { approuverAction, creerEbaucheAction, enregistrerTexteAction, joindrePdfAction } from '@/app/associes/actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Convention d’associés — Tapora' }

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Toronto' })

/**
 * La convention d'associés : le texte, ses versions, l'approbation de
 * chacun, puis le PDF signé. Une ébauche, pas un avis juridique : elle se
 * fait valider par un notaire ou un avocat avant d'être signée.
 */
export default async function PageConvention({ searchParams }: { searchParams: Promise<{ v?: string; message?: string; erreur?: string }> }) {
  const moi = await exigerSession()
  const sp = await searchParams
  const numero = Number(sp.v) || undefined
  const [c, historique, associes] = await Promise.all([lireConvention(numero), versions(), listerAssocies()])
  const ecriture = moi.role !== 'lecture'

  const entete = (
    <>
      <OngletsAssocies actif="/associes/convention" />
      {sp.erreur && <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)] print:hidden">{sp.erreur}</p>}
      {sp.message && <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)] print:hidden">{sp.message}</p>}
    </>
  )

  if (!c) {
    return (
      <div className="space-y-5">
        {entete}
        <section className="carte mx-auto max-w-2xl p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--color-accent-doux)] text-2xl" aria-hidden>📜</span>
          <h1 className="mt-4 font-[family-name:var(--police-fraunces)] text-2xl font-semibold">Convention d’associés</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--color-encre-doux)]">
            Elle dit, par écrit, qui fait quoi, comment les profits se partagent, comment on décide, et ce qui arrive si l’un de vous part. Sans convention, le Code civil prévoit un partage égal de tout (art. 2202).
          </p>
          {ecriture && (
            <form action={creerEbaucheAction} className="mt-6">
              <BoutonEnvoi attente="Préparation…">Commencer avec l’ébauche Tapora</BoutonEnvoi>
            </form>
          )}
          <p className="mt-3 text-xs text-[var(--color-encre-doux)]">Remplie avec vos noms, vos parts actuelles et les rôles de « Qui fait quoi ». Tout reste modifiable.</p>
        </section>
      </div>
    )
  }

  const { v, approbations, courante } = c
  const nbApprouve = approbations.filter((a) => a.approuve_le).length
  const unanime = nbApprouve === approbations.length && approbations.length > 0
  const aConfirmer = [...new Set(v.texte.match(CROCHETS) ?? [])].length
  const pdf = lienRecu(v.pdf_signe)
  const statut = v.pdf_signe
    ? { texte: 'Signée', classe: 'bg-[#e9f2ea] text-[var(--color-positif)]' }
    : unanime
      ? { texte: 'Approuvée par les deux', classe: 'bg-[#e9f2ea] text-[var(--color-positif)]' }
      : nbApprouve
        ? { texte: `${nbApprouve} approbation sur ${approbations.length}`, classe: 'bg-[#fdf3dc] text-[#8a5a00]' }
        : { texte: 'Ébauche', classe: 'bg-[var(--color-fond)] text-[var(--color-encre-doux)]' }

  return (
    <div className="space-y-5">
      {entete}

      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-[family-name:var(--police-fraunces)] text-2xl font-semibold tracking-tight">Convention d’associés</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            Version {v.version} · {date(v.cree_le)}
            {v.cree_par ? ` · par ${v.cree_par}` : ''}
            {!courante && ' · ancienne version'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statut.classe}`}>{statut.texte}</span>
          <BoutonImprimer petit />
        </div>
      </div>

      {!courante && (
        <p className="carte flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm print:hidden">
          Vous regardez la version {v.version}.
          <Link href="/associes/convention" className="font-semibold text-[var(--color-accent)] hover:underline">Voir la version actuelle →</Link>
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start print:block">
        <article className="carte p-6 sm:p-10 print:!border-0 print:!bg-transparent print:!p-0 print:!shadow-none">
          <DocumentConvention texte={v.texte} />
        </article>

        <aside className="space-y-4 print:hidden lg:sticky lg:top-20">
          <section className="carte p-4">
            <h2 className="text-sm font-semibold">Approbations — version {v.version}</h2>
            <ul className="mt-3 space-y-2">
              {approbations.map((a) => {
                const mien = a.associe_id === moi.associe_id
                return (
                  <li key={a.associe_id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${a.approuve_le ? 'bg-[var(--color-positif)] text-white' : 'border border-[var(--color-ligne)] text-transparent'}`} aria-hidden>
                        ✓
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{a.nom}</span>
                        <span className="block text-xs text-[var(--color-encre-doux)]">{a.approuve_le ? `Approuvé le ${date(a.approuve_le)}` : 'Pas encore'}</span>
                      </span>
                    </span>
                    {mien && ecriture && courante && (
                      <form action={approuverAction}>
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="oui" value={a.approuve_le ? '0' : '1'} />
                        <button className={a.approuve_le ? 'text-xs text-[var(--color-encre-doux)] hover:underline' : 'bouton py-1 text-xs'}>
                          {a.approuve_le ? 'Retirer' : 'J’approuve'}
                        </button>
                      </form>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-[var(--color-encre-doux)]">
              Chacun approuve pour lui-même, depuis son compte. Modifier le texte crée une nouvelle version : les approbations repartent à zéro.
            </p>
          </section>

          {aConfirmer > 0 && courante && (
            <p className="rounded-xl border border-[#f1dca8] bg-[#fdf6e6] px-4 py-3 text-xs leading-relaxed text-[#6b4a05]">
              <strong>{aConfirmer} chiffre{aConfirmer > 1 ? 's' : ''} à confirmer</strong>, surligné{aConfirmer > 1 ? 's' : ''} dans le texte. Mettez-vous d’accord, puis retirez les crochets dans « Modifier le texte ».
            </p>
          )}

          <section className="carte p-4">
            <h2 className="text-sm font-semibold">Partage des profits</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {associes.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span>{a.nom}</span>
                  <span className="font-semibold tabular-nums">{pourcent(Number(a.part) * 100)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-encre-doux)]">
              Le partage en vigueur aujourd’hui. Si la convention signée le change, proposez le nouveau partage dans{' '}
              <Link href="/associes/profits#partage" className="font-medium text-[var(--color-accent)] hover:underline">Vos profits</Link> : il s’applique dès que vous l’avez approuvé tous les deux.
            </p>
          </section>

          <section className="carte p-4">
            <h2 className="text-sm font-semibold">Avant de signer</h2>
            <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-[var(--color-encre-doux)]">
              {[
                ['Discuter les chiffres entre crochets', aConfirmer === 0],
                ['Approuver chacun dans l’app', unanime],
                ['Faire valider par un notaire ou un avocat', !!v.pdf_signe],
                ['Signer et joindre le PDF signé', !!v.pdf_signe],
              ].map(([texte, fait], i) => (
                <li key={i} className="flex gap-2">
                  <span className={`grid size-4 shrink-0 place-items-center rounded-full text-[9px] ${fait ? 'bg-[var(--color-positif)] text-white' : 'bg-[var(--color-fond)] text-[var(--color-encre-doux)]'}`}>{fait ? '✓' : i + 1}</span>
                  <span className={fait ? 'line-through opacity-70' : ''}>{texte}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-encre-doux)]">Cette ébauche n’est pas un avis juridique.</p>
          </section>

          {courante && (
            <section className="carte p-4">
              <h2 className="text-sm font-semibold">Convention signée</h2>
              {pdf ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a href={pdf} target="_blank" rel="noreferrer" className="bouton bouton-secondaire text-xs">Ouvrir le PDF signé ↗</a>
                  {ecriture && (
                    <form action={joindrePdfAction}>
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="retirer" value="1" />
                      <button className="text-xs text-[var(--color-encre-doux)] hover:underline">Retirer</button>
                    </form>
                  )}
                </div>
              ) : !unanime ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--color-encre-doux)]">Une fois que vous l’aurez approuvée tous les deux, faites-la valider et signer, puis joignez le PDF signé ici.</p>
              ) : ecriture ? (
                <form action={joindrePdfAction} className="mt-2 space-y-2">
                  <input type="hidden" name="id" value={v.id} />
                  <input name="pdf" type="file" accept="application/pdf" required className="block w-full text-xs file:mr-2 file:rounded-full file:border-0 file:bg-[var(--color-fond)] file:px-3 file:py-1.5 file:text-xs file:font-semibold" />
                  <BoutonEnvoi className="w-full text-xs" attente="Envoi…">Joindre le PDF signé</BoutonEnvoi>
                </form>
              ) : (
                <p className="mt-2 text-xs text-[var(--color-encre-doux)]">Pas encore jointe.</p>
              )}
            </section>
          )}

          {historique.length > 1 && (
            <section className="carte p-4">
              <h2 className="text-sm font-semibold">Versions</h2>
              <ul className="mt-2 divide-y divide-[var(--color-ligne)] text-xs">
                {historique.map((h) => (
                  <li key={h.id}>
                    <Link href={h === historique[0] ? '/associes/convention' : `?v=${h.version}`} className={`flex justify-between gap-2 py-1.5 hover:text-[var(--color-accent)] ${h.version === v.version ? 'font-semibold' : ''}`}>
                      <span>Version {h.version} · {new Date(h.cree_le).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', timeZone: 'America/Toronto' })}{h.cree_par ? ` · ${h.cree_par.split(' ')[0]}` : ''}</span>
                      <span className="text-[var(--color-encre-doux)]">{h.pdf_signe ? 'signée' : `${h.approbations}/${approbations.length}`}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {ecriture && courante && (
        <details className="carte p-5 print:hidden" id="modifier">
          <summary className="cursor-pointer text-sm font-semibold">Modifier le texte</summary>
          <form action={enregistrerTexteAction} className="mt-3 space-y-3">
            <p className="text-xs text-[var(--color-encre-doux)]">
              « # » titre, « ## » article, « - » énumération. Enregistrer crée la version {v.version + 1}{nbApprouve ? ' et efface les approbations de la version actuelle' : ''}.
            </p>
            <textarea name="texte" rows={28} maxLength={60000} className="champ w-full resize-y font-mono text-xs leading-relaxed" defaultValue={v.texte} />
            <BoutonEnvoi attente="Enregistrement…">Enregistrer la version {v.version + 1}</BoutonEnvoi>
          </form>
        </details>
      )}
    </div>
  )
}
