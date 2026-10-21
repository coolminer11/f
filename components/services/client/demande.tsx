'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Compteur from '@/components/effets/compteur'
import { desintegrer, vibrer } from '@/components/effets/desintegration'
import { toast } from '@/components/effets/toasts'
import { annulerDemande, demander } from '@/app/s/[code]/actions'
import type { StatutDemande } from '@/lib/services/types'
import { useLieu } from './contexte'
import Feuille from './feuille'
import BlocAvis, { avisRecent } from './avis'
import { Tuile } from './tuiles'
import { eclat, rebond, remplir } from './outils'

export type TypeDemandeUi = { cle: string; libelle: string; icone: string | null; avec_note: boolean }
/** Une demande suivie sur ce téléphone ; `resume` pour une commande (« 3 articles · 42,50 $ »). */
export type Suivie = { id: string; cle: string; libelle: string; icone: string | null; cree: number; resume?: string }
type Etat = { statut: StatutDemande; prise_par: string | null; cree_le: string }

const CLE = (code: string) => `tapora_suivi_${code}`
const OUVERTES: StatutDemande[] = ['nouvelle', 'prise']
/** Une demande envoyée ailleurs sur la page (la commande du panier) : le suivi la prend tout de suite. */
const EVENEMENT_SUIVI = 'tapora:suivi'

function lireSuivies(code: string): Suivie[] {
  try {
    const l = JSON.parse(localStorage.getItem(CLE(code)) ?? '[]') as Suivie[]
    // Au-delà de 6 heures, une demande n'a plus rien à faire à l'écran.
    return Array.isArray(l) ? l.filter((s) => s && typeof s.id === 'string' && Date.now() - s.cree < 6 * 3600_000).slice(-6) : []
  } catch {
    return []
  }
}
function ecrireSuivies(code: string, l: Suivie[]) {
  try {
    localStorage.setItem(CLE(code), JSON.stringify(l))
  } catch {
    // Stockage bloqué : le suivi vit le temps de la page.
  }
}

/**
 * Suivre une demande envoyée hors du centre des demandes (une commande) :
 * gardée sur le téléphone — l'accueil la montrera aussi — et annoncée au
 * suivi déjà affiché sur la page.
 */
export function ajouterSuivi(code: string, s: Suivie, nouvelle: boolean): void {
  const l = lireSuivies(code)
  if (!l.some((x) => x.id === s.id)) ecrireSuivies(code, [...l, s].slice(-6))
  window.dispatchEvent(new CustomEvent(EVENEMENT_SUIVI, { detail: { code, s, nouvelle } }))
}

/**
 * Le suivi en direct, partagé par le centre des demandes et par le menu (les
 * commandes) : ce qui est retenu sur le téléphone, interrogé toutes les 3 s
 * tant que c'est ouvert et que la page est visible ; une demande réglée part
 * en poussière.
 */
