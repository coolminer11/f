'use client'

import { useState } from 'react'

/**
 * Ajout d'une vidéo : un lien, ou un fichier.
 *
 * Le fichier ne passe pas par le serveur de l'application. On demande une
 * adresse de dépôt signée, le navigateur téléverse chez Supabase, puis on
 * n'enregistre que le chemin. C'est aussi ce qui permet d'afficher une
 * progression honnête plutôt qu'un bouton figé pendant deux minutes.
 */
export default function FormulaireTutoriel({
  enregistrer,
  stockageActif,
}: {
  enregistrer: (donnees: FormData) => Promise<void>
  stockageActif: boolean
}) {
  const [mode, setMode] = useState<'lien' | 'fichier'>(stockageActif ? 'fichier' : 'lien')
  const [progression, setProgression] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  async function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    if (mode === 'lien') return // le formulaire part normalement
    evenement.preventDefault()
    setErreur(null)

    const formulaire = evenement.currentTarget
    const donnees = new FormData(formulaire)
    const fichier = donnees.get('fichier') as File | null
    if (!fichier || fichier.size === 0) {
      setErreur('Choisissez une vidéo.')
      return
    }

    try {
      setProgression(0)
      const reponse = await fetch('/api/tutoriels', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nom: fichier.name }),
      })
      const depot = await reponse.json()
      if (!reponse.ok) throw new Error(depot.erreur ?? 'Dépôt refusé.')

      await televerser(depot.url, fichier, setProgression)

      const meta = new FormData()
      meta.set('titre', String(donnees.get('titre') ?? ''))
      meta.set('description', String(donnees.get('description') ?? ''))
      meta.set('chemin', depot.chemin)
      meta.set('taille', String(fichier.size))
      await enregistrer(meta)

      formulaire.reset()
      setProgression(null)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Téléversement impossible.')
      setProgression(null)
    }
  }

  return (
    <form action={enregistrer} onSubmit={soumettre} className="carte space-y-3 p-4">
      <div className="flex gap-2">
        {(['fichier', 'lien'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            disabled={m === 'fichier' && !stockageActif}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === m
                ? 'bg-[var(--color-encre)] text-white'
                : 'border border-[var(--color-ligne)] text-[var(--color-encre-doux)] disabled:opacity-40'
            }`}
          >
            {m === 'fichier' ? 'Téléverser une vidéo' : 'Coller un lien'}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiquette" htmlFor="titre_tuto">
            Titre
          </label>
          <input
            id="titre_tuto"
            name="titre"
            className="champ"
            required
            maxLength={150}
            placeholder="Saisir une dépense avec sa photo de reçu"
          />
        </div>
        <div>
          <label className="etiquette" htmlFor="description_tuto">
            Description (facultatif)
          </label>
          <input
            id="description_tuto"
            name="description"
            className="champ"
            maxLength={400}
            placeholder="Ce qu’on y voit, en une ligne"
          />
        </div>
      </div>

      {mode === 'lien' ? (
        <div>
          <label className="etiquette" htmlFor="lien_tuto">
            Adresse de la vidéo
          </label>
          <input
            id="lien_tuto"
            name="lien"
            type="url"
            className="champ"
            required
            placeholder="https://www.loom.com/share/…"
          />
          <p className="mt-1 text-xs text-[var(--color-encre-doux)]">
            YouTube, Loom, Vimeo et Google Drive s’affichent directement dans la page. Collez
            l’adresse telle qu’elle apparaît dans votre navigateur.
          </p>
        </div>
      ) : (
        <div>
          <label className="etiquette" htmlFor="fichier_tuto">
            Fichier vidéo
          </label>
          <input
            id="fichier_tuto"
            name="fichier"
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="champ"
            required
          />
          <p className="mt-1 text-xs text-[var(--color-encre-doux)]">
            200 Mo au plus. L’espace gratuit est d’un gigaoctet en tout : pour une longue
            démonstration, un lien coûte moins cher qu’un fichier.
          </p>
        </div>
      )}

      {erreur && <p className="text-sm font-medium text-[var(--color-negatif)]">{erreur}</p>}

      {progression !== null ? (
        <div>
          <div className="h-2 w-full overflow-hidden rounded bg-[var(--color-fond)]">
            <div
              className="h-full bg-[var(--color-accent)] transition-[width]"
              style={{ width: `${progression}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-[var(--color-encre-doux)]">
            Envoi… {progression} % — ne fermez pas cet onglet.
          </p>
        </div>
      ) : (
        <button className="bouton">Ajouter</button>
      )}
    </form>
  )
}

/**
 * `fetch` ne sait pas rendre compte de l'avancement d'un envoi ; XHR le sait
 * encore. Pour un fichier de cent mégaoctets, une barre qui bouge est la
 * différence entre « ça marche » et « c'est planté ».
 */
function televerser(
  url: string,
  fichier: File,
  avance: (pourcent: number) => void,
): Promise<void> {
  return new Promise((resolve, rejeter) => {
    const requete = new XMLHttpRequest()
    requete.open('PUT', url)
    requete.setRequestHeader('content-type', fichier.type || 'video/mp4')
    requete.upload.onprogress = (e) => {
      if (e.lengthComputable) avance(Math.round((e.loaded / e.total) * 100))
    }
    requete.onload = () =>
      requete.status >= 200 && requete.status < 300
        ? resolve()
        : rejeter(new Error(`Supabase a refusé le fichier (${requete.status}).`))
    requete.onerror = () => rejeter(new Error('Connexion interrompue pendant l’envoi.'))
    requete.send(fichier)
  })
}
