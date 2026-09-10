'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { Produit, TypeDocument } from '@/lib/requetes/ventes'
import { argent, taux } from '@/lib/format'

type LigneSaisie = {
  cle: string
  produit_id: string | null
  description: string
  quantite: number
  prix_unitaire_ht: number
  remise_ht: number
  taxable: boolean
}

type ApercuTaxe = { code: string; taux: number; montant: number; autorite: string }

const TYPES: { code: TypeDocument; libelle: string; aide: string }[] = [
  { code: 'facture', libelle: 'Facture', aide: 'Reconnaît le revenu, même si elle n’est pas encore payée.' },
  { code: 'devis', libelle: 'Devis', aide: 'N’engage rien : aucun revenu, aucune sortie de stock.' },
  { code: 'recu', libelle: 'Reçu de vente', aide: 'Vente réglée sur place, au comptoir.' },
]

function aujourdhuiLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ajouterJours(iso: string, jours: number): string {
  const [a, m, j] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, j + jours))
  return d.toISOString().slice(0, 10)
}

function nouvelleLigne(): LigneSaisie {
  return {
    cle: crypto.randomUUID(),
    produit_id: null,
    description: '',
    quantite: 1,
    prix_unitaire_ht: 0,
    remise_ht: 0,
    taxable: true,
  }
}

function Bouton({ type }: { type: TypeDocument }) {
  const { pending } = useFormStatus()
  const libelle =
    type === 'devis' ? 'Créer le devis' : type === 'recu' ? 'Créer le reçu' : 'Créer la facture'
  return (
    <button className="bouton" disabled={pending}>
      {pending ? 'Enregistrement…' : libelle}
    </button>
  )
}

