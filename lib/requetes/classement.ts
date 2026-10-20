import 'server-only'
import { requete } from '@/lib/db'

/**
 * Le détail carte par carte d'un dossier, pour les clients à plusieurs cartes
 * (un hôtel : une carte par chambre, une au bar, une à la réception…).
 * Mêmes bornes que les totaux de la page client : les N derniers jours,
 * comparés aux N jours d'avant.
 */
const FUSEAU = 'America/Toronto'

export type LigneClassement = {
  id: string
  libelle: string
  groupe: string | null
  courant: number
  precedent: number
  total: number
  dernier_tap: string | null
  jours_silence: number | null
}

/** Chaque carte active, de la plus tapée à la moins tapée sur la période. */
export async function classement(dossierId: string, jours: number): Promise<LigneClassement[]> {
  const lignes = await requete<LigneClassement>(
    `select c.id, c.libelle, c.groupe,
            count(t.id) filter (where t.tape_le >= now() - make_interval(days => $2::int))::int as courant,
            count(t.id) filter (where t.tape_le <  now() - make_interval(days => $2::int)
                                  and t.tape_le >= now() - make_interval(days => 2 * $2::int))::int as precedent,
            count(t.id)::int as total,
            max(t.tape_le) as dernier_tap,
            case when max(t.tape_le) is null then null
                 else ((now() at time zone $3)::date - (max(t.tape_le) at time zone $3)::date)::int end as jours_silence
       from cartes_nfc c left join taps t on t.carte_id = c.id
      where c.dossier_id = $1::uuid and c.actif
      group by c.id`,
    [dossierId, jours, FUSEAU],
  )
  // À égalité, l'ordre des noms comme un humain le lit : « Carte 9 » avant « Carte 10 ».
  return lignes.sort((a, b) => b.courant - a.courant || b.total - a.total || a.libelle.localeCompare(b.libelle, 'fr', { numeric: true }))
}

export type LigneGroupe = {
  nom: string | null
  cartes: number
  courant: number
  precedent: number
  part: number
}

/** Les mêmes chiffres, regroupés (« Chambres », « Bar »…) ; les cartes sans groupe à la fin. */
export function parGroupe(lignes: LigneClassement[]): LigneGroupe[] {
  const total = lignes.reduce((s, l) => s + l.courant, 0)
  const groupes = new Map<string | null, LigneGroupe>()
  for (const l of lignes) {
    const g = groupes.get(l.groupe) ?? {
      nom: l.groupe,
      cartes: 0,
      courant: 0,
      precedent: 0,
      part: 0,
    }
    g.cartes += 1
    g.courant += l.courant
    g.precedent += l.precedent
    groupes.set(l.groupe, g)
  }
  return [...groupes.values()]
    .map((g) => ({
      ...g,
      part: total ? Math.round((g.courant / total) * 100) : 0,
    }))
    .sort((a, b) => (a.nom === null ? 1 : b.nom === null ? -1 : b.courant - a.courant || a.nom.localeCompare(b.nom, 'fr')))
}

export type CarteGroupe = {
  id: string
  libelle: string
  groupe: string | null
  actif: boolean
}

export async function groupesDuDossier(dossierId: string): Promise<CarteGroupe[]> {
  return requete<CarteGroupe>(
    `select id, libelle, groupe, actif from cartes_nfc where dossier_id = $1::uuid
      order by actif desc, groupe nulls last, lower(libelle)`,
    [dossierId],
  )
}

/** Range les cartes du dossier dans leurs groupes ; une carte d'un autre dossier est ignorée. */
export async function changerGroupes(dossierId: string, choix: { id: string; groupe: string | null }[]): Promise<void> {
  if (!choix.length) return
  await requete(
    `update cartes_nfc c set groupe = v.groupe
       from unnest($2::uuid[], $3::text[]) as v(id, groupe)
      where c.id = v.id and c.dossier_id = $1::uuid and c.groupe is distinct from v.groupe`,
    [dossierId, choix.map((c) => c.id), choix.map((c) => c.groupe)],
  )
}

export type LigneExport = {
  jour: string
  libelle: string
  groupe: string | null
  taps: number
  nfc: number
  qr: number
}

/** Une ligne par carte et par jour où elle a servi, pour le tableur du client. */
export async function exportJournalier(dossierId: string, jours: number): Promise<LigneExport[]> {
  return requete<LigneExport>(
    `select to_char((t.tape_le at time zone $3)::date, 'YYYY-MM-DD') as jour, c.libelle, c.groupe,
            count(*)::int as taps,
            count(*) filter (where t.canal = 'nfc')::int as nfc,
            count(*) filter (where t.canal = 'qr')::int as qr
       from taps t join cartes_nfc c on c.id = t.carte_id
      where c.dossier_id = $1::uuid and t.tape_le >= now() - make_interval(days => $2::int)
      group by 1, c.id
      order by 1 desc, lower(c.libelle)`,
    [dossierId, jours, FUSEAU],
  )
}
