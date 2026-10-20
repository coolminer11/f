import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { exigerSession } from '@/lib/auth'
import { ETAPES, lireCommande, rangEtape, type Commande } from '@/lib/commandes'
import { catalogue } from '@/lib/catalogue'
import { listerClients } from '@/lib/requetes/ventes'
import { lienRecu } from '@/lib/stockage'
import { argent } from '@/lib/format'
import OngletsVentes from '@/components/onglets-ventes'
import FormulaireCommande from '@/components/formulaire-commande'
import BoutonEnvoi from '@/components/bouton-envoi'
import {
  annulerAction,
  devisAction,
  etapeAction,
  facturerAction,
  fichierAction,
  modifierCommandeAction,
  poserAction,
  recevoirAction,
} from '@/app/commandes/actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Commande — Tapora' }

const LIEUX: Record<string, string> = {
  QC: 'Québec', ON: 'Ontario', NB: 'Nouveau-Brunswick', NS: 'Nouvelle-Écosse', PE: 'Île-du-Prince-Édouard', NL: 'Terre-Neuve-et-Labrador',
  MB: 'Manitoba', SK: 'Saskatchewan', AB: 'Alberta', BC: 'Colombie-Britannique', YT: 'Yukon', NT: 'Territoires du Nord-Ouest', NU: 'Nunavut', INTL: 'Hors Canada',
}
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', timeZone: 'America/Toronto' })
const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date())

