'use server'

import { etablissementDuJeton } from '@/lib/services/acces'
import { lireEtablissement } from '@/lib/services/donnees'
import { prendreDemande, rouvrirDemande, terminerDemande } from '@/lib/services/demandes'
import {
  basculerAnnonce,
  changerAccueil,
  changerDisponibilite,
  enregistrerPlatDuJour,
  marquerRetourLu,
  marquerTousLus,
  nettoyerTexte,
  toutDisponible,
} from '@/lib/services/portail'

/**
 * Les gestes du personnel. Une action serveur s'appelle sans la page : le
 * jeton (et le mot de passe, par son témoin) est revérifié à CHAQUE appel.
 */
const id = (jeton: unknown) => (typeof jeton === 'string' ? etablissementDuJeton(jeton.slice(0, 80)) : Promise.resolve(null))
const nom = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 60) || null : null)

export async function prendreAction(jeton: string, demandeId: string, par: string | null): Promise<boolean> {
  const e = await id(jeton)
  return e ? prendreDemande(e, String(demandeId), nom(par)) : false
}

export async function terminerAction(jeton: string, demandeId: string, par: string | null): Promise<boolean> {
  const e = await id(jeton)
  return e ? terminerDemande(e, String(demandeId), nom(par)) : false
}

export async function rouvrirAction(jeton: string, demandeId: string): Promise<boolean> {
  const e = await id(jeton)
  return e ? rouvrirDemande(e, String(demandeId)) : false
}

export async function platDuJourAction(
  jeton: string,
  saisie: { id: string | null; titre: Record<string, string>; texte: Record<string, string>; prix: string; fin: string; actif: boolean },
): Promise<{ ok: boolean; id: string | null }> {
  const e = await id(jeton)
  if (!e) return { ok: false, id: null }
  const etab = await lireEtablissement(e)
  if (!etab) return { ok: false, id: null }
  const titre = nettoyerTexte(saisie.titre, etab.langues, 120)
  if (!Object.keys(titre).length) return { ok: false, id: null }
  const prixBrut = String(saisie.prix ?? '').replace(/\s|\$/g, '').replace(',', '.')
  const prix = prixBrut ? Number(prixBrut) : null
  const r = await enregistrerPlatDuJour(e, etab.options.fuseau, {
    id: typeof saisie.id === 'string' ? saisie.id : null,
    titre,
    texte: nettoyerTexte(saisie.texte, etab.langues, 500),
    prix: prix !== null && Number.isFinite(prix) ? prix : null,
    fin: typeof saisie.fin === 'string' ? saisie.fin : null,
    actif: Boolean(saisie.actif),
  })
  return { ok: Boolean(r), id: r }
}

export async function annonceAction(jeton: string, annonceId: string, actif: boolean): Promise<boolean> {
  const e = await id(jeton)
  return e ? basculerAnnonce(e, String(annonceId), Boolean(actif)) : false
}

export async function disponibiliteAction(jeton: string, platId: string, disponible: boolean): Promise<boolean> {
  const e = await id(jeton)
  return e ? changerDisponibilite(e, String(platId), Boolean(disponible)) : false
}

export async function toutDisponibleAction(jeton: string): Promise<number | null> {
  const e = await id(jeton)
  return e ? toutDisponible(e) : null
}

export async function accueilAction(jeton: string, accueil: Record<string, string>): Promise<boolean> {
  const e = await id(jeton)
  if (!e) return false
  const etab = await lireEtablissement(e)
  if (!etab) return false
  await changerAccueil(e, nettoyerTexte(accueil, etab.langues, 400))
  return true
}

export async function retourLuAction(jeton: string, retourId: string, lu: boolean): Promise<boolean> {
  const e = await id(jeton)
  return e ? marquerRetourLu(e, String(retourId), Boolean(lu)) : false
}

export async function tousLusAction(jeton: string): Promise<number | null> {
  const e = await id(jeton)
  return e ? marquerTousLus(e) : null
}
