'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { exigerEcriture } from '@/lib/auth'
import {
  annulerCommande,
  creerCommande,
  creerDevisCommande,
  ETAPES,
  facturerCommande,
  joindreFichier,
  modifierCommande,
  noterEtape,
  poserCommande,
  recevoirCommande,
  type Etape,
  type SaisieCommande,
} from '@/lib/commandes'
import { modifierCarte } from '@/lib/catalogue'
import { televerserRecu } from '@/lib/stockage'

const erreur = (e: unknown) => (e instanceof Error ? e.message : 'Opération impossible.').replace(/^error:\s*/i, '')
const aller = (chemin: string, cle: 'message' | 'erreur', texte: string): never =>
  redirect(`${chemin}${chemin.includes('?') ? '&' : '?'}${cle}=${encodeURIComponent(texte)}`)
const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date())
const texte = (d: FormData, k: string, max: number) => String(d.get(k) ?? '').trim().slice(0, max) || null
const LIEUX = new Set(['QC', 'ON', 'NB', 'NS', 'PE', 'NL', 'MB', 'SK', 'AB', 'BC', 'YT', 'NT', 'NU', 'INTL'])

function montant(brut: FormDataEntryValue | null): number | null {
  const v = String(brut ?? '').trim().replace(/\s/g, '').replace(',', '.').replace(/\$$/, '')
  return /^\d{1,7}(\.\d{1,2})?$/.test(v) ? Number(v) : null
}