function useSuivi() {
  const { code, t } = useLieu()
  const [suivies, setSuivies] = useState<Suivie[]>([])
  const [etats, setEtats] = useState<Record<string, Etat>>({})
  const cartes = useRef(new Map<string, HTMLElement>())
  const precedents = useRef<Record<string, StatutDemande>>({})
  const partantes = useRef(new Set<string>())

  useEffect(() => setSuivies(lireSuivies(code)), [code])

  const suivre = useCallback(
    (s: Suivie, nouvelle: boolean) => {
      setSuivies((l) => {
        if (l.some((x) => x.id === s.id)) return l
        const n = [...l, s].slice(-6)
        ecrireSuivies(code, n)
        return n
      })
      if (nouvelle) {
        precedents.current[s.id] = 'nouvelle'
        setEtats((x) => ({ ...x, [s.id]: { statut: 'nouvelle', prise_par: null, cree_le: new Date().toISOString() } }))
      }
    },
    [code],
  )

  useEffect(() => {
    const recevoir = (e: Event) => {
      const d = (e as CustomEvent<{ code: string; s: Suivie; nouvelle: boolean }>).detail
      if (d?.code === code) suivre(d.s, d.nouvelle)
    }
    window.addEventListener(EVENEMENT_SUIVI, recevoir)
    return () => window.removeEventListener(EVENEMENT_SUIVI, recevoir)
  }, [code, suivre])

  const retirer = useCallback(
    (id: string) => {
      setSuivies((l) => {
        const n = l.filter((s) => s.id !== id)
        ecrireSuivies(code, n)
        return n
      })
      partantes.current.delete(id)
    },
    [code],
  )

  /** La carte s'en va en poussière, puis disparaît de la liste. */
  const dissoudre = useCallback(
    async (id: string) => {
      if (partantes.current.has(id)) return
      partantes.current.add(id)
      await desintegrer(cartes.current.get(id) ?? null, { duree: 850 })
      retirer(id)
    },
    [retirer],
  )

  // Le suivi en direct : toutes les 3 s, seulement ce qui est encore ouvert, seulement page visible.
  const ouvertes = suivies.filter((s) => !etats[s.id] || OUVERTES.includes(etats[s.id].statut))
  const cleOuvertes = ouvertes.map((s) => s.id).join(',')
  useEffect(() => {
    if (!cleOuvertes) return
    const ids = cleOuvertes.split(',')
    let vivant = true
    const tour = async () => {
      if (document.visibilityState !== 'visible') return
      await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await fetch(`/api/s/${code}/demande/${id}`, { cache: 'no-store' })
            if (!vivant) return
            if (r.status === 404) return retirer(id)
            if (!r.ok) return
            const e = (await r.json()) as Etat
            const avant = precedents.current[id]
            precedents.current[id] = e.statut
            if (avant === undefined && (e.statut === 'faite' || e.statut === 'annulee')) {
              // Revenue plus tard sur la page : une demande déjà réglée ne s'affiche plus.
              return retirer(id)
            }
            if (avant && avant !== e.statut) {
              if (e.statut === 'prise') {
                vibrer([10, 50, 10])
                toast(e.prise_par ? remplir(t.etatPrisNom, { nom: e.prise_par }) : t.etatPris, { texte: t.etatPrisSous, ton: 'info' })
              } else if (e.statut === 'faite') {
                vibrer([12, 40, 12, 40, 20])
                toast(t.etatFait, { texte: t.etatFaitSous, ton: 'succes' })
                setTimeout(() => void dissoudre(id), 9000)
              } else if (e.statut === 'annulee') {
                setTimeout(() => void dissoudre(id), 1500)
              }
            }
            setEtats((x) => ({ ...x, [id]: e }))
          } catch {
            // Réseau perdu : on réessaie au prochain tour.
          }
        }),
      )
    }
    void tour()
    const minuterie = setInterval(() => void tour(), 3000)
    const visible = () => document.visibilityState === 'visible' && void tour()
    document.addEventListener('visibilitychange', visible)
    return () => {
      vivant = false
      clearInterval(minuterie)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [cleOuvertes, code, retirer, dissoudre, t])

  async function annuler(id: string) {
    const ok = await annulerDemande(code, id).catch(() => false)
    if (!ok) return toast(t.etatPris, { texte: t.etatPrisSous, ton: 'info' })
    precedents.current[id] = 'annulee'
    vibrer(10)
    toast(t.etatAnnule, { ton: 'info' })
    await dissoudre(id)
  }

  // Une demande retrouvée dans le téléphone n'apparaît qu'une fois son état connu (pas d'éclair d'une demande déjà réglée).
  const affichees = suivies.filter((s) => etats[s.id])
  return { affichees, etats, cartes, suivre, annuler, dissoudre }
}

/**
 * Les demandes en un tap, et leur suivi en direct.
 *
 * Toucher une demande sans précision l'envoie tout de suite (la tuile
 * rebondit, un éclat, une vibration, un pop-up) ; avec précision, une
 * feuille demande le mot. Le suivi apparaît en haut — envoyée, prise (par
 * qui), faite — interrogé toutes les 3 s tant que la page est visible ;
 * « Annuler » tant que personne ne l'a prise, et la carte se désintègre.
 * Après « Appeler le serveur » ou « L'addition », la note est demandée
 * aussitôt.
 */
