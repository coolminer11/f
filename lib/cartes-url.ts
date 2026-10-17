import 'server-only'
import { headers } from 'next/headers'

/**
 * L'adresse de base écrite sur les puces.
 *
 * Elle vient de URL_CARTES (https://go.taporacards.com) et de rien d'autre :
 * une puce programmée avec l'adresse de l'hébergeur du moment
 * (…onrender.com) cesserait de marcher le jour où l'on change d'hébergeur,
 * et elle ne se reprogramme pas une fois chez le client.
 */
export function baseCartesConfiguree(): string | null {
  const brut = process.env.URL_CARTES?.trim()
  return brut ? brut.replace(/\/+$/, '') : null
}

/** Pour l'affichage seulement, quand URL_CARTES manque : l'adresse actuelle. */
export async function baseCartesAffichee(): Promise<string> {
  const configuree = baseCartesConfiguree()
  if (configuree) return configuree
  const h = await headers()
  const hote = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto')?.split(',')[0] ?? 'http'
  return `${proto}://${hote}`
}

export function urlPuce(base: string, code: string): string {
  return `${base}/t/${code}`
}

/** Le QR imprimé porte « ?q » : c'est ce qui distingue un scan d'un tap. */
export function urlQr(base: string, code: string): string {
  return `${base}/t/${code}?q`
}
