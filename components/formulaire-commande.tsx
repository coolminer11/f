'use client'

import { useState } from 'react'
import BoutonEnvoi from '@/components/bouton-envoi'

export type ModeleEntreprise = { id: string; nom: string; prix: number; min: number; langue: 'fr_en' | 'en_fr' }
export type ValeursCommande = {
  id?: string
  client_nom: string
  courriel: string | null
  produit_id: string
  quantite: number
  prix_unitaire: number
  lieu: string
  couleurs: string | null
  texte_fr: string | null
  texte_en: string | null
  noms_cartes: string | null
  destination: string | null
  notes: string | null
}

const LIEUX = [
  ['QC', 'Québec'],
  ['ON', 'Ontario'],
  ['NB', 'Nouveau-Brunswick'],
  ['NS', 'Nouvelle-Écosse'],
  ['PE', 'Île-du-Prince-Édouard'],
  ['NL', 'Terre-Neuve-et-Labrador'],
  ['MB', 'Manitoba'],
  ['SK', 'Saskatchewan'],
  ['AB', 'Alberta'],
  ['BC', 'Colombie-Britannique'],
  ['YT', 'Yukon'],
  ['NT', 'Territoires du Nord-Ouest'],
  ['NU', 'Nunavut'],
  ['INTL', 'Hors Canada'],
] as const

const argent = (v: number) => v.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })

/**
 * Nouvelle commande Entreprise (ou modification) : le client, la carte, la
 * quantité, où elles seront posées, la personnalisation. Le total et les
 * règles (minimum, langue au Québec) se vérifient en direct ; la base les
 * revérifie de toute façon.
 */
