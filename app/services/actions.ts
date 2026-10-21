'use server'

import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import { lireEtablissement } from '@/lib/services/donnees'
import { LANGUES, type Texte } from '@/lib/services/langues'
import type { Etablissement, Options, TypeEtablissement, Variante } from '@/lib/services/types'
import { televerserFichierService } from '@/lib/services/fichiers'
import { definirMotDePassePortail, renouvelerLienPortail } from '@/lib/services/acces'
import { faiblesse } from '@/lib/mots-de-passe'
import * as A from '@/lib/services/admin'
import { creerDemo } from '@/lib/services/demo'

/**
 * Les actions du back-office Tapora Services. Chacune commence par
 * `exigerProprietaire()` : pour tout autre compte, elle n'existe pas (404).
 * Le travail se fait dans un try ; la redirection (avec ?message= ou
 * ?erreur=) toujours après, jamais dedans.
 */

const CODES = LANGUES.map((l) => l.code as string)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TYPES_EMPLACEMENT = ['table', 'chambre', 'zone', 'comptoir'] as const
const TYPES_MENU = ['carte', 'boissons', 'room_service', 'dejeuner', 'autre'] as const
const TYPES_ANNONCE = ['plat_du_jour', 'promo', 'info', 'evenement'] as const
const FUSEAUX = ['America/Toronto', 'America/Halifax', 'America/St_Johns', 'America/Winnipeg', 'America/Regina', 'America/Edmonton', 'America/Vancouver', 'Europe/Paris']
const OPTIONS_BOOL = ['menu', 'appel', 'concierge', 'wifi', 'avis', 'recherche', 'prix', 'allergenes', 'photos'] as const

// ---------------------------------------------------------------------------
// Lecture du formulaire
// ---------------------------------------------------------------------------

function champ(d: FormData, n: string): string {
  const v = d.get(n)
  return typeof v === 'string' ? v.trim() : ''
}
const ouNull = (d: FormData, n: string) => champ(d, n) || null
const coche = (d: FormData, n: string) => d.get(n) === 'on'
function fichier(d: FormData, n: string): File | null {
  const f = d.get(n)
  return f instanceof File && f.size > 0 ? f : null
}
function parmi<T extends string>(v: string, liste: readonly T[], defaut: T): T {
  return (liste as readonly string[]).includes(v) ? (v as T) : defaut
}
function idDe(d: FormData, n = 'id'): string {
  const v = champ(d, n)
  if (!UUID.test(v)) throw new Error('Élément introuvable.')
  return v
}
const sensDe = (d: FormData): -1 | 1 => (champ(d, 'sens') === '-1' ? -1 : 1)

/** `nom_fr`, `nom_en`… → { fr, en } (toutes les langues connues, vides exclues). */
function texteDe(d: FormData, nom: string): Texte {
  const t: Record<string, string> = {}
  for (const l of CODES) {
    const v = d.get(`${nom}_${l}`)
    if (typeof v === 'string' && v.trim()) t[l] = v
  }
  return t as Texte
}

function montant(d: FormData, n: string): number | null {
  const v = champ(d, n)
  if (!v) return null
  const x = A.lirePrix(v)
  if (x === null) throw new Error(`Montant invalide : « ${v} ».`)
  return x
}

function raison(x: unknown): string {
  // Une erreur de PostgreSQL (code à 5 caractères) : pas de SQL brut à l'écran.
  const code = x && typeof x === 'object' && 'code' in x ? (x as { code: unknown }).code : null
  if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return 'La base a refusé ces valeurs : vérifiez la longueur et le format des champs.'
  return x instanceof Error ? x.message : 'Action impossible.'
}

// ---------------------------------------------------------------------------
// Retour à la page
// ---------------------------------------------------------------------------

const RETOUR = /^\/services\/[0-9a-f-]{36}(\/[a-z]+)?(\?[A-Za-z0-9_=&%.\-]*)?$/

function cheminRetour(v: FormDataEntryValue | null, id: string): string {
  const s = typeof v === 'string' ? v : ''
  return RETOUR.test(s) && s.startsWith(`/services/${id}`) ? s : `/services/${id}`
}

