'use client'

import { useEffect, useMemo, useState } from 'react'
import type { RetourPortail } from '@/lib/services/portail'
import { drapeau, nomLangue } from '@/lib/services/langues'
import { retourLuAction, tousLusAction } from '@/app/service/[jeton]/actions'
import { TEXTES_PORTAIL, type LanguePortail } from '@/components/services/portail/textes'
import { annoncerBadges } from '@/components/services/portail/badge-direct'
import Chiffre from '@/components/services/portail/chiffre'
import { desintegrer, vibrer } from '@/components/effets/desintegration'
import { toast } from '@/components/effets/toasts'

type Filtre = 'tous' | 'non-lus' | 'bas'

/**
 * Les avis des clients, laissés juste après une demande. Les notes basses
 * ressortent ; un geste les marque comme lus (ou non lus, pour y revenir).
 */
export default function AvisPortail({
  jeton,
  l,
  retours,
  langueDefaut,
  fuseau,
}: {
  jeton: string
  l: LanguePortail
  retours: RetourPortail[]
  langueDefaut: string
  fuseau: string
}) {
  const T = TEXTES_PORTAIL[l]
  const [lus, setLus] = useState<Record<string, boolean>>(() => Object.fromEntries(retours.map((r) => [r.id, r.lu_le !== null])))
  const [filtre, setFiltre] = useState<Filtre>(() => (retours.some((r) => r.lu_le === null) ? 'non-lus' : 'tous'))
  const [erreur, setErreur] = useState(false)
  const [occupe, setOccupe] = useState(false)

  const nbNonLus = Object.values(lus).filter((v) => !v).length
  // La pastille « Avis clients » suit (les non-lus des 30 derniers jours).
  useEffect(() => {
    const limite = Date.now() - 30 * 86400000
    annoncerBadges({ nonLus: retours.filter((r) => !lus[r.id] && Date.parse(r.cree_le) > limite).length })
  }, [lus, retours])
  const visibles = useMemo(
    () => retours.filter((r) => (filtre === 'non-lus' ? !lus[r.id] : filtre === 'bas' ? r.note <= 3 : true)),
    [retours, filtre, lus],
  )
  const moyenne = retours.length ? retours.reduce((a, r) => a + r.note, 0) / retours.length : null

  const carte = (id: string) => document.querySelector<HTMLElement>(`[data-retour="${id}"]`)
  const or = () => getComputedStyle(document.querySelector('.theme-portail') ?? document.body).getPropertyValue('--p-or-clair').trim() || undefined

  async function basculer(r: RetourPortail) {
    const v = !lus[r.id]
    setErreur(false)
    vibrer(10)
    const action = retourLuAction(jeton, r.id, v).catch(() => false)
    // Dans « non lus », l'avis lu part en poussière avant de quitter la liste.
    if (v && filtre === 'non-lus') await desintegrer(carte(r.id), { duree: 750, couleur: or() })
    setLus((x) => ({ ...x, [r.id]: v }))
    if (!(await action)) {
      setLus((x) => ({ ...x, [r.id]: !v }))
      setErreur(true)
      toast(T.erreur, { ton: 'erreur' })
    } else if (v) toast(T.retourLu, { ton: 'succes', duree: 2200 })
  }

  async function tousLus() {
    setOccupe(true)
    setErreur(false)
    const action = tousLusAction(jeton).catch(() => null)
    // Les cartes visibles se désintègrent ensemble (8 au plus : le vieil iPad reste fluide).
    if (filtre === 'non-lus') await Promise.all(visibles.slice(0, 8).map((r) => desintegrer(carte(r.id), { duree: 800, particules: 28, couleur: or() })))
    const n = await action
    setOccupe(false)
    if (n === null) {
      setErreur(true)
      toast(T.erreur, { ton: 'erreur' })
      return
    }
    vibrer(16)
    setLus((x) => Object.fromEntries(Object.keys(x).map((k) => [k, true])))
    toast(T.tousLusOk(n), { ton: 'succes' })
  }

  const date = (iso: string) =>
    new Date(iso).toLocaleString(l === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: fuseau })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titre-portail text-2xl font-medium">{T.avisTitre}</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--p-doux)]">{T.avisSous}</p>
        </div>
        {moyenne !== null && (
          <div className="pt-kpi flex items-center gap-3 !py-3">
            <span className="pt-valeur text-3xl">
              <Chiffre valeur={moyenne} genre="note" l={l} />
            </span>
            <span className="text-xs text-[var(--p-doux)]">
              <span className="block text-[var(--p-ambre)]">★★★★★</span>
              {T.noteSous(retours.length)}
            </span>
          </div>
        )}
      </div>

      {retours.length === 0 ? (
        <div className="pt-carte-plate flex flex-col items-center gap-2 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-[var(--p-surface)] text-2xl shadow-sm" aria-hidden>
            💬
          </span>
          <p className="max-w-sm text-sm text-[var(--p-doux)]">{T.aucunAvis}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2" role="group">
              <button type="button" className="pt-puce" aria-pressed={filtre === 'non-lus'} onClick={() => setFiltre('non-lus')}>
                {T.nonLus(nbNonLus)}
              </button>
              <button type="button" className="pt-puce" aria-pressed={filtre === 'bas'} onClick={() => setFiltre('bas')}>
                ★ ≤ 3
              </button>
              <button type="button" className="pt-puce" aria-pressed={filtre === 'tous'} onClick={() => setFiltre('tous')}>
                {T.tout} · {retours.length}
              </button>
            </div>
            <button type="button" onClick={tousLus} disabled={occupe || nbNonLus === 0} className="pt-bouton-doux !py-2.5 text-sm">
              ✓ {T.tousLus}
            </button>
          </div>

          {erreur && (
            <p role="alert" className="text-sm font-medium text-[var(--p-rouge)]">
              {T.erreur}
            </p>
          )}

          {visibles.length === 0 ? (
            <p className="pt-carte-plate px-6 py-10 text-center text-sm text-[var(--p-doux)]">✓ {T.nonLus(0)}</p>
          ) : (
            <ul className="cascade grid gap-3 md:grid-cols-2">
              {visibles.map((r) => {
                const lu = lus[r.id]
                const bas = r.note <= 2
                return (
                  <li
                    key={r.id}
                    data-retour={r.id}
                    className={`pt-carte relative p-5 transition-opacity ${lu ? 'opacity-70' : ''} ${bas ? '!border-[color-mix(in_oklab,var(--p-rouge)_40%,transparent)]' : ''}`}
                  >
                    {!lu && <span className="absolute right-4 top-4 size-2.5 rounded-full bg-[var(--accent)]" aria-label={T.nonLus(1)} />}
                    <div className="flex items-center gap-3 pr-6">
                      <span
                        className={`grid size-11 shrink-0 place-items-center rounded-2xl text-lg font-bold tabular-nums ${
                          bas ? 'bg-[var(--p-rouge-pale)] text-[var(--p-rouge)]' : r.note === 3 ? 'bg-[var(--p-ambre-pale)] text-[var(--p-ambre)]' : 'bg-[var(--p-vert-pale)] text-[var(--p-vert)]'
                        }`}
                      >
                        {r.note}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm tracking-[0.08em] text-[var(--p-ambre)]" aria-label={`${r.note} / 5`}>
                          {'★'.repeat(r.note)}
                          <span className="text-[var(--p-ligne-forte)]">{'★'.repeat(5 - r.note)}</span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--p-faible)]">
                          {[r.emplacement, r.groupe].filter(Boolean).join(' · ')}
                          {r.emplacement || r.groupe ? ' · ' : ''}
                          {date(r.cree_le)}
                        </p>
                      </div>
                    </div>
                    <p className={`mt-4 text-[15px] leading-relaxed ${r.commentaire ? '' : 'italic text-[var(--p-faible)]'}`} lang={r.langue}>
                      {r.commentaire ? `« ${r.commentaire} »` : T.sansCommentaire}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2 text-xs">
                        {r.langue !== langueDefaut && (
                          <span className="pt-pastille bg-[var(--p-surface-2)] text-[var(--p-doux)]">
                            {drapeau(r.langue)} {nomLangue(r.langue)}
                          </span>
                        )}
                        {r.google && <span className="pt-pastille bg-[var(--p-vert-pale)] text-[var(--p-vert)]">↗ {T.googleClique}</span>}
                      </div>
                      <button type="button" onClick={() => basculer(r)} className="pt-bouton-fantome !py-2 text-xs">
                        {lu ? T.marquerNonLu : `✓ ${T.marquerLu}`}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
