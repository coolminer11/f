'use client'

export default function FiltresDecisions({
  categories,
  valeurs,
  annee,
}: {
  categories: readonly (readonly [string, string])[]
  valeurs: Record<string, string | undefined>
  annee: number
}) {
  return (
    <form method="get" className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="annee" value={annee} />
      <div className="min-w-48 flex-1">
        <label className="etiquette" htmlFor="recherche_decision">
          Recherche
        </label>
        <input
          id="recherche_decision"
          name="recherche"
          className="champ"
          placeholder="Prix, fournisseur, associé…"
          defaultValue={valeurs.recherche ?? ''}
        />
      </div>
      <div>
        <label className="etiquette" htmlFor="categorie_filtre">
          Catégorie
        </label>
        <select
          id="categorie_filtre"
          name="categorie"
          className="champ w-auto"
          defaultValue={valeurs.categorie ?? ''}
        >
          <option value="">Toutes</option>
          {categories.map(([code, libelle]) => (
            <option key={code} value={code}>
              {libelle}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="etiquette" htmlFor="statut_filtre">
          Approbation
        </label>
        <select
          id="statut_filtre"
          name="statut"
          className="champ w-auto"
          defaultValue={valeurs.statut ?? ''}
        >
          <option value="">Toutes</option>
          <option value="unanime">Unanime</option>
          <option value="partielle">Partielle</option>
          <option value="en_attente">En attente</option>
        </select>
      </div>
      <button className="bouton bouton-secondaire">Filtrer</button>
    </form>
  )
}
