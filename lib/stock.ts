import 'server-only'
import { requete, requeteUne } from '@/lib/db'

/**
 * Le stock de cartes, par modèle. Les règles sont en base (migrations
 * 20261020000300 et 0400) : une réception va au stock, chaque vente en sort
 * ses cartes au coût moyen pondéré perpétuel, annuler un document remet ses
 * cartes. Ici, on lit et on appelle les fonctions SQL — aucune arithmétique
 * sur l'argent.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const n = (v: unknown) => Number(v ?? 0)

export type EtatStock = {
  produit_id: string | null
  nom: string | null
  modele: string | null
  quantite: number
  cout_moyen: number
  valeur: number
  /** Null : pas d'alerte (cartes faites sur commande). */
  seuil: number | null
  /** Cartes vendues par semaine (8 dernières semaines), pour estimer quand commander. */
  rythme_semaine: number
  /** Vrai dès qu'une réception existe : le coût de la carte vient alors du stock. */
  depuis_receptions: boolean
}

const SELECT_ETAT = `
  select p.id as produit_id, p.nom, p.modele, coalesce(s.quantite_en_stock, 0) as quantite,
         coalesce(s.cout_moyen, 0) as cout_moyen, coalesce(s.valeur_stock, 0) as valeur, p.seuil_stock as seuil,
         coalesce((select -sum(m.quantite) / 8.0 from inventaire_mouvements m
                    where m.produit_id = p.id and m.type = 'vente' and m.date > current_date - 56), 0) as rythme_semaine,
         exists (select 1 from inventaire_mouvements m where m.produit_id = p.id and m.type = 'achat' and m.cout_unitaire is not null) as depuis_receptions
    from produits p
    left join v_stock s on s.produit_id = p.id
   where p.actif and p.suivi_stock and p.est_carte`

const versEtat = (l: Record<string, unknown> | null | undefined): EtatStock => ({
  produit_id: (l?.produit_id as string) ?? null,
  nom: (l?.nom as string) ?? null,
  modele: (l?.modele as string) ?? null,
  quantite: n(l?.quantite),
  cout_moyen: n(l?.cout_moyen),
  valeur: n(l?.valeur),
  seuil: l?.seuil === null || l?.seuil === undefined ? null : n(l.seuil),
  rythme_semaine: n(l?.rythme_semaine),
  depuis_receptions: !!l?.depuis_receptions,
})

/** Toutes les cartes suivies au stock, dans l'ordre du catalogue. */
export async function etatsStock(): Promise<EtatStock[]> {
  const l = await requete<Record<string, unknown>>(`${SELECT_ETAT} order by p.ordre, p.nom`)
  return l.map(versEtat)
}

/** La carte par défaut (la carte à l’unité — Québec). */
export async function etatStock(): Promise<EtatStock> {
  return versEtat(await requeteUne<Record<string, unknown>>(`${SELECT_ETAT} and p.id = produit_carte()`))
}

/** Les cartes sous leur seuil (ou en stock négatif) : pour les alertes. */
export async function alertesStock(): Promise<EtatStock[]> {
  return (await etatsStock()).filter((s) => s.quantite < 0 || (s.seuil !== null && s.quantite < s.seuil))
}

export async function inscritAuxTaxes(): Promise<boolean> {
  const l = await requeteUne<{ inscrit: boolean }>(
    `select (coalesce(numero_tps, '') <> '' or coalesce(numero_tvq, '') <> '') as inscrit from parametres where id`,
  )
  return !!l?.inscrit
}

export type Reception = {
  id: string
  date: string
  description: string
  produit_id: string
  modele_nom: string
  quantite: number
  montant_cartes: number
  cout_unitaire: number
  hors_cartes: number
  total: number
  piece_jointe_url: string | null
  a_des_taxes: boolean
}

export async function receptions(): Promise<Reception[]> {
  const l = await requete<Record<string, unknown>>(
    `select t.id, to_char(t.date, 'YYYY-MM-DD') as date, t.description, m.produit_id, p.nom as modele_nom, m.quantite,
            t.cout_reel as montant_cartes, m.cout_unitaire, coalesce(r.cout_reel, 0) as hors_cartes,
            t.cout_reel + coalesce(r.cout_reel, 0) as total, t.piece_jointe_url, t.total_taxes <> 0 as a_des_taxes
       from transactions t
       join inventaire_mouvements m on m.transaction_id = t.id and m.type = 'achat'
       join produits p on p.id = m.produit_id
       left join transactions r on r.id = t.transaction_liee_id
      where t.est_stock
      order by t.date desc, t.cree_le desc
      limit 100`,
  )
  return l.map((x) => ({
    id: x.id as string,
    date: x.date as string,
    description: x.description as string,
    produit_id: x.produit_id as string,
    modele_nom: x.modele_nom as string,
    quantite: n(x.quantite),
    montant_cartes: n(x.montant_cartes),
    cout_unitaire: n(x.cout_unitaire),
    hors_cartes: n(x.hors_cartes),
    total: n(x.total),
    piece_jointe_url: (x.piece_jointe_url as string) ?? null,
    a_des_taxes: !!x.a_des_taxes,
  }))
}

