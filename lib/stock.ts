import 'server-only'
import { requete, requeteUne } from '@/lib/db'

/**
 * Le stock de cartes. Les règles sont en base (migration 20261020000300) :
 * une réception va au stock, chaque vente en sort une carte au coût moyen
 * pondéré perpétuel, annuler un document remet ses cartes. Ici, on lit et on
 * appelle les fonctions SQL — aucune arithmétique sur l'argent.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const n = (v: unknown) => Number(v ?? 0)

export type EtatStock = {
  produit_id: string | null
  nom: string | null
  quantite: number
  cout_moyen: number
  valeur: number
  seuil: number
  inscrit_taxes: boolean
  /** Cartes vendues par semaine (8 dernières semaines), pour estimer quand commander. */
  rythme_semaine: number
  /** Vrai dès qu'une réception existe : le coût de la carte vient alors du stock. */
  depuis_receptions: boolean
}

export async function etatStock(): Promise<EtatStock> {
  const l = await requeteUne<Record<string, unknown>>(
    `select s.produit_id, s.nom, s.quantite_en_stock as quantite, s.cout_moyen, s.valeur_stock as valeur,
            p.seuil_stock_cartes as seuil,
            (coalesce(p.numero_tps, '') <> '' or coalesce(p.numero_tvq, '') <> '') as inscrit_taxes,
            coalesce((select -sum(m.quantite) / 8.0 from inventaire_mouvements m
                       where m.produit_id = s.produit_id and m.type = 'vente' and m.date > current_date - 56), 0) as rythme_semaine,
            exists (select 1 from inventaire_mouvements m where m.produit_id = s.produit_id and m.type = 'achat' and m.cout_unitaire is not null) as depuis_receptions
       from parametres p
       left join v_stock s on s.produit_id = produit_carte()
      where p.id`,
  )
  return {
    produit_id: (l?.produit_id as string) ?? null,
    nom: (l?.nom as string) ?? null,
    quantite: n(l?.quantite),
    cout_moyen: n(l?.cout_moyen),
    valeur: n(l?.valeur),
    seuil: n(l?.seuil ?? 10),
    inscrit_taxes: !!l?.inscrit_taxes,
    rythme_semaine: n(l?.rythme_semaine),
    depuis_receptions: !!l?.depuis_receptions,
  }
}

export type Reception = {
  id: string
  date: string
  description: string
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
    `select t.id, to_char(t.date, 'YYYY-MM-DD') as date, t.description, m.quantite, t.cout_reel as montant_cartes,
            m.cout_unitaire, coalesce(r.cout_reel, 0) as hors_cartes, t.cout_reel + coalesce(r.cout_reel, 0) as total,
            t.piece_jointe_url, t.total_taxes <> 0 as a_des_taxes
       from transactions t
       join inventaire_mouvements m on m.transaction_id = t.id and m.type = 'achat'
       left join transactions r on r.id = t.transaction_liee_id
      where t.est_stock
      order by t.date desc, t.cree_le desc
      limit 100`,
  )
  return l.map((x) => ({
    id: x.id as string,
    date: x.date as string,
    description: x.description as string,
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
  date: string
  quantite: number
  total: number
  taxes: number
  description: string | null
  modePaiement: string
  pieceJointe: string | null
}): Promise<string> {
  const l = await requeteUne<{ id: string }>(
    `select recevoir_cartes($1::date, $2::int, $3::numeric, $4, null, $5::mode_paiement, $6, $7::numeric) as id`,
    [e.date, e.quantite, e.total, e.description, e.modePaiement, e.pieceJointe, e.taxes],
  )
  return l!.id
}

export async function convertirEnReception(transactionId: string, quantite: number, montantCartes: number): Promise<void> {
  if (!UUID.test(transactionId)) throw new Error('Dépense introuvable.')
  await requete(`select convertir_en_reception($1::uuid, $2::int, $3::numeric)`, [transactionId, quantite, montantCartes])
}

export async function modifierReception(transactionId: string, quantite: number, total: number, montantCartes: number): Promise<void> {
  if (!UUID.test(transactionId)) throw new Error('Réception introuvable.')
  await requete(`select modifier_reception($1::uuid, $2::int, $3::numeric, $4::numeric)`, [transactionId, quantite, total, montantCartes])
}

export async function changerSeuil(seuil: number): Promise<void> {
  await requete(`update parametres set seuil_stock_cartes = $1 where id`, [seuil])
}

/** Le stock à une date (fin d'année pour les impôts), au coût moyen de ce jour-là. */
export async function stockAu(date: string): Promise<{ quantite: number; valeur: number; achats: number; cogs: number }> {
  const l = await requeteUne<Record<string, unknown>>(
    `with p as (select produit_carte() as id)
     select coalesce((select sum(quantite) from inventaire_mouvements m, p where m.produit_id = p.id and m.date <= $1::date), 0) as quantite,
            round(coalesce((select sum(quantite) from inventaire_mouvements m, p where m.produit_id = p.id and m.date <= $1::date), 0)
                  * (select cout_moyen(p.id, $1::date) from p), 2) as valeur,
            coalesce((select sum(cout_reel) from transactions where est_stock and date between date_trunc('year', $1::date)::date and $1::date), 0) as achats,
            coalesce((select sum(cout_reel) from transactions where categorie = 'cout_marchandises_vendues' and date between date_trunc('year', $1::date)::date and $1::date), 0) as cogs`,
    [date],
  )
  const quantite = n(l?.quantite)
  return { quantite, valeur: quantite > 0 ? n(l?.valeur) : 0, achats: n(l?.achats), cogs: n(l?.cogs) }
}