export default function FormulaireDocument({
  action,
  produits,
  provinces,
  modesPaiement,
  conditions,
  typeInitial,
  conditionsGeneralesDefaut,
  delaiPaiementJours,
}: {
  action: (donnees: FormData) => Promise<void>
  produits: Produit[]
  provinces: readonly (readonly [string, string])[]
  modesPaiement: readonly (readonly [string, string])[]
  conditions: readonly (readonly [string, number])[]
  typeInitial: TypeDocument
  conditionsGeneralesDefaut: string | null
  delaiPaiementJours: number
}) {
  const [type, setType] = useState<TypeDocument>(typeInitial)
  const [date, setDate] = useState(aujourdhuiLocal())
  const [province, setProvince] = useState('QC')
  const [modePaiement, setModePaiement] = useState('virement')
  const [conditionChoisie, setConditionChoisie] = useState(`Net ${delaiPaiementJours}`)
  const [echeance, setEcheance] = useState(() => ajouterJours(aujourdhuiLocal(), delaiPaiementJours))
  const [remiseGlobale, setRemiseGlobale] = useState('0')
  const [lignes, setLignes] = useState<LigneSaisie[]>([nouvelleLigne()])
  const [taxes, setTaxes] = useState<ApercuTaxe[]>([])
  const [paiementImmediat, setPaiementImmediat] = useState('')

  const sousTotal = useMemo(
    () =>
      lignes.reduce(
        (somme, l) => somme + Math.round((l.quantite * l.prix_unitaire_ht - l.remise_ht) * 100) / 100,
        0,
      ),
    [lignes],
  )
  const baseTaxable = useMemo(
    () =>
      Math.max(
        lignes
          .filter((l) => l.taxable)
          .reduce(
            (somme, l) =>
              somme + Math.round((l.quantite * l.prix_unitaire_ht - l.remise_ht) * 100) / 100,
            0,
          ) - Number(remiseGlobale || 0),
        0,
      ),
    [lignes, remiseGlobale],
  )
  const totalHt = Math.round((sousTotal - Number(remiseGlobale || 0)) * 100) / 100
  const totalTaxes = taxes.reduce((s, t) => s + Number(t.montant), 0)
  const totalTtc = Math.round((totalHt + totalTaxes) * 100) / 100

  // Les taux viennent de la base : jamais d'une constante côté navigateur.
  useEffect(() => {
    if (baseTaxable <= 0) {
      setTaxes([])
      return
    }
    const controle = new AbortController()
    const minuterie = setTimeout(async () => {
      try {
        const reponse = await fetch(
          `/api/apercu-taxes?montant=${baseTaxable}&province=${province}&date=${date}`,
          { signal: controle.signal },
        )
        if (reponse.ok) setTaxes((await reponse.json()).lignes ?? [])
      } catch {
        /* requête annulée */
      }
    }, 250)
    return () => {
      clearTimeout(minuterie)
      controle.abort()
    }
  }, [baseTaxable, province, date])

  function majLigne(cle: string, partiel: Partial<LigneSaisie>) {
    setLignes((precedentes) =>
      precedentes.map((l) => (l.cle === cle ? { ...l, ...partiel } : l)),
    )
  }

  function choisirProduit(cle: string, produitId: string) {
    const produit = produits.find((p) => p.id === produitId)
    majLigne(cle, {
      produit_id: produit?.id ?? null,
      description: produit?.nom ?? '',
      prix_unitaire_ht: produit ? Number(produit.prix_vente_ht) : 0,
      taxable: produit ? produit.taxable : true,
    })
  }

  function changerCondition(valeur: string) {
    setConditionChoisie(valeur)
    const trouve = conditions.find(([libelle]) => libelle === valeur)
    if (trouve) setEcheance(ajouterJours(date, trouve[1]))
  }

  return (
    <form action={action} className="space-y-5">
      <input
        type="hidden"
        name="lignes"
        value={JSON.stringify(
          lignes
            .filter((l) => l.description.trim() && l.quantite !== 0)
            .map(({ cle, ...reste }) => {
              void cle
              return reste
            }),
        )}
      />
      <input type="hidden" name="type_document" value={type} />

      {/* Type de document */}
      <div className="carte p-5">
        <h2 className="text-sm font-bold">Type de document</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <button
              key={t.code}
              type="button"
              onClick={() => setType(t.code)}
              className={`rounded-lg border p-3 text-left ${
                type === t.code
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-doux)]'
                  : 'border-[var(--color-ligne)]'
              }`}
            >
              <div className="text-sm font-semibold">{t.libelle}</div>
              <div className="mt-0.5 text-xs text-[var(--color-encre-doux)]">{t.aide}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Client et conditions */}
      <div className="carte space-y-4 p-5">
        <h2 className="text-sm font-bold">Client et conditions</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiquette" htmlFor="client_nom">
              Nom du client
            </label>
            <input
              id="client_nom"
              name="client_nom"
              className="champ"
              placeholder="Boulangerie Lévesque"
              required
              maxLength={200}
            />
          </div>
          <div>
            <label className="etiquette" htmlFor="courriel_facturation">
              Courriel <span className="font-normal">(facultatif)</span>
            </label>
            <input
              id="courriel_facturation"
              name="courriel_facturation"
              type="email"
              className="champ"
              maxLength={200}
            />
          </div>
        </div>

        <div>
          <label className="etiquette" htmlFor="adresse_facturation">
            Adresse de facturation <span className="font-normal">(facultatif)</span>
          </label>
          <textarea
            id="adresse_facturation"
            name="adresse_facturation"
            className="champ"
            rows={2}
            maxLength={500}
            placeholder="88, rue Racine Est&#10;Chicoutimi (Québec) G7H 1S4"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
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
              onChange={(e) => {
                setDate(e.target.value)
                const trouve = conditions.find(([libelle]) => libelle === conditionChoisie)
                if (trouve) setEcheance(ajouterJours(e.target.value, trouve[1]))
              }}
              required
            />
          </div>
          <div>
            <label className="etiquette" htmlFor="province">
              Province de destination
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
          <div>
            <label className="etiquette" htmlFor="bon_de_commande">
              Bon de commande <span className="font-normal">(facultatif)</span>
            </label>
            <input
              id="bon_de_commande"
              name="bon_de_commande"
              className="champ"
              maxLength={100}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="etiquette" htmlFor="conditions_paiement">
              Conditions de paiement
            </label>
            <select
              id="conditions_paiement"
              name="conditions_paiement"
              className="champ"
              value={conditionChoisie}
              onChange={(e) => changerCondition(e.target.value)}
            >
              {conditions.map(([libelle]) => (
                <option key={libelle} value={libelle}>
                  {libelle}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiquette" htmlFor="date_echeance">
              {type === 'devis' ? 'Valide jusqu’au' : 'Échéance'}
            </label>
            <input
              id="date_echeance"
              name="date_echeance"
              type="date"
              className="champ"
              value={echeance}
              onChange={(e) => setEcheance(e.target.value)}
            />
          </div>
          <div>
            <label className="etiquette" htmlFor="mode_paiement">
              Mode de paiement
            </label>
            <select
              id="mode_paiement"
              name="mode_paiement"
              className="champ"
              value={modePaiement}
              onChange={(e) => setModePaiement(e.target.value)}
            >
              {modesPaiement.map(([code, nom]) => (
                <option key={code} value={code}>
                  {nom}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lignes */}
      <div className="carte p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold">Lignes</h2>
          <button
            type="button"
            onClick={() => setLignes((l) => [...l, nouvelleLigne()])}
            className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
          >
            + Ajouter une ligne
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {lignes.map((l, index) => (
            <div
              key={l.cle}
              className="grid gap-2 rounded-lg border border-[var(--color-ligne)] p-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-5">
                <label className="etiquette" htmlFor={`desc-${l.cle}`}>
                  Description
                </label>
                {produits.length > 0 && (
                  <select
                    aria-label="Choisir un produit"
                    className="champ mb-2 text-xs"
                    value={l.produit_id ?? ''}
                    onChange={(e) => choisirProduit(l.cle, e.target.value)}
                  >
                    <option value="">— saisie libre —</option>
                    {produits.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  id={`desc-${l.cle}`}
                  className="champ"
                  value={l.description}
                  onChange={(e) => majLigne(l.cle, { description: e.target.value })}
                  placeholder="Carte NFC personnalisée"
                  maxLength={300}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="etiquette" htmlFor={`qte-${l.cle}`}>
                  Quantité
                </label>
                <input
                  id={`qte-${l.cle}`}
                  type="number"
                  step="1"
                  className="champ"
                  value={l.quantite}
                  onChange={(e) => majLigne(l.cle, { quantite: Number(e.target.value) })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="etiquette" htmlFor={`prix-${l.cle}`}>
                  Prix HT
                </label>
                <input
                  id={`prix-${l.cle}`}
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className="champ"
                  value={l.prix_unitaire_ht}
                  onChange={(e) => majLigne(l.cle, { prix_unitaire_ht: Number(e.target.value) })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="etiquette" htmlFor={`remise-${l.cle}`}>
                  Remise
                </label>
                <input
                  id={`remise-${l.cle}`}
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className="champ"
                  value={l.remise_ht}
                  onChange={(e) => majLigne(l.cle, { remise_ht: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-end justify-between gap-2 sm:col-span-1">
                <span className="chiffre text-sm font-semibold">
                  {argent(l.quantite * l.prix_unitaire_ht - l.remise_ht)}
                </span>
              </div>
              <div className="flex items-center gap-4 sm:col-span-12">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={l.taxable}
                    onChange={(e) => majLigne(l.cle, { taxable: e.target.checked })}
                  />
                  Taxable
                </label>
                {lignes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLignes((precedentes) => precedentes.filter((x) => x.cle !== l.cle))}
                    className="text-xs text-[var(--color-encre-doux)] hover:underline"
                  >
                    Retirer la ligne {index + 1}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totaux et mentions */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="carte space-y-4 p-5">
          <h2 className="text-sm font-bold">Mentions</h2>
          <div>
            <label className="etiquette" htmlFor="notes_facture">
              Note au client <span className="font-normal">(facultatif)</span>
            </label>
            <textarea
              id="notes_facture"
              name="notes_facture"
              className="champ"
              rows={2}
              maxLength={1000}
              placeholder="Livraison estimée à 10 jours ouvrables."
            />
          </div>
          <div>
            <label className="etiquette" htmlFor="conditions_generales">
              Conditions générales
            </label>
            <textarea
              id="conditions_generales"
              name="conditions_generales"
              className="champ"
              rows={3}
              maxLength={2000}
              defaultValue={conditionsGeneralesDefaut ?? ''}
            />
          </div>
        </div>

        <div className="carte bg-[var(--color-accent-doux)] p-5">
          <h2 className="text-sm font-bold">Totaux</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <LigneTotal libelle="Sous-total" valeur={argent(sousTotal)} />
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--color-encre-doux)]">
                <label htmlFor="remise_globale">Remise globale</label>
              </dt>
              <dd>
                <input
                  id="remise_globale"
                  name="remise_globale"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className="champ w-28 py-1 text-right"
                  value={remiseGlobale}
                  onChange={(e) => setRemiseGlobale(e.target.value)}
                />
              </dd>
            </div>
            <LigneTotal libelle="Total hors taxes" valeur={argent(totalHt)} fort />
            {taxes.map((t) => (
              <LigneTotal
                key={t.code}
                libelle={`${t.code} (${taux(t.taux)} · ${t.autorite})`}
                valeur={argent(t.montant)}
              />
            ))}
            {taxes.length === 0 && baseTaxable > 0 && (
              <LigneTotal libelle="Aucune taxe applicable" valeur="—" />
            )}
            <div className="!mt-3 border-t border-white/70 pt-2">
              <LigneTotal libelle="Total à payer" valeur={argent(totalTtc)} fort />
            </div>
          </dl>

          {type !== 'devis' && (
            <div className="mt-4 border-t border-white/70 pt-3">
              <label className="etiquette" htmlFor="paiement_immediat">
                Paiement reçu maintenant <span className="font-normal">(facultatif)</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="paiement_immediat"
                  name="paiement_immediat"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className="champ"
                  placeholder="0,00"
                  value={paiementImmediat}
                  onChange={(e) => setPaiementImmediat(e.target.value)}
                />
                <button
                  type="button"
                  className="bouton bouton-secondaire whitespace-nowrap"
                  onClick={() => setPaiementImmediat(totalTtc.toFixed(2))}
                >
                  Payé en entier
                </button>
              </div>
              {Number(paiementImmediat) > 0 && (
                <p className="mt-1.5 text-xs text-[var(--color-encre-doux)]">
                  Solde après paiement :{' '}
                  <span className="chiffre font-semibold">
                    {argent(totalTtc - Number(paiementImmediat))}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Bouton type={type} />
        <a href="/ventes" className="bouton bouton-secondaire">
          Annuler
        </a>
      </div>
    </form>
  )
}

function LigneTotal({
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
