'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { analyserCsv, convertir, deviner, type Correspondance, type TableauCsv } from '@/lib/csv'
import { argent, dateCourte } from '@/lib/format'

const CHAMPS: { cle: keyof Correspondance; libelle: string; aide?: string }[] = [
  { cle: 'date', libelle: 'Date' },
  { cle: 'description', libelle: 'Description' },
  { cle: 'montant', libelle: 'Montant signé', aide: 'négatif = débit' },
  { cle: 'debit', libelle: 'Débit', aide: 'si colonnes séparées' },
  { cle: 'credit', libelle: 'Crédit', aide: 'si colonnes séparées' },
  { cle: 'solde', libelle: 'Solde', aide: 'facultatif' },
]

async function empreinte(texte: string): Promise<string> {
  const condensat = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte))
  return Array.from(new Uint8Array(condensat))
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('')
}

export default function TeleversementReleve() {
  const router = useRouter()
  const [fichier, setFichier] = useState<File | null>(null)
  const [texte, setTexte] = useState('')
  const [tableau, setTableau] = useState<TableauCsv | null>(null)
  const [correspondance, setCorrespondance] = useState<Correspondance | null>(null)
  const [compte, setCompte] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  async function choisir(f: File | null) {
    setErreur(null)
    setTableau(null)
    setFichier(f)
    if (!f) return
    if (f.size > 2 * 1024 * 1024) {
      setErreur('Fichier trop volumineux (2 Mo maximum).')
      return
    }
    const contenu = await f.text()
    const analyse = analyserCsv(contenu)
    if (analyse.lignes.length === 0) {
      setErreur('Ce fichier ne contient aucune ligne exploitable.')
      return
    }
    setTexte(contenu)
    setTableau(analyse)
    setCorrespondance(deviner(analyse.entetes))
  }

  const converti =
    tableau && correspondance ? convertir(tableau, correspondance) : { lignes: [], rejets: 0 }

  async function envoyer() {
    if (!fichier || converti.lignes.length === 0) return
    setEnvoi(true)
    setErreur(null)
    try {
      const reponse = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomFichier: fichier.name,
          empreinteFichier: await empreinte(texte),
          compte: compte.trim() || null,
          lignes: converti.lignes,
        }),
      })
      const resultat = await reponse.json()
      if (!reponse.ok) {
        setErreur(resultat.erreur ?? 'Import impossible.')
        return
      }
      if (resultat.deja) {
        setErreur('Ce relevé a déjà été importé : les lignes existantes sont déjà en attente.')
      }
      setTableau(null)
      setFichier(null)
      router.push(`/import?import=${resultat.importId}`)
      router.refresh()
    } catch {
      setErreur('Le serveur n’a pas répondu.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <section className="carte p-5">
      <h2 className="text-sm font-bold">Importer un relevé</h2>
      <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
        Fichier CSV exporté de votre institution. Le contenu est analysé dans le navigateur : rien
        n’est envoyé tant que la correspondance des colonnes n’est pas confirmée.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_16rem]">
        <div>
          <label className="etiquette" htmlFor="fichier">
            Fichier CSV
          </label>
          <input
            id="fichier"
            type="file"
            accept=".csv,text/csv,text/plain"
            className="champ file:mr-3 file:rounded file:border-0 file:bg-[var(--color-accent-doux)] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[var(--color-accent)]"
            onChange={(e) => choisir(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <label className="etiquette" htmlFor="compte">
            Compte <span className="font-normal">(facultatif)</span>
          </label>
          <input
            id="compte"
            className="champ"
            placeholder="Desjardins entreprise"
            value={compte}
            onChange={(e) => setCompte(e.target.value)}
          />
        </div>
      </div>

      {erreur && (
        <p className="mt-3 rounded-lg border border-[var(--color-negatif)] bg-red-50 px-3 py-2 text-sm font-medium text-[var(--color-negatif)]">
          {erreur}
        </p>
      )}

      {tableau && correspondance && (
        <>
          <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-[var(--color-encre-doux)]">
            Correspondance des colonnes
          </h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {CHAMPS.map((champ) => (
              <div key={champ.cle}>
                <label className="etiquette" htmlFor={`col-${champ.cle}`}>
                  {champ.libelle}
                  {champ.aide && <span className="font-normal"> ({champ.aide})</span>}
                </label>
                <select
                  id={`col-${champ.cle}`}
                  className="champ"
                  value={correspondance[champ.cle]}
                  onChange={(e) =>
                    setCorrespondance({ ...correspondance, [champ.cle]: Number(e.target.value) })
                  }
                >
                  <option value={-1}>— aucune —</option>
                  {tableau.entetes.map((entete, i) => (
                    <option key={i} value={i}>
                      {entete || `Colonne ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold">
              {converti.lignes.length} ligne{converti.lignes.length > 1 ? 's' : ''} exploitable
              {converti.lignes.length > 1 ? 's' : ''}
            </span>
            {converti.rejets > 0 && (
              <span className="text-[var(--color-attention)]">
                {converti.rejets} ligne{converti.rejets > 1 ? 's' : ''} ignorée
                {converti.rejets > 1 ? 's' : ''} (date, description ou montant illisible)
              </span>
            )}
          </div>

          {converti.lignes.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--color-ligne)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-fond)] text-left text-xs uppercase text-[var(--color-encre-doux)]">
                    <th className="px-3 py-1.5 font-semibold">Date</th>
                    <th className="px-3 py-1.5 font-semibold">Description</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {converti.lignes.slice(0, 5).map((l, i) => (
                    <tr key={i} className="border-t border-[var(--color-ligne)]">
                      <td className="chiffre px-3 py-1.5">{dateCourte(l.date)}</td>
                      <td className="px-3 py-1.5">{l.description}</td>
                      <td
                        className={`chiffre px-3 py-1.5 text-right ${
                          l.montant < 0 ? '' : 'text-[var(--color-positif)]'
                        }`}
                      >
                        {argent(l.montant)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {converti.lignes.length > 5 && (
                <p className="border-t border-[var(--color-ligne)] px-3 py-1.5 text-xs text-[var(--color-encre-doux)]">
                  … et {converti.lignes.length - 5} autres.
                </p>
              )}
            </div>
          )}

          <button
            className="bouton mt-4"
            onClick={envoyer}
            disabled={envoi || converti.lignes.length === 0}
            type="button"
          >
            {envoi ? 'Import en cours…' : 'Importer ces lignes'}
          </button>
        </>
      )}
    </section>
  )
}
