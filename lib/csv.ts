/**
 * Analyseur CSV minimal mais correct : guillemets, guillemets doublés,
 * séparateurs `,` `;` ou tabulation détectés automatiquement, fins de ligne
 * Windows, BOM UTF-8. Utilisé côté navigateur pour l'aperçu du relevé
 * bancaire avant envoi — le fichier ne quitte jamais la page tant que la
 * correspondance des colonnes n'est pas confirmée.
 */
export type TableauCsv = { entetes: string[]; lignes: string[][] }

export function detecterSeparateur(texte: string): string {
  const premiere = texte.split(/\r?\n/).find((l) => l.trim().length > 0) ?? ''
  const candidats = [',', ';', '\t', '|']
  let meilleur = ','
  let score = -1
  for (const separateur of candidats) {
    const n = decouperLigne(premiere, separateur).length
    if (n > score) {
      score = n
      meilleur = separateur
    }
  }
  return meilleur
}

function decouperLigne(ligne: string, separateur: string): string[] {
  const champs: string[] = []
  let courant = ''
  let entreGuillemets = false
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i]
    if (entreGuillemets) {
      if (c === '"') {
        if (ligne[i + 1] === '"') {
          courant += '"'
          i++
        } else entreGuillemets = false
      } else courant += c
    } else if (c === '"') entreGuillemets = true
    else if (c === separateur) {
      champs.push(courant)
      courant = ''
    } else courant += c
  }
  champs.push(courant)
  return champs.map((c) => c.trim())
}

export function analyserCsv(texte: string, separateur?: string): TableauCsv {
  const propre = texte.replace(/^﻿/, '')
  const sep = separateur ?? detecterSeparateur(propre)

  // Recompose les lignes en tenant compte des sauts de ligne entre guillemets.
  const lignesBrutes: string[] = []
  let courant = ''
  let entreGuillemets = false
  for (const c of propre) {
    if (c === '"') entreGuillemets = !entreGuillemets
    if ((c === '\n' || c === '\r') && !entreGuillemets) {
      if (courant.trim().length > 0) lignesBrutes.push(courant)
      courant = ''
    } else if (c !== '\r') courant += c
  }
  if (courant.trim().length > 0) lignesBrutes.push(courant)
  if (lignesBrutes.length === 0) return { entetes: [], lignes: [] }

  const toutes = lignesBrutes.map((l) => decouperLigne(l, sep))
  const premiere = toutes[0]
  // Une première ligne sans aucun nombre est un en-tête.
  const estEntete = premiere.every((c) => !/^-?[\d\s.,$()]+$/.test(c) || c === '')

  return estEntete
    ? { entetes: premiere, lignes: toutes.slice(1) }
    : { entetes: premiere.map((_, i) => `Colonne ${i + 1}`), lignes: toutes }
}

/** « 1 234,56 $ », « (45.00) », « -45,00 » -> nombre. */
export function nombreDepuisTexte(valeur: string): number | null {
  if (!valeur) return null
  let texte = valeur.replace(/[\s $]/g, '')
  let negatif = false
  if (/^\(.*\)$/.test(texte)) {
    negatif = true
    texte = texte.slice(1, -1)
  }
  if (texte.startsWith('-')) {
    negatif = true
    texte = texte.slice(1)
  }
  // Virgule décimale française : 1.234,56 ou 1234,56
  if (/,\d{1,2}$/.test(texte)) texte = texte.replace(/\./g, '').replace(',', '.')
  else texte = texte.replace(/,/g, '')
  const n = Number(texte)
  if (!Number.isFinite(n)) return null
  return negatif ? -n : n
}

/** Dates des relevés canadiens : AAAA-MM-JJ, JJ/MM/AAAA, MM/JJ/AAAA, 5 sept. 2026. */
export function dateDepuisTexte(valeur: string): string | null {
  if (!valeur) return null
  const texte = valeur.trim()

  const iso = texte.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  const jma = texte.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (jma) {
    // Au-delà de 12, le premier nombre ne peut être qu'un jour.
    const a = Number(jma[1])
    const b = Number(jma[2])
    const [jour, mois] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b]
    return `${jma[3]}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
  }
  return null
}

const ALIAS: Record<string, string[]> = {
  date: ['date', 'date de transaction', 'transaction date', 'date d’opération', "date d'operation"],
  description: ['description', 'libellé', 'libelle', 'détail', 'detail', 'narration', 'payee'],
  montant: ['montant', 'amount', 'valeur'],
  debit: ['débit', 'debit', 'retrait', 'withdrawal', 'sortie'],
  credit: ['crédit', 'credit', 'dépôt', 'depot', 'deposit', 'entrée'],
  solde: ['solde', 'balance'],
}

export type Correspondance = {
  date: number
  description: number
  montant: number
  debit: number
  credit: number
  solde: number
}

/** Devine la correspondance des colonnes à partir des en-têtes. -1 = absente. */
export function deviner(entetes: string[]): Correspondance {
  const normalise = (t: string) =>
    t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
  const trouver = (cle: string) =>
    entetes.findIndex((e) => {
      const n = normalise(e)
      return ALIAS[cle].some((a) => n === normalise(a) || n.includes(normalise(a)))
    })

  return {
    date: trouver('date'),
    description: trouver('description'),
    montant: trouver('montant'),
    debit: trouver('debit'),
    credit: trouver('credit'),
    solde: trouver('solde'),
  }
}

export type LigneReleve = {
  date: string
  description: string
  montant: number
  solde: number | null
}

/**
 * Applique la correspondance. Un relevé donne soit une colonne « montant »
 * signée, soit deux colonnes débit/crédit : les deux formes sont acceptées.
 */
export function convertir(
  tableau: TableauCsv,
  correspondance: Correspondance,
): { lignes: LigneReleve[]; rejets: number } {
  const lignes: LigneReleve[] = []
  let rejets = 0

  for (const brute of tableau.lignes) {
    const date = dateDepuisTexte(brute[correspondance.date] ?? '')
    const description = (brute[correspondance.description] ?? '').trim()

    let montant: number | null = null
    if (correspondance.montant >= 0) {
      montant = nombreDepuisTexte(brute[correspondance.montant] ?? '')
    } else {
      const debit = correspondance.debit >= 0
        ? nombreDepuisTexte(brute[correspondance.debit] ?? '')
        : null
      const credit = correspondance.credit >= 0
        ? nombreDepuisTexte(brute[correspondance.credit] ?? '')
        : null
      if (debit) montant = -Math.abs(debit)
      else if (credit) montant = Math.abs(credit)
    }

    if (!date || !description || montant === null || montant === 0) {
      rejets++
      continue
    }
    lignes.push({
      date,
      description,
      montant,
      solde: correspondance.solde >= 0 ? nombreDepuisTexte(brute[correspondance.solde] ?? '') : null,
    })
  }
  return { lignes, rejets }
}
