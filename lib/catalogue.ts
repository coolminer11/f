import 'server-only'
import { requete } from '@/lib/db'

/**
 * Le catalogue : trois cartes, et seulement trois.
 *
 *   - Carte Québec : français mis en valeur, anglais après ; sans
 *     personnalisation ; gardée en stock.
 *   - Entreprise — Québec : personnalisée, français d'abord ; 25 au minimum.
 *   - Entreprise — International : personnalisée, anglais d'abord ; hors
 *     Québec seulement (la base le refuse au Québec).
 */

export type Modele = 'quebec' | 'entreprise_qc' | 'entreprise_intl'

export const MODELES: Record<Modele, { court: string; langue: string; pour: string }> = {
  quebec: { court: 'Québec', langue: 'Français mis en valeur, anglais après', pour: 'Tout commerce au Québec. Prête à poser, sans personnalisation.' },
  entreprise_qc: { court: 'Entreprise — Québec', langue: 'Français d’abord, anglais après', pour: 'Restos, hôtels, chaînes au Québec. Logo, couleurs, texte, nom de chaque carte.' },
  entreprise_intl: { court: 'Entreprise — International', langue: 'Anglais d’abord, français après', pour: 'Les mêmes, hors Québec (reste du Canada, États-Unis…).' },
}

export type CarteCatalogue = {
  id: string
  sku: string
  nom: string
  description: string | null
  modele: Modele
  langue: 'fr_en' | 'en_fr'
  personnalisable: boolean
  prix: number
  quantite_min: number
  seuil_stock: number | null
  stock: number
  valeur_stock: number
  cout_moyen: number
  vendues_90j: number
}

export async function catalogue(): Promise<CarteCatalogue[]> {
  const l = await requete<Record<string, unknown>>(
    `select p.id, p.sku, p.nom, p.description, p.modele, p.langue, p.personnalisable, p.prix_vente_ht as prix,
            p.quantite_min, p.seuil_stock,
            coalesce(s.quantite_en_stock, 0) as stock, coalesce(s.valeur_stock, 0) as valeur_stock, coalesce(s.cout_moyen, 0) as cout_moyen,
            coalesce((select -sum(m.quantite) from inventaire_mouvements m
                       where m.produit_id = p.id and m.type = 'vente' and m.date > current_date - 90), 0) as vendues_90j
       from produits p
       left join v_stock s on s.produit_id = p.id
      where p.actif and p.modele is not null
      order by p.ordre, p.nom`,
  )
  return l.map((x) => ({
    id: x.id as string,
    sku: x.sku as string,
    nom: x.nom as string,
    description: (x.description as string) ?? null,
    modele: x.modele as Modele,
    langue: x.langue as 'fr_en' | 'en_fr',
    personnalisable: !!x.personnalisable,
    prix: Number(x.prix),
    quantite_min: Number(x.quantite_min),
    seuil_stock: x.seuil_stock === null ? null : Number(x.seuil_stock),
    stock: Number(x.stock),
    valeur_stock: Number(x.valeur_stock),
    cout_moyen: Number(x.cout_moyen),
    vendues_90j: Number(x.vendues_90j),
  }))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Prix, minimum par commande et seuil d'alerte d'une carte. Le nom, le modèle et la langue ne bougent pas. */
export async function modifierCarte(id: string, e: { prix: number; quantiteMin: number; seuilStock: number | null }): Promise<void> {
  if (!UUID.test(id)) throw new Error('Carte introuvable.')
  await requete(
    `update produits set prix_vente_ht = $2, quantite_min = $3, seuil_stock = $4 where id = $1::uuid and modele is not null`,
    [id, e.prix, e.quantiteMin, e.seuilStock],
  )
}
