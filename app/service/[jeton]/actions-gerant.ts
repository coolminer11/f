'use server'

import { etablissementGerant } from '@/lib/services/acces'
import * as A from '@/lib/services/admin'
import { televerserFichierService, urlFichier } from '@/lib/services/fichiers'
import {
  enregistrerAnnonceGerant,
  enregistrerInfosGerant,
  enregistrerPlatGerant,
  enregistrerSectionGerant,
  supprimerAnnonceGerant,
  supprimerSectionVide,
  type SaisieAnnonce,
  type SaisieInfos,
  type SaisiePlat,
  type SaisieSection,
} from '@/lib/services/portail'

/**
 * Les gestes du gérant. Chaque appel revérifie le jeton, le portail ouvert
 * ET le mode gérant (témoin de 12 h, ou propriétaire connecté) ; chaque id
 * est vérifié contre l'établissement dans lib/services/admin.ts. Les
 * réponses disent ok, ou la raison du refus — jamais de détail technique.
 */
export type Reponse<T extends object = object> = ({ ok: true } & T) | { ok: false; erreur: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ACCES_FERME = 'Le mode gérant est fermé sur cet appareil : rouvrez-le avec le mot de passe du gérant.'

async function gerant<T extends object>(jeton: unknown, travail: (etabId: string) => Promise<T>): Promise<Reponse<T>> {
  const etabId = typeof jeton === 'string' ? await etablissementGerant(jeton.slice(0, 80)) : null
  if (!etabId) return { ok: false, erreur: ACCES_FERME }
  try {
    return { ok: true, ...(await travail(etabId)) }
  } catch (x) {
    const m = x instanceof Error ? x.message : ''
    // Les messages d'admin.ts et de portail.ts sont écrits pour être lus ; le reste reste générique.
    return { ok: false, erreur: m && m.length < 200 && !/sql|relation|column|syntax/i.test(m) ? m : 'Une erreur est survenue. Réessayez.' }
  }
}

const id = (v: unknown) => {
  if (typeof v !== 'string' || !UUID.test(v)) throw new Error('Élément introuvable.')
  return v
}
const sens = (v: unknown): -1 | 1 => (v === -1 ? -1 : 1)

// ---------------------------------------------------------------------------
// Plats et sections
// ---------------------------------------------------------------------------

export async function platGerantAction(jeton: string, saisie: SaisiePlat): Promise<Reponse<{ id: string }>> {
  return gerant(jeton, async (e) => ({ id: await enregistrerPlatGerant(e, saisie) }))
}

/** La photo d'un plat : `photo` (fichier) la remplace, `retirer=1` la retire. */
export async function photoPlatGerantAction(d: FormData): Promise<Reponse<{ photo: string | null }>> {
  return gerant(d.get('jeton'), async (e) => {
    const plat = id(d.get('plat'))
    const f = d.get('photo')
    if (f instanceof File && f.size > 0) {
      const chemin = await televerserFichierService(f, e, 'photo')
      await A.definirPhotoPlat(e, plat, chemin)
      return { photo: urlFichier(chemin) }
    }
    if (d.get('retirer') === '1') {
      await A.definirPhotoPlat(e, plat, null)
      return { photo: null }
    }
    throw new Error('Choisissez une photo.')
  })
}

export async function dupliquerPlatGerantAction(jeton: string, platId: string): Promise<Reponse<{ id: string }>> {
  return gerant(jeton, async (e) => ({ id: await A.dupliquerPlat(e, id(platId)) }))
}

export async function supprimerPlatGerantAction(jeton: string, platId: string): Promise<Reponse> {
  return gerant(jeton, async (e) => {
    await A.supprimerPlat(e, id(platId))
    return {}
  })
}

export async function deplacerPlatGerantAction(jeton: string, platId: string, direction: number): Promise<Reponse> {
  return gerant(jeton, async (e) => {
    await A.deplacerPlat(e, id(platId), sens(direction))
    return {}
  })
}

export async function disponiblePlatGerantAction(jeton: string, platId: string, disponible: boolean): Promise<Reponse> {
  return gerant(jeton, async (e) => {
    await A.basculerDisponible(e, id(platId), Boolean(disponible))
    return {}
  })
}

export async function sectionGerantAction(jeton: string, saisie: SaisieSection): Promise<Reponse<{ id: string }>> {
  return gerant(jeton, async (e) => ({ id: await enregistrerSectionGerant(e, saisie) }))
}

export async function deplacerSectionGerantAction(jeton: string, sectionId: string, direction: number): Promise<Reponse> {
  return gerant(jeton, async (e) => {
    await A.deplacerSection(e, id(sectionId), sens(direction))
    return {}
  })
}

export async function supprimerSectionGerantAction(jeton: string, sectionId: string): Promise<Reponse> {
  return gerant(jeton, async (e) => {
    await supprimerSectionVide(e, id(sectionId))
    return {}
  })
}

// ---------------------------------------------------------------------------
// Annonces
// ---------------------------------------------------------------------------

export async function annonceGerantAction(jeton: string, saisie: SaisieAnnonce): Promise<Reponse> {
  return gerant(jeton, async (e) => {
    await enregistrerAnnonceGerant(e, saisie)
    return {}
  })
}

export async function supprimerAnnonceGerantAction(jeton: string, annonceId: string): Promise<Reponse> {
  return gerant(jeton, async (e) => {
    await supprimerAnnonceGerant(e, id(annonceId))
    return {}
  })
}

// ---------------------------------------------------------------------------
// L'établissement
// ---------------------------------------------------------------------------

export async function infosGerantAction(jeton: string, saisie: SaisieInfos): Promise<Reponse> {
  return gerant(jeton, async (e) => {
    await enregistrerInfosGerant(e, saisie)
    return {}
  })
}

/** Le logo ou l'image de couverture : `fichier` la remplace, `retirer=1` la retire. */
export async function imageGerantAction(d: FormData): Promise<Reponse<{ image: string | null }>> {
  return gerant(d.get('jeton'), async (e) => {
    const quoi = d.get('quoi') === 'logo' ? 'logo' : 'couverture'
    const f = d.get('fichier')
    if (f instanceof File && f.size > 0) {
      const chemin = await televerserFichierService(f, e, quoi)
      await A.definirImage(e, quoi, chemin)
      return { image: urlFichier(chemin) }
    }
    if (d.get('retirer') === '1') {
      await A.definirImage(e, quoi, null)
      return { image: null }
    }
    throw new Error('Choisissez une image.')
  })
}
