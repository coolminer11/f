import type { Metadata } from 'next'
import Link from 'next/link'
import { exigerSession } from '@/lib/auth'
import { catalogue, MODELES, type CarteCatalogue } from '@/lib/catalogue'
import { argent } from '@/lib/format'
import OngletsVentes from '@/components/onglets-ventes'
import { carteAction } from '@/app/commandes/actions'
import { VISUELS, type Visuel } from '@/lib/visuels'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Catalogue — Tapora' }

const virgule = (v: number) => v.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, '')

/**
 * Les quatre cartes, en deux familles : à l'unité (prêtes à poser, avec leur
 * visuel à télécharger) et Entreprise (sur mesure : leur visuel est la
 * maquette de chaque client). Prix, minimum et seuil d'alerte se changent ici.
 */
export default async function PageCatalogue({ searchParams }: { searchParams: Promise<{ message?: string; erreur?: string }> }) {
  const moi = await exigerSession()
  const sp = await searchParams
  const ecriture = moi.role !== 'lecture'
  const cartes = await catalogue()
  const unite = cartes.filter((c) => !c.personnalisable)
  const entreprise = cartes.filter((c) => c.personnalisable)

  return (
    <div className="space-y-6">
      <OngletsVentes actif="/commandes/catalogue" />
      <div>
        <h1 className="font-[family-name:var(--police-fraunces)] text-2xl font-semibold tracking-tight">Catalogue</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          Deux familles : à l’unité (prêtes à poser) et Entreprise (sur mesure). Le prix et le minimum s’appliquent tout seuls aux nouveaux devis,
          factures et commandes.
        </p>
      </div>

      {sp.erreur && <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">{sp.erreur}</p>}
      {sp.message && <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">{sp.message}</p>}

      <section aria-labelledby="unite" className="space-y-3">
        <div>
          <h2 id="unite" className="text-sm font-semibold">À l’unité</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
            Prêtes à poser, sans personnalisation. Une version par marché, pour respecter la Charte de la langue française au Québec.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {unite.map((c) => (
            <Fiche key={c.id} c={c} ecriture={ecriture} visuel={c.modele === 'quebec' || c.modele === 'hors_quebec' ? VISUELS[c.modele] : undefined} />
          ))}
        </div>
      </section>

      <section aria-labelledby="entreprise" className="space-y-3">
        <div>
          <h2 id="entreprise" className="text-sm font-semibold">Entreprise</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
            Design sur mesure (logo, couleurs, texte, nom de chaque carte), 25 au minimum. Elles se vendent par une{' '}
            <Link href="/commandes" className="font-medium text-[var(--color-accent)] hover:underline">
              commande
            </Link>
            ; leur visuel est la maquette faite pour chaque client.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {entreprise.map((c) => (
            <Fiche key={c.id} c={c} ecriture={ecriture} />
          ))}
        </div>
      </section>
      <p className="text-xs text-[var(--color-encre-doux)]">Les cartes à l’unité se vendent par un reçu ou une facture ordinaire.</p>
    </div>
  )
}

function Fiche({ c, ecriture, visuel }: { c: CarteCatalogue; ecriture: boolean; visuel?: Visuel }) {
  const m = MODELES[c.modele]
  return (
    <section className="carte flex flex-col overflow-hidden">
      {visuel && (
        <a href={visuel.fichier} target="_blank" rel="noreferrer" className="visuel-carte block bg-[var(--color-fond)] p-5" title="Ouvrir en grand">
          <img
            src={visuel.apercu}
            alt={visuel.titre}
            width={720}
            height={720}
            loading="lazy"
            className="mx-auto aspect-square w-full max-w-[18rem] rounded-2xl object-cover shadow-[0_20px_40px_-24px_rgb(60_40_20/0.6)]"
          />
        </a>
      )}
      <div className="border-b border-[var(--color-ligne)] bg-[linear-gradient(110deg,var(--color-accent-doux),transparent_75%)] p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-[family-name:var(--police-fraunces)] text-xl font-semibold leading-tight">{c.nom}</h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${c.personnalisable ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-fond)] text-[var(--color-encre-doux)]'}`}
          >
            {c.personnalisable ? 'Sur mesure' : 'Prête à poser'}
          </span>
        </div>
        <p className="mt-2 font-[family-name:var(--police-fraunces)] text-4xl font-semibold tabular-nums">
          {argent(c.prix)}
          <span className="ml-1 text-sm font-medium text-[var(--color-encre-doux)]">la carte</span>
        </p>
        <p className="mt-1 text-sm text-[var(--color-encre-doux)]">{c.quantite_min > 1 ? `${c.quantite_min} cartes au minimum par commande` : 'À l’unité, sans minimum'}</p>
        {visuel && (
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={visuel.fichier} download={visuel.nomFichier} className="bouton py-1.5 text-sm">
              ↓ Télécharger l’image
            </a>
            <a href={visuel.fichier} target="_blank" rel="noreferrer" className="bouton bouton-secondaire py-1.5 text-sm">
              Ouvrir en grand ↗
            </a>
          </div>
        )}
      </div>
      <dl className="flex-1 space-y-2 p-5 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-encre-doux)]">Langue</dt>
          <dd className="mt-0.5">{m.langue}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--color-encre-doux)]">Pour qui</dt>
          <dd className="mt-0.5 leading-relaxed">{m.pour}</dd>
        </div>
        {c.langue === 'en_fr' && (
          <p className="rounded-lg bg-[#fdf3dc] px-3 py-2 text-xs text-[#6b4a05]">
            Jamais pour un commerce au Québec : la Charte de la langue française y exige un français nettement prédominant.
            {c.personnalisable ? ' L’app le refuse toute seule.' : ' Au Québec, prenez la carte à l’unité — Québec.'}
          </p>
        )}
        <div className="flex justify-between gap-3 border-t border-[var(--color-ligne)] pt-2">
          <dt className="text-[var(--color-encre-doux)]">En stock</dt>
          <dd className="tabular-nums">
            <Link href={`/cartes/stock?modele=${c.id}`} className="font-semibold hover:text-[var(--color-accent)]">
              {c.stock} carte{Math.abs(c.stock) > 1 ? 's' : ''}
            </Link>
            {c.cout_moyen > 0 && <span className="text-[var(--color-encre-doux)]"> · coût {argent(c.cout_moyen)}</span>}
          </dd>
        </div>
        {c.cout_moyen > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-encre-doux)]">Marge par carte</dt>
            <dd className="tabular-nums font-semibold">{argent(Math.round((c.prix - c.cout_moyen) * 100) / 100)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--color-encre-doux)]">Vendues (90 jours)</dt>
          <dd className="tabular-nums">{c.vendues_90j}</dd>
        </div>
      </dl>
      {ecriture && (
        <details className="border-t border-[var(--color-ligne)] px-5 py-3">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]">Modifier le prix, le minimum, l’alerte</summary>
          <form action={carteAction} className="mt-3 grid grid-cols-3 gap-2">
            <input type="hidden" name="id" value={c.id} />
            <label className="flex flex-col text-xs text-[var(--color-encre-doux)]">
              Prix
              <input name="prix" inputMode="decimal" defaultValue={virgule(c.prix)} className="champ mt-0.5 py-1.5 text-right" />
            </label>
            <label className="flex flex-col text-xs text-[var(--color-encre-doux)]">
              Minimum
              <input name="quantite_min" inputMode="numeric" defaultValue={c.quantite_min} className="champ mt-0.5 py-1.5 text-right" />
            </label>
            <label className="flex flex-col text-xs text-[var(--color-encre-doux)]">
              Alerte sous
              <input name="seuil" inputMode="numeric" defaultValue={c.seuil_stock ?? ''} placeholder="—" className="champ mt-0.5 py-1.5 text-right" />
            </label>
            <button className="bouton col-span-3 py-1.5 text-sm">Enregistrer</button>
          </form>
        </details>
      )}
    </section>
  )
}
