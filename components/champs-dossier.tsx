import { z } from 'zod'
import type { Client } from '@/lib/requetes/ventes'

export const SaisieDossier = z.object({
  nom: z.string().trim().min(1, 'Donnez un nom au dossier (le nom du commerce).').max(120),
  client_id: z.string().uuid().optional().or(z.literal('')),
  courriel_rapport: z
    .string()
    .trim()
    .max(254)
    .regex(/^[^@\s<>]+@[^@\s<>]+\.[a-z]{2,}$/i, 'Courriel invalide.')
    .optional()
    .or(z.literal('')),
  rapport_mensuel: z.literal('on').optional(),
  note: z.string().trim().max(500).optional(),
})

export function valeursDossier(v: z.infer<typeof SaisieDossier>) {
  return {
    nom: v.nom,
    clientId: v.client_id || null,
    courrielRapport: v.courriel_rapport || null,
    rapportMensuel: v.rapport_mensuel === 'on',
    note: v.note || null,
  }
}

export default function ChampsDossier({
  clients,
  valeurs,
  complet = true,
}: {
  clients: Client[]
  valeurs?: { nom: string; client_id: string | null; courriel_rapport: string | null; rapport_mensuel: boolean; note: string | null }
  /** Faux : seulement le nom et le client (création rapide). */
  complet?: boolean
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="etiquette" htmlFor="nom">Nom du commerce</label>
          <input id="nom" name="nom" className="champ" required maxLength={120} defaultValue={valeurs?.nom} placeholder="Café Olimpico" />
        </div>
        <div>
          <label className="etiquette" htmlFor="client_id">Client de facturation (facultatif)</label>
          <select id="client_id" name="client_id" className="champ" defaultValue={valeurs?.client_id ?? ''}>
            <option value="">— aucun —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>
      </div>
      {complet && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="etiquette" htmlFor="courriel_rapport">Courriel pour le rapport mensuel</label>
              <input
                id="courriel_rapport"
                name="courriel_rapport"
                type="email"
                className="champ"
                maxLength={254}
                defaultValue={valeurs?.courriel_rapport ?? ''}
                placeholder="Vide = courriel du client de facturation"
              />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" name="rapport_mensuel" defaultChecked={valeurs?.rapport_mensuel} className="size-4 accent-[var(--color-accent)]" />
              Envoyer le rapport mensuel le 1er de chaque mois
            </label>
          </div>
          <div>
            <label className="etiquette" htmlFor="note">Note interne (facultatif)</label>
            <input id="note" name="note" className="champ" maxLength={500} defaultValue={valeurs?.note ?? ''} />
          </div>
        </>
      )}
    </>
  )
}
