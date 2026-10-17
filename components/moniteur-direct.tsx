'use client'

import { useEffect, useRef, useState } from 'react'
import { GraphiqueColonnes } from '@/components/graphiques'

type Etat = {
  taps_60s: number
  taps_5min: number
  taps_15min: number
  cloudflare_15min: number
  p50_ms: number | null
  p95_ms: number | null
  max_ms: number | null
  dernier_tap: string | null
  par_minute: { minute: string; taps: number }[]
  serveur: {
    age_s: number
    memoire_mo: number
    retard_boucle_ms: number
    duree_base_ms: number
    cartes_en_cache: number
    pool: { taille: number; ouvertes: number; libres: number; enAttente: number }
    file: { enAttente: number; ecrits: number; perdus: number }
  }
  mesure_le: string
}

const INTERVALLE = 3_000
/** Mémoire de l'instance gratuite de Render. */
const MEMOIRE_MAX_MO = 512
const fmt = new Intl.NumberFormat('fr-CA')

type Verdict = { niveau: 'bon' | 'attention' | 'critique'; titre: string; texte: string }

/**
 * Le verdict combine les trois signaux d'un serveur qui ne suit plus : des
 * redirections lentes (ce que vit le client), une file d'attente vers la base,
 * un processeur en retard. Un seul suffit à passer à l'orange ou au rouge.
 */
function verdict(e: Etat | null, injoignable: boolean): Verdict {
  if (injoignable || !e) {
    return {
      niveau: 'critique',
      titre: 'Serveur injoignable',
      texte: 'Aucune réponse depuis la dernière mesure : il dort, redémarre, ou il est tombé.',
    }
  }
  const s = e.serveur
  const p95 = e.p95_ms ?? 0
  if (s.pool.enAttente > 0 || s.retard_boucle_ms > 250 || p95 > 1500 || s.file.enAttente > 5_000) {
    return {
      niveau: 'critique',
      titre: 'Render ne suit plus',
      texte:
        s.file.enAttente > 5_000
          ? `${fmt.format(s.file.enAttente)} taps attendent d’être écrits : la base ne suit plus.`
          : s.pool.enAttente > 0
          ? `${s.pool.enAttente} requête(s) attendent une connexion à la base.`
          : s.retard_boucle_ms > 250
            ? `Le processeur répond avec ${s.retard_boucle_ms} ms de retard.`
            : `5 % des clients attendent plus de ${fmt.format(p95)} ms.`,
    }
  }
  if (p95 > 600 || s.retard_boucle_ms > 80 || s.memoire_mo > MEMOIRE_MAX_MO * 0.8) {
    return {
      niveau: 'attention',
      titre: 'Ça commence à forcer',
      texte:
        s.memoire_mo > MEMOIRE_MAX_MO * 0.8
          ? `Mémoire à ${s.memoire_mo} Mo sur ${MEMOIRE_MAX_MO}.`
          : `Redirections plus lentes que d’habitude (95e centile : ${fmt.format(p95)} ms).`,
    }
  }
  return {
    niveau: 'bon',
    titre: 'Render suit',
    texte: 'Redirections rapides, aucune file d’attente, processeur à l’aise.',
  }
}

const STYLE: Record<Verdict['niveau'], { boite: string; icone: string }> = {
  bon: { boite: 'border-[#0ca30c] bg-green-50 text-[#0b5e0b]', icone: '✓' },
  attention: { boite: 'border-[#fab219] bg-amber-50 text-amber-900', icone: '!' },
  critique: { boite: 'border-[#d03b3b] bg-red-50 text-[#8a1c1c]', icone: '✕' },
}

function duree(s: number): string {
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
  return `${Math.floor(s / 86400)} j ${Math.floor((s % 86400) / 3600)} h`
}

