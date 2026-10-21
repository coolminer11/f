'use client'

import { useEffect, useRef, useState } from 'react'
import { desintegrer } from '@/components/effets/desintegration'

/**
 * Les pop-ups (toasts) de Tapora : ils arrivent avec un ressort, s'empilent,
 * se chassent d'un geste (et se désintègrent), une barre montre le temps
 * qu'il leur reste. N'importe quel composant les déclenche avec `toast()` —
 * même un bouton de formulaire après une action serveur.
 */
export type Ton = 'succes' | 'info' | 'alerte' | 'erreur'
type Toast = { id: number; titre: string; texte?: string; ton: Ton; duree: number }

const EVENEMENT = 'tapora:toast'
let suivant = 1
// Un pop-up demandé avant que le conteneur soit monté (au tout premier
// affichage, les effets des pages passent avant celui du gabarit) attend ici.
let ecouteurs = 0
const enAttente: Toast[] = []

export function toast(titre: string, options: { texte?: string; ton?: Ton; duree?: number } = {}): void {
  if (typeof window === 'undefined') return
  const t: Toast = { id: suivant++, titre, texte: options.texte, ton: options.ton ?? 'succes', duree: options.duree ?? 4200 }
  if (ecouteurs === 0) {
    enAttente.push(t)
    enAttente.splice(0, Math.max(0, enAttente.length - 5))
    return
  }
  window.dispatchEvent(new CustomEvent<Toast>(EVENEMENT, { detail: t }))
}

const ICONES: Record<Ton, string> = { succes: '✓', info: 'i', alerte: '!', erreur: '×' }

// Le bouton « Fermer » parle la langue de la page : celle d'un client de
// Tapora Services (attribut lang de son cadre), sinon le français.
const FERMER: Record<string, string> = { fr: 'Fermer', en: 'Close', es: 'Cerrar', de: 'Schließen', it: 'Chiudi', pt: 'Fechar', zh: '关闭', ja: '閉じる', ko: '닫기', ar: 'إغلاق' }
function libelleFermer(el: Element | null): string {
  const langue = el?.closest('[lang]')?.getAttribute('lang') ?? document.querySelector('.theme-services[lang]')?.getAttribute('lang') ?? 'fr'
  return FERMER[langue.slice(0, 2)] ?? FERMER.fr
}

function Un({ t, fermer }: { t: Toast; fermer: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pause, setPause] = useState(false)
  const [libelle, setLibelle] = useState('Fermer')
  const depart = useRef<number | null>(null)

  useEffect(() => setLibelle(libelleFermer(ref.current)), [])

  useEffect(() => {
    if (pause) return
    const reste = t.duree
    const minuterie = setTimeout(() => void chasser(), reste)
    return () => clearTimeout(minuterie)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pause])

  async function chasser() {
    await desintegrer(ref.current, { duree: 700, particules: 36 })
    fermer(t.id)
  }

  return (
    <div
      ref={ref}
      role={t.ton === 'erreur' ? 'alert' : 'status'}
      className={`toast-tapora toast-${t.ton}`}
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      onPointerDown={(e) => (depart.current = e.clientX)}
      onPointerUp={(e) => {
        if (depart.current !== null && Math.abs(e.clientX - depart.current) > 60) void chasser()
        depart.current = null
      }}
    >
      <span className="toast-icone" aria-hidden>
        {ICONES[t.ton]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="toast-titre">{t.titre}</p>
        {t.texte && <p className="toast-texte">{t.texte}</p>}
      </div>
      <button type="button" onClick={() => void chasser()} className="toast-fermer" aria-label={libelle}>
        ×
      </button>
      <span className="toast-temps" style={{ animationDuration: `${t.duree}ms`, animationPlayState: pause ? 'paused' : 'running' }} aria-hidden />
    </div>
  )
}

/** À poser une fois par page (les gabarits s'en chargent) ; affiche aussi ?message= et ?erreur= de l'adresse, puis les retire. */
export default function Toasts({ depuisAdresse = false }: { depuisAdresse?: boolean }) {
  const [liste, setListe] = useState<Toast[]>([])

  useEffect(() => {
    const recevoir = (e: Event) => setListe((l) => [...l.slice(-4), (e as CustomEvent<Toast>).detail])
    window.addEventListener(EVENEMENT, recevoir)
    ecouteurs++
    if (enAttente.length) {
      const attente = enAttente.splice(0)
      setListe((l) => [...l, ...attente].slice(-5))
    }
    if (depuisAdresse) {
      const u = new URL(location.href)
      const message = u.searchParams.get('message')
      const erreur = u.searchParams.get('erreur')
      if (message) toast(message, { ton: 'succes' })
      if (erreur) toast(erreur, { ton: 'erreur', duree: 7000 })
      if (message || erreur) {
        u.searchParams.delete('message')
        u.searchParams.delete('erreur')
        history.replaceState(history.state, '', u.toString())
      }
    }
    return () => {
      ecouteurs--
      window.removeEventListener(EVENEMENT, recevoir)
    }
  }, [depuisAdresse])

  return (
    <div className="toasts-tapora" aria-live="polite">
      {liste.map((t) => (
        <Un key={t.id} t={t} fermer={(id) => setListe((l) => l.filter((x) => x.id !== id))} />
      ))}
    </div>
  )
}
