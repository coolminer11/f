import 'server-only'
import { requete } from '@/lib/db'

export type TypeEvenement = 'ouverture' | 'menu' | 'plat' | 'concierge' | 'rubrique' | 'wifi' | 'demandes' | 'avis_google' | 'pdf' | 'langue'

/**
 * Ce qu'un client a regardé, pour les statistiques de l'établissement. Rien
 * de personnel : ni adresse IP, ni appareil — l'emplacement, la langue,
 * l'heure. Plafonné à 5 000 événements par heure et par établissement : un
 * robot ne remplit pas la base.
 */
export async function noterEvenement(
  etabId: string,
  emplacementId: string | null,
  type: TypeEvenement,
  cible: string | null,
  langue: string | null,
  /** Pour une visite : venue d'un tap (carte NFC) ou d'un scan (code QR). */
  source: 'nfc' | 'qr' | null = null,
): Promise<void> {
  await requete(
    `insert into evenements_service (etablissement_id, emplacement_id, type, cible, langue, source)
     select $1::uuid, $2::uuid, $3, $4, $5, $6
      where (select count(*) from evenements_service where etablissement_id = $1::uuid and cree_le > now() - interval '1 hour') < 5000`,
    [etabId, emplacementId, type, cible?.slice(0, 80) ?? null, langue?.slice(0, 5) ?? null, source],
  ).catch(() => {})
}
