'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { textes, type Langue } from '@/lib/langue'
import { lancerConfettis } from '@/lib/confettis'
import { ouvrirPartage } from '@/components/client/partage-palier'

const TX = {
  fr: { partager: 'Partager' },
  en: { partager: 'Share' },
}

/**
 * Fête un palier franchi : des confettis aux couleurs de Tapora et une
 * petite carte « Bravo ! », avec un bouton pour partager l'image du palier.
 * Une seule fois par palier et par appareil (le navigateur s'en souvient) ;
 * à la toute première visite, on fête le plus beau palier déjà atteint.
 *
 * « Réduire les animations » : la carte, sans confettis.
 */
export default function Celebration({
  dossierId,
  franchis,
  langue,
}: {
  dossierId: string
  franchis: { cle: string; titre: string }[]
  langue: Langue
}) {
  const T = textes(langue)
  const [choisi, setChoisi] = useState<{ cle: string; titre: string } | null>(null)
  const signature = franchis.map((f) => f.cle).join(',')

  useEffect(() => {
    if (!franchis.length) return
    const cle = `tapora-paliers-${dossierId}`
    let vus: string[] = []
    try {
      vus = JSON.parse(localStorage.getItem(cle) ?? '[]')
    } catch {
      // Stockage indisponible (navigation privée) : on fête, sans mémoire.
    }
    const nouveaux = franchis.filter((f) => !vus.includes(f.cle))
    try {
      localStorage.setItem(cle, JSON.stringify(franchis.map((f) => f.cle)))
    } catch {}
    if (!nouveaux.length) return
    // Le plus beau : d'abord les avis (ce que le commerce veut), le plus haut.
    const avis = nouveaux.filter((f) => f.cle.startsWith('avis-'))
    const c = (avis.length ? avis : nouveaux).at(-1)!
    const attente = setTimeout(() => {
      setChoisi(c)
      lancerConfettis()
    }, 1600)
    return () => clearTimeout(attente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossierId, signature])

  useEffect(() => {
    if (!choisi) return
    const fin = setTimeout(() => setChoisi(null), 10000)
    return () => clearTimeout(fin)
  }, [choisi])

  if (!choisi) return null
  const [type, valeur] = choisi.cle.split('-')
  // Hors de la page : un parent animé (transform) piégerait le « fixed ».
  return createPortal(
    <div className="fixed inset-x-4 bottom-6 z-50 flex justify-center" role="status">
      <div className="toast-bravo flex max-w-md items-center gap-4 rounded-3xl bg-[#2a211a] py-4 pl-5 pr-3 text-[#fffaf2] shadow-2xl">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#c2552f] text-2xl" aria-hidden>
          🎉
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-[#f0b48f]">{T.bravo}</p>
          <p className="titre-client text-xl font-medium leading-tight">{choisi.titre}</p>
          <p className="mt-0.5 text-xs text-[#fffaf2]/70">{T.bravoSous}</p>
          <button
            onClick={() => {
              ouvrirPartage({ type: type as 'avis' | 'taps', valeur: Number(valeur) })
              setChoisi(null)
            }}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#c2552f] px-3.5 py-1.5 text-xs font-semibold text-[#fffaf2] transition hover:bg-[#d96a40]"
          >
            <IconePartage /> {TX[langue].partager}
          </button>
        </div>
        <button
          onClick={() => setChoisi(null)}
          className="ml-1 grid size-8 shrink-0 place-items-center self-start rounded-full text-[#fffaf2]/60 hover:bg-white/10 hover:text-[#fffaf2]"
          aria-label={T.fermer}
        >
          ✕
        </button>
      </div>
    </div>,
    document.getElementById('calque-client') ?? document.body,
  )
}

export function IconePartage({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}
