'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'

function aujourdhuiLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Bouton() {
  const { pending } = useFormStatus()
  return (
    <button className="bouton" disabled={pending}>
      {pending ? 'Enregistrement…' : 'Consigner la décision'}
    </button>
  )
}

export default function FormulaireDecision({
  action,
  categories,
}: {
  action: (donnees: FormData) => Promise<void>
  categories: readonly (readonly [string, string])[]
}) {
  const [ouvert, setOuvert] = useState(false)

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="bouton bouton-secondaire mt-4"
        type="button"
      >
        Consigner une décision
      </button>
    )
  }

  return (
    <form action={action} className="mt-4 rounded-lg border border-[var(--color-ligne)] p-4">
      <h3 className="text-sm font-bold">Nouvelle décision</h3>
      <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
        Les deux cases d’approbation seront créées automatiquement.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiquette" htmlFor="date_decision">
            Date
          </label>
          <input
            id="date_decision"
            name="date"
            type="date"
            className="champ"
            defaultValue={aujourdhuiLocal()}
            required
          />
        </div>
        <div>
          <label className="etiquette" htmlFor="categorie_decision">
            Catégorie
          </label>
          <select id="categorie_decision" name="categorie" className="champ" defaultValue="autre">
            {categories.map(([code, libelle]) => (
              <option key={code} value={code}>
                {libelle}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className="etiquette" htmlFor="titre">
          Titre
        </label>
        <input
          id="titre"
          name="titre"
          className="champ"
          placeholder="Révision du prix de la carte standard"
          required
          maxLength={200}
        />
      </div>

      <div className="mt-3">
        <label className="etiquette" htmlFor="description_decision">
          Contexte
        </label>
        <textarea
          id="description_decision"
          name="description"
          className="champ"
          rows={2}
          required
          maxLength={2000}
        />
      </div>

      <div className="mt-3">
        <label className="etiquette" htmlFor="decision">
          Décision prise
        </label>
        <textarea
          id="decision"
          name="decision"
          className="champ"
          rows={2}
          required
          maxLength={2000}
        />
      </div>

      <div className="mt-3">
        <label className="etiquette" htmlFor="notes">
          Notes <span className="font-normal">(facultatif)</span>
        </label>
        <textarea id="notes" name="notes" className="champ" rows={2} maxLength={2000} />
      </div>

      <div className="mt-4 flex gap-2">
        <Bouton />
        <button type="button" onClick={() => setOuvert(false)} className="bouton bouton-secondaire">
          Annuler
        </button>
      </div>
    </form>
  )
}