function versPage(chemin: string, cle: 'message' | 'erreur', texte: string, ancre: string | null): string {
  const [p, q = ''] = chemin.split('?')
  const sp = new URLSearchParams(q)
  sp.delete('message')
  sp.delete('erreur')
  sp.set(cle, texte.slice(0, 300))
  // Pas de « #ancre » : une redirection d'action serveur vers une adresse à
  // fragment ne se termine jamais côté navigateur (le bouton reste en attente).
  // MessagesAdresse défile jusqu'à la section, puis retire le paramètre.
  sp.delete('aller')
  if (ancre) sp.set('aller', ancre)
  return `${p}?${sp.toString()}`
}

type Issue = string | { message: string; vers: string } | void

/** Le tronc commun : l'établissement du formulaire, le travail, puis la redirection hors du try. */
async function agir(d: FormData, travail: (e: Etablissement) => Promise<Issue>): Promise<void> {
  const e = await lireEtablissement(champ(d, 'etab'))
  if (!e) notFound()
  const a = champ(d, 'ancre')
  const ancre = /^[a-z0-9-]{1,80}$/i.test(a) ? a : null
  let cle: 'message' | 'erreur' = 'message'
  let texte = 'Enregistré.'
  let vers = cheminRetour(d.get('retour'), e.id)
  try {
    const r = await travail(e)
    if (typeof r === 'string') texte = r
    else if (r) {
      texte = r.message
      vers = r.vers
    }
  } catch (x) {
    cle = 'erreur'
    texte = raison(x)
  }
  revalidatePath('/services', 'layout')
  redirect(versPage(vers, cle, texte, ancre))
}

// ---------------------------------------------------------------------------
// Établissements
// ---------------------------------------------------------------------------

export async function creerEtablissementAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  const type: TypeEtablissement = champ(d, 'type') === 'hotel' ? 'hotel' : 'restaurant'
  const defaut = parmi(champ(d, 'langue_defaut'), CODES, 'fr')
  const langues = [defaut, ...d.getAll('langues').map(String)]
  let id: string | null = null
  let erreur = 'Création impossible.'
  try {
    id = await A.creerEtablissement({ type, nom: champ(d, 'nom'), langues, langue_defaut: defaut })
  } catch (x) {
    erreur = raison(x)
  }
  revalidatePath('/services', 'layout')
  if (!id) redirect(`/services?erreur=${encodeURIComponent(erreur)}`)
  redirect(`/services/${id}/reglages?message=${encodeURIComponent('Établissement créé. Réglez son image, puis ajoutez le menu et les emplacements.')}`)
}

export async function creerDemoAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  const type: TypeEtablissement = champ(d, 'type') === 'hotel' ? 'hotel' : 'restaurant'
  let id: string | null = null
  let erreur = 'Démo impossible.'
  try {
    id = await creerDemo(type)
  } catch (x) {
    erreur = raison(x)
  }
  revalidatePath('/services', 'layout')
  if (!id) redirect(`/services?erreur=${encodeURIComponent(erreur)}`)
  const texte =
    type === 'restaurant'
      ? 'Démo créée : trois menus traduits, 21 emplacements et 30 jours d’activité.'
      : 'Démo créée : concierge de Québec, service aux chambres, 16 emplacements et 30 jours d’activité.'
  redirect(`/services/${id}?message=${encodeURIComponent(texte)}`)
}

export async function identiteAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    const type: TypeEtablissement = champ(d, 'type') === 'hotel' ? 'hotel' : 'restaurant'
    await A.modifierIdentite(e.id, { nom: champ(d, 'nom'), type })
    return type !== e.type ? 'Type changé. Ajustez les demandes proposées dans l’onglet Demandes (bouton « Rétablir les demandes par défaut »).' : 'Identité enregistrée.'
  })
}

export async function apparenceAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.modifierApparence(e.id, champ(d, 'couleur'))
    for (const quoi of ['logo', 'couverture'] as const) {
      const f = fichier(d, quoi)
      if (f) await A.definirImage(e.id, quoi, await televerserFichierService(f, e.id, quoi))
      else if (coche(d, `retirer_${quoi}`)) await A.definirImage(e.id, quoi, null)
    }
    return 'Image de marque enregistrée.'
  })
}

