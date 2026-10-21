'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileJson } from '@/lib/services/portail'
import type { Demande } from '@/lib/services/types'
import { drapeau, nomLangue } from '@/lib/services/langues'
import { prendreAction, rouvrirAction, terminerAction } from '@/app/service/[jeton]/actions'
import { desintegrer, vibrer } from '@/components/effets/desintegration'
import { toast } from '@/components/effets/toasts'
import Fenetre from '@/components/effets/fenetre'
import Inclinaison from '@/components/effets/inclinaison'
import { TEXTES_PORTAIL, duree, type LanguePortail } from '@/components/services/portail/textes'
import PanneauAppareil from '@/components/services/portail/panneau-appareil'
import AstuceInstallation from '@/components/services/portail/astuce-installation'
import Chiffre from '@/components/services/portail/chiffre'
import { annoncerBadges } from '@/components/services/portail/badge-direct'

const SONDAGE_MS = 4000
/** Un geste local l'emporte sur un sondage parti avant lui, pendant ce délai. */
const OPTIMISTE_MS = 10000

type Urgence = 'calme' | 'attention' | 'urgent'
const urgence = (sec: number): Urgence => (sec < 120 ? 'calme' : sec < 300 ? 'attention' : 'urgent')

type Optimiste = { statut: 'prise' | 'faite'; champs: Partial<Demande>; jusqua: number }

function lireLocal(cle: string): string | null {
  try {
    return localStorage.getItem(cle)
  } catch {
    return null
  }
}
function ecrireLocal(cle: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(cle)
    else localStorage.setItem(cle, v)
  } catch {}
}

/** Applique les gestes locaux encore frais sur une réponse du serveur (qui peut être partie avant eux). */
function fusionner(d: FileJson, gestes: Map<string, Optimiste>): FileJson {
  if (!gestes.size) return d
  const t = Date.now()
  let ouvertes = d.ouvertes
  let faites = d.faites
  for (const [id, g] of gestes) {
    const serveurFaite = faites.some((x) => x.id === id)
    const ouverte = ouvertes.find((x) => x.id === id)
    // Le serveur est d'accord (ou le geste a expiré) : on oublie le geste.
    if (g.jusqua < t || (g.statut === 'faite' && serveurFaite) || (g.statut === 'prise' && ouverte?.statut === 'prise') || (!ouverte && !serveurFaite)) {
      gestes.delete(id)
      continue
    }
    if (!ouverte) continue
    if (g.statut === 'faite') {
      ouvertes = ouvertes.filter((x) => x.id !== id)
      faites = [{ ...ouverte, ...g.champs, statut: 'faite' }, ...faites]
    } else if (ouverte.statut === 'nouvelle') {
      ouvertes = ouvertes.map((x) => (x.id === id ? { ...x, ...g.champs, statut: 'prise' } : x))
    }
  }
  return { ...d, ouvertes, faites }
}

/**
 * La file en direct : ce que les clients demandent, en ce moment. Sondée
 * toutes les 4 secondes ; une nouvelle demande arrive avec un ressort, sonne
 * (si le son est activé), illumine l'écran, fait vibrer et s'annonce en
 * pop-up. « J'arrive » montre au client que quelqu'un vient ; « Fait »
 * désintègre la carte (annulable quelques secondes).
 */
