import 'server-only'
import { requete, requeteUne } from '@/lib/db'
import type { Contexte } from '@/lib/securite'
import { texte } from '@/lib/services/langues'
import { parCode } from '@/lib/services/donnees'
import { notifierPersonnel } from '@/lib/services/notifications'
import { noterEvenement } from '@/lib/services/evenements'
import { jetonPortail } from '@/lib/services/acces'
import type { Demande, StatutDemande } from '@/lib/services/types'

/**
 * Les demandes des clients (appeler le serveur, l'addition, des serviettes…).
 *
 * Contre les abus : la même demande au même emplacement, encore en attente,
 * n'est pas recréée (on rend la première) ; 30 demandes par heure et par
 * adresse, 400 par heure pour l'établissement.
 */
export type ResultatDemande = { etat: 'ok'; id: string; avis: boolean; deja: boolean } | { etat: 'trop' } | { etat: 'invalide' }

export async function creerDemande(code: string, cle: string, note: string | null, langue: string, ctx: Contexte): Promise<ResultatDemande> {
  const lieu = await parCode(code)
  if (!lieu || !lieu.etab.options.appel) return { etat: 'invalide' }
  const { etab, emplacement } = lieu
  const type = await requeteUne<{ id: string; libelle: Record<string, string>; icone: string | null; avec_note: boolean; avis_apres: boolean }>(
    `select id, libelle, icone, avec_note, avis_apres from types_demandes where etablissement_id = $1::uuid and cle = $2 and actif`,
    [etab.id, cle],
  )
  if (!type) return { etat: 'invalide' }

  const deja = await requeteUne<{ id: string }>(
    `select id from demandes_service where emplacement_id = $1::uuid and cle = $2 and statut in ('nouvelle', 'prise') and cree_le > now() - interval '10 minutes'
      order by cree_le desc limit 1`,
    [emplacement.id, cle],
  )
  if (deja) return { etat: 'ok', id: deja.id, avis: type.avis_apres && etab.options.avis, deja: true }

  const libelle = texte(type.libelle, etab.langue_defaut, etab.langue_defaut) || cle
  const ligne = await requeteUne<{ id: string }>(
    `insert into demandes_service (etablissement_id, emplacement_id, type_id, cle, libelle, note, langue, empreinte)
     select $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8
      where (select count(*) from demandes_service where empreinte is not distinct from $8 and $8 is not null and cree_le > now() - interval '1 hour') < 30
        and (select count(*) from demandes_service where etablissement_id = $1::uuid and cree_le > now() - interval '1 hour') < 400
     returning id`,
    [etab.id, emplacement.id, type.id, cle, libelle.slice(0, 120), type.avec_note ? note?.trim().slice(0, 500) || null : null, langue.slice(0, 5), ctx.ipEmpreinte],
  )
  if (!ligne) return { etat: 'trop' }

  void noterEvenement(etab.id, emplacement.id, 'demandes', cle, langue)
  void notifierPersonnel(etab.id, emplacement.groupe, {
    titre: `${type.icone ?? '🔔'} ${emplacement.libelle} — ${libelle}`,
    corps: note?.trim() ? note.trim().slice(0, 140) : etab.type === 'hotel' ? 'Nouvelle demande d’un client.' : 'Un client vous attend.',
    url: `/service/${jetonPortail(etab.id, etab.version_lien)}`,
    etiquette: `demande-${ligne.id}`,
  }).catch(() => 0)
  return { etat: 'ok', id: ligne.id, avis: type.avis_apres && etab.options.avis, deja: false }
}

/** Où en est la demande, pour l'écran du client (seulement s'il est à l'emplacement de la demande). */
export async function etatPourClient(code: string, id: string): Promise<{ statut: StatutDemande; prise_par: string | null; cree_le: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  return requeteUne(
    `select d.statut, d.prise_par, d.cree_le from demandes_service d join emplacements e on e.id = d.emplacement_id
      where d.id = $1::uuid and e.code = $2`,
    [id, code.toUpperCase()],
  )
}

export async function annulerParClient(code: string, id: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false
  const l = await requeteUne<{ id: string }>(
    `update demandes_service d set statut = 'annulee' from emplacements e
      where d.id = $1::uuid and e.id = d.emplacement_id and e.code = $2 and d.statut = 'nouvelle' returning d.id`,
    [id, code.toUpperCase()],
  )
  return Boolean(l)
}

const SELECT = `select d.id, d.emplacement_id, e.libelle as emplacement, e.groupe, d.cle, d.libelle, t.icone, d.note, d.langue, d.statut, d.prise_par,
                       d.cree_le, d.prise_le, d.faite_le
                  from demandes_service d left join emplacements e on e.id = d.emplacement_id left join types_demandes t on t.id = d.type_id`