export async function languesAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    const defaut = parmi(champ(d, 'langue_defaut'), CODES, 'fr')
    await A.modifierLangues(e.id, [defaut, ...d.getAll('langues').map(String)], defaut)
    return defaut === 'fr' ? 'Langues enregistrées.' : 'Langues enregistrées. Attention : au Québec, le français doit être la langue par défaut.'
  })
}

export async function accueilAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.modifierAccueil(e.id, texteDe(d, 'accueil'))
    const merci = A.nettoyerTexte(texteDe(d, 'merci'), 200)
    const options: Options = { ...e.options, merci: Object.keys(merci).length ? merci : undefined }
    await A.modifierOptions(e.id, options)
    return 'Messages enregistrés.'
  })
}

export async function optionsAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    const options: Options = { ...e.options, fuseau: parmi(champ(d, 'fuseau'), FUSEAUX, 'America/Toronto') }
    for (const o of OPTIONS_BOOL) options[o] = coche(d, o)
    // Les commandes passent par le menu : sans menu, pas de commande.
    options.commande = coche(d, 'commande') && options.menu
    await A.modifierOptions(e.id, options)
    return 'Options enregistrées : la page client change tout de suite.'
  })
}

export async function coordonneesAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.modifierCoordonnees(e.id, {
      adresse: ouNull(d, 'adresse'),
      telephone: ouNull(d, 'telephone'),
      site_web: ouNull(d, 'site_web'),
      avis_url: ouNull(d, 'avis_url'),
      wifi_nom: ouNull(d, 'wifi_nom'),
      wifi_mdp: ouNull(d, 'wifi_mdp'),
    })
    return 'Coordonnées enregistrées.'
  })
}

export async function formuleAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    const formule = parmi(champ(d, 'formule'), ['essai', 'actif', 'suspendu'] as const, 'essai')
    await A.modifierFormule(e.id, {
      formule,
      essai_jusqua: formule === 'essai' ? ouNull(d, 'essai_jusqua') : null,
      prix_mensuel: montant(d, 'prix_mensuel'),
      contact_nom: ouNull(d, 'contact_nom'),
      contact_courriel: ouNull(d, 'contact_courriel'),
      notes: ouNull(d, 'notes'),
    })
    return formule === 'suspendu' ? 'Abonnement suspendu : les pages client sont hors ligne.' : 'Abonnement enregistré.'
  })
}

export async function basculerEtablissementAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.basculerEtablissement(e.id, !e.actif)
    return e.actif ? 'Établissement désactivé : ses pages client et son portail sont fermés.' : 'Établissement réactivé.'
  })
}

export async function supprimerEtablissementAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    if (champ(d, 'confirmation') !== e.nom) throw new Error('Tapez le nom exact de l’établissement pour confirmer la suppression.')
    await A.supprimerEtablissement(e.id)
    return { message: `« ${e.nom} » est supprimé, avec ses menus, ses emplacements et son historique.`, vers: '/services' }
  })
}

// ---------------------------------------------------------------------------
// Portail du personnel
// ---------------------------------------------------------------------------

export async function motDePassePortailAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    const mdp = champ(d, 'mot_de_passe')
    const refus = mdp.length > 100 ? '100 caractères au plus.' : faiblesse(mdp, [e.nom])
    if (refus) throw new Error(`Mot de passe refusé : ${refus}`)
    await definirMotDePassePortail(e.id, mdp)
    return 'Mot de passe du portail enregistré. Donnez-le à l’équipe : il ne sera plus jamais affiché.'
  })
}

export async function retirerMotDePassePortailAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await definirMotDePassePortail(e.id, null)
    return 'Mot de passe retiré : le lien seul ouvre le portail.'
  })
}

export async function renouvelerLienPortailAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await renouvelerLienPortail(e.id)
    return 'Nouveau lien du portail créé : l’ancien ne fonctionne plus, et chaque appareil doit se reconnecter.'
  })
}

// ---------------------------------------------------------------------------
// Emplacements
// ---------------------------------------------------------------------------

