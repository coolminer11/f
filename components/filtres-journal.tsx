'use client'

import Link from 'next/link'
import type { Categorie } from '@/lib/requetes/transactions'

export default function FiltresJournal({
  categories,
  provinces,
  valeurs,
}: {
  categories: Categorie[]
  provinces: readonly (readonly [string, string])[]
  valeurs: Record<string, string | undefined>
}) {
  const actif = Object.entries(valeurs).some(([c, v]) => v && c !== 'page')

  return (
    <form method="get" className="carte grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-7">
      <div className="lg:col-span-2">
        <label className="etiquette" htmlFor="recherche">
          Recherche
        </label>
        <input
          id="recherche"
          name="recherche"
          className="champ"
          placeholder="Description…"
          defaultValue={valeurs.recherche ?? ''}
        />
      </div>
      <div>
        <label className="etiquette" htmlFor="debut">
          Du
        </label>
        <input id="debut" name="debut" type="date" className="champ" defaultValue={valeurs.debut ?? ''} />
      </div>
      <div>
        <label className="etiquette" htmlFor="fin">
          Au
        </label>
        <input id="fin" name="fin" type="date" className="champ" defaultValue={valeurs.fin ?? ''} />
      </div>
      <div>
        <label className="etiquette" htmlFor="type">
          Type
        </label>
        <select id="type" name="type" className="champ" defaultValue={valeurs.type ?? ''}>
          <option value="">Tous</option>
          <option value="revenu">Revenus</option>
          <option value="depense">Dépenses</option>
        </select>
      </div>
      <div>
        <label className="etiquette" htmlFor="categorie">
          Catégorie
        </label>
        <select
          id="categorie"
          name="categorie"
          className="champ"
          defaultValue={valeurs.categorie ?? ''}
        >
          <option value="">Toutes</option>
          {categories.map((c) => (
            <option key={c.categorie} value={c.categorie}>
              {c.libelle}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="etiquette" htmlFor="province">
          Province
        </label>
        <select id="province" name="province" className="champ" defaultValue={valeurs.province ?? ''}>
          <option value="">Toutes</option>
          {provinces.map(([code, nom]) => (
            <option key={code} value={code}>
              {nom}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-7">
        <button className="bouton">Filtrer</button>
        {actif && (
          <Link href="/transactions" className="bouton bouton-secondaire">
            Réinitialiser
          </Link>
        )}
      </div>
    </form>
  )
}