export default function CentreDemandes({
  types,
  limite,
  lienTout,
  avis,
  merci,
  accentPremier = false,
}: {
  types: TypeDemandeUi[]
  /** Sur l'accueil d'un hôtel : les premières seulement, puis « Toutes les demandes ». */
  limite?: number
  lienTout?: string
  /** null : les avis sont désactivés. Sinon le lien Google (https) s'il existe. */
  avis: { google: string | null } | null
  /** Le message de l'établissement après une demande. */
  merci?: string | null
  /** Restaurant : « Appeler le serveur » en couleur. */
  accentPremier?: boolean
}) {
  const { code, langue, t } = useLieu()
  const suivi = useSuivi()
  const [envoi, setEnvoi] = useState<string | null>(null)
  const [avecNote, setAvecNote] = useState<TypeDemandeUi | null>(null)
  const [note, setNote] = useState('')
  const [avisPour, setAvisPour] = useState<{ demandeId: string; cle: number } | null>(null)
  const tuiles = useRef(new Map<string, HTMLElement>())

  async function envoyer(type: TypeDemandeUi, precision: string | null) {
    if (envoi) return
    setEnvoi(type.cle)
    let r: Awaited<ReturnType<typeof demander>>
    try {
      r = await demander(code, type.cle, precision, langue)
    } catch {
      r = { etat: 'invalide' }
    }
    setEnvoi(null)
    if (r.etat === 'trop') return toast(t.trop, { ton: 'alerte', duree: 7000 })
    if (r.etat !== 'ok') return toast(t.erreur, { ton: 'erreur' })
    const { id, deja } = r
    const tuile = tuiles.current.get(type.cle) ?? null
    rebond(tuile)
    if (!deja) eclat(tuile)
    vibrer(deja ? 10 : [14, 60, 22])
    toast(deja ? t.dejaEnvoye : t.etatEnvoye, { texte: deja ? undefined : merci || t.etatEnvoyeSous, ton: deja ? 'info' : 'succes' })
    suivi.suivre({ id, cle: type.cle, libelle: type.libelle, icone: type.icone, cree: Date.now() }, !deja)
    // La note, juste après — sauf si elle vient d'être donnée (on ne harcèle pas).
    if (r.avis && avis && !avisRecent(code)) setTimeout(() => setAvisPour({ demandeId: id, cle: Date.now() }), 1100)
  }

  const visibles = limite ? types.slice(0, limite) : types
  const reste = limite ? types.length - visibles.length : 0

  return (
    <div className="space-y-4">
      <ListeSuivi suivi={suivi} merci={merci} />

      <div className="sv-grille sv-cascade">
        {visibles.map((type, i) => (
          <Tuile
            key={type.cle}
            ref={(el) => {
              if (el) tuiles.current.set(type.cle, el)
              else tuiles.current.delete(type.cle)
            }}
            icone={type.icone ?? '🔔'}
            titre={type.libelle}
            accent={accentPremier && i === 0}
            occupe={envoi === type.cle}
            onClick={() => {
              if (type.avec_note) {
                setNote('')
                setAvecNote(type)
              } else void envoyer(type, null)
            }}
          />
        ))}
        {reste > 0 && lienTout && <Tuile href={lienTout} icone="＋" titre={t.toutesDemandes} sous={t.demandesSous} large />}
      </div>

      <Feuille ouverte={Boolean(avecNote)} onFermer={() => setAvecNote(null)} titre={avecNote?.libelle} fermer={t.fermer}>
        {avecNote && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const type = avecNote
              setAvecNote(null)
              void envoyer(type, note.trim() || null)
            }}
          >
            <label className="sv-etiquette" htmlFor="sv-precision">
              {t.ajouterNote}
            </label>
            <textarea
              id="sv-precision"
              className="sv-champ mt-2"
              rows={3}
              maxLength={500}
              placeholder={t.notePlaceholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              autoFocus
            />
            <button type="submit" className="sv-bouton sv-bouton-plein mt-4">
              <span aria-hidden>{avecNote.icone ?? '🔔'}</span>
              {t.envoyer}
            </button>
          </form>
        )}
      </Feuille>

      {avis && (
        <Feuille ouverte={Boolean(avisPour)} onFermer={() => setAvisPour(null)} fermer={t.fermer}>
          {avisPour && <BlocAvis key={avisPour.cle} code={code} langue={langue} t={t} demandeId={avisPour.demandeId} google={avis.google} onFini={() => setAvisPour(null)} />}
        </Feuille>
      )}
    </div>
  )
}

/** Seulement le suivi (sur le menu : les commandes envoyées, et le reste) — rien si rien n'est en cours. */
export function SuiviEnCours({ merci, className = '' }: { merci?: string | null; className?: string }) {
  const suivi = useSuivi()
  if (!suivi.affichees.length) return null
  return (
    <div className={className}>
      <ListeSuivi suivi={suivi} merci={merci} />
    </div>
  )
}