/**
 * Les dépenses saisies à la main qui ressemblent à un achat de cartes
 * (« carte », « Alibaba », « NFC »…) et ne sont pas au stock : l'app propose
 * de les convertir en un clic.
 */
export async function achatsProbables(): Promise<{ id: string; date: string; description: string; montant: number }[]> {
  const l = await requete<Record<string, unknown>>(
    `select t.id, to_char(t.date, 'YYYY-MM-DD') as date, t.description, t.montant_ht as montant
       from transactions t
      where t.type = 'depense' and not t.est_stock and t.vente_id is null
        and t.categorie not in ('cout_marchandises_vendues', 'perte_inventaire')
        and t.total_taxes = 0
        and t.description ~* '(carte|card|nfc|alibaba|aliexpress|temu|amazon.*(nfc|carte)|stickers?|autocollant)'
        and t.description !~* 'hors cartes'
        and t.date > current_date - 400
        and not exists (select 1 from inventaire_mouvements m where m.transaction_id = t.id)
      order by t.date desc
      limit 10`,
  )
  return l.map((x) => ({ id: x.id as string, date: x.date as string, description: x.description as string, montant: n(x.montant) }))
}

export async function recevoirCartes(e: {
  produitId: string | null
  date: string
  quantite: number
  total: number
  taxes: number
  description: string | null
  modePaiement: string
  pieceJointe: string | null
}): Promise<string> {
  if (e.produitId && !UUID.test(e.produitId)) throw new Error('Modèle de carte introuvable.')
  const l = await requeteUne<{ id: string }>(
    `select recevoir_cartes($1::date, $2::int, $3::numeric, $4, $5::uuid, $6::mode_paiement, $7, $8::numeric) as id`,
    [e.date, e.quantite, e.total, e.description, e.produitId, e.modePaiement, e.pieceJointe, e.taxes],
  )
  return l!.id
}

export async function convertirEnReception(transactionId: string, quantite: number, montantCartes: number, produitId: string | null): Promise<void> {
  if (!UUID.test(transactionId) || (produitId && !UUID.test(produitId))) throw new Error('Dépense introuvable.')
  await requete(`select convertir_en_reception($1::uuid, $2::int, $3::numeric, $4::uuid)`, [transactionId, quantite, montantCartes, produitId])
}

export async function modifierReception(transactionId: string, quantite: number, total: number, montantCartes: number): Promise<void> {
  if (!UUID.test(transactionId)) throw new Error('Réception introuvable.')
  await requete(`select modifier_reception($1::uuid, $2::int, $3::numeric, $4::numeric)`, [transactionId, quantite, total, montantCartes])
}

export async function changerSeuil(produitId: string, seuil: number | null): Promise<void> {
  if (!UUID.test(produitId)) throw new Error('Modèle de carte introuvable.')
  await requete(`update produits set seuil_stock = $2 where id = $1::uuid`, [produitId, seuil])
}

/**
 * Le stock de toutes les cartes à une date (fin d'année pour les impôts), au
 * coût moyen de ce jour-là ; plus les achats et le coût des cartes vendues
 * depuis le 1er janvier.
 */
export async function stockAu(date: string): Promise<{ quantite: number; valeur: number; achats: number; cogs: number }> {
  const l = await requeteUne<Record<string, unknown>>(
    `with q as (
       select p.id, coalesce((select sum(m.quantite) from inventaire_mouvements m where m.produit_id = p.id and m.date <= $1::date), 0) as qte
         from produits p where p.suivi_stock and p.est_carte
     )
     select coalesce(sum(greatest(qte, 0)), 0) as quantite,
            coalesce(sum(case when qte > 0 then round(qte * cout_moyen(q.id, $1::date), 2) else 0 end), 0) as valeur,
            coalesce((select sum(cout_reel) from transactions where est_stock and date between date_trunc('year', $1::date)::date and $1::date), 0) as achats,
            coalesce((select sum(cout_reel) from transactions where categorie = 'cout_marchandises_vendues' and date between date_trunc('year', $1::date)::date and $1::date), 0) as cogs
       from q`,
    [date],
  )
  return { quantite: n(l?.quantite), valeur: n(l?.valeur), achats: n(l?.achats), cogs: n(l?.cogs) }
}
