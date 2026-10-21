'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Compteur from '@/components/effets/compteur'
import { desintegrer, vibrer } from '@/components/effets/desintegration'
import { toast } from '@/components/effets/toasts'
import { commander } from '@/app/s/[code]/actions'
import { useLieu } from './contexte'
import Feuille from './feuille'
import { ajouterSuivi } from './demande'
import { eclat, mouvementReduit, rebond, remplir } from './outils'

/**
 * Le panier d'une table ou d'une chambre : ce que le client ajoute depuis la
 * fiche d'un plat, retenu sur son téléphone (par emplacement, 12 heures),
 * puis envoyé d'un coup. Les noms et les prix gardés ici ne servent qu'à
 * l'affichage : le serveur relit tout dans le menu avant d'enregistrer.
 */
export type LignePanier = {
  /** plat + format + précision : deux fois le même, c'est la même ligne. */
  cle: string
  plat_id: string
  variante: number | null
  quantite: number
  note: string | null
  nom: string
  varianteNom: string | null
  prix: number | null
}

const MAX_LIGNES = 30
const MAX_QUANTITE = 20
const DUREE_MEMOIRE = 12 * 3600_000
const CLE = (code: string) => `tapora_panier_${code}`

type Memoire = { lignes: LignePanier[]; note: string; maj: number }

function lire(code: string): Memoire {
  try {
    const m = JSON.parse(localStorage.getItem(CLE(code)) ?? 'null') as Memoire | null
    if (!m || !Array.isArray(m.lignes) || Date.now() - (m.maj ?? 0) > DUREE_MEMOIRE) return { lignes: [], note: '', maj: Date.now() }
    const lignes = m.lignes
      .filter((l) => l && typeof l.plat_id === 'string' && typeof l.cle === 'string' && Number.isInteger(l.quantite) && l.quantite >= 1)
      .map((l) => ({ ...l, quantite: Math.min(MAX_QUANTITE, l.quantite) }))
      .slice(0, MAX_LIGNES)
    return { lignes, note: typeof m.note === 'string' ? m.note.slice(0, 500) : '', maj: m.maj }
  } catch {
    return { lignes: [], note: '', maj: Date.now() }
  }
}

function ecrire(code: string, m: Memoire) {
  try {
    if (!m.lignes.length && !m.note) localStorage.removeItem(CLE(code))
    else localStorage.setItem(CLE(code), JSON.stringify(m))
  } catch {
    // Stockage bloqué : le panier vit le temps de la page.
  }
}

export const clePanier = (platId: string, variante: number | null, note: string | null) => `${platId}:${variante ?? ''}:${note ?? ''}`

export type Panier = ReturnType<typeof usePanier>

export function usePanier(code: string) {
  const [lignes, setLignes] = useState<LignePanier[]>([])
  const [note, setNoteBrute] = useState('')
  const charge = useRef(false)

  useEffect(() => {
    const m = lire(code)
    setLignes(m.lignes)
    setNoteBrute(m.note)
    charge.current = true
  }, [code])

  // Chaque changement est retenu (après le premier chargement, pour ne pas effacer ce qui était gardé).
  useEffect(() => {
    if (charge.current) ecrire(code, { lignes, note, maj: Date.now() })
  }, [code, lignes, note])

  const ajouter = useCallback((l: Omit<LignePanier, 'cle'>) => {
    setLignes((avant) => {
      const cle = clePanier(l.plat_id, l.variante, l.note)
      if (avant.some((x) => x.cle === cle)) return avant.map((x) => (x.cle === cle ? { ...x, quantite: Math.min(MAX_QUANTITE, x.quantite + l.quantite) } : x))
      if (avant.length >= MAX_LIGNES) return avant
      return [...avant, { ...l, cle, quantite: Math.min(MAX_QUANTITE, l.quantite) }]
    })
  }, [])
  /** Une nouvelle ligne a-t-elle encore sa place (30 plats différents au plus) ? */
  const place = useCallback((platId: string, variante: number | null, note: string | null) => lignes.length < MAX_LIGNES || lignes.some((x) => x.cle === clePanier(platId, variante, note)), [lignes])

  const changer = useCallback((cle: string, quantite: number) => {
    setLignes((avant) => avant.map((x) => (x.cle === cle ? { ...x, quantite: Math.max(1, Math.min(MAX_QUANTITE, quantite)) } : x)))
  }, [])

  const retirer = useCallback((cle: string) => setLignes((avant) => avant.filter((x) => x.cle !== cle)), [])
  const retirerPlats = useCallback((ids: string[]) => setLignes((avant) => avant.filter((x) => !ids.includes(x.plat_id))), [])
  const vider = useCallback(() => {
    setLignes([])
    setNoteBrute('')
  }, [])
  const setNote = useCallback((v: string) => setNoteBrute(v.slice(0, 500)), [])

  const nombre = lignes.reduce((n, l) => n + l.quantite, 0)
  const total = Math.round(lignes.reduce((t, l) => t + (l.prix ?? 0) * l.quantite, 0) * 100) / 100
  const prixInconnu = lignes.some((l) => l.prix === null)
  /** Combien de ce plat (tous formats) est déjà dans le panier : la pastille « ×2 » du menu. */
  const quantites = useMemo(() => {
    const m: Record<string, number> = {}
    for (const l of lignes) m[l.plat_id] = (m[l.plat_id] ?? 0) + l.quantite
    return m
  }, [lignes])

  return { lignes, note, setNote, ajouter, place, changer, retirer, retirerPlats, vider, nombre, total, prixInconnu, quantites }
}

