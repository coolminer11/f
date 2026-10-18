'use client'

import { useState, useTransition } from 'react'
import { chercherFichesAction } from '@/app/cartes/actions'

type Fiche = { place_id: string; nom: string; adresse: string }

/**
 * Choisir la fiche Google du commerce : chercher par nom et ville, ou coller
 * l'identifiant. Le choix part dans des champs cachés du formulaire parent.
 */
export default function ChoixFiche({
  initiale,
  configure,
  champDestination = 'destination',
}: {
  initiale: { place_id: string; nom: string | null } | null
  configure: boolean
  champDestination?: string
}) {
  const [choisie, setChoisie] = useState<{ place_id: string; nom: string; adresse: string } | null>(
    initiale ? { place_id: initiale.place_id, nom: initiale.nom ?? initiale.place_id, adresse: '' } : null,
  )
  const [texte, setTexte] = useState('')
  const [resultats, setResultats] = useState<Fiche[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, demarrer] = useTransition()
  // Sans clé Google, les avis se saisissent à la main dans le dossier : rien à afficher ici.
  if (!configure && !initiale) return null

  function chercher() {
    setErreur(null)
    demarrer(async () => {
      const r = await chercherFichesAction(texte)
      setResultats(r.fiches)
      setErreur(r.erreur ?? (r.fiches.length ? null : 'Aucune fiche trouvée. Essayez « nom du commerce + ville ».'))
    })
  }

  function utiliserCommeDestination() {
    if (!choisie) return
    const champ = document.getElementById(champDestination) as HTMLInputElement | null
    if (champ) champ.value = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(choisie.place_id)}`
  }

  return (
    <div>
      <span className="etiquette">Fiche Google du commerce (facultatif)</span>
      <input type="hidden" name="place_id" value={choisie?.place_id ?? ''} />
      <input type="hidden" name="fiche_nom" value={choisie?.nom ?? ''} />
      <input type="hidden" name="fiche_adresse" value={choisie?.adresse ?? ''} />

      {choisie ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-ligne)] bg-[var(--color-fond)] px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            <span className="font-medium">{choisie.nom}</span>
            {choisie.adresse && <span className="block truncate text-xs text-[var(--color-encre-doux)]">{choisie.adresse}</span>}
          </span>
          <button type="button" onClick={utiliserCommeDestination} className="text-xs font-semibold text-[var(--color-accent)] hover:underline">
            Utiliser son lien d’avis comme destination
          </button>
          <button type="button" onClick={() => setChoisie(null)} className="text-xs text-[var(--color-encre-doux)] hover:underline">
            Retirer
          </button>
        </div>
      ) : configure ? (
        <>
          <div className="flex gap-2">
            <input
              className="champ"
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  chercher()
                }
              }}
              placeholder="Nom du commerce et ville"
              maxLength={200}
              aria-label="Rechercher la fiche Google"
            />
            <button type="button" className="bouton bouton-secondaire shrink-0" onClick={chercher} disabled={enCours || texte.trim().length < 3}>
              {enCours ? 'Recherche…' : 'Chercher'}
            </button>
          </div>
          {erreur && <p className="mt-1.5 text-xs text-[var(--color-negatif)]">{erreur}</p>}
          {resultats.length > 0 && (
            <ul className="mt-2 divide-y divide-[var(--color-ligne)] rounded-md border border-[var(--color-ligne)] text-sm">
              {resultats.map((f) => (
                <li key={f.place_id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-[var(--color-fond)]"
                    onClick={() => {
                      setChoisie(f)
                      setResultats([])
                    }}
                  >
                    <span className="font-medium">{f.nom}</span>
                    <span className="block text-xs text-[var(--color-encre-doux)]">{f.adresse}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-xs text-[var(--color-encre-doux)]">
          Pour suivre les avis Google, ajoutez la clé <code>GOOGLE_PLACES_CLE</code> (DEPLOIEMENT.md, section 7).
        </p>
      )}
      <p className="mt-1.5 text-xs text-[var(--color-encre-doux)]">
        Sert à suivre le nombre d’avis et la note, à côté des taps.
      </p>
    </div>
  )
}