function lireSaisie(d: FormData, retour: string): SaisieCommande {
  const clientNom = texte(d, 'client_nom', 200)
  if (!clientNom) aller(retour, 'erreur', 'Le nom du client est requis.')
  const quantite = Number(String(d.get('quantite') ?? '').trim())
  if (!Number.isInteger(quantite) || quantite < 1 || quantite > 100000) aller(retour, 'erreur', 'Le nombre de cartes : un nombre entier.')
  const prix = montant(d.get('prix_unitaire'))
  if (prix === null) aller(retour, 'erreur', 'Le prix par carte : un montant comme 30,00.')
  const lieu = String(d.get('lieu') ?? 'QC')
  const courriel = texte(d, 'courriel', 254)
  if (courriel && !/^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$/i.test(courriel)) aller(retour, 'erreur', 'Courriel invalide.')
  let destination = texte(d, 'destination', 600)
  if (destination && !/^https?:\/\//i.test(destination)) destination = `https://${destination}`
  return {
    clientNom: clientNom!,
    courriel,
    produitId: String(d.get('produit_id') ?? ''),
    quantite,
    prixUnitaire: prix!,
    lieu: LIEUX.has(lieu) ? lieu : 'QC',
    couleurs: texte(d, 'couleurs', 200),
    texteFr: texte(d, 'texte_fr', 300),
    texteEn: texte(d, 'texte_en', 300),
    nomsCartes: texte(d, 'noms_cartes', 8000),
    destination,
    notes: texte(d, 'notes', 2000),
  }
}

export async function creerCommandeAction(d: FormData): Promise<void> {
  const moi = await exigerEcriture()
  const e = lireSaisie(d, '/commandes')
  let id: string
  try {
    id = await creerCommande(e, moi.id)
  } catch (x) {
    aller('/commandes', 'erreur', erreur(x))
  }
  revalidatePath('/commandes')
  aller(`/commandes/${id!}`, 'message', 'Commande créée. Prochaine étape : le devis.')
}

export async function modifierCommandeAction(d: FormData): Promise<void> {
  await exigerEcriture()
  const id = String(d.get('id') ?? '')
  const ici = `/commandes/${id}`
  const e = lireSaisie(d, ici)
  try {
    await modifierCommande(id, e)
  } catch (x) {
    aller(ici, 'erreur', erreur(x))
  }
  revalidatePath(ici)
  aller(ici, 'message', 'Commande mise à jour.')
}

/** Les étapes sans automatisme : approuvée, commandée (avec une note : fournisseur, délai…). */
export async function etapeAction(d: FormData): Promise<void> {
  const moi = await exigerEcriture()
  const id = String(d.get('id') ?? '')
  const etape = String(d.get('etape') ?? '') as Etape
  const ici = `/commandes/${id}`
  if (!ETAPES.some(([c]) => c === etape)) aller(ici, 'erreur', 'Étape inconnue.')
  await noterEtape(id, etape, moi.id, texte(d, 'note', 500))
  revalidatePath(ici)
  aller(ici, 'message', `Étape « ${ETAPES.find(([c]) => c === etape)![1]} » notée.`)
}

export async function devisAction(d: FormData): Promise<void> {
  await exigerEcriture()
  const id = String(d.get('id') ?? '')
  const ici = `/commandes/${id}`
  let devis: { numero: string }
  try {
    devis = await creerDevisCommande(id)
  } catch (x) {
    aller(ici, 'erreur', erreur(x))
  }
  revalidatePath(ici)
  aller(ici, 'message', `Devis ${devis!.numero} créé : vérifiez-le et envoyez-le depuis Factures.`)
}

export async function fichierAction(d: FormData): Promise<void> {
  const moi = await exigerEcriture()
  const id = String(d.get('id') ?? '')
  const quoi = d.get('quoi') === 'logo' ? 'logo' : 'maquette'
  const ici = `/commandes/${id}`
  const f = d.get('fichier')
  if (!(f instanceof File) || f.size === 0) aller(ici, 'erreur', 'Choisissez un fichier.')
  const fichier = f as File
  if (fichier.size > 10 * 1024 * 1024) aller(ici, 'erreur', 'Fichier trop volumineux (10 Mo maximum).')
  if (!/\.(pdf|png|jpe?g|webp|svg|ai|eps)$/i.test(fichier.name)) aller(ici, 'erreur', 'Un PDF ou une image, s’il vous plaît.')
  try {
    await joindreFichier(id, quoi, await televerserRecu(fichier))
    if (quoi === 'maquette') await noterEtape(id, 'maquette', moi.id, null)
  } catch (x) {
    aller(ici, 'erreur', erreur(x))
  }
  revalidatePath(ici)
  aller(ici, 'message', quoi === 'logo' ? 'Logo joint.' : 'Maquette jointe : envoyez-la au client pour approbation.')
}

export async function recevoirAction(d: FormData): Promise<void> {
  const moi = await exigerEcriture()
  const id = String(d.get('id') ?? '')
  const ici = `/commandes/${id}`
  const total = montant(d.get('total'))
  if (!total) aller(ici, 'erreur', 'Le total payé au fournisseur : un montant comme 120,00.')
  const date = String(d.get('date') ?? aujourdhui())
  try {
    await recevoirCommande(id, total!, /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : aujourdhui(), moi.id)
  } catch (x) {
    aller(ici, 'erreur', erreur(x))
  }
  revalidatePath('/', 'layout')
  aller(ici, 'message', 'Cartes reçues : elles sont au stock, à leur vrai coût.')
}

export async function poserAction(d: FormData): Promise<void> {
  const moi = await exigerEcriture()
  const id = String(d.get('id') ?? '')
  const ici = `/commandes/${id}`
  let nb: number
  try {
    nb = await poserCommande(id, moi.id)
  } catch (x) {
    aller(ici, 'erreur', erreur(x))
  }
  revalidatePath('/', 'layout')
  aller(ici, 'message', `${nb!} cartes NFC créées dans le dossier du client. Programmez les puces avec la liste du dossier.`)
}

export async function facturerAction(d: FormData): Promise<void> {
  const moi = await exigerEcriture()
  const id = String(d.get('id') ?? '')
  const ici = `/commandes/${id}`
  let facture: { numero: string }
  try {
    facture = await facturerCommande(id, aujourdhui(), moi.id)
  } catch (x) {
    aller(ici, 'erreur', erreur(x))
  }
  revalidatePath('/', 'layout')
  aller(ici, 'message', `Facture ${facture!.numero} créée. Les cartes sortent du stock.`)
}

export async function annulerAction(d: FormData): Promise<void> {
  await exigerEcriture()
  const id = String(d.get('id') ?? '')
  const oui = d.get('annuler') === '1'
  await annulerCommande(id, oui)
  revalidatePath('/commandes')
  aller(`/commandes/${id}`, 'message', oui ? 'Commande annulée.' : 'Commande rétablie.')
}

/** Catalogue : prix, minimum par commande, seuil d'alerte. */
export async function carteAction(d: FormData): Promise<void> {
  await exigerEcriture()
  const ici = '/commandes/catalogue'
  const prix = montant(d.get('prix'))
  const min = Number(String(d.get('quantite_min') ?? '').trim())
  const seuilBrut = String(d.get('seuil') ?? '').trim()
  if (prix === null) aller(ici, 'erreur', 'Le prix : un montant comme 35,00.')
  if (!Number.isInteger(min) || min < 1 || min > 100000) aller(ici, 'erreur', 'Le minimum : un nombre entier.')
  if (seuilBrut !== '' && !/^\d{1,5}$/.test(seuilBrut)) aller(ici, 'erreur', 'Le seuil d’alerte : un nombre entier (vide = pas d’alerte).')
  try {
    await modifierCarte(String(d.get('id') ?? ''), { prix: prix!, quantiteMin: min, seuilStock: seuilBrut === '' ? null : Number(seuilBrut) })
  } catch (x) {
    aller(ici, 'erreur', erreur(x))
  }
  revalidatePath('/', 'layout')
  aller(ici, 'message', 'Carte mise à jour. Les nouveaux devis et factures prennent ce prix.')
}