/** Un format de prix stable (le compteur ne repart pas à chaque rendu) : 24 $, 42,50 $. */
export function useFormatPrix(monnaie: { locale: string; devise: string }) {
  return useMemo(() => {
    const entier = new Intl.NumberFormat(monnaie.locale, { style: 'currency', currency: monnaie.devise || 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
    const cents = new Intl.NumberFormat(monnaie.locale, { style: 'currency', currency: monnaie.devise || 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return (v: number) => {
      try {
        return (Number.isInteger(Math.round(v * 100) / 100) ? entier : cents).format(v)
      } catch {
        return `${v.toFixed(2)} $`
      }
    }
  }, [monnaie.locale, monnaie.devise])
}

/** La barre du panier, posée en bas de l'écran : le nombre d'articles, le total qui roule, « Voir la commande ». */
export function BarrePanier({
  panier,
  montrerPrix,
  formatPrix,
  onOuvrir,
}: {
  panier: Panier
  montrerPrix: boolean
  formatPrix: (v: number) => string
  onOuvrir: () => void
}) {
  const { t } = useLieu()
  const ref = useRef<HTMLButtonElement>(null)
  const avant = useRef(panier.nombre)
  // Chaque ajout fait sauter la barre, comme une pièce qui tombe dans le panier.
  useEffect(() => {
    if (panier.nombre > avant.current) rebond(ref.current)
    avant.current = panier.nombre
  }, [panier.nombre])
  const formatNombre = useMemo(() => (v: number) => String(Math.round(v)), [])
  if (!panier.nombre) return null
  return (
    <div className="sv-panier-zone">
      <button ref={ref} type="button" className="sv-panier-barre" onClick={onOuvrir} aria-label={`${t.voirCommande} · ${remplir(panier.nombre === 1 ? t.article : t.articles, { n: panier.nombre })}`}>
        <span className="sv-panier-nombre" aria-hidden>
          <Compteur valeur={panier.nombre} format={formatNombre} duree={600} />
        </span>
        <span className="sv-panier-libelle">{t.voirCommande}</span>
        {montrerPrix && panier.total > 0 && (
          <span className="sv-panier-total" aria-hidden>
            <Compteur valeur={panier.total} format={formatPrix} duree={900} />
          </span>
        )}
      </button>
    </div>
  )
}

/**
 * La commande, avant l'envoi : les lignes (quantités, retirer — la ligne part
 * en poussière), un mot pour la cuisine, le total, et comment on paie.
 * « Envoyer la commande » : le serveur recalcule tout ; une commande partie
 * se suit ensuite en direct comme les autres demandes.
 */
export function FeuillePanier({
  ouverte,
  onFermer,
  panier,
  hotel,
  montrerPrix,
  formatPrix,
  merci,
}: {
  ouverte: boolean
  onFermer: () => void
  panier: Panier
  hotel: boolean
  montrerPrix: boolean
  formatPrix: (v: number) => string
  merci?: string | null
}) {
  const { code, langue, t } = useLieu()
  const [envoi, setEnvoi] = useState(false)
  const lignesEl = useRef(new Map<string, HTMLElement>())
  const bouton = useRef<HTMLButtonElement>(null)
  const partantes = useRef(new Set<string>())

  async function retirer(cle: string) {
    if (partantes.current.has(cle)) return
    partantes.current.add(cle)
    vibrer(8)
    await desintegrer(lignesEl.current.get(cle) ?? null, { duree: 700, particules: 30 })
    partantes.current.delete(cle)
    panier.retirer(cle)
  }

  async function envoyer() {
    if (envoi || !panier.lignes.length) return
    setEnvoi(true)
    const lignes = panier.lignes.map((l) => ({ plat_id: l.plat_id, variante: l.variante, quantite: l.quantite, note: l.note }))
    let r: Awaited<ReturnType<typeof commander>>
    try {
      r = await commander(code, lignes, panier.note.trim() || null, langue)
    } catch {
      r = { etat: 'invalide' }
    }
    setEnvoi(false)
    if (r.etat === 'trop') return toast(t.trop, { ton: 'alerte', duree: 7000 })
    if (r.etat === 'ferme') return toast(t.commandesFermees, { ton: 'alerte', duree: 6000 })
    if (r.etat === 'indisponible') {
      panier.retirerPlats(r.plats)
      vibrer([20, 40, 20])
      return toast(t.platsRetires, { ton: 'alerte', duree: 7000 })
    }
    if (r.etat !== 'ok') return toast(t.erreur, { ton: 'erreur' })

    rebond(bouton.current)
    if (!r.deja) eclat(bouton.current)
    vibrer(r.deja ? 10 : [14, 60, 22])
    const articles = remplir(r.articles === 1 ? t.article : t.articles, { n: r.articles })
    const resume = montrerPrix && r.total !== null ? `${articles} · ${formatPrix(r.total)}` : articles
    toast(r.deja ? t.dejaEnvoye : t.commandeEnvoyee, { texte: r.deja ? undefined : merci || t.commandeEnvoyeeSous, ton: r.deja ? 'info' : 'succes' })
    ajouterSuivi(code, { id: r.id, cle: 'commande', libelle: t.commande, icone: '🍽️', cree: Date.now(), resume }, !r.deja)
    // Le temps de voir l'éclat, puis la feuille redescend et le suivi apparaît en haut de la page.
    setTimeout(
      () => {
        panier.vider()
        onFermer()
        window.scrollTo({ top: 0, behavior: mouvementReduit() ? 'auto' : 'smooth' })
      },
      mouvementReduit() ? 0 : 420,
    )
  }

  const formatNombre = useMemo(() => (v: number) => String(Math.round(v)), [])

  return (
    <Feuille ouverte={ouverte} onFermer={onFermer} titre={t.panier} fermer={t.fermer}>
      {panier.lignes.length === 0 ? (
        <div className="sv-vide">
          <span aria-hidden>🛎️</span>
          <p>{t.panierVide}</p>
        </div>
      ) : (
        <div className="space-y-5">
          <ul className="sv-panier-lignes">
            {panier.lignes.map((l) => (
              <li
                key={l.cle}
                ref={(el) => {
                  if (el) lignesEl.current.set(l.cle, el)
                  else lignesEl.current.delete(l.cle)
                }}
                className="sv-panier-ligne"
              >
                <div className="min-w-0 flex-1">
                  <p className="sv-panier-nom">{l.nom}</p>
                  {(l.varianteNom || l.note) && (
                    <p className="sv-panier-detail">
                      {l.varianteNom}
                      {l.varianteNom && l.note ? ' · ' : ''}
                      {l.note ? `« ${l.note} »` : ''}
                    </p>
                  )}
                  {montrerPrix && <p className="sv-panier-prix">{l.prix === null ? t.prixAConfirmer : formatPrix(l.prix * l.quantite)}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Quantite valeur={l.quantite} onChanger={(q) => panier.changer(l.cle, q)} />
                  <button type="button" className="sv-lien text-[0.82rem]" onClick={() => void retirer(l.cle)}>
                    {t.retirer}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div>
            <label className="sv-etiquette" htmlFor="sv-note-cuisine">
              {t.noteCuisine}
            </label>
            <textarea
              id="sv-note-cuisine"
              className="sv-champ mt-2"
              rows={2}
              maxLength={500}
              placeholder={t.noteCuisineEx}
              value={panier.note}
              onChange={(e) => panier.setNote(e.target.value)}
            />
          </div>

          {montrerPrix && (
            <div className="sv-panier-somme">
              <span>{t.total}</span>
              <strong>
                <Compteur valeur={panier.total} format={formatPrix} duree={900} />
              </strong>
            </div>
          )}
          {montrerPrix && panier.prixInconnu && <p className="sv-doux -mt-3 text-end text-[0.82rem]">+ {t.prixAConfirmer.toLowerCase()}</p>}

          <p className="sv-panier-paiement">
            <span aria-hidden>{hotel ? '🛎️' : '🧾'}</span>
            {hotel ? t.porteChambre : t.paiementAddition}
          </p>

          <button ref={bouton} type="button" className="sv-bouton sv-bouton-plein" disabled={envoi} aria-busy={envoi} onClick={() => void envoyer()}>
            {envoi ? (
              <>
                <span className="sv-rond" aria-hidden />
                {t.envoi}
              </>
            ) : (
              <>
                <span aria-hidden>🍽️</span>
                {t.envoyerCommande}
                <span className="sv-bouton-compte" aria-hidden>
                  {montrerPrix && panier.total > 0 ? <Compteur valeur={panier.total} format={formatPrix} duree={700} /> : <Compteur valeur={panier.nombre} format={formatNombre} duree={500} />}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </Feuille>
  )
}

/** − 1 + : la quantité d'une ligne (1 à 20). */
export function Quantite({ valeur, onChanger, grand = false }: { valeur: number; onChanger: (q: number) => void; grand?: boolean }) {
  const { t } = useLieu()
  const formatNombre = useMemo(() => (v: number) => String(Math.round(v)), [])
  return (
    <div className="sv-quantite" data-grand={grand} role="group" aria-label={t.quantite}>
      <button type="button" onClick={() => onChanger(valeur - 1)} disabled={valeur <= 1} aria-label={t.unDeMoins}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
          <path d="M6 12h12" />
        </svg>
      </button>
      <output aria-live="polite">
        <Compteur valeur={valeur} format={formatNombre} duree={450} />
      </output>
      <button type="button" onClick={() => onChanger(valeur + 1)} disabled={valeur >= MAX_QUANTITE} aria-label={t.unDePlus}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
          <path d="M12 6v12M6 12h12" />
        </svg>
      </button>
    </div>
  )
}
