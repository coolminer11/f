'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { BOUTON, MODELES, type CleModele } from '@/lib/modeles-lien'

/**
 * Envoyer le lien privé au client, sans quitter la fiche du dossier : un
 * modèle (bienvenue, rappel, nouveau lien), en français ou en anglais, que
 * l'on peut retoucher. Le lien est ajouté tout seul sous le message.
 * « Copier le texte » sert pour un texto ou Messenger.
 */
export default function EnvoiLien({
  action,
  commerce,
  lien,
  destinataire,
  langue: langueDossier,
  monCourriel,
}: {
  action: (avant: unknown, donnees: FormData) => Promise<{ ok: boolean; texte: string }>
  commerce: string
  lien: string
  destinataire: string | null
  langue: 'fr' | 'en'
  monCourriel: string
}) {
  const [langue, setLangue] = useState<'fr' | 'en'>(langueDossier)
  const [modele, setModele] = useState<CleModele>('bienvenue')
  const [objet, setObjet] = useState(MODELES[langueDossier].bienvenue.objet(commerce))
  const [message, setMessage] = useState(MODELES[langueDossier].bienvenue.corps(commerce))
  const [copie, setCopie] = useState(false)
  const [resultat, envoyer] = useActionState(action, null)

  function choisir(l: 'fr' | 'en', m: CleModele) {
    setLangue(l)
    setModele(m)
    setObjet(MODELES[l][m].objet(commerce))
    setMessage(MODELES[l][m].corps(commerce))
  }

  async function copier() {
    await navigator.clipboard.writeText(`${message.trim()}\n\n${BOUTON[langue]} : ${lien}`)
    setCopie(true)
    setTimeout(() => setCopie(false), 1600)
  }

  return (
    <form action={envoyer} className="mt-4 space-y-3 border-t border-[var(--color-ligne)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Envoyer le lien au client</p>
        <div className="inline-flex rounded-lg border border-[var(--color-ligne)] bg-white p-0.5 text-xs">
          {(['fr', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => choisir(l, modele)}
              aria-pressed={langue === l}
              className={`rounded-md px-2.5 py-1 font-medium ${langue === l ? 'bg-[var(--color-encre)] text-white' : 'text-[var(--color-encre-doux)] hover:bg-[var(--color-fond)]'}`}
            >
              {l === 'fr' ? 'Français' : 'English'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Modèle">
        {(Object.keys(MODELES.fr) as CleModele[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => choisir(langue, m)}
            aria-pressed={modele === m}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              modele === m ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white' : 'border-[var(--color-ligne)] hover:bg-[var(--color-fond)]'
            }`}
          >
            {MODELES.fr[m].nom}
          </button>
        ))}
      </div>

      <input type="hidden" name="langue" value={langue} />
      <input type="hidden" name="modele" value={modele} />
      <div>
        <label className="etiquette" htmlFor="envoi-destinataire">Courriel du client</label>
        <input
          id="envoi-destinataire"
          name="destinataire"
          type="email"
          className="champ"
          maxLength={254}
          defaultValue={destinataire ?? ''}
          placeholder="proprio@commerce.com"
        />
      </div>
      <div>
        <label className="etiquette" htmlFor="envoi-objet">Objet</label>
        <input id="envoi-objet" name="objet" className="champ" maxLength={150} required value={objet} onChange={(e) => setObjet(e.target.value)} />
      </div>
      <div>
        <label className="etiquette" htmlFor="envoi-message">Message</label>
        <textarea
          id="envoi-message"
          name="message"
          className="champ min-h-[13rem] resize-y leading-relaxed"
          maxLength={4000}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="mt-1 text-xs text-[var(--color-encre-doux)]">
          Le lien est ajouté tout seul sous le message, en bouton « {BOUTON[langue]} ». Les réponses du client arrivent à votre courriel de contact.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Bouton nom="envoyer">Envoyer au client</Bouton>
        <Bouton nom="essai" secondaire>
          M’envoyer un essai
        </Bouton>
        <button type="button" onClick={copier} className="bouton bouton-secondaire text-xs">
          {copie ? 'Copié ✓' : 'Copier le texte (texto)'}
        </button>
        <span className="text-xs text-[var(--color-encre-doux)]">L’essai part à {monCourriel}</span>
      </div>
      {resultat && (
        <p
          role="status"
          className={`rounded-md border px-3 py-2 text-sm font-medium ${resultat.ok ? 'border-[var(--color-positif)] bg-green-50 text-[var(--color-positif)]' : 'border-[var(--color-negatif)] bg-red-50 text-[var(--color-negatif)]'}`}
        >
          {resultat.texte}
        </p>
      )}
    </form>
  )
}

function Bouton({ nom, secondaire, children }: { nom: string; secondaire?: boolean; children: React.ReactNode }) {
  const { pending, data } = useFormStatus()
  const moi = pending && data?.get('envoi') === nom
  return (
    <button name="envoi" value={nom} disabled={pending} className={`bouton text-xs ${secondaire ? 'bouton-secondaire' : ''} disabled:opacity-60`}>
      {moi ? 'Envoi…' : children}
    </button>
  )
}