export async function creerEmplacementsAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    const n = await A.creerEmplacements(e.id, {
      prefixe: champ(d, 'prefixe'),
      de: Number(champ(d, 'de')),
      a: Number(champ(d, 'a')),
      type: parmi(champ(d, 'type'), TYPES_EMPLACEMENT, e.type === 'hotel' ? 'chambre' : 'table'),
      groupe: ouNull(d, 'groupe'),
    })
    return `${n} emplacement${n > 1 ? 's' : ''} créé${n > 1 ? 's' : ''}. Téléchargez la planche de QR pour les imprimer.`
  })
}

export async function creerEmplacementAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.creerEmplacement(e.id, { libelle: champ(d, 'libelle'), type: parmi(champ(d, 'type'), TYPES_EMPLACEMENT, 'zone'), groupe: ouNull(d, 'groupe') })
    return 'Emplacement ajouté.'
  })
}

export async function modifierEmplacementAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.modifierEmplacement(e.id, idDe(d), { libelle: champ(d, 'libelle'), type: parmi(champ(d, 'type'), TYPES_EMPLACEMENT, 'table'), groupe: ouNull(d, 'groupe') })
    return 'Emplacement enregistré.'
  })
}

export async function basculerEmplacementAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    const actif = champ(d, 'actif') === '1'
    await A.basculerEmplacement(e.id, idDe(d), actif)
    return actif ? 'Emplacement réactivé.' : 'Emplacement désactivé : sa carte et son QR ne mènent plus nulle part.'
  })
}

export async function supprimerEmplacementAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.supprimerEmplacement(e.id, idDe(d))
    return 'Emplacement supprimé (son historique reste dans les statistiques).'
  })
}

export async function deplacerEmplacementAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.deplacerEmplacement(e.id, idDe(d), sensDe(d))
    return 'Ordre enregistré.'
  })
}

// ---------------------------------------------------------------------------
// Menus et sections
// ---------------------------------------------------------------------------

export async function creerMenuAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    const id = await A.creerMenu(e.id, parmi(champ(d, 'type'), TYPES_MENU, 'carte'), texteDe(d, 'nom'))
    return { message: 'Menu créé. Ajoutez-y des sections et des plats, ou importez-le en texte.', vers: `/services/${e.id}/menu?m=${id}` }
  })
}

export async function modifierMenuAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    const toute = coche(d, 'toute_la_journee')
    await A.modifierMenu(e.id, idDe(d), {
      type: parmi(champ(d, 'type'), TYPES_MENU, 'carte'),
      nom: texteDe(d, 'nom'),
      description: texteDe(d, 'description'),
      heure_debut: toute ? null : ouNull(d, 'heure_debut'),
      heure_fin: toute ? null : ouNull(d, 'heure_fin'),
      jours: d.getAll('jours').map(Number),
      actif: coche(d, 'actif'),
    })
    return 'Menu enregistré.'
  })
}

export async function pdfMenuAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    const menu = idDe(d)
    const langue = parmi(champ(d, 'langue'), CODES, e.langue_defaut)
    if (champ(d, 'geste') === 'retirer') {
      await A.definirPdfMenu(e.id, menu, langue, null)
      return `PDF (${langue.toUpperCase()}) retiré.`
    }
    const f = fichier(d, 'pdf')
    if (!f) throw new Error('Choisissez un fichier PDF.')
    await A.definirPdfMenu(e.id, menu, langue, await televerserFichierService(f, e.id, 'pdf'))
    return `PDF (${langue.toUpperCase()}) en ligne : les clients qui lisent en ${langue.toUpperCase()} peuvent l’ouvrir.`
  })
}

export async function supprimerMenuAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.supprimerMenu(e.id, idDe(d))
    return { message: 'Menu supprimé, avec ses sections et ses plats.', vers: `/services/${e.id}/menu` }
  })
}

export async function deplacerMenuAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.deplacerMenu(e.id, idDe(d), sensDe(d))
    return 'Ordre des menus enregistré.'
  })
}

export async function creerSectionAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.creerSection(e.id, idDe(d, 'menu'), texteDe(d, 'nom'))
    return 'Section ajoutée.'
  })
}

export async function modifierSectionAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.modifierSection(e.id, idDe(d), texteDe(d, 'nom'), texteDe(d, 'description'))
    return 'Section enregistrée.'
  })
}

