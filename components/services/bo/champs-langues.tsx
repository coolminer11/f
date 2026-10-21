import { LANGUES, nomLangue, sens, type Texte } from '@/lib/services/langues'

/**
 * Un texte dans toutes les langues de l'établissement : un champ par langue,
 * la langue par défaut d'abord. Une traduction absente est soulignée
 * « à traduire », avec le texte d'origine en filigrane pour guider.
 * Les langues retirées de l'établissement gardent leur texte (champs cachés) :
 * les rajouter plus tard ne fait rien perdre.
 */
export default function ChampsLangues({
  nom,
  libelle,
  valeurs,
  langues,
  defaut,
  multiligne = false,
  lignes = 2,
  max = 300,
  requis = false,
  aide,
  exemple,
}: {
  nom: string
  libelle: string
  valeurs?: Texte | null
  langues: string[]
  defaut: string
  multiligne?: boolean
  lignes?: number
  max?: number
  requis?: boolean
  aide?: string
  exemple?: string
}) {
  const v = (valeurs ?? {}) as Record<string, string | undefined>
  const ordre = [defaut, ...langues.filter((l) => l !== defaut)]
  const origine = v[defaut]?.trim() || ''
  const autres = LANGUES.map((l) => l.code as string).filter((l) => !ordre.includes(l) && v[l]?.trim())
  const aTraduire = origine ? ordre.filter((l) => l !== defaut && !v[l]?.trim()).length : 0

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="etiquette !mb-0">{libelle}</span>
        {aTraduire > 0 && (
          <span className="text-[11px] font-semibold text-[var(--color-attention)]">
            {aTraduire} à traduire
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {ordre.map((l) => {
          const manque = l !== defaut && origine && !v[l]?.trim()
          const commun = {
            name: `${nom}_${l}`,
            defaultValue: v[l] ?? '',
            maxLength: max,
            dir: sens(l),
            lang: l,
            required: requis && l === defaut,
            'aria-label': `${libelle} — ${nomLangue(l)}`,
            placeholder: manque ? `À traduire : « ${origine.slice(0, 80)} »` : l === defaut ? exemple : undefined,
            className: `champ ${manque ? '!border-dashed !border-[var(--color-attention)]' : ''}`,
          }
          return (
            <div key={l} className="flex items-start gap-2">
              <span
                title={nomLangue(l)}
                className={`mt-2 w-7 shrink-0 text-center text-[11px] font-bold uppercase tracking-wide ${
                  l === defaut ? 'text-[var(--color-encre)]' : manque ? 'text-[var(--color-attention)]' : 'text-[var(--color-encre-doux)]'
                }`}
              >
                {l}
              </span>
              {multiligne ? <textarea rows={lignes} {...commun} /> : <input {...commun} />}
            </div>
          )
        })}
      </div>
      {autres.map((l) => (
        <input key={l} type="hidden" name={`${nom}_${l}`} value={v[l]} />
      ))}
      {aide && <p className="mt-1 text-xs text-[var(--color-encre-doux)]">{aide}</p>}
    </div>
  )
}

/** Les pastilles « EN · ES à traduire » d'une ligne de liste. */
export function ATraduire({ textes, langues, defaut }: { textes: (Texte | null | undefined)[]; langues: string[]; defaut: string }) {
  const manque = langues.filter(
    (l) => l !== defaut && textes.some((t) => {
      const v = (t ?? {}) as Record<string, string | undefined>
      return v[defaut]?.trim() && !v[l]?.trim()
    }),
  )
  if (!manque.length) return null
  return (
    <span className="inline-flex items-center gap-1" title="Traductions manquantes">
      {manque.map((l) => (
        <span key={l} className="rounded border border-dashed border-[var(--color-attention)] px-1 text-[10px] font-bold uppercase text-[var(--color-attention)]">
          {l}
        </span>
      ))}
    </span>
  )
}