export default function FormulaireCommande({
  action,
  modeles,
  clients,
  valeurs,
  libelle,
}: {
  action: (d: FormData) => Promise<void>
  modeles: ModeleEntreprise[]
  clients: string[]
  valeurs?: ValeursCommande
  libelle: string
}) {
  const [produit, setProduit] = useState(valeurs?.produit_id ?? modeles[0]?.id ?? '')
  const m = modeles.find((x) => x.id === produit) ?? modeles[0]
  const [quantite, setQuantite] = useState(String(valeurs?.quantite ?? m?.min ?? 25))
  const [prix, setPrix] = useState(String(valeurs?.prix_unitaire ?? m?.prix ?? 30).replace('.', ','))
  const [lieu, setLieu] = useState(valeurs?.lieu ?? 'QC')
  const q = Number(quantite)
  const p = Number(prix.replace(',', '.'))
  const sousMin = !!m && q < m.min
  const langueInterdite = m?.langue === 'en_fr' && lieu === 'QC'
  const total = Number.isFinite(q) && Number.isFinite(p) ? Math.round(q * p * 100) / 100 : null

  function changerModele(id: string) {
    setProduit(id)
    const nouveau = modeles.find((x) => x.id === id)
    if (nouveau && !valeurs) setPrix(String(nouveau.prix).replace('.', ','))
    // Anglais d'abord : par défaut, hors Québec.
    if (nouveau?.langue === 'en_fr' && lieu === 'QC') setLieu('ON')
  }

  return (
    <form action={action} className="space-y-4">
      {valeurs?.id && <input type="hidden" name="id" value={valeurs.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiquette" htmlFor="cc">Client</label>
          <input id="cc" name="client_nom" required maxLength={200} list="clients-connus" defaultValue={valeurs?.client_nom} className="champ" placeholder="Hôtel Le Château" />
          <datalist id="clients-connus">
            {clients.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="etiquette" htmlFor="cm">Courriel du client (facultatif)</label>
          <input id="cm" name="courriel" type="email" maxLength={254} defaultValue={valeurs?.courriel ?? ''} className="champ" />
        </div>
      </div>

      <fieldset>
        <legend className="etiquette">Carte</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {modeles.map((x) => (
            <label
              key={x.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${produit === x.id ? 'border-[var(--color-accent)] bg-[var(--color-accent-doux)]' : 'border-[var(--color-ligne)] hover:border-[var(--color-encre-doux)]'}`}
            >
              <input type="radio" name="produit_id" value={x.id} checked={produit === x.id} onChange={() => changerModele(x.id)} className="mt-0.5 accent-[var(--color-accent)]" />
              <span>
                <span className="block font-semibold">{x.nom}</span>
                <span className="block text-xs text-[var(--color-encre-doux)]">
                  {x.langue === 'fr_en' ? 'Français d’abord, anglais après' : 'Anglais d’abord, français après — hors Québec'} · {argent(x.prix)} la carte · {x.min} minimum
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="etiquette" htmlFor="cq">Nombre de cartes</label>
          <input id="cq" name="quantite" inputMode="numeric" required value={quantite} onChange={(e) => setQuantite(e.target.value.replace(/\D/g, ''))} className={`champ text-right tabular-nums ${sousMin ? 'border-[var(--color-negatif)]' : ''}`} />
        </div>
        <div>
          <label className="etiquette" htmlFor="cp">Prix par carte</label>
          <input id="cp" name="prix_unitaire" inputMode="decimal" required value={prix} onChange={(e) => setPrix(e.target.value)} className="champ text-right tabular-nums" />
        </div>
        <div>
          <label className="etiquette" htmlFor="cl">Où seront-elles posées ?</label>
          <select id="cl" name="lieu" value={lieu} onChange={(e) => setLieu(e.target.value)} className={`champ ${langueInterdite ? 'border-[var(--color-negatif)]' : ''}`}>
            {LIEUX.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="rounded-xl bg-[var(--color-fond)] px-4 py-3 text-sm" aria-live="polite">
        {sousMin ? (
          <span className="font-medium text-[var(--color-negatif)]">Cette carte se commande par {m?.min} au minimum.</span>
        ) : langueInterdite ? (
          <span className="font-medium text-[var(--color-negatif)]">
            Au Québec, le français doit être nettement prédominant : choisissez « Entreprise — Québec », ou indiquez où les cartes seront posées.
          </span>
        ) : (
          <span>
            Total : <strong className="tabular-nums">{total !== null ? argent(total) : '—'}</strong>
            <span className="text-[var(--color-encre-doux)]"> avant taxes</span>
          </span>
        )}
      </div>

      <details className="rounded-xl border border-[var(--color-ligne)] p-3" open={!!valeurs}>
        <summary className="cursor-pointer text-sm font-semibold">Personnalisation</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="etiquette" htmlFor="cd">Où mènent les cartes (lien Google, TripAdvisor…)</label>
            <input id="cd" name="destination" maxLength={600} defaultValue={valeurs?.destination ?? ''} className="champ" placeholder="https://g.page/r/…/review" />
          </div>
          <div>
            <label className="etiquette" htmlFor="cf">Texte en français</label>
            <input id="cf" name="texte_fr" maxLength={300} defaultValue={valeurs?.texte_fr ?? ''} className="champ" placeholder="Votre avis compte pour nous" />
          </div>
          <div>
            <label className="etiquette" htmlFor="ce">Texte en anglais</label>
            <input id="ce" name="texte_en" maxLength={300} defaultValue={valeurs?.texte_en ?? ''} className="champ" placeholder="Your review means a lot" />
          </div>
          <div>
            <label className="etiquette" htmlFor="co">Couleurs</label>
            <input id="co" name="couleurs" maxLength={200} defaultValue={valeurs?.couleurs ?? ''} className="champ" placeholder="Bleu marine #1B2A49, or #C9A227" />
          </div>
          <div>
            <label className="etiquette" htmlFor="cn">Notes</label>
            <input id="cn" name="notes" maxLength={2000} defaultValue={valeurs?.notes ?? ''} className="champ" />
          </div>
          <div className="sm:col-span-2">
            <label className="etiquette" htmlFor="cs">Nom de chaque carte (une par ligne, facultatif)</label>
            <textarea id="cs" name="noms_cartes" rows={4} maxLength={8000} defaultValue={valeurs?.noms_cartes ?? ''} className="champ resize-y font-mono text-xs" placeholder={'Chambre 101\nChambre 102\nRéception'} />
            <p className="mt-1 text-xs text-[var(--color-encre-doux)]">Sinon, « Carte 1 » à « Carte {q || 'N'} ». Ce sont les noms que le client verra dans ses statistiques.</p>
          </div>
        </div>
      </details>

      <BoutonEnvoi attente="Enregistrement…" className={sousMin || langueInterdite ? 'pointer-events-none opacity-50' : ''}>
        {libelle}
      </BoutonEnvoi>
    </form>
  )
}
