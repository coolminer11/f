import { z } from 'zod'
import ChoixFiche from '@/components/choix-fiche'

const PLACE_ID = /^[A-Za-z0-9_-]{10,255}$/

/**
 * Destination : https seulement. Le Worker de Cloudflare refuse de rediriger
 * vers autre chose — accepter http ici créerait une carte qui affiche
 * « pas encore activée » sans que personne ne comprenne pourquoi.
 */
export const Destination = z
  .string()
  .trim()
  .max(2000)
  .url('La destination doit être une adresse web complète (https://…).')
  .refine((u) => /^https:\/\//i.test(u), 'La destination doit commencer par https://')

export const SaisieCarte = z.object({
  libelle: z.string().trim().min(1, 'Donnez un nom à la carte (ex. « Comptoir caisse »).').max(120),
  dossier_id: z.string().uuid().optional().or(z.literal('')),
  destination: Destination,
  place_id: z.string().regex(PLACE_ID, 'Identifiant de fiche Google invalide.').optional().or(z.literal('')),
  fiche_nom: z.string().max(200).optional(),
  fiche_adresse: z.string().max(300).optional(),
  note: z.string().trim().max(500).optional(),
})

export default function ChampsCarte({
  dossiers,
  valeurs,
  googleConfigure,
}: {
  dossiers: { id: string; nom: string }[]
  valeurs?: {
    libelle: string
    dossier_id: string | null
    destination: string
    note: string | null
    place_id: string | null
    fiche_nom: string | null
  }
  googleConfigure: boolean
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="etiquette" htmlFor="libelle">
            Nom de la carte
          </label>
          <input
            id="libelle"
            name="libelle"
            className="champ"
            required
            maxLength={120}
            defaultValue={valeurs?.libelle}
            placeholder="Comptoir caisse"
          />
        </div>
        <div>
          <label className="etiquette" htmlFor="dossier_id">
            Dossier (commerce)
          </label>
          <select id="dossier_id" name="dossier_id" className="champ" defaultValue={valeurs?.dossier_id ?? ''}>
            <option value="">— aucun —</option>
            {dossiers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="etiquette" htmlFor="destination">
          Destination
        </label>
        <input
          id="destination"
          name="destination"
          type="url"
          className="champ"
          required
          defaultValue={valeurs?.destination}
          placeholder="https://g.page/r/…/review"
        />
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-encre-doux)]">
          Pour des avis Google : dans la fiche Google du commerce (Google Business Profile),{' '}
          <strong>Demander des avis</strong> → copier le lien. Il ressemble à{' '}
          <code>https://g.page/r/…/review</code>. Ça peut aussi être un menu, un Instagram, n’importe quelle page en https.
        </p>
      </div>
      <ChoixFiche
        configure={googleConfigure}
        initiale={valeurs?.place_id ? { place_id: valeurs.place_id, nom: valeurs.fiche_nom } : null}
      />
      <div>
        <label className="etiquette" htmlFor="note">
          Note interne (facultatif)
        </label>
        <input id="note" name="note" className="champ" maxLength={500} defaultValue={valeurs?.note ?? ''} placeholder="Posée le 17 octobre, présentoir acrylique" />
      </div>
    </>
  )
}
