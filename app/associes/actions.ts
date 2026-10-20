'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { exigerEcriture } from '@/lib/auth'
import { associeDuCompte, enregistrerRole, enregistrerSemaine, estMesure, type SaisieRole } from '@/lib/equipe'
import { approuver, ebauche, enregistrerTexte, joindrePdf, lireConvention } from '@/lib/convention'
import { televerserRecu } from '@/lib/stockage'

const ROLES = '/associes/roles'
const CONVENTION = '/associes/convention'
const avec = (chemin: string, cle: 'message' | 'erreur', texte: string, ancre = '') =>
  `${chemin}${chemin.includes('?') ? '&' : '?'}${cle}=${encodeURIComponent(texte)}${ancre}`

// ---------------------------------------------------------------------------
// Qui fait quoi
// ---------------------------------------------------------------------------
const Role = z.object({
  associe_id: z.string().uuid(),
  titre: z.string().trim().min(1, 'Donnez un titre au rôle.').max(80),
  mission: z.string().trim().max(400).optional(),
  responsabilites: z.string().max(4000).optional(),
})

/** Le rôle d'un associé : titre, mission, responsabilités (une par ligne) et objectifs. */
export async function enregistrerRoleAction(donnees: FormData): Promise<void> {
  const moi = await exigerEcriture()
  const a = Role.safeParse(Object.fromEntries(donnees))
  if (!a.success) redirect(avec(ROLES, 'erreur', a.error.issues[0].message))
  const v = a.data

  // « Libellé — détail » (tiret long, court ou deux-points), une par ligne.
  const responsabilites = (v.responsabilites ?? '')
    .split('\n')
    .map((l) => l.trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean)
    .slice(0, 15)
    .map((l) => {
      const [libelle, ...reste] = l.split(/\s+[—–-]\s+|\s*:\s+/)
      return { libelle: libelle.slice(0, 80), detail: reste.join(' — ').slice(0, 240) || null }
    })

  const objectifs: SaisieRole['objectifs'] = []
  const n = Math.min(20, Number(donnees.get('obj_n')) || 0)
  for (let i = 0; i < n; i++) {
    const libelle = String(donnees.get(`obj_${i}_libelle`) ?? '').trim().slice(0, 80)
    if (!libelle || donnees.get(`obj_${i}_supprimer`) === 'on') continue
    const cible = Math.round(Number(donnees.get(`obj_${i}_cible`)))
    if (!Number.isFinite(cible) || cible < 1 || cible > 1000) redirect(avec(ROLES, 'erreur', `« ${libelle} » : la cible va de 1 à 1000.`))
    const mesure = String(donnees.get(`obj_${i}_mesure`) ?? 'manuel')
    objectifs.push({
      id: String(donnees.get(`obj_${i}_id`) ?? '') || null,
      libelle,
      cible,
      mesure: estMesure(mesure) ? mesure : 'manuel',
    })
  }

  await enregistrerRole(v.associe_id, { titre: v.titre, mission: v.mission || null, responsabilites, objectifs }, moi.id)
  revalidatePath(ROLES)
  redirect(avec(ROLES, 'message', 'Rôle enregistré.'))
}

/** Les chiffres de MA semaine : seulement pour l'associé lié au compte connecté. */
export async function enregistrerSemaineAction(donnees: FormData): Promise<void> {
  const moi = await exigerEcriture()
  const semaine = String(donnees.get('semaine') ?? '')
  const retour = `${ROLES}?semaine=${encodeURIComponent(semaine)}`
  const associeId = await associeDuCompte(moi.id)
  if (!associeId) redirect(avec(retour, 'erreur', 'Votre compte n’est lié à aucun associé.'))

  const valeurs: { objectifId: string; valeur: number | null }[] = []
  for (const [cle, brut] of donnees.entries()) {
    const m = cle.match(/^val_([0-9a-f-]{36})$/i)
    if (!m) continue
    const texte = String(brut).trim()
    const valeur = texte === '' ? null : Math.round(Number(texte))
    if (valeur !== null && (!Number.isFinite(valeur) || valeur < 0 || valeur > 100000)) {
      redirect(avec(retour, 'erreur', 'Un chiffre entre 0 et 100 000, s’il vous plaît.'))
    }
    valeurs.push({ objectifId: m[1], valeur })
  }
  try {
    await enregistrerSemaine(associeId, semaine, valeurs, moi.id)
  } catch (e) {
    redirect(avec(retour, 'erreur', e instanceof Error ? e.message : 'Enregistrement impossible.'))
  }
  revalidatePath(ROLES)
  redirect(avec(retour, 'message', 'Semaine enregistrée.'))
}

