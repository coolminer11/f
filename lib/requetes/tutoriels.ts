import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { requete, requeteUne } from '@/lib/db'
import { stockageDistant } from '@/lib/stockage'

const SEAU = 'tutoriels'
const DUREE_LECTURE = 60 * 60 * 3 // trois heures : le temps d'une séance

export type Tutoriel = {
  id: string
  titre: string
  description: string | null
  lien: string | null
  chemin: string | null
  taille: number | null
  ordre: number
  cree_le: string
  cree_par: string | null
}

export type TutorielAffiche = Tutoriel & {
  /** Adresse de lecture : intégration pour un lien connu, URL signée pour un fichier. */
  integration: string | null
  fichier: string | null
}

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/**
 * Transforme l'adresse d'une vidéo en adresse d'intégration.
 *
 * Coller l'adresse de la barre du navigateur est le geste naturel ; c'est
 * rarement celle qui s'intègre. Faire la conversion ici évite d'expliquer la
 * différence à quelqu'un qui veut juste montrer une vidéo.
 */
export function adresseIntegration(lien: string): string | null {
  try {
    const u = new URL(lien)
    const hote = u.hostname.replace(/^www\./, '')

    if (hote === 'youtu.be') return `https://www.youtube.com/embed${u.pathname}`
    if (hote.endsWith('youtube.com')) {
      if (u.pathname === '/watch' && u.searchParams.get('v')) {
        return `https://www.youtube.com/embed/${u.searchParams.get('v')}`
      }
      if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/')) {
        return `https://www.youtube.com/embed/${u.pathname.split('/')[2]}`
      }
    }
    if (hote.endsWith('loom.com') && u.pathname.startsWith('/share/')) {
      return `https://www.loom.com/embed/${u.pathname.split('/')[2]}`
    }
    if (hote.endsWith('vimeo.com') && /^\/\d+/.test(u.pathname)) {
      return `https://player.vimeo.com/video/${u.pathname.slice(1).split('/')[0]}`
    }
    if (hote === 'drive.google.com') {
      const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1]
      if (id) return `https://drive.google.com/file/d/${id}/preview`
    }
    return null
  } catch {
    return null
  }
}

export async function listerTutoriels(): Promise<TutorielAffiche[]> {
  const lignes = await requete<Tutoriel>(
    'select * from tutoriels order by ordre, cree_le',
  )
  const distant = stockageDistant()
  const supabase = distant ? client() : null

  return Promise.all(
    lignes.map(async (t) => {
      let fichier: string | null = null
      if (t.chemin && supabase) {
        const { data } = await supabase.storage.from(SEAU).createSignedUrl(t.chemin, DUREE_LECTURE)
        fichier = data?.signedUrl ?? null
      }
      return {
        ...t,
        integration: t.lien ? adresseIntegration(t.lien) : null,
        fichier,
      }
    }),
  )
}

/** Adresse de dépôt signée : le navigateur téléverse chez Supabase, pas chez nous. */
export async function urlDeTeleversement(
  nomFichier: string,
): Promise<{ url: string; chemin: string; jeton: string }> {
  if (!stockageDistant()) {
    throw new Error(
      'L’entreposage n’est pas configuré : ajoutez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY, ou collez plutôt un lien.',
    )
  }
  const extension = (nomFichier.split('.').pop() ?? 'mp4').toLowerCase().slice(0, 5)
  const chemin = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`
  const { data, error } = await client().storage.from(SEAU).createSignedUploadUrl(chemin)
  if (error || !data) throw new Error(error?.message ?? 'Adresse de dépôt refusée.')
  return { url: data.signedUrl, chemin, jeton: data.token }
}

export async function ajouterTutoriel(entree: {
  titre: string
  description: string | null
  lien: string | null
  chemin: string | null
  taille: number | null
  par: string | null
}): Promise<void> {
  await requete(
    `insert into tutoriels (titre, description, lien, chemin, taille, ordre, cree_par)
     values ($1, $2, $3, $4, $5,
             coalesce((select max(ordre) + 1 from tutoriels), 0), $6)`,
    [
      entree.titre,
      entree.description,
      entree.lien,
      entree.chemin,
      entree.taille,
      entree.par,
    ],
  )
}

export async function supprimerTutoriel(id: string): Promise<void> {
  const ligne = await requeteUne<{ chemin: string | null }>(
    'select chemin from tutoriels where id = $1::uuid',
    [id],
  )
  // Le fichier part avec la fiche : une vidéo orpheline dans le seau
  // continuerait de consommer le gigaoctet gratuit sans que rien ne l'affiche.
  if (ligne?.chemin && stockageDistant()) {
    await client().storage.from(SEAU).remove([ligne.chemin])
  }
  await requete('delete from tutoriels where id = $1::uuid', [id])
}

export async function deplacerTutoriel(id: string, sens: -1 | 1): Promise<void> {
  await requete(
    `with moi as (select id, ordre from tutoriels where id = $1::uuid),
          voisin as (
            select t.id, t.ordre from tutoriels t, moi
             where ($2 = -1 and t.ordre < moi.ordre) or ($2 = 1 and t.ordre > moi.ordre)
             order by case when $2 = -1 then -t.ordre else t.ordre end
             limit 1)
     update tutoriels t
        set ordre = case when t.id = (select id from moi) then (select ordre from voisin)
                         else (select ordre from moi) end
      where t.id in ((select id from moi), (select id from voisin))
        and exists (select 1 from voisin)`,
    [id, sens],
  )
}
