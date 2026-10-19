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
  langue: z.enum(['fr', 'en']).optional(),
  objectif_avis: z
    .string()
    .trim()
    .regex(/^\d{0,7}$/, 'Objectif d’avis : un nombre entier.')
    .refine((v) => v === '' || (Number(v) >= 1 && Number(v) <= 1_000_000), 'Objectif d’avis : entre 1 et 1 000 000.')
    .optional(),
  avis_pose: z
    .string()
    .trim()
    .regex(/^\d{0,7}$/, 'Avis à la pose : un nombre entier.')
    .optional(),
  avis_mois_avant: z
    .string()
    .trim()
    .transform((v) => v.replace(',', '.'))
    .refine((v) => v === '' || (/^\d{1,5}(\.\d{1,2})?$/.test(v) && Number(v) <= 100000), 'Avis par mois avant Tapora : un nombre (ex. 2 ou 1,5).')
    .optional(),
  date_pose: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), 'Date de la pose invalide.')
    .refine((v) => v === '' || (v >= '2020-01-01' && Date.parse(`${v}T00:00:00-05:00`) <= Date.now()), 'La date de la pose ne peut pas être dans le futur.')
    .optional(),
})

export function valeursDossier(v: z.infer<typeof SaisieDossier>) {
  return {
    nom: v.nom,
    clientId: v.client_id || null,
    courrielRapport: v.courriel_rapport || null,
    rapportMensuel: v.rapport_mensuel === 'on',
    note: v.note || null,
    langue: v.langue ?? 'fr',
    objectifAvis: v.objectif_avis ? Number(v.objectif_avis) : null,
    avisPose: v.avis_pose ? Number(v.avis_pose) : null,
    avisMoisAvant: v.avis_mois_avant ? Number(v.avis_mois_avant) : null,
    datePose: v.date_pose || null,
  }
}

export default function ChampsDossier({
  clients,
  valeurs,
  complet = true,
}: {
  clients: Client[]
  valeurs?: {
    nom: string
    client_id: string | null
    courriel_rapport: string | null
    rapport_mensuel: boolean
    note: string | null
    langue: 'fr' | 'en'
    objectif_avis: number | null
    avis_pose: number | null
    avis_mois_avant: number | null
    date_pose: string | null
  }
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="etiquette" htmlFor="langue">Langue de la page client</label>
              <select id="langue" name="langue" className="champ" defaultValue={valeurs?.langue ?? 'fr'}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="etiquette" htmlFor="objectif_avis">Objectif d’avis Google (facultatif)</label>
              <input
                id="objectif_avis"
                name="objectif_avis"
                inputMode="numeric"
                className="champ"
                maxLength={7}
                defaultValue={valeurs?.objectif_avis ?? ''}
                placeholder="Vide = prochain palier (100, 250, 300…)"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="etiquette" htmlFor="date_pose">Date de la pose (facultatif)</label>
              <input id="date_pose" name="date_pose" type="date" className="champ" min="2020-01-01" defaultValue={valeurs?.date_pose ?? ''} />
            </div>
            <div>
              <label className="etiquette" htmlFor="avis_pose">Avis Google le jour de la pose (facultatif)</label>
              <input
                id="avis_pose"
                name="avis_pose"
                inputMode="numeric"
                className="champ"
                maxLength={7}
                defaultValue={valeurs?.avis_pose ?? ''}
                placeholder="Vide = le premier relevé"
              />
            </div>
            <div>
              <label className="etiquette" htmlFor="avis_mois_avant">Avis par mois avant Tapora (facultatif)</label>
              <input
                id="avis_mois_avant"
                name="avis_mois_avant"
                inputMode="decimal"
                className="champ"
                maxLength={9}
                defaultValue={valeurs?.avis_mois_avant ?? ''}
                placeholder="Ex. 2 — pour l’« avant / après »"
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-[var(--color-encre-doux)]">
            Date de la pose : à remplir si la carte était posée avant d’être ajoutée ici (vide = le jour de la première carte).
            Pour le rythme d’avant : sur Google Maps, triez les avis par « Plus récents » et comptez ceux des 3 derniers mois avant la pose, divisé par 3.
          </p>
          <div>
            <label className="etiquette" htmlFor="note">Note interne (facultatif)</label>
            <input id="note" name="note" className="champ" maxLength={500} defaultValue={valeurs?.note ?? ''} />
          </div>
        </>
      )}
    </>
  )
}
