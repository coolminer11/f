'use client'

import { useState } from 'react'
import { proposerPartageAction } from '@/app/associes/actions'
import BoutonEnvoi from '@/components/bouton-envoi'

type Associe = { id: string; nom: string; part: number }

const centiemes = (texte: string) => {
  const v = texte.trim().replace(',', '.')
  return /^\d{1,3}(\.\d{1,2})?$/.test(v) ? Math.round(Number(v) * 100) : NaN
}
const pct = (c: number) => (c / 100).toLocaleString('fr-CA', { maximumFractionDigits: 2 })

/**
 * Proposer un nouveau partage : une date de début et la part de chacun. Le
 * total se vérifie en direct ; la base revérifie tout (somme, exercice clos,
 * proposition déjà ouverte).
 */
export default function FormulairePartage({ associes, aujourdhui, retourAssocie }: { associes: Associe[]; aujourdhui: string; retourAssocie: string }) {
  const [valeurs, setValeurs] = useState<Record<string, string>>(() =>
    Object.fromEntries(associes.map((a) => [a.id, String(Math.round(a.part * 10000) / 100).replace('.', ',')])),
  )
  const [debut, setDebut] = useState(aujourdhui)
  const total = associes.reduce((s, a) => s + centiemes(valeurs[a.id] ?? ''), 0)
  const valide = Number.isFinite(total) && total === 10000 && associes.every((a) => centiemes(valeurs[a.id] ?? '') > 0)
  const retroactif = debut < aujourdhui

  // Deux associés : changer l'un ajuste l'autre, pour arriver à 100 % sans calcul.
  function changer(id: string, texte: string) {
    const suivant = { ...valeurs, [id]: texte }
    const c = centiemes(texte)
    if (associes.length === 2 && Number.isFinite(c) && c >= 0 && c <= 10000) {
      const autre = associes.find((a) => a.id !== id)!
      suivant[autre.id] = pct(10000 - c).replace(/\s/g, '')
    }
    setValeurs(suivant)
  }

  return (
    <form action={proposerPartageAction} className="space-y-3">
      <input type="hidden" name="retour_associe" value={retourAssocie} />
      <div className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        <div>
          <label className="etiquette" htmlFor="debut-partage">À partir du</label>
          <input id="debut-partage" name="debut" type="date" required className="champ" value={debut} onChange={(e) => setDebut(e.target.value)} />
        </div>
        {associes.map((a) => (
          <div key={a.id}>
            <label className="etiquette" htmlFor={`part-${a.id}`}>{a.nom}</label>
            <div className="relative">
              <input
                id={`part-${a.id}`}
                name={`part_${a.id}`}
                inputMode="decimal"
                required
                className="champ pr-8 text-right tabular-nums"
                value={valeurs[a.id] ?? ''}
                onChange={(e) => changer(a.id, e.target.value)}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-[var(--color-encre-doux)]">%</span>
            </div>
          </div>
        ))}
      </div>
      <div>
        <label className="etiquette" htmlFor="motif-partage">Pourquoi (facultatif, va au registre des décisions)</label>
        <input id="motif-partage" name="motif" maxLength={300} className="champ" placeholder="Ex. révision prévue à la convention, article 5" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`text-sm font-semibold tabular-nums ${valide ? 'text-[var(--color-positif)]' : 'text-[var(--color-negatif)]'}`} aria-live="polite">
          Total : {Number.isFinite(total) ? `${pct(total)} %` : '—'}
          {valide ? ' ✓' : ' — doit faire 100 %'}
        </span>
        <BoutonEnvoi attente="Envoi…" className={valide ? '' : 'pointer-events-none opacity-50'}>
          Proposer ce partage
        </BoutonEnvoi>
      </div>
      {retroactif && (
        <p className="rounded-lg bg-[#fdf3dc] px-3 py-2 text-xs text-[#6b4a05]">
          Date passée : les profits depuis cette date seront répartis à nouveau selon ce partage (seulement dans les exercices encore ouverts).
        </p>
      )}
      <p className="text-xs text-[var(--color-encre-doux)]">
        Il s’applique dès que {associes.length > 2 ? 'tous les associés l’ont' : 'l’autre associé l’a'} approuvé, et s’inscrit au registre des décisions.
      </p>
    </form>
  )
}
