import { z } from 'zod'
import type { Client } from '@/lib/requetes/ventes'

export const SaisieCarte = z.object({
  libelle: z.string().trim().min(1, 'Donnez un nom à la carte (ex. « Comptoir caisse »).').max(120),
  client_id: z.string().uuid().optional().or(z.literal('')),
  destination: z
    .string()
    .trim()
    .url('La destination doit être une adresse web complète (https://…).')
    .refine((u) => /^https?:\/\//i.test(u), 'La destination doit commencer par https://'),
  note: z.string().trim().max(500).optional(),
})

export default function ChampsCarte({
  clients,
  valeurs,
}: {
  clients: Client[]
  valeurs?: { libelle: string; client_id: string | null; destination: string; note: string | null }
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
          <label className="etiquette" htmlFor="client_id">
            Client
          </label>
          <select id="client_id" name="client_id" className="champ" defaultValue={valeurs?.client_id ?? ''}>
            <option value="">— aucun pour l’instant —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
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
          <code>https://g.page/r/…/review</code>. Ça peut aussi être un menu, un Instagram, n’importe quelle page.
        </p>
      </div>
      <div>
        <label className="etiquette" htmlFor="note">
          Note interne (facultatif)
        </label>
        <input id="note" name="note" className="champ" maxLength={500} defaultValue={valeurs?.note ?? ''} placeholder="Posée le 17 octobre, présentoir acrylique" />
      </div>
    </>
  )
}