export async function supprimerSectionAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.supprimerSection(e.id, idDe(d))
    return 'Section supprimée, avec ses plats.'
  })
}

export async function deplacerSectionAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.deplacerSection(e.id, idDe(d), sensDe(d))
    return 'Ordre des sections enregistré.'
  })
}

export async function importerMenuAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    const brut = String(d.get('texte') ?? '')
    if (!brut.trim()) throw new Error('Collez le menu à importer.')
    if (brut.length > 60_000) throw new Error('Texte trop long (60 000 caractères au plus).')
    const r = await A.importerTexte(e.id, idDe(d, 'menu'), brut, e.langue_defaut)
    return `Import terminé : ${r.sections} section${r.sections > 1 ? 's' : ''} et ${r.plats} plat${r.plats > 1 ? 's' : ''}. Complétez les traductions.`
  })
}

// ---------------------------------------------------------------------------
// Plats
// ---------------------------------------------------------------------------

function variantesDe(d: FormData): Variante[] {
  const n = Math.min(20, Number(champ(d, 'nb_variantes')) || 0)
  const v: Variante[] = []
  for (let i = 0; i < n; i++) {
    const nom = texteDe(d, `v${i}_nom`)
    if (Object.keys(nom).length) v.push({ nom, prix: montant(d, `v${i}_prix`) })
  }
  return v
}

export async function creerPlatAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.creerPlat(e.id, idDe(d, 'section'), {
      nom: texteDe(d, 'nom'),
      description: texteDe(d, 'description'),
      prix: montant(d, 'prix'),
      variantes: [],
      allergenes: d.getAll('allergenes').map(String),
      etiquettes: d.getAll('etiquettes').map(String),
      disponible: true,
    })
    return 'Plat ajouté.'
  })
}

export async function modifierPlatAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    const id = idDe(d)
    await A.modifierPlat(e.id, id, {
      nom: texteDe(d, 'nom'),
      description: texteDe(d, 'description'),
      prix: montant(d, 'prix'),
      variantes: variantesDe(d),
      allergenes: d.getAll('allergenes').map(String),
      etiquettes: d.getAll('etiquettes').map(String),
      disponible: coche(d, 'disponible'),
      section_id: UUID.test(champ(d, 'section_id')) ? champ(d, 'section_id') : undefined,
    })
    const photo = fichier(d, 'photo')
    if (photo) await A.definirPhotoPlat(e.id, id, await televerserFichierService(photo, e.id, 'photo'))
    else if (coche(d, 'retirer_photo')) await A.definirPhotoPlat(e.id, id, null)
    return 'Plat enregistré.'
  })
}

export async function basculerPlatAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    const disponible = champ(d, 'disponible') === '1'
    await A.basculerDisponible(e.id, idDe(d), disponible)
    return disponible ? 'De retour sur le menu.' : 'Marqué « épuisé » : les clients le voient grisé.'
  })
}

export async function dupliquerPlatAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.dupliquerPlat(e.id, idDe(d))
    return 'Plat dupliqué (« copie » ajoutée au nom).'
  })
}

export async function supprimerPlatAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.supprimerPlat(e.id, idDe(d))
    return 'Plat supprimé.'
  })
}

export async function deplacerPlatAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.deplacerPlat(e.id, idDe(d), sensDe(d))
    return 'Ordre enregistré.'
  })
}

// ---------------------------------------------------------------------------
// Annonces
// ---------------------------------------------------------------------------

function annonceDe(d: FormData): A.ChampsAnnonce {
  return {
    type: parmi(champ(d, 'type'), TYPES_ANNONCE, 'info'),
    titre: texteDe(d, 'titre'),
    texte: texteDe(d, 'texte'),
    prix: montant(d, 'prix'),
    debut: ouNull(d, 'debut'),
    fin: ouNull(d, 'fin'),
    actif: coche(d, 'actif'),
  }
}

export async function creerAnnonceAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.creerAnnonce(e.id, annonceDe(d))
    return 'Annonce publiée.'
  })
}