export default function MoniteurDirect() {
  const [etat, setEtat] = useState<Etat | null>(null)
  const [injoignable, setInjoignable] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const vivant = useRef(true)

  useEffect(() => {
    vivant.current = true
    async function mesurer() {
      if (document.hidden) return
      setEnCours(true)
      try {
        const r = await fetch('/api/direct', { cache: 'no-store' })
        if (!r.ok) throw new Error(String(r.status))
        const donnees = (await r.json()) as Etat
        if (vivant.current) {
          setEtat(donnees)
          setInjoignable(false)
        }
      } catch {
        if (vivant.current) setInjoignable(true)
      } finally {
        if (vivant.current) setEnCours(false)
      }
    }
    mesurer()
    const minuterie = setInterval(mesurer, INTERVALLE)
    return () => {
      vivant.current = false
      clearInterval(minuterie)
    }
  }, [])

  const v = verdict(etat, injoignable)
  const s = etat?.serveur

  return (
    // Pendant une mesure, l'affichage garde la précédente, à peine estompée :
    // pas de saut, pas de chargement plein écran.
    <div className={`space-y-4 transition-opacity ${enCours && etat ? 'opacity-90' : ''}`}>
      <div className={`carte flex items-start gap-3 border-2 px-4 py-3 ${STYLE[v.niveau].boite}`} role="status" aria-live="polite">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white text-sm font-bold" aria-hidden>
          {STYLE[v.niveau].icone}
        </span>
        <div>
          <div className="font-semibold">{v.titre}</div>
          <div className="text-sm">{v.texte}</div>
          {s && s.age_s < 180 && (
            <div className="mt-1 text-sm">
              Le serveur a démarré il y a {duree(s.age_s)} : réveil après sommeil, déploiement, ou redémarrage après un plantage.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="carte p-4">
          <div className="text-xs font-medium text-[var(--color-encre-doux)]">Taps, dernière minute</div>
          <div className="mt-1 text-5xl font-semibold tracking-tight" style={{ fontVariantNumeric: 'proportional-nums' }}>
            {etat ? fmt.format(etat.taps_60s) : '—'}
          </div>
          <div className="mt-1 text-xs text-[var(--color-encre-doux)]">
            {etat ? `${fmt.format(etat.taps_5min)} sur 5 min · ${fmt.format(etat.taps_15min)} sur 15 min` : ''}
          </div>
          {etat && etat.taps_15min > 0 && (
            <div className="mt-1 text-xs text-[var(--color-encre-doux)]">
              {etat.cloudflare_15min === etat.taps_15min
                ? 'tous servis par Cloudflare'
                : etat.cloudflare_15min === 0
                  ? 'tous servis par Render'
                  : `${Math.round((100 * etat.cloudflare_15min) / etat.taps_15min)} % servis par Cloudflare, le reste par Render`}
            </div>
          )}
        </div>
        <Bloc
          titre="Temps de redirection"
          valeur={etat?.p50_ms != null ? `${fmt.format(etat.p50_ms)} ms` : '—'}
          lignes={[
            etat?.p95_ms != null ? `95 % sous ${fmt.format(etat.p95_ms)} ms` : 'aucun tap depuis 15 min',
            etat?.max_ms != null ? `pire : ${fmt.format(etat.max_ms)} ms` : '',
          ]}
          note="médiane sur 15 min, avant la réponse"
        />
        <Bloc
          titre="Base de données"
          valeur={s ? `${s.pool.ouvertes - s.pool.libres} / ${s.pool.taille}` : '—'}
          lignes={[
            s ? `${s.pool.enAttente} requête(s) en attente` : '',
            s ? `${fmt.format(s.file.enAttente)} tap(s) à écrire` : '',
            s && s.file.perdus ? `⚠ ${fmt.format(s.file.perdus)} tap(s) perdu(s) depuis le démarrage` : '',
            s ? `requête du moniteur : ${s.duree_base_ms} ms` : '',
          ]}
          note="connexions occupées"
        />
        <Bloc
          titre="Serveur"
          valeur={s ? duree(s.age_s) : '—'}
          lignes={[
            s ? `mémoire : ${s.memoire_mo} / ${MEMOIRE_MAX_MO} Mo` : '',
            s ? `retard processeur : ${s.retard_boucle_ms} ms` : '',
            s ? `${fmt.format(s.cartes_en_cache)} carte(s) en mémoire` : '',
          ]}
          note="en ligne depuis"
        />
      </div>

      <section className="carte p-5">
        <h2 className="text-sm font-semibold">Taps par minute</h2>
        <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">La dernière heure, actualisée toutes les 3 secondes.</p>
        <div className="mt-4">
          {etat ? (
            <GraphiqueColonnes
              barres={etat.par_minute.map((m) => ({ etiquette: m.minute, detail: `à ${m.minute}`, valeur: m.taps }))}
              pasEtiquettes={10}
              resume={`Taps par minute sur la dernière heure, ${etat.taps_15min} sur les 15 dernières minutes.`}
            />
          ) : (
            <div className="h-40" />
          )}
        </div>
      </section>

      <p className="text-xs text-[var(--color-encre-doux)]">
        {etat
          ? `Dernière mesure : ${new Date(etat.mesure_le).toLocaleTimeString('fr-CA', { timeZone: 'America/Toronto' })}`
          : 'Première mesure…'}
        {' · '}les mesures s’arrêtent quand l’onglet est en arrière-plan.
      </p>
    </div>
  )
}

function Bloc({ titre, valeur, lignes, note }: { titre: string; valeur: string; lignes: string[]; note: string }) {
  return (
    <div className="carte p-4">
      <div className="text-xs font-medium text-[var(--color-encre-doux)]">{titre}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight" style={{ fontVariantNumeric: 'proportional-nums' }}>
        {valeur}
      </div>
      <div className="text-[11px] text-[var(--color-encre-doux)]">{note}</div>
      <ul className="mt-1.5 space-y-0.5 text-xs text-[var(--color-encre-doux)]">
        {lignes.filter(Boolean).map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  )
}
