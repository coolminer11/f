'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Langue } from '@/lib/langue'
import { contenuMedaille, dessinerImage, type Contenu, type Format, type Medaille } from '@/lib/image-partage'
import { lancerConfettis } from '@/lib/confettis'

const EVENEMENT = 'tapora:partager'

/** Ouvre la fenêtre de partage, d'où que l'on soit sur la page. */
export function ouvrirPartage(m: Medaille | { contenu: Contenu }) {
  window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: m }))
}

const TX = {
  fr: {
    titre: 'Partagez votre palier',
    sous: 'Publiez-la sur Instagram ou Facebook : vos clients adorent voir ça.',
    carre: 'Publication',
    story: 'Story',
    partager: 'Partager',
    telecharger: 'Enregistrer l’image',
    fermer: 'Fermer',
    preparation: 'Préparation de l’image…',
    texte: (c: Contenu) => `${c.chiffre} ${c.libelle} ! ${c.merci}`,
  },
  en: {
    titre: 'Share your milestone',
    sous: 'Post it on Instagram or Facebook: your customers love seeing this.',
    carre: 'Post',
    story: 'Story',
    partager: 'Share',
    telecharger: 'Save image',
    fermer: 'Close',
    preparation: 'Preparing the image…',
    texte: (c: Contenu) => `${c.chiffre} ${c.libelle}! ${c.merci}`,
  },
}

/**
 * La fenêtre de partage d'un palier : l'image arrive en se retournant comme
 * une carte, un reflet la balaie, les confettis partent. Puis « Partager »
 * (le menu natif du téléphone : Instagram, Facebook, Messages…) ou
 * « Enregistrer l'image ».
 */
export default function PartagePalier({ nom, langue }: { nom: string; langue: Langue }) {
  const T = TX[langue]
  const [contenu, setContenu] = useState<Contenu | null>(null)
  const [format, setFormat] = useState<Format>('carre')
  const [image, setImage] = useState<{ url: string; blob: Blob } | null>(null)
  const [peutPartager, setPeutPartager] = useState(false)
  const cadre = useRef<HTMLDivElement>(null)
  const fermerBtn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const ouvrir = (e: Event) => {
      const d = (e as CustomEvent).detail as Medaille | { contenu: Contenu }
      setFormat('carre')
      setContenu('contenu' in d ? d.contenu : contenuMedaille(d, nom, langue))
    }
    window.addEventListener(EVENEMENT, ouvrir)
    return () => window.removeEventListener(EVENEMENT, ouvrir)
  }, [nom, langue])

  const fermer = useCallback(() => {
    setContenu(null)
    setImage((i) => {
      if (i) URL.revokeObjectURL(i.url)
      return null
    })
  }, [])

  useEffect(() => {
    if (!contenu) return
    let annule = false
    setImage(null)
    dessinerImage(contenu, format).then((blob) => {
      if (annule) return
      const fichier = new File([blob], 'tapora.png', { type: 'image/png' })
      setPeutPartager(typeof navigator.canShare === 'function' && navigator.canShare({ files: [fichier] }))
      setImage((avant) => {
        if (avant) URL.revokeObjectURL(avant.url)
        return { url: URL.createObjectURL(blob), blob }
      })
    })
    return () => {
      annule = true
    }
  }, [contenu, format])

  // L'entrée en scène : retournement, reflet, confettis — une fois l'image prête.
  useEffect(() => {
    if (!image || !cadre.current) return
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduit) {
      cadre.current.animate(
        [
          { transform: 'perspective(1200px) rotateY(-80deg) scale(.85)', opacity: 0 },
          { transform: 'perspective(1200px) rotateY(8deg) scale(1.02)', opacity: 1, offset: 0.65 },
          { transform: 'perspective(1200px) rotateY(0) scale(1)', opacity: 1 },
        ],
        { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' },
      )
      lancerConfettis({ depuis: cadre.current, nombre: 90 })
    }
    fermerBtn.current?.focus()
  }, [image])

  useEffect(() => {
    if (!contenu) return
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && fermer()
    document.addEventListener('keydown', touche)
    return () => document.removeEventListener('keydown', touche)
  }, [contenu, fermer])

  async function partager() {
    if (!image || !contenu) return
    try {
      await navigator.share({
        files: [new File([image.blob], 'tapora.png', { type: 'image/png' })],
        text: T.texte(contenu),
      })
    } catch {
      // Partage annulé : rien à faire.
    }
  }

  function enregistrer() {
    if (!image) return
    const a = document.createElement('a')
    a.href = image.url
    a.download = `tapora-${format}.png`
    a.click()
  }

  if (!contenu) return null
  return createPortal(
    <div className="fenetre-partage fixed inset-0 z-[55] flex items-center justify-center bg-[#2a211a]/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={T.titre} onClick={fermer}>
      <div className="w-full max-w-md rounded-[2rem] bg-[#fffaf2] p-5 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="titre-client text-2xl font-medium">{T.titre}</p>
            <p className="mt-0.5 text-sm text-[#6b5d50]">{T.sous}</p>
          </div>
          <button ref={fermerBtn} onClick={fermer} className="grid size-9 shrink-0 place-items-center rounded-full text-[#6b5d50] hover:bg-[#f3ebdf]" aria-label={T.fermer}>
            ✕
          </button>
        </div>

        <div className="mt-4 flex justify-center gap-1 rounded-full bg-[#f3ebdf] p-1 text-sm">
          {(['carre', 'story'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              className={`flex-1 rounded-full px-4 py-1.5 font-medium transition ${format === f ? 'bg-[#2a211a] text-[#fffaf2]' : 'text-[#6b5d50] hover:text-[#2a211a]'}`}
            >
              {f === 'carre' ? T.carre : T.story}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-center">
          <div
            ref={cadre}
            className={`reflet-partage relative overflow-hidden rounded-2xl shadow-[0_20px_50px_-20px_rgb(60_40_20/.5)] ${format === 'story' ? 'aspect-[9/16] h-[52vh] max-h-[460px]' : 'aspect-square w-full max-w-[340px]'}`}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.url} alt={T.texte(contenu)} className="size-full object-cover" />
            ) : (
              <div className="grid size-full animate-pulse place-items-center bg-[#f3ebdf] text-sm text-[#6b5d50]">{T.preparation}</div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {peutPartager && (
            <button onClick={partager} disabled={!image} className="flex-1 rounded-full bg-[#c2552f] px-5 py-3 text-sm font-semibold text-[#fffaf2] transition hover:bg-[#a9481f] disabled:opacity-50">
              {T.partager}
            </button>
          )}
          <button
            onClick={enregistrer}
            disabled={!image}
            className={`flex-1 rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-50 ${peutPartager ? 'bg-[#f3ebdf] text-[#2a211a] hover:bg-[#ede3d3]' : 'bg-[#c2552f] text-[#fffaf2] hover:bg-[#a9481f]'}`}
          >
            {T.telecharger}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('calque-client') ?? document.body,
  )
}

/** Une médaille atteinte, cliquable : elle ouvre la fenêtre de partage. */
export function BoutonMedaille({ medaille, libelle, children }: { medaille: Medaille; libelle: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => ouvrirPartage(medaille)} className="medaille-bouton" aria-label={libelle} title={libelle}>
      {children}
    </button>
  )
}