// ---------------------------------------------------------------------------
// Convention d'associés
// ---------------------------------------------------------------------------
export async function creerEbaucheAction(): Promise<void> {
  const moi = await exigerEcriture()
  if (await lireConvention()) redirect(CONVENTION)
  await enregistrerTexte(await ebauche(), moi.id)
  revalidatePath(CONVENTION)
  redirect(avec(CONVENTION, 'message', 'Ébauche créée. Discutez les chiffres entre crochets, puis approuvez chacun de votre côté.'))
}

export async function enregistrerTexteAction(donnees: FormData): Promise<void> {
  const moi = await exigerEcriture()
  const texte = String(donnees.get('texte') ?? '')
  if (texte.trim().length < 20 || texte.length > 60000) redirect(avec(CONVENTION, 'erreur', 'Le texte est vide ou trop long.'))
  const avant = await lireConvention()
  const version = await enregistrerTexte(texte, moi.id)
  revalidatePath(CONVENTION)
  redirect(
    avec(
      CONVENTION,
      'message',
      avant && avant.v.version === version ? 'Aucun changement.' : `Version ${version} enregistrée. Les approbations repartent à zéro.`,
    ),
  )
}

export async function approuverAction(donnees: FormData): Promise<void> {
  const moi = await exigerEcriture()
  const associeId = await associeDuCompte(moi.id)
  if (!associeId) redirect(avec(CONVENTION, 'erreur', 'Votre compte n’est lié à aucun associé.'))
  const ok = await approuver(String(donnees.get('id') ?? ''), associeId, donnees.get('oui') === '1')
  if (!ok) redirect(avec(CONVENTION, 'erreur', 'Seule la version la plus récente peut être approuvée.'))
  revalidatePath(CONVENTION)
  redirect(CONVENTION)
}

/** Le PDF signé de la version courante (bucket privé, comme les reçus). */
export async function joindrePdfAction(donnees: FormData): Promise<void> {
  await exigerEcriture()
  const c = await lireConvention()
  if (!c || c.v.id !== String(donnees.get('id'))) redirect(avec(CONVENTION, 'erreur', 'Version introuvable.'))
  if (donnees.get('retirer') === '1') {
    await joindrePdf(c.v.id, null)
    revalidatePath(CONVENTION)
    redirect(CONVENTION)
  }
  if (!c.approbations.length || c.approbations.some((a) => !a.approuve_le)) {
    redirect(avec(CONVENTION, 'erreur', 'Les deux associés doivent d’abord approuver cette version.'))
  }
  const f = donnees.get('pdf')
  if (!(f instanceof File) || f.size === 0) redirect(avec(CONVENTION, 'erreur', 'Choisissez le PDF signé.'))
  if (f.type !== 'application/pdf' || !f.name.toLowerCase().endsWith('.pdf')) redirect(avec(CONVENTION, 'erreur', 'Un fichier PDF, s’il vous plaît.'))
  if (f.size > 10 * 1024 * 1024) redirect(avec(CONVENTION, 'erreur', 'PDF trop volumineux (10 Mo maximum).'))
  let chemin: string
  try {
    chemin = await televerserRecu(f)
  } catch (e) {
    redirect(avec(CONVENTION, 'erreur', e instanceof Error ? e.message : 'Téléversement impossible.'))
  }
  await joindrePdf(c.v.id, chemin)
  revalidatePath(CONVENTION)
  redirect(avec(CONVENTION, 'message', 'Convention signée jointe.'))
}
