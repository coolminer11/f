'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'

type Compte = 'capital' | 'courant'

function aujourdhuiLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Bouton() {
  const { pending } = useFormStatus()
  return (
    <button className="bouton w-full" disabled={pending}>
      {pending ? 'Enregistrement…' : 'Enregistrer'}
    </button>
  )
}

export default function FormulaireMouvement({
  action,
  associes,
  types,
}: {
  action: (donnees: FormData) => Promise<void>
  associes: { id: string; nom: string }[]
  types: Record<Compte, readonly (readonly [string, string])[]>
}) {
  const [compte, setCompte] = useState<Compte>('capital')

  return (
    <form action={action} className="carte h-fit space-y-3 p-5">
      <h2 className="text-sm font-bold">Nouveau mouvement</h2>
      <p className="text-xs text-[var(--color-encre-doux)]">
        Un prélèvement n’est pas une dépense : il ne touche pas le profit.
      </p>

      <div>
        <label className="etiquette" htmlFor="associe_id">
          Associé
        </label>
        <select id="associe_id" name="associe_id" className="champ" required>
          {associes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nom}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="etiquette" htmlFor="compte">
          Compte
        </label>
        <select
          id="compte"
          name="compte"
          className="champ"
          value={compte}
          onChange={(e) => setCompte(e.target.value as Compte)}
        >
          <option value="capital">Capital</option>
          <option value="courant">Compte courant (avances)</option>
        </select>
      </div>

      <div>
        <label className="etiquette" htmlFor="type">
          Nature
        </label>
        <select id="type" name="type" className="champ" required>
          {types[compte].map(([code, libelle]) => (
            <option key={code} value={code}>
              {libelle}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="etiquette" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            className="champ"
            defaultValue={aujourdhuiLocal()}
            required
          />
        </div>
        <div>
          <label className="etiquette" htmlFor="montant">
            Montant
          </label>
          <input
            id="montant"
            name="montant"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            className="champ"
            placeholder="0,00"
            required
          />
        </div>
      </div>

      <div>
        <label className="etiquette" htmlFor="description">
          Description <span className="font-normal">(facultatif)</span>
        </label>
        <input id="description" name="description" className="champ" maxLength={300} />
      </div>

      <Bouton />
    </form>
  )
}