/** La file du personnel : tout ce qui attend, puis ce qui a été fait aujourd'hui. */
export async function fileDuPersonnel(etabId: string): Promise<{ ouvertes: Demande[]; faites: Demande[] }> {
  const [ouvertes, faites] = await Promise.all([
    requete<Demande>(`${SELECT} where d.etablissement_id = $1::uuid and d.statut in ('nouvelle', 'prise') order by d.cree_le`, [etabId]),
    requete<Demande>(
      `${SELECT} where d.etablissement_id = $1::uuid and d.statut in ('faite', 'annulee') and d.cree_le > now() - interval '18 hours' order by coalesce(d.faite_le, d.cree_le) desc limit 30`,
      [etabId],
    ),
  ])
  return { ouvertes, faites }
}

export async function prendreDemande(etabId: string, id: string, par: string | null): Promise<boolean> {
  const l = await requeteUne<{ id: string }>(
    `update demandes_service set statut = 'prise', prise_le = coalesce(prise_le, now()), prise_par = coalesce($3, prise_par)
      where id = $2::uuid and etablissement_id = $1::uuid and statut in ('nouvelle', 'prise') returning id`,
    [etabId, id, par?.trim().slice(0, 60) || null],
  )
  return Boolean(l)
}

export async function terminerDemande(etabId: string, id: string, par: string | null): Promise<boolean> {
  const l = await requeteUne<{ id: string }>(
    `update demandes_service set statut = 'faite', prise_le = coalesce(prise_le, now()), faite_le = now(), prise_par = coalesce(prise_par, $3)
      where id = $2::uuid and etablissement_id = $1::uuid and statut in ('nouvelle', 'prise') returning id`,
    [etabId, id, par?.trim().slice(0, 60) || null],
  )
  return Boolean(l)
}

export async function rouvrirDemande(etabId: string, id: string): Promise<boolean> {
  const l = await requeteUne<{ id: string }>(
    `update demandes_service set statut = 'nouvelle', prise_le = null, faite_le = null, prise_par = null
      where id = $2::uuid and etablissement_id = $1::uuid and statut in ('faite', 'annulee') and cree_le > now() - interval '18 hours' returning id`,
    [etabId, id],
  )
  return Boolean(l)
}

// ---------------------------------------------------------------------------
// Retours (la note donnée juste après une demande, ou depuis l'accueil)
// ---------------------------------------------------------------------------

export async function enregistrerRetour(
  code: string,
  e: { demandeId: string | null; note: number; commentaire: string | null; langue: string },
  ctx: Contexte,
): Promise<{ id: string; avisUrl: string | null } | null> {
  const lieu = await parCode(code)
  if (!lieu || !Number.isInteger(e.note) || e.note < 1 || e.note > 5) return null
  const ligne = await requeteUne<{ id: string }>(
    `insert into retours_service (etablissement_id, emplacement_id, demande_id, note, commentaire, langue, empreinte)
     select $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7
      where (select count(*) from retours_service where empreinte is not distinct from $7 and $7 is not null and cree_le > now() - interval '1 hour') < 10
     returning id`,
    [
      lieu.etab.id,
      lieu.emplacement.id,
      e.demandeId && /^[0-9a-f-]{36}$/i.test(e.demandeId) ? e.demandeId : null,
      e.note,
      e.commentaire?.trim().slice(0, 1000) || null,
      e.langue.slice(0, 5),
      ctx.ipEmpreinte,
    ],
  )
  if (!ligne) return null
  // Une note basse avec un commentaire : le personnel le sait tout de suite, pendant que le client est encore là.
  if (e.note <= 3 && e.commentaire?.trim()) {
    void notifierPersonnel(lieu.etab.id, lieu.emplacement.groupe, {
      titre: `${'★'.repeat(e.note)}${'☆'.repeat(5 - e.note)} ${lieu.emplacement.libelle}`,
      corps: e.commentaire.trim().slice(0, 140),
      url: `/service/${jetonPortail(lieu.etab.id, lieu.etab.version_lien)}`,
      etiquette: `retour-${ligne.id}`,
    }).catch(() => 0)
  }
  // Le lien d'avis Google est offert à TOUS, quelle que soit la note : Google interdit de trier.
  return { id: ligne.id, avisUrl: lieu.etab.avis_url }
}

export async function retourVersGoogle(code: string, retourId: string | null, langue: string): Promise<string | null> {
  const lieu = await parCode(code)
  if (!lieu?.etab.avis_url) return null
  if (retourId && /^[0-9a-f-]{36}$/i.test(retourId)) {
    await requete(`update retours_service set google = true where id = $1::uuid and etablissement_id = $2::uuid`, [retourId, lieu.etab.id])
  }
  void noterEvenement(lieu.etab.id, lieu.emplacement.id, 'avis_google', null, langue)
  return lieu.etab.avis_url
}