function ListeSuivi({ suivi, merci }: { suivi: ReturnType<typeof useSuivi>; merci?: string | null }) {
  const { t } = useLieu()
  if (!suivi.affichees.length) return null
  return (
    <section aria-label={t.enCours} className="space-y-3">
      {suivi.affichees.map((s) => (
        <CarteSuivi
          key={s.id}
          ref={(el) => {
            if (el) suivi.cartes.current.set(s.id, el)
            else suivi.cartes.current.delete(s.id)
          }}
          suivie={s}
          etat={suivi.etats[s.id]}
          merci={merci}
          onAnnuler={() => void suivi.annuler(s.id)}
          onFermer={() => void suivi.dissoudre(s.id)}
        />
      ))}
    </section>
  )
}

/** Une demande en cours : où elle en est, depuis quand, et « Annuler » tant que personne ne l'a prise. */
const CarteSuivi = function CarteSuivi({
  ref,
  suivie,
  etat,
  merci,
  onAnnuler,
  onFermer,
}: {
  ref: (el: HTMLDivElement | null) => void
  suivie: Suivie
  etat: Etat | undefined
  merci?: string | null
  onAnnuler: () => void
  onFermer: () => void
}) {
  const { t } = useLieu()
  const [maintenant, setMaintenant] = useState(() => Date.now())
  const [annulation, setAnnulation] = useState(false)
  useEffect(() => {
    const i = setInterval(() => setMaintenant(Date.now()), 15_000)
    return () => clearInterval(i)
  }, [])
  const statut = etat?.statut ?? 'nouvelle'
  const depuis = etat ? new Date(etat.cree_le).getTime() : suivie.cree
  const minutes = Math.max(0, Math.floor((maintenant - depuis) / 60_000))
  const [avantN, apresN] = t.ilYa.split('{n}')
  const formatMinutes = useMemo(() => (v: number) => String(Math.round(v)), [])

  const titre =
    statut === 'prise' ? (etat?.prise_par ? remplir(t.etatPrisNom, { nom: etat.prise_par }) : t.etatPris) : statut === 'faite' ? t.etatFait : statut === 'annulee' ? t.etatAnnule : t.etatEnvoye
  const sous = statut === 'prise' ? t.etatPrisSous : statut === 'faite' ? t.etatFaitSous : statut === 'annulee' ? '' : merci || t.etatEnvoyeSous
  const etape = statut === 'nouvelle' ? 1 : statut === 'prise' ? 2 : 3

  return (
    <div ref={ref} className="sv-suivi sv-glisse-haut" data-etat={statut} role="status" aria-live="polite">
      <div className="flex items-center gap-3.5">
        <span className="sv-suivi-icone" data-etat={statut} aria-hidden>
          {statut === 'faite' ? '✓' : (suivie.icone ?? '🔔')}
        </span>
        <div className="min-w-0 flex-1">
          <p className="sv-suivi-quoi">
            {suivie.libelle}
            {suivie.resume ? <span className="sv-suivi-resume"> · {suivie.resume}</span> : null}
          </p>
          <p className="sv-suivi-titre">{titre}</p>
          <p className="sv-suivi-sous">
            {sous}
            {sous && statut !== 'faite' ? ' · ' : ''}
            {statut !== 'faite' &&
              (minutes < 1 ? (
                t.aLinstant
              ) : (
                <span className="whitespace-nowrap">
                  {avantN}
                  <Compteur valeur={minutes} format={formatMinutes} duree={900} />
                  {apresN}
                </span>
              ))}
          </p>
        </div>
        {statut === 'faite' && (
          <button type="button" className="sv-rond-bouton sv-rond-petit" onClick={onFermer} aria-label={t.fermer}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
      <div className="sv-etapes" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className="sv-etape" data-faite={n < etape || statut === 'faite'} data-encours={n === etape && statut !== 'faite'} />
        ))}
      </div>
      {statut === 'nouvelle' && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="sv-bouton sv-bouton-texte sv-bouton-mini"
            disabled={annulation}
            onClick={() => {
              setAnnulation(true)
              onAnnuler()
            }}
          >
            {t.annuler}
          </button>
        </div>
      )}
    </div>
  )
}
