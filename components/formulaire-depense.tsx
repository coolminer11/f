'use client'

import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { Categorie } from '@/lib/requetes/transactions'
import { argent, taux } from '@/lib/format'

type LigneApercu = { code: string; taux: number; montant: number; autorite: string }

function aujourdhuiLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function BoutonEnvoi() {
  const { pending } = useFormStatus()
  return (
    <button className="bouton" disabled={pending}>
      {pending ? 'Enregistrement…' : 'Enregistrer la dépense'}
    </button>
  )
}

export default function FormulaireDepense({
  action,
  categories,
  provinces,
  modesPaiement,
}: {
  action: (donnees: FormData) => Promise<void>
  categories: Categorie[]
  provinces: readonly (readonly [string, string])[]
  modesPaiement: readonly (readonly [string, string])[]
}) {
  const [montant, setMontant] = useState('')
  const [taxesIncluses, setTaxesIncluses] = useState(false)
  const [province, setProvince] = useState('QC')
  const [date, setDate] = useState(aujourdhuiLocal())
  const [categorie, setCategorie] = useState(categories[0]?.categorie ?? '')
  const [apercu, setApercu] = useState<{ montant_ht: number; lignes: LigneApercu[] }>({
    montant_ht: 0,
    lignes: [],
  })
  const [nomRecu, setNomRecu] = useState<string | null>(null)

  const choisie = categories.find((c) => c.categorie === categorie)
  const partRecuperable = choisie ? Number(choisie.pct_recuperable) : 1

  // L'aperçu vient de la base : les taux ne sont jamais codés en dur ici.
  useEffect(() => {
    const valeur = Number(montant)
    if (!Number.isFinite(valeur) || valeur <= 0) {
      setApercu({ montant_ht: 0, lignes: [] })
      return
    }
    const controle = new AbortController()
    const minuterie = setTimeout(async () => {
      try {
        const reponse = await fetch(
          `/api/apercu-taxes?montant=${valeur}&province=${province}&date=${date}&taxes_incluses=${taxesIncluses ? '1' : '0'}`,
          { signal: controle.signal },
        )
        if (reponse.ok) setApercu(await reponse.json())
      } catch {
        /* requête annulée : rien à signaler */
      }
    }, 250)
    return () => {
      clearTimeout(minuterie)
      controle.abort()
    }
  }, [montant, province, date, taxesIncluses])

  const totalTaxes = apercu.lignes.reduce((s, l) => s + Number(l.montant), 0)
  const recuperable = apercu.lignes.reduce(
    (s, l) => s + Number(l.montant) * partRecuperable * (l.code === 'TVP' ? 0 : 1),
    0,
  )
  const coutReel = apercu.montant_ht + (totalTaxes - recuperable)

  return (
    <form action={action} className="space-y-5">
      <div className="carte space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiquette" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              className="champ"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="etiquette" htmlFor="mode_paiement">
              Mode de paiement
            </label>
            <select id="mode_paiement" name="mode_paiement" className="champ" defaultValue="carte_credit">
              {modesPaiement.map(([code, nom]) => (
                <option key={code} value={code}>
                  {nom}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="etiquette" htmlFor="description">
            Description
          </label>
          <input
            id="description"
            name="description"
            className="champ"
            placeholder="Impression de 50 cartes, Postes Canada…"
            required
            maxLength={200}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiquette" htmlFor="categorie">
              Catégorie
            </label>
            <select
              id="categorie"
              name="categorie"
              className="champ"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              required
            >
              {categories.map((c) => (
                <option key={c.categorie} value={c.categorie}>
                  {c.libelle}
                </option>
              ))}
            </select>
            {choisie && (
              <p className="mt-1.5 text-xs text-[var(--color-encre-doux)]">
                Coût {choisie.nature_defaut === 'fixe' ? 'fixe' : 'variable'}
                {partRecuperable < 1 && (
                  <span className="font-semibold text-[var(--color-attention)]">
                    {' '}
                    · taxes récupérables à {Math.round(partRecuperable * 100)} % seulement
                  </span>
                )}
              </p>
            )}
          </div>
          <div>
            <label className="etiquette" htmlFor="province">
              Province de l’achat
            </label>
            <select
              id="province"
              name="province"
              className="champ"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            >
              {provinces.map(([code, nom]) => (
                <option key={code} value={code}>
                  {nom}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiquette" htmlFor="montant">
              Montant
            </label>
            <input
              id="montant"
              name="montant"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              className="champ"
              placeholder="0,00"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              required
            />
            <div className="mt-2 flex gap-4 text-xs">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="taxes_incluses"
                  value="0"
                  checked={!taxesIncluses}
                  onChange={() => setTaxesIncluses(false)}
                />
                hors taxes
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="taxes_incluses"
                  value="1"
                  checked={taxesIncluses}
                  onChange={() => setTaxesIncluses(true)}
                />
                taxes incluses (total du reçu)
              </label>
            </div>
          </div>
          <div>
            <label className="etiquette" htmlFor="taxes_reelles">
              Taxes du reçu <span className="font-normal">(facultatif)</span>
            </label>
            <input
              id="taxes_reelles"
              name="taxes_reelles"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              className="champ"
              placeholder="laisser vide pour calculer"
            />
            <p className="mt-1.5 text-xs text-[var(--color-encre-doux)]">
              À remplir seulement si le reçu affiche un cent d’écart avec le calcul.
            </p>
          </div>
        </div>

        <div>
          <label className="etiquette" htmlFor="recu">
            Photo du reçu
          </label>
          <input
            id="recu"
            name="recu"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            capture="environment"
            className="champ file:mr-3 file:rounded file:border-0 file:bg-[var(--color-accent-doux)] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[var(--color-accent)]"
            onChange={(e) => setNomRecu(e.target.files?.[0]?.name ?? null)}
          />
          <p className="mt-1.5 text-xs text-[var(--color-encre-doux)]">
            {nomRecu ? `Sélectionné : ${nomRecu}` : 'JPEG, PNG, HEIC ou PDF, 10 Mo maximum.'}
          </p>
        </div>

        <div>
          <label className="etiquette" htmlFor="note">
            Note <span className="font-normal">(facultatif)</span>
          </label>
          <textarea id="note" name="note" className="champ" rows={2} maxLength={500} />
        </div>
      </div>

      <div className="carte bg-[var(--color-accent-doux)] p-5">
        <h2 className="text-sm font-bold">Ce qui sera enregistré</h2>
        {apercu.montant_ht > 0 ? (
          <dl className="mt-3 space-y-1.5 text-sm">
            <Ligne libelle="Montant hors taxes" valeur={argent(apercu.montant_ht)} fort />
            {apercu.lignes.map((l) => (
              <Ligne
                key={l.code}
                libelle={`${l.code} (${taux(l.taux)} · ${l.autorite})`}
                valeur={argent(l.montant)}
              />
            ))}
            {apercu.lignes.length === 0 && (
              <Ligne libelle="Aucune taxe applicable" valeur="—" />
            )}
            <Ligne libelle="Total payé" valeur={argent(apercu.montant_ht + totalTaxes)} />
            <div className="!mt-3 border-t border-white/70 pt-2">
              <Ligne libelle="Taxes récupérables" valeur={argent(recuperable)} />
              <Ligne libelle="Coût réel pour la société" valeur={argent(coutReel)} fort />
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-[var(--color-encre-doux)]">
            Saisissez un montant pour voir le détail des taxes.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <BoutonEnvoi />
        <a href="/transactions" className="bouton bouton-secondaire">
          Annuler
        </a>
      </div>
    </form>
  )
}

function Ligne({
  libelle,
  valeur,
  fort = false,
}: {
  libelle: string
  valeur: string
  fort?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={fort ? 'font-semibold' : 'text-[var(--color-encre-doux)]'}>{libelle}</dt>
      <dd className={`chiffre ${fort ? 'font-bold' : ''}`}>{valeur}</dd>
    </div>
  )
}
