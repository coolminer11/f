'use client'

import { useState } from 'react'
import { recevoirAction } from '@/app/cartes/stock/actions'
import BoutonEnvoi from '@/components/bouton-envoi'

const MODES = [
  ['carte_credit', 'Carte de crédit'],
  ['carte_debit', 'Carte de débit'],
  ['interac', 'Virement Interac'],
  ['virement', 'Virement bancaire'],
  ['comptant', 'Argent comptant'],
  ['cheque', 'Chèque'],
  ['autre', 'Autre'],
] as const

const nombre = (t: string) => {
  const v = t.trim().replace(/\s/g, '').replace(',', '.')
  return /^\d+(\.\d{1,2})?$/.test(v) ? Number(v) : NaN
}

/**
 * Réception de cartes : combien de cartes, combien payé. L'app calcule le
 * coût par carte, les met au stock, et le coût de chaque vente suit tout seul.
 */
export default function FormulaireReception({
  aujourdhui,
  inscritTaxes,
  modeles,
  modeleParDefaut,
}: {
  aujourdhui: string
  inscritTaxes: boolean
  modeles: { id: string; nom: string }[]
  modeleParDefaut: string | null
}) {
  const [quantite, setQuantite] = useState('')
  const [total, setTotal] = useState('')
  const [taxes, setTaxes] = useState('')
  const q = Number(quantite)
  const t = nombre(total)
  const tx = taxes ? nombre(taxes) : 0
  const parCarte = q > 0 && Number.isFinite(t) && Number.isFinite(tx) ? (t - tx) / q : null

  return (
    <form action={recevoirAction} className="space-y-3">
      {modeles.length > 1 && (
        <div>
          <label className="etiquette" htmlFor="rp">Modèle</label>
          <select id="rp" name="produit_id" defaultValue={modeleParDefaut ?? modeles[0]?.id} className="champ">
            {modeles.map((m) => (
              <option key={m.id} value={m.id}>{m.nom}</option>
            ))}
          </select>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="etiquette" htmlFor="rq">Cartes reçues</label>
          <input id="rq" name="quantite" inputMode="numeric" required className="champ text-right tabular-nums" placeholder="50" value={quantite} onChange={(e) => setQuantite(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div>
          <label className="etiquette" htmlFor="rt">Total payé{inscritTaxes ? ' (taxes incluses)' : ''}</label>
          <div className="relative">
            <input id="rt" name="total" inputMode="decimal" required className="champ text-right tabular-nums" style={{ paddingRight: '2rem' }} placeholder="250,00" value={total} onChange={(e) => setTotal(e.target.value)} />
            <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-[var(--color-encre-doux)]">$</span>
          </div>
        </div>
        <div>
          <label className="etiquette" htmlFor="rd">Reçues le</label>
          <input id="rd" name="date" type="date" required defaultValue={aujourdhui} max={aujourdhui} className="champ" />
        </div>
      </div>
      {inscritTaxes && (
        <div className="sm:w-1/3">
          <label className="etiquette" htmlFor="rx">Dont TPS + TVQ (récupérables)</label>
          <input id="rx" name="taxes" inputMode="decimal" className="champ text-right tabular-nums" placeholder="0,00" value={taxes} onChange={(e) => setTaxes(e.target.value)} />
        </div>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]">Fournisseur, paiement, reçu (facultatif)</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="etiquette" htmlFor="rf">Description</label>
            <input id="rf" name="description" maxLength={200} className="champ" placeholder="Cartes NFC — Alibaba" />
          </div>
          <div>
            <label className="etiquette" htmlFor="rm">Payé par</label>
            <select id="rm" name="mode_paiement" defaultValue="carte_credit" className="champ">
              {MODES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiquette" htmlFor="rr">Reçu ou facture</label>
            <input id="rr" name="recu" type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="block w-full text-xs file:mr-2 file:rounded-full file:border-0 file:bg-[var(--color-fond)] file:px-3 file:py-1.5 file:text-xs file:font-semibold" />
          </div>
        </div>
      </details>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-[var(--color-encre-doux)]" aria-live="polite">
          {parCarte !== null && parCarte > 0 ? (
            <>
              = <strong className="tabular-nums text-[var(--color-encre)]">{parCarte.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $</strong> par carte
            </>
          ) : (
            'Le coût par carte se calcule tout seul.'
          )}
        </span>
        <BoutonEnvoi attente="Ajout…">Ajouter au stock</BoutonEnvoi>
      </div>
    </form>
  )
}