/** Une commande Entreprise : ses sept étapes, chacune avec son bouton, et tout ce qu'il faut savoir à droite. */
export default async function PageCommande({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ message?: string; erreur?: string }> }) {
  const moi = await exigerSession()
  const { id } = await params
  const sp = await searchParams
  const [c, cartes, clients] = await Promise.all([lireCommande(id), catalogue(), listerClients()])
  if (!c) notFound()
  const ecriture = moi.role !== 'lecture' && !c.annulee_le
  const rang = rangEtape(c.etape)
  const marge = c.cout_cartes !== null ? Math.round((c.total - c.cout_cartes) * 100) / 100 : null
  const entreprise = cartes.filter((x) => x.personnalisable).map((x) => ({ id: x.id, nom: x.nom, prix: x.prix, min: x.quantite_min, langue: x.langue }))

  return (
    <div className="space-y-5">
      <OngletsVentes actif="/commandes" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/commandes" className="text-xs text-[var(--color-encre-doux)] hover:underline">← Commandes</Link>
          <h1 className="mt-1 font-[family-name:var(--police-fraunces)] text-2xl font-semibold tracking-tight">
            {c.numero} · {c.client_nom}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            {c.quantite} × {c.produit_nom} · {argent(c.total)} avant taxes · créée le {date(c.cree_le)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.annulee_le ? 'bg-[var(--color-fond)] text-[var(--color-encre-doux)]' : c.etape === 'facturee' ? 'bg-[#e9f2ea] text-[var(--color-positif)]' : 'bg-[var(--color-accent-doux)] text-[var(--color-accent)]'}`}>
          {c.annulee_le ? 'Annulée' : `Étape ${rang + 1} sur 7 · ${ETAPES[rang][1]}`}
        </span>
      </div>

      {sp.erreur && <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">{sp.erreur}</p>}
      {sp.message && <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">{sp.message}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <section className="carte p-5">
          <h2 className="text-sm font-semibold">Les étapes</h2>
          <ol className="mt-4">
            {ETAPES.map(([code, libelle, aide], i) => {
              const fait = c.etapes.find((e) => e.etape === code)
              const actuelle = i === rang + 1 || (i === 0 && !fait)
              return (
                <li key={code} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < ETAPES.length - 1 && <span className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 ${fait ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-ligne)]'}`} aria-hidden />}
                  <span
                    className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      fait ? 'bg-[var(--color-accent)] text-white' : actuelle ? 'border-2 border-[var(--color-accent)] bg-[var(--color-carte,white)] text-[var(--color-accent)]' : 'border border-[var(--color-ligne)] text-[var(--color-encre-doux)]'
                    }`}
                    aria-hidden
                  >
                    {fait ? '✓' : i + 1}
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="font-semibold">{libelle}</p>
                    <p className="text-xs text-[var(--color-encre-doux)]">
                      {fait ? `Fait le ${date(fait.fait_le)}${fait.par ? ` par ${fait.par.split(' ')[0]}` : ''}${fait.note ? ` · ${fait.note}` : ''}` : aide}
                    </p>
                    <div className="mt-2">
                      <Action code={code} c={c} ecriture={ecriture} fait={!!fait} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <aside className="space-y-4">
          <section className="carte p-5 text-sm">
            <h2 className="text-sm font-semibold">Résumé</h2>
            <dl className="mt-3 space-y-1.5">
              <Ligne libelle="Carte" valeur={c.produit_nom} />
              <Ligne libelle="Langue" valeur={c.langue === 'fr_en' ? 'Français d’abord' : 'Anglais d’abord'} />
              <Ligne libelle="Posées au/en" valeur={LIEUX[c.lieu] ?? c.lieu} />
              <Ligne libelle="Cartes" valeur={`${c.quantite} × ${argent(c.prix_unitaire)}`} />
              <Ligne libelle="Total (avant taxes)" valeur={argent(c.total)} fort />
              {c.cout_cartes !== null && <Ligne libelle="Coût des cartes" valeur={`− ${argent(c.cout_cartes)}`} />}
              {marge !== null && <Ligne libelle="Marge" valeur={argent(marge)} fort />}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-ligne)] pt-3 text-xs">
              {c.devis_id && <Link href={`/ventes/${c.devis_id}`} className="bouton bouton-secondaire py-1 text-xs">Devis {c.devis_numero} ↗</Link>}
              {c.facture_id && <Link href={`/ventes/${c.facture_id}`} className="bouton bouton-secondaire py-1 text-xs">Facture {c.facture_numero} ↗</Link>}
              {c.dossier_id && <Link href={`/cartes/dossiers/${c.dossier_id}`} className="bouton bouton-secondaire py-1 text-xs">Dossier du client ↗</Link>}
            </div>
          </section>

          <section className="carte p-5 text-sm">
            <h2 className="text-sm font-semibold">Personnalisation</h2>
            <dl className="mt-3 space-y-1.5">
              <Ligne libelle="Destination" valeur={c.destination ? c.destination.replace(/^https?:\/\//, '').slice(0, 40) : '— à indiquer'} />
              <Ligne libelle="Texte FR" valeur={c.texte_fr ?? '—'} />
              <Ligne libelle="Texte EN" valeur={c.texte_en ?? '—'} />
              <Ligne libelle="Couleurs" valeur={c.couleurs ?? '—'} />
              <Ligne libelle="Noms des cartes" valeur={c.noms_cartes ? `${c.noms_cartes.split('\n').filter((l) => l.trim()).length} noms` : `Carte 1 à ${c.quantite}`} />
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-ligne)] pt-3">
              {c.logo_url ? (
                <a href={lienRecu(c.logo_url)!} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[var(--color-accent)] hover:underline">Logo du client ↗</a>
              ) : (
                <span className="text-xs text-[var(--color-encre-doux)]">Pas encore de logo.</span>
              )}
              {ecriture && (
                <form action={fichierAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="quoi" value="logo" />
                  <input name="fichier" type="file" accept="image/*,application/pdf,.ai,.eps,.svg" required className="block w-40 text-xs file:mr-2 file:rounded-full file:border-0 file:bg-[var(--color-fond)] file:px-2 file:py-1 file:text-xs" />
                  <button className="bouton bouton-secondaire py-1 text-xs">Joindre</button>
                </form>
              )}
            </div>
          </section>

          {ecriture && (
            <details className="carte p-5">
              <summary className="cursor-pointer text-sm font-semibold">Modifier la commande</summary>
              <div className="mt-4">
                <FormulaireCommande
                  action={modifierCommandeAction}
                  modeles={entreprise}
                  clients={clients.map((x) => x.nom)}
                  valeurs={{ ...c }}
                  libelle="Enregistrer"
                />
              </div>
            </details>
          )}
          {moi.role !== 'lecture' && (
            <form action={annulerAction} className="text-right">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="annuler" value={c.annulee_le ? '0' : '1'} />
              <button className="text-xs text-[var(--color-encre-doux)] hover:text-[var(--color-negatif)] hover:underline">{c.annulee_le ? 'Rétablir la commande' : 'Annuler la commande'}</button>
            </form>
          )}
        </aside>
      </div>
    </div>
  )
}

/** Le bouton (ou le petit formulaire) de chaque étape. */
function Action({ code, c, ecriture, fait }: { code: string; c: Commande; ecriture: boolean; fait: boolean }) {
  const cache = (nom: string, valeur: string) => <input type="hidden" name={nom} value={valeur} />
  switch (code) {
    case 'demande':
      return c.devis_id ? (
        <Link href={`/ventes/${c.devis_id}`} className="text-xs font-semibold text-[var(--color-accent)] hover:underline">Devis {c.devis_numero} ↗</Link>
      ) : ecriture ? (
        <form action={devisAction}>
          {cache('id', c.id)}
          <BoutonEnvoi className="py-1.5 text-sm" attente="Création…">Créer le devis</BoutonEnvoi>
        </form>
      ) : null
    case 'maquette':
      return (
        <div className="flex flex-wrap items-center gap-2">
          {c.maquette_url && <a href={lienRecu(c.maquette_url)!} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[var(--color-accent)] hover:underline">Voir la maquette ↗</a>}
          {ecriture && (
            <form action={fichierAction} className="flex flex-wrap items-center gap-2">
              {cache('id', c.id)}
              {cache('quoi', 'maquette')}
              <input name="fichier" type="file" accept="application/pdf,image/*" required className="block w-48 text-xs file:mr-2 file:rounded-full file:border-0 file:bg-[var(--color-fond)] file:px-2 file:py-1 file:text-xs" />
              <button className="bouton bouton-secondaire py-1 text-xs">{c.maquette_url ? 'Remplacer' : 'Joindre la maquette'}</button>
            </form>
          )}
        </div>
      )
    case 'approuvee':
    case 'commandee':
      return ecriture && !fait ? (
        <form action={etapeAction} className="flex flex-wrap items-center gap-2">
          {cache('id', c.id)}
          {cache('etape', code)}
          {code === 'commandee' && <input name="note" maxLength={500} placeholder="Fournisseur, délai…" className="champ w-56 py-1.5 text-sm" />}
          <button className="bouton py-1.5 text-sm">{code === 'approuvee' ? 'Le client a approuvé' : 'C’est commandé'}</button>
        </form>
      ) : null
    case 'recue':
      return c.reception_id ? (
        <Link href="/cartes/stock" className="text-xs font-semibold text-[var(--color-accent)] hover:underline">
          {c.quantite} cartes au stock · {argent(c.cout_cartes ?? 0)} ↗
        </Link>
      ) : ecriture ? (
        <form action={recevoirAction} className="flex flex-wrap items-end gap-2">
          {cache('id', c.id)}
          <label className="flex flex-col text-xs text-[var(--color-encre-doux)]">
            Payé au fournisseur
            <input name="total" inputMode="decimal" required placeholder="120,00" className="champ mt-0.5 py-1.5 text-right" style={{ width: '7.5rem' }} />
          </label>
          <label className="flex flex-col text-xs text-[var(--color-encre-doux)]">
            Reçues le
            <input name="date" type="date" defaultValue={aujourdhui()} max={aujourdhui()} className="champ mt-0.5 py-1.5" />
          </label>
          <button className="bouton py-1.5 text-sm">Cartes reçues</button>
        </form>
      ) : null
    case 'posee':
      return c.dossier_id && fait ? (
        <Link href={`/cartes/dossiers/${c.dossier_id}`} className="text-xs font-semibold text-[var(--color-accent)] hover:underline">Les cartes dans le dossier du client ↗</Link>
      ) : ecriture ? (
        <form action={poserAction}>
          {cache('id', c.id)}
          <BoutonEnvoi className="py-1.5 text-sm" attente="Création…">Créer les {c.quantite} cartes NFC</BoutonEnvoi>
          <p className="mt-1 text-xs text-[var(--color-encre-doux)]">Elles mènent à la destination indiquée ; le dossier du client est créé s’il n’existe pas.</p>
        </form>
      ) : null
    case 'facturee':
      return c.facture_id ? (
        <Link href={`/ventes/${c.facture_id}`} className="text-xs font-semibold text-[var(--color-accent)] hover:underline">Facture {c.facture_numero} ↗</Link>
      ) : ecriture ? (
        <form action={facturerAction}>
          {cache('id', c.id)}
          <BoutonEnvoi className="py-1.5 text-sm" attente="Facturation…">{c.devis_id ? `Facturer (depuis le devis ${c.devis_numero})` : 'Facturer'}</BoutonEnvoi>
        </form>
      ) : null
    default:
      return null
  }
}

function Ligne({ libelle, valeur, fort = false }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${fort ? 'font-semibold' : ''}`}>
      <dt className={fort ? '' : 'text-[var(--color-encre-doux)]'}>{libelle}</dt>
      <dd className="min-w-0 truncate text-right tabular-nums">{valeur}</dd>
    </div>
  )
}
