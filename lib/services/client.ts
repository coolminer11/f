import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { requete, requeteUne } from '@/lib/db'
import { parCode } from '@/lib/services/donnees'
import { estLangue } from '@/lib/services/langues'
import { notifierPersonnel } from '@/lib/services/notifications'
import { noterEvenement, type TypeEvenement } from '@/lib/services/evenements'
import { jetonPortail } from '@/lib/services/acces'
import type { Emplacement, Etablissement, Menu } from '@/lib/services/types'

/**
 * Ce dont les pages des clients (/s/…) ont besoin côté serveur : le lieu (un
 * seul aller-retour par affichage, partagé avec les métadonnées), la langue
 * choisie, les couleurs de l'établissement lisibles en clair comme en sombre.
 */
export const NOM_TEMOIN_LANGUE = 'tapora_langue'
/** Posé par le navigateur sur /s/<code> pour 30 minutes : ce qui a déjà été compté. */
export const NOM_TEMOIN_VU = 'tapora_vu'

/** La langue : ?l=, sinon le dernier choix (témoin), sinon celle de l'établissement — toujours une de SES langues. */
export async function choisirLangue(etab: Etablissement, demandee?: string | null): Promise<string> {
  if (demandee && estLangue(demandee) && etab.langues.includes(demandee)) return demandee
  const memo = (await cookies()).get(NOM_TEMOIN_LANGUE)?.value
  if (memo && etab.langues.includes(memo)) return memo
  return etab.langue_defaut
}

export const chargerLieu = cache(async (code: string, demandee?: string | null) => {
  const lieu = await parCode(code)
  if (!lieu) return null
  return { ...lieu, langue: await choisirLangue(lieu.etab, demandee) }
})

/** Le client a-t-il fait un choix de langue (témoin ou ?l=) ? Sinon, on peut lui en suggérer une. */
export async function langueChoisie(demandee?: string | null): Promise<boolean> {
  return Boolean(demandee) || Boolean((await cookies()).get(NOM_TEMOIN_LANGUE)?.value)
}

/**
 * Compter une visite (ou un menu, le concierge…) une seule fois par demi-heure
 * et par téléphone : revenir en arrière ou changer de langue ne gonfle pas
 * les statistiques. `cle` est courte : « o », « c », « d », « m-1a2b3c4d ».
 */
export async function compterUneFois(
  lieu: { etab: Etablissement; emplacement: Emplacement },
  type: TypeEvenement,
  cible: string | null,
  langue: string,
  cle: string,
  source: 'nfc' | 'qr' | null = null,
): Promise<void> {
  const vu = ((await cookies()).get(NOM_TEMOIN_VU)?.value ?? '').split('.')
  if (vu.includes(cle)) return
  void noterEvenement(lieu.etab.id, lieu.emplacement.id, type, cible, langue, source)
}

/** Les menus actifs, sans leurs plats : de quoi dessiner les tuiles de l'accueil. */
export async function menusLegers(etabId: string): Promise<Pick<Menu, 'id' | 'type' | 'nom'>[]> {
  return requete<Pick<Menu, 'id' | 'type' | 'nom'>>(`select id, type, nom from menus where etablissement_id = $1::uuid and actif order by ordre, cree_le`, [etabId])
}

/**
 * La langue du téléphone, si l'établissement la propose et qu'elle n'est pas
 * déjà affichée : on la SUGGÈRE (« Read in English »), on ne l'impose pas —
 * le français reste la langue d'accueil au Québec.
 */
export async function langueSuggeree(etab: Etablissement, langue: string): Promise<string | null> {
  const accepte = (await headers()).get('accept-language') ?? ''
  for (const morceau of accepte.split(',')) {
    const code = morceau.trim().slice(0, 2).toLowerCase()
    if (!code) continue
    if (code === langue) return null
    if (etab.langues.includes(code)) return code
  }
  return null
}

// ---------------------------------------------------------------------------
// Couleurs : l'accent de l'établissement, et de quoi écrire dessus lisiblement
// ---------------------------------------------------------------------------
function rvb(hex: string): [number, number, number] {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#c2552f'
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}
function luminance(hex: string): number {
  const [r, g, b] = rvb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function melange(hex: string, vers: string, t: number): string {
  const a = rvb(hex)
  const b = rvb(vers)
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}
const contraste = (l1: number, l2: number) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
const surAccent = (hex: string) => (contraste(luminance(hex), 1) >= contraste(luminance(hex), luminance('#141414')) ? '#ffffff' : '#141414')

/** Les variables CSS d'un établissement : accent (fond de bouton) et accent « texte », en clair et en sombre. */
export function variablesCouleur(brute: string): Record<string, string> {
  // Seulement une couleur #rrggbb : rien d'autre n'entre dans l'attribut style.
  const couleur = /^#[0-9a-f]{6}$/i.test(brute ?? '') ? brute.toLowerCase() : '#c2552f'
  const L = luminance(couleur)
  // Sur fond clair, un accent trop pâle (jaune, pastel) devient illisible en texte : on l'assombrit.
  let texteClair = couleur
  for (let t = 0.15; contraste(luminance(texteClair), luminance('#ffffff')) < 4.5 && t <= 0.8; t += 0.1) texteClair = melange(couleur, '#000000', t)
  // En sombre, un accent trop foncé (marine) disparaît : on l'éclaircit.
  const accentSombre = L < 0.12 ? melange(couleur, '#ffffff', 0.32) : couleur
  let texteSombre = accentSombre
  for (let t = 0.15; contraste(luminance(texteSombre), luminance('#17171a')) < 4.5 && t <= 0.8; t += 0.1) texteSombre = melange(accentSombre, '#ffffff', t)
  return {
    '--sv-accent-c': couleur,
    '--sv-sur-accent-c': surAccent(couleur),
    '--sv-accent-texte-c': texteClair,
    '--sv-accent-n': accentSombre,
    '--sv-sur-accent-n': surAccent(accentSombre),
    '--sv-accent-texte-n': texteSombre,
  }
}

// ---------------------------------------------------------------------------
// Retours : le commentaire ajouté après la note
// ---------------------------------------------------------------------------

/**
 * Le client a d'abord donné sa note (enregistrée tout de suite), puis il
 * écrit un mot pour l'équipe : on l'ajoute au même retour, dans la demi-heure,
 * à l'emplacement d'où il écrit. Une note basse avec un mot prévient le
 * personnel sur-le-champ.
 */
export async function ajouterCommentaire(code: string, retourId: string, commentaire: string): Promise<boolean> {
  const lieu = await parCode(code)
  const texte = commentaire.trim().slice(0, 1000)
  if (!lieu || !texte || !/^[0-9a-f-]{36}$/i.test(retourId)) return false
  const r = await requeteUne<{ note: number }>(
    `update retours_service set commentaire = $3
      where id = $1::uuid and etablissement_id = $2::uuid and emplacement_id = $4::uuid and cree_le > now() - interval '30 minutes'
      returning note`,
    [retourId, lieu.etab.id, texte, lieu.emplacement.id],
  )
  if (!r) return false
  if (r.note <= 3) {
    void notifierPersonnel(lieu.etab.id, lieu.emplacement.groupe, {
      titre: `${'★'.repeat(r.note)}${'☆'.repeat(5 - r.note)} ${lieu.emplacement.libelle}`,
      corps: texte.slice(0, 140),
      url: `/service/${jetonPortail(lieu.etab.id, lieu.etab.version_lien)}`,
      etiquette: `retour-${retourId}`,
    }).catch(() => 0)
  }
  return true
}