export async function modifierAnnonceAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.modifierAnnonce(e.id, idDe(d), annonceDe(d))
    return 'Annonce enregistrée.'
  })
}

export async function supprimerAnnonceAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.supprimerAnnonce(e.id, idDe(d))
    return 'Annonce supprimée.'
  })
}

export async function deplacerAnnonceAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.deplacerAnnonce(e.id, idDe(d), sensDe(d))
    return 'Ordre enregistré.'
  })
}

// ---------------------------------------------------------------------------
// Concierge
// ---------------------------------------------------------------------------

export async function wifiAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.modifierWifi(e.id, ouNull(d, 'wifi_nom'), ouNull(d, 'wifi_mdp'))
    return 'Wi-Fi enregistré.'
  })
}

function rubriqueDe(d: FormData): A.ChampsRubrique {
  return {
    type: champ(d, 'type') || 'autre',
    icone: ouNull(d, 'icone'),
    titre: texteDe(d, 'titre'),
    texte: texteDe(d, 'texte'),
    lien: ouNull(d, 'lien'),
    telephone: ouNull(d, 'telephone'),
    actif: coche(d, 'actif'),
  }
}

export async function creerRubriqueAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.creerRubrique(e.id, rubriqueDe(d))
    return 'Rubrique ajoutée au concierge.'
  })
}

export async function modifierRubriqueAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.modifierRubrique(e.id, idDe(d), rubriqueDe(d))
    return 'Rubrique enregistrée.'
  })
}

export async function supprimerRubriqueAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.supprimerRubrique(e.id, idDe(d))
    return 'Rubrique supprimée.'
  })
}

export async function deplacerRubriqueAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.deplacerRubrique(e.id, idDe(d), sensDe(d))
    return 'Ordre enregistré.'
  })
}

// ---------------------------------------------------------------------------
// Types de demandes
// ---------------------------------------------------------------------------

function typeDemandeDe(d: FormData): A.ChampsTypeDemande {
  return { libelle: texteDe(d, 'libelle'), icone: ouNull(d, 'icone'), avec_note: coche(d, 'avec_note'), avis_apres: coche(d, 'avis_apres'), actif: coche(d, 'actif') }
}

export async function creerTypeDemandeAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.creerTypeDemande(e.id, typeDemandeDe(d))
    return 'Demande ajoutée : elle apparaît tout de suite sur la page client.'
  })
}

export async function modifierTypeDemandeAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.modifierTypeDemande(e.id, idDe(d), typeDemandeDe(d))
    return 'Demande enregistrée.'
  })
}

export async function supprimerTypeDemandeAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.supprimerTypeDemande(e.id, idDe(d))
    return 'Demande retirée (l’historique reste).'
  })
}

export async function deplacerTypeDemandeAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.deplacerTypeDemande(e.id, idDe(d), sensDe(d))
    return 'Ordre enregistré.'
  })
}

export async function retablirDemandesAction(d: FormData): Promise<void> {
  await exigerProprietaire()
  await agir(d, async (e) => {
    await A.semerDemandes(e.id, e.type)
    return 'Demandes par défaut rétablies (celles qui existaient déjà sont gardées telles quelles).'
  })
}

// ---------------------------------------------------------------------------
// Glisser-déposer (et ↑ / ↓) : appelée par le composant Triable, sans
// redirection — la page ne remonte pas en haut, elle se met à jour en place.
// ---------------------------------------------------------------------------

export async function reordonnerAction(entree: { etab: string; quoi: string; parent: string; ids: string[] }): Promise<{ ok: boolean; message: string }> {
  await exigerProprietaire()
  try {
    const e = await lireEtablissement(String(entree.etab))
    if (!e) throw new Error('Établissement introuvable.')
    const quoi = String(entree.quoi) as A.ListeTriable
    const ids = Array.isArray(entree.ids) ? entree.ids.map(String) : []
    const parent = quoi === 'sections' || quoi === 'plats' ? String(entree.parent) : e.id
    await A.reordonnerListe(quoi, e.id, parent, ids)
    revalidatePath(`/services/${e.id}`, 'layout')
    return { ok: true, message: 'Nouvel ordre enregistré.' }
  } catch (x) {
    return { ok: false, message: raison(x) }
  }
}
