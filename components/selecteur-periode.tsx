'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function SelecteurPeriode({
  periodes,
  valeur,
}: {
  periodes: { valeur: string; libelle: string }[]
  valeur: string
}) {
  const router = useRouter()
  const parametres = useSearchParams()

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-[var(--color-encre-doux)]">Période</span>
      <select
        className="champ w-auto"
        value={valeur}
        onChange={(e) => {
          const suivants = new URLSearchParams(parametres.toString())
          suivants.set('periode', e.target.value)
          suivants.delete('erreur')
          router.push(`?${suivants}`)
        }}
      >
        {periodes.map((p) => (
          <option key={p.valeur} value={p.valeur}>
            {p.libelle}
          </option>
        ))}
      </select>
    </label>
  )
}