export default function FileLive({
  jeton,
  l,
  initial,
  groupes,
  type,
  langueDefaut,
  fuseau,
  cle,
}: {
  jeton: string
  l: LanguePortail
  initial: FileJson
  groupes: string[]
  type: 'restaurant' | 'hotel'
  langueDefaut: string
  fuseau: string
  /** Préfixe des réglages retenus sur l'appareil (un par établissement). */
  cle: string
}) {
  const T = TEXTES_PORTAIL[l]
  const [donnees, setDonnees] = useState<FileJson>(initial)
  // Rendu serveur et premier rendu client sur la même horloge (celle du serveur) : pas d'écart d'hydratation.
  const [decalage, setDecalage] = useState(0)
  const [recuLe, setRecuLe] = useState(() => Date.parse(initial.maintenant))
  const [tic, setTic] = useState(() => Date.parse(initial.maintenant))
  const [horsLigne, setHorsLigne] = useState(false)
  const [filtre, setFiltre] = useState<string | null>(null)
  const [prenom, setPrenom] = useState('')
  const [son, setSon] = useState<'actif' | 'a-reactiver' | 'inactif'>('inactif')
  const [panneau, setPanneau] = useState(false)
  const [annulation, setAnnulation] = useState<{ n: number; texte: string; annuler: () => void } | null>(null)
  const [arrivees, setArrivees] = useState<Set<string>>(new Set())
  const [sortantes, setSortantes] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<string | null>(null)
  const [eclair, setEclair] = useState(0)
  const vues = useRef<Set<string>>(new Set(initial.ouvertes.map((d) => d.id)))
  const gestes = useRef<Map<string, Optimiste>>(new Map())
  const filtreRef = useRef<string | null>(null)
  const audio = useRef<AudioContext | null>(null)
  const echecs = useRef(0)
  const titreBase = useRef('')
  const minuterieAnnulation = useRef<ReturnType<typeof setTimeout> | null>(null)
  filtreRef.current = filtre

  // ---- Horloge et réglages retenus sur cet appareil
  useEffect(() => {
    const t = Date.now()
    setDecalage(Date.parse(initial.maintenant) - t)
    setRecuLe(t)
    setTic(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setFiltre(lireLocal(`${cle}:filtre`))
    setPrenom(lireLocal('tapora_portail_prenom') ?? '')
    if (lireLocal(`${cle}:son`) === '1') setSon('a-reactiver')
    titreBase.current = document.title.replace(/^\(\d+\)\s*/, '')
  }, [cle])

  const ding = useCallback(() => {
    const ctx = audio.current
    if (!ctx || ctx.state !== 'running') return
    const t = ctx.currentTime
    // Deux notes claires, comme une sonnette de comptoir.
    for (const [f, d] of [
      [987.77, 0],
      [1318.51, 0.13],
    ] as const) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t + d)
      g.gain.exponentialRampToValueAtTime(0.32, t + d + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.7)
      o.connect(g).connect(ctx.destination)
      o.start(t + d)
      o.stop(t + d + 0.75)
    }
  }, [])

  const activerSon = useCallback(async () => {
    try {
      audio.current ??= new AudioContext()
      await audio.current.resume()
      setSon('actif')
      ecrireLocal(`${cle}:son`, '1')
      ding()
    } catch {
      setSon('inactif')
    }
  }, [cle, ding])

  const couperSon = useCallback(() => {
    setSon('inactif')
    ecrireLocal(`${cle}:son`, null)
  }, [cle])

  // Le son était activé sur cet appareil : le navigateur exige un geste, le premier toucher le réactive.
  useEffect(() => {
    if (son !== 'a-reactiver') return
    const reveil = () => void activerSon()
    document.addEventListener('pointerdown', reveil, { once: true })
    document.addEventListener('keydown', reveil, { once: true })
    return () => {
      document.removeEventListener('pointerdown', reveil)
      document.removeEventListener('keydown', reveil)
    }
  }, [son, activerSon])

  const proposerAnnulation = useCallback((texte: string, annuler: () => void) => {
    if (minuterieAnnulation.current) clearTimeout(minuterieAnnulation.current)
    setAnnulation((a) => ({ n: (a?.n ?? 0) + 1, texte, annuler }))
    minuterieAnnulation.current = setTimeout(() => setAnnulation(null), 6000)
  }, [])

  // ---- Le sondage
  const rafraichir = useCallback(async () => {
    try {
      const r = await fetch(`/api/service/${jeton}/file`, { cache: 'no-store' })
      if (r.status === 401) return window.location.reload()
      if (!r.ok) throw new Error()
      const d = fusionner((await r.json()) as FileJson, gestes.current)
      echecs.current = 0
      setHorsLigne(false)
      setDecalage(Date.parse(d.maintenant) - Date.now())
      setRecuLe(Date.now())
      const neuves = d.ouvertes.filter((x) => x.statut === 'nouvelle' && !vues.current.has(x.id))
      d.ouvertes.forEach((x) => vues.current.add(x.id))
      // Seul le secteur suivi sonne : la terrasse n'est pas dérangée par le bar.
      const f = filtreRef.current
      const pourMoi = neuves.filter((x) => !f || x.groupe === f)
      if (pourMoi.length) {
        ding()
        vibrer([120, 60, 120])
        setEclair((n) => n + 1)
        setArrivees(new Set(pourMoi.map((x) => x.id)))
        setTimeout(() => setArrivees(new Set()), 2600)
        for (const x of pourMoi.slice(0, 2)) {
          toast(T.nouvelleDemande(x.emplacement ?? '—', x.libelle), { ton: 'info', texte: x.note ?? x.groupe ?? undefined, duree: 6500 })
        }
        if (pourMoi.length > 2) toast(T.plusQue(pourMoi.length - 2), { ton: 'info', duree: 6500 })
      }
      setDonnees(d)
      annoncerBadges({ ouvertes: d.pouls.ouvertes, nonLus: d.nonLus })
    } catch {
      echecs.current += 1
      if (echecs.current >= 2) setHorsLigne(true)
    }
  }, [jeton, ding, T])

  useEffect(() => {
    const i = setInterval(rafraichir, SONDAGE_MS)
    const visible = () => document.visibilityState === 'visible' && rafraichir()
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('online', rafraichir)
    return () => {
      clearInterval(i)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('online', rafraichir)
    }
  }, [rafraichir])

  useEffect(() => {
    const i = setInterval(() => setTic(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])

  // ---- Ce qu'on affiche (filtré par secteur)
  const dansFiltre = useCallback((d: Demande) => !filtre || d.groupe === filtre, [filtre])
  const nouvelles = useMemo(() => donnees.ouvertes.filter((d) => d.statut === 'nouvelle' && dansFiltre(d)), [donnees, dansFiltre])
  const enCours = useMemo(
    () => donnees.ouvertes.filter((d) => d.statut === 'prise' && dansFiltre(d)).sort((a, b) => Date.parse(a.prise_le ?? a.cree_le) - Date.parse(b.prise_le ?? b.cree_le)),
    [donnees, dansFiltre],
  )
  const faites = useMemo(() => donnees.faites.filter(dansFiltre), [donnees, dansFiltre])
  const maintenant = tic + decalage

  useEffect(() => {
    if (!titreBase.current) return
    document.title = nouvelles.length ? `(${nouvelles.length}) ${titreBase.current}` : titreBase.current
  }, [nouvelles.length])
  useEffect(
    () => () => {
      if (titreBase.current) document.title = titreBase.current
    },
    [],
  )

  // ---- Les gestes (affichés tout de suite, confirmés par le serveur)
  const appliquer = (id: string, g: Optimiste) => {
    gestes.current.set(id, g)
    setDonnees((d) => fusionner(d, gestes.current))
  }

  async function prendre(d: Demande) {
    if (d.statut !== 'nouvelle' || sortantes.has(d.id)) return
    vibrer(10)
    appliquer(d.id, { statut: 'prise', champs: { prise_par: prenom || null, prise_le: new Date(maintenant).toISOString() }, jusqua: Date.now() + OPTIMISTE_MS })
    const ok = await prendreAction(jeton, d.id, prenom || null).catch(() => false)
    if (!ok) {
      gestes.current.delete(d.id)
      toast(T.erreur, { ton: 'erreur' })
    } else toast(T.enRouteToast(d.emplacement ?? '—'), { ton: 'info', duree: 2600 })
    rafraichir()
  }

  async function terminer(d: Demande) {
    if (sortantes.has(d.id)) return
    setSortantes((s) => new Set(s).add(d.id))
    setDetail(null)
    vibrer(18)
    const lieu = d.emplacement ?? '—'
    // Le serveur travaille pendant que la carte part en poussière.
    const action = terminerAction(jeton, d.id, prenom || null).catch(() => false)
    const el = document.querySelector<HTMLElement>(`[data-demande="${d.id}"]`)
    // Poussière champagne : la couleur de la carte (presque noire la nuit) ne se verrait pas.
    await desintegrer(el, { duree: 850, couleur: el ? getComputedStyle(el).getPropertyValue('--p-or-clair').trim() || undefined : undefined })
    appliquer(d.id, {
      statut: 'faite',
      champs: { faite_le: new Date(Date.now() + decalage).toISOString(), prise_par: d.prise_par ?? (prenom || null) },
      jusqua: Date.now() + OPTIMISTE_MS,
    })
    setSortantes((s) => {
      const n = new Set(s)
      n.delete(d.id)
      return n
    })
    if (!(await action)) {
      gestes.current.delete(d.id)
      toast(T.erreur, { ton: 'erreur' })
    } else {
      toast(T.demandeTerminee(lieu), { ton: 'succes', texte: d.libelle })
      proposerAnnulation(T.marqueeFaite(`${lieu} · ${d.libelle}`), async () => {
        setAnnulation(null)
        gestes.current.delete(d.id)
        vues.current.add(d.id)
        const ok = await rouvrirAction(jeton, d.id).catch(() => false)
        toast(ok ? T.rouverte : T.erreur, { ton: ok ? 'info' : 'erreur', duree: 2600 })
        rafraichir()
      })
    }
    rafraichir()
  }

  async function rouvrir(d: Demande) {
    gestes.current.delete(d.id)
    vues.current.add(d.id)
    const ok = await rouvrirAction(jeton, d.id).catch(() => false)
    toast(ok ? T.rouverte : T.erreur, { ton: ok ? 'info' : 'erreur', duree: 2600 })
    rafraichir()
  }

  function choisirFiltre(g: string | null) {
    setFiltre(g)
    ecrireLocal(`${cle}:filtre`, g)
  }

  const fermerDetail = useCallback(() => setDetail(null), [])
  const fermerPanneau = useCallback(() => setPanneau(false), [])
  const enDetail = detail ? (donnees.ouvertes.find((x) => x.id === detail) ?? donnees.faites.find((x) => x.id === detail) ?? null) : null

  const p = donnees.pouls
  const plusAncienne = p.plusAncienneSec === null ? null : p.plusAncienneSec + Math.max(0, tic - recuLe) / 1000
  const carte = (d: Demande, arrivee: boolean) => (
    <CarteDemande
      key={d.id}
      d={d}
      l={l}
      maintenant={maintenant}
      langueDefaut={langueDefaut}
      arrivee={arrivee}
      sortante={sortantes.has(d.id)}
      onPrendre={() => prendre(d)}
      onTerminer={() => terminer(d)}
      onDetail={() => setDetail(d.id)}
    />
  )

  return (
    <div>
      <div className="pt-eclair" data-actif={eclair ? 'true' : 'false'} key={eclair} aria-hidden />

      {/* ---- Le pouls */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tuile libelle={T.ouvertes} accent={p.ouvertes > 0} premium>
          <Chiffre valeur={p.ouvertes} l={l} />
        </Tuile>
        <Tuile libelle={T.plusAncienne} ton={plusAncienne === null ? undefined : urgence(plusAncienne)}>
          {plusAncienne === null ? T.aucune : <Chiffre valeur={Math.round(plusAncienne)} genre="duree" l={l} duree={550} />}
        </Tuile>
        <Tuile libelle={T.visitesHeure}>
          <Chiffre valeur={p.visitesHeure} l={l} />
        </Tuile>
        <Tuile libelle={T.aujourdhui}>
          <Chiffre valeur={p.demandesAujourdhui} l={l} />
        </Tuile>
      </div>

      {/* ---- Barre d'outils */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 items-center gap-2 text-sm font-semibold">
            <span className="pt-point-direct" data-hors-ligne={horsLigne ? 'true' : 'false'} aria-hidden />
            {horsLigne ? <span className="text-[var(--p-rouge)]">{T.connexionPerdue}</span> : <span>{T.onglets.file}</span>}
          </span>
          {groupes.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Secteurs">
              <button type="button" className="pt-puce" aria-pressed={filtre === null} onClick={() => choisirFiltre(null)}>
                {T.tout}
              </button>
              {groupes.map((g) => (
                <button key={g} type="button" className="pt-puce" aria-pressed={filtre === g} onClick={() => choisirFiltre(g)}>
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {son !== 'actif' ? (
            <button type="button" onClick={activerSon} className={`pt-bouton-doux !py-2.5 text-sm ${son === 'a-reactiver' ? '!border-[var(--p-or-clair)]' : ''}`}>
              🔕 {T.sonActiver}
            </button>
          ) : (
            <button type="button" onClick={couperSon} className="pt-bouton-doux !py-2.5 text-sm" title={T.son}>
              🔔 {T.sonActif}
            </button>
          )}
          <button type="button" onClick={() => setPanneau(true)} className="pt-bouton-doux !py-2.5 text-sm">
            <span aria-hidden>👤</span> {prenom || T.cetAppareil}
          </button>
        </div>
      </div>

      <AstuceInstallation l={l} />

      {/* ---- Nouvelles · En cours */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2" aria-live="polite">
        <Colonne titre={T.nouvelles} n={nouvelles.length} ton="accent">
          {nouvelles.length === 0 ? <Vide emoji="✨" texte={T.rienNouvelles} /> : nouvelles.map((d) => carte(d, arrivees.has(d.id)))}
        </Colonne>
        <Colonne titre={T.enCours} n={enCours.length}>
          {enCours.length === 0 ? <Vide emoji={type === 'hotel' ? '🛎️' : '🍽️'} texte={T.rienEnCours} /> : enCours.map((d) => carte(d, false))}
        </Colonne>
      </div>

      {/* ---- Faites aujourd'hui */}
      <details className="pt-carte mt-5 overflow-hidden" open>
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold">
          <span>
            {T.faites} <span className="ml-1 text-[var(--p-faible)]">{faites.length}</span>
          </span>
          <span className="hidden text-xs font-normal text-[var(--p-faible)] md:inline">{T.raccourcis}</span>
        </summary>
        {faites.length === 0 ? (
          <p className="border-t pt-sep px-5 py-5 text-sm text-[var(--p-doux)]">{T.rienFaites}</p>
        ) : (
          <ul className="divide-y divide-[var(--p-ligne)] border-t pt-sep">
            {faites.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--p-surface-2)] text-lg" aria-hidden>
                  {d.icone ?? '🔔'}
                </span>
                <button type="button" onClick={() => setDetail(d.id)} className="min-w-0 flex-1 text-left">
                  <span className="font-semibold">{d.emplacement ?? '—'}</span>
                  <span className="text-[var(--p-doux)]"> · {d.libelle}</span>
                  <span className="block text-xs text-[var(--p-faible)]">
                    {d.statut === 'annulee'
                      ? T.annulee
                      : `${T.faitIlYa(duree((maintenant - Date.parse(d.faite_le ?? d.cree_le)) / 1000, l))}${d.prise_par ? ` · ${d.prise_par}` : ''}`}
                  </span>
                </button>
                <button type="button" onClick={() => rouvrir(d)} className="pt-bouton-fantome !py-2 text-xs">
                  ↺ {T.rouvrir}
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>

      {/* ---- Le détail d'une demande */}
      <Fenetre ouverte={Boolean(enDetail)} fermer={fermerDetail} titre={enDetail ? `${enDetail.emplacement ?? '—'} · ${enDetail.libelle}` : T.details} largeur="max-w-md">
        {enDetail && (
          <DetailDemande
            d={enDetail}
            l={l}
            fuseau={fuseau}
            maintenant={maintenant}
            langueDefaut={langueDefaut}
            onPrendre={() => prendre(enDetail)}
            onTerminer={() => terminer(enDetail)}
            onRouvrir={() => {
              setDetail(null)
              rouvrir(enDetail)
            }}
          />
        )}
      </Fenetre>

      {panneau && (
        <PanneauAppareil
          jeton={jeton}
          l={l}
          cle={cle}
          prenom={prenom}
          groupes={groupes}
          son={son === 'actif'}
          onPrenom={(v) => {
            setPrenom(v)
            ecrireLocal('tapora_portail_prenom', v || null)
          }}
          onSon={(v) => (v ? activerSon() : couperSon())}
          onFermer={fermerPanneau}
        />
      )}

      {annulation && (
        <div className="pt-toast" role="status" key={annulation.n}>
          <span className="max-w-[16rem] truncate">{annulation.texte}</span>
          <button type="button" onClick={annulation.annuler}>
            ↺ {T.annuler}
          </button>
          <span className="pt-toast-temps" aria-hidden />
        </div>
      )}
    </div>
  )
}

const TON_TUILE = { calme: 'text-[var(--p-vert)]', attention: 'text-[var(--p-ambre)]', urgent: 'text-[var(--p-rouge)]' } as const

function Tuile({ libelle, accent, ton, premium, children }: { libelle: string; accent?: boolean; ton?: Urgence; premium?: boolean; children: React.ReactNode }) {
  const couleur = ton ? TON_TUILE[ton] : accent ? 'text-[var(--accent)]' : ''
  return (
    // L'apparition anime le support, l'inclinaison la carte : deux transformations qui ne se marchent pas dessus.
    <div className="pt-apparait">
      <Inclinaison className="h-full" intensite={6}>
        <div className={`pt-kpi ${premium ? 'reflet-premium' : ''}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--p-doux)]">{libelle}</p>
          <p className={`pt-valeur mt-2 text-[2.1rem] sm:text-[2.6rem] ${couleur}`}>{children}</p>
        </div>
      </Inclinaison>
    </div>
  )
}

function Colonne({ titre, n, ton, children }: { titre: string; n: number; ton?: 'accent'; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--p-doux)]">
        {titre}
        <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${ton === 'accent' && n ? 'bg-[var(--accent)] text-[var(--accent-texte)]' : 'bg-[var(--p-surface-2)] text-[var(--p-doux)]'}`}>{n}</span>
      </h2>
      <div className="cascade space-y-3">{children}</div>
    </section>
  )
}

function Vide({ emoji, texte }: { emoji: string; texte: string }) {
  return (
    <div className="pt-carte-plate flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-[var(--p-surface)] text-2xl shadow-sm ring-1 ring-[var(--p-ligne)]" aria-hidden>
        {emoji}
      </span>
      <p className="max-w-xs text-sm text-[var(--p-doux)]">{texte}</p>
    </div>
  )
}

function CarteDemande({
  d,
  l,
  maintenant,
  langueDefaut,
  arrivee,
  sortante,
  onPrendre,
  onTerminer,
  onDetail,
}: {
  d: Demande
  l: LanguePortail
  maintenant: number
  langueDefaut: string
  arrivee: boolean
  sortante: boolean
  onPrendre: () => void
  onTerminer: () => void
  onDetail: () => void
}) {
  const T = TEXTES_PORTAIL[l]
  const depuis = (maintenant - Date.parse(d.statut === 'prise' ? (d.prise_le ?? d.cree_le) : d.cree_le)) / 1000
  const attente = (maintenant - Date.parse(d.cree_le)) / 1000
  const u = d.statut === 'prise' ? 'calme' : urgence(attente)
  return (
    <article
      data-demande={d.id}
      tabIndex={0}
      data-urgence={u}
      data-statut={d.statut}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'j' || e.key === 'J') onPrendre()
        if (e.key === 'f' || e.key === 'F') onTerminer()
        if (e.key === 'Enter') onDetail()
      }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) onDetail()
      }}
      className={`pt-demande cursor-pointer p-5 pl-6 ${arrivee ? 'pt-nouvelle' : ''} ${sortante ? 'pt-sortie' : ''}`}
      aria-label={`${d.emplacement ?? ''} — ${d.libelle}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="titre-portail truncate text-[1.65rem] font-medium leading-tight sm:text-[1.85rem]">{d.emplacement ?? '—'}</p>
          {d.groupe && <p className="pt-surtitre mt-1 !text-[var(--p-faible)]">{d.groupe}</p>}
        </div>
        <span className="pt-chrono shrink-0 rounded-full bg-[var(--p-surface-2)] px-3 py-1 text-sm" data-urgence={u}>
          {d.statut === 'prise' ? `${T.prise} · ${duree(depuis, l)}` : duree(attente, l)}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-pale)] text-2xl ring-1 ring-[var(--p-ligne)]" aria-hidden>
          {d.icone ?? '🔔'}
        </span>
        <p className="text-lg font-semibold leading-snug">{d.libelle}</p>
      </div>

      {d.note && <p className="mt-3 rounded-2xl border border-[var(--p-ligne)] bg-[var(--p-surface-2)] px-4 py-3 text-[15px] leading-relaxed">« {d.note} »</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--p-doux)]">
          {d.langue && d.langue !== langueDefaut ? (
            <span title={T.langueClient(nomLangue(d.langue))}>
              {drapeau(d.langue)} {T.langueClient(nomLangue(d.langue))}
            </span>
          ) : d.statut === 'prise' && d.prise_par ? (
            <span className="font-semibold text-[var(--accent)]">{T.priseParVous(d.prise_par)}</span>
          ) : null}
        </p>
        <div className="flex gap-2">
          {d.statut === 'nouvelle' && (
            <button type="button" onClick={onPrendre} disabled={sortante} className="pt-bouton-doux pt-bouton-grand !py-3.5">
              🏃 {T.jarrive}
            </button>
          )}
          <button type="button" onClick={onTerminer} disabled={sortante} className="pt-bouton pt-bouton-grand !py-3.5">
            ✓ {T.fait}
          </button>
        </div>
      </div>
    </article>
  )
}

function DetailDemande({
  d,
  l,
  fuseau,
  maintenant,
  langueDefaut,
  onPrendre,
  onTerminer,
  onRouvrir,
}: {
  d: Demande
  l: LanguePortail
  fuseau: string
  maintenant: number
  langueDefaut: string
  onPrendre: () => void
  onTerminer: () => void
  onRouvrir: () => void
}) {
  const T = TEXTES_PORTAIL[l]
  const heure = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString(l === 'fr' ? 'fr-CA' : 'en-CA', { timeZone: fuseau, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return new Date(iso).toLocaleTimeString()
    }
  }
  const etapes: { libelle: string; quand: string | null; qui?: string | null }[] = [
    { libelle: T.recue, quand: d.cree_le },
    { libelle: T.priseEnCharge, quand: d.prise_le, qui: d.prise_par },
    { libelle: T.terminee, quand: d.faite_le },
  ]
  const fin = d.faite_le ? Date.parse(d.faite_le) : maintenant
  const ouverte = d.statut === 'nouvelle' || d.statut === 'prise'
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--accent-pale)] text-3xl ring-1 ring-[var(--p-ligne)]" aria-hidden>
          {d.icone ?? '🔔'}
        </span>
        <div className="min-w-0">
          {d.groupe && <p className="pt-surtitre">{d.groupe}</p>}
          <p className="text-sm text-[var(--p-doux)]">
            {T.attente} : <span className="font-semibold tabular-nums text-[var(--p-encre)]">{duree((fin - Date.parse(d.cree_le)) / 1000, l)}</span>
          </p>
          {d.langue && d.langue !== langueDefaut && (
            <p className="text-sm text-[var(--p-doux)]">
              {drapeau(d.langue)} {T.langueClient(nomLangue(d.langue))}
            </p>
          )}
        </div>
      </div>

      {d.note && (
        <div className="mt-4">
          <p className="pt-etiquette">{T.noteClient}</p>
          <p className="rounded-2xl border border-[var(--p-ligne)] bg-[var(--p-surface-2)] px-4 py-3 text-[15px] leading-relaxed">« {d.note} »</p>
        </div>
      )}

      <ol className="mt-5 space-y-0">
        {etapes.map((e, i) => (
          <li key={e.libelle} className="relative flex gap-3 pb-4 last:pb-0">
            {i < etapes.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-[var(--p-ligne-forte)]" aria-hidden />}
            <span
              className={`relative mt-1 size-[15px] shrink-0 rounded-full border-2 ${e.quand ? 'border-[var(--p-or-clair)] bg-[var(--p-or-pale)]' : 'border-[var(--p-ligne-forte)] bg-[var(--p-surface)]'}`}
              aria-hidden
            />
            <div className="min-w-0 text-sm">
              <p className={`font-semibold ${e.quand ? '' : 'text-[var(--p-faible)]'}`}>{e.libelle}</p>
              {e.quand && (
                <p className="text-xs tabular-nums text-[var(--p-doux)]">
                  {heure(e.quand)} · {T.ilYa(duree((maintenant - Date.parse(e.quand)) / 1000, l))}
                  {e.qui ? ` · ${T.par(e.qui)}` : ''}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        {d.statut === 'nouvelle' && (
          <button type="button" onClick={onPrendre} className="pt-bouton-doux">
            🏃 {T.jarrive}
          </button>
        )}
        {ouverte ? (
          <button type="button" onClick={onTerminer} className="pt-bouton">
            ✓ {T.fait}
          </button>
        ) : (
          <button type="button" onClick={onRouvrir} className="pt-bouton-doux">
            ↺ {T.rouvrir}
          </button>
        )}
      </div>
    </div>
  )
}
