import Link from 'next/link'
import Logo from '@/components/client/logo'
import { drapeau, LANGUES, nomLangue, sens, texte } from '@/lib/services/langues'
import { urlFichier } from '@/lib/services/fichiers'
import { dictionnaire, ui, formaterPrix } from '@/lib/services/ui'
import { variablesCouleur } from '@/lib/services/client'
import type { Annonce, Emplacement, Etablissement } from '@/lib/services/types'
import Inclinaison from '@/components/effets/inclinaison'
import { FournisseurLieu } from './contexte'
import { domaine, httpsSeulement, numeroTel } from './outils'
import { Memoire, SelecteurLangue, SuggestionLangue, type LangueOfferte } from './langue'

/**
 * Le cadre de toutes les pages des clients : les couleurs de l'établissement
 * (lisibles en clair comme en sombre), la langue et le sens de lecture, le
 * calque des feuilles, et « Propulsé par Tapora ».
 */
export function Cadre({
  etab,
  code,
  langue,
  memoriserLangue,
  vu,
  children,
}: {
  etab: Etablissement
  code: string
  langue: string
  /** La langue est arrivée par ?l= : le navigateur la retient. */
  memoriserLangue?: string | null
  /** Ce qui vient d'être compté (« o », « m-… ») : pas de doublon dans la demi-heure. */
  vu?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="theme-services" lang={langue} dir={sens(langue)} style={variablesCouleur(etab.couleur) as React.CSSProperties}>
      <FournisseurLieu code={code} langue={langue} t={dictionnaire(langue)}>
        <div className="sv-racine">
          {children}
          <Pied langue={langue} />
        </div>
        <div id="sv-calques" />
        <Memoire code={code} langue={memoriserLangue} vu={vu} />
      </FournisseurLieu>
    </div>
  )
}

export function languesOffertes(etab: Etablissement): LangueOfferte[] {
  const offertes = LANGUES.filter((l) => etab.langues.includes(l.code))
  // La langue par défaut en premier (le français, au Québec).
  return [...offertes].sort((a, b) => Number(b.code === etab.langue_defaut) - Number(a.code === etab.langue_defaut)).map((l) => ({ code: l.code, nom: l.nom, drapeau: l.drapeau }))
}

function Pied({ langue }: { langue: string }) {
  return (
    <footer className="sv-pied">
      <a href="https://taporacards.com" target="_blank" rel="noopener noreferrer">
        <Logo className="size-4" />
        <span>
          {ui(langue, 'propulse')} <strong>Tapora</strong>
        </span>
      </a>
    </footer>
  )
}

/** Le grand en-tête de l'accueil : couverture, logo, langue, l'endroit où l'on est, le nom, le mot d'accueil. */
export function EnTete({ etab, emplacement, code, langue }: { etab: Etablissement; emplacement: Emplacement; code: string; langue: string }) {
  const couverture = urlFichier(etab.couverture)
  const logo = urlFichier(etab.logo)
  const accueil = texte(etab.accueil, langue, etab.langue_defaut) || ui(langue, etab.type === 'hotel' ? 'accueilHotel' : 'accueilRestaurant')
  return (
    <header className={`sv-hero fond-maillage ${couverture ? 'sv-hero-image-ok' : 'sv-hero-sans-image'}`}>
      {couverture && <img className="sv-hero-image" src={couverture} alt="" fetchPriority="high" decoding="async" />}
      <div className="sv-colonne sv-hero-contenu">
        <div className="sv-barre">
          <div className="sv-logo" aria-hidden={!logo}>
            {logo ? <img src={logo} alt={etab.nom} decoding="async" /> : <span>{etab.nom.trim().charAt(0).toUpperCase()}</span>}
          </div>
          <SelecteurLangue code={code} langue={langue} langues={languesOffertes(etab)} titre={ui(langue, 'changerLangue')} fermer={ui(langue, 'fermer')} />
        </div>
        <div className="sv-hero-texte sv-entre">
          <p className="sv-lieu">
            <span className="sv-lieu-point" aria-hidden />
            <span className="sr-only">{ui(langue, 'vousEtesA')} </span>
            {emplacement.libelle}
          </p>
          <h1 className="sv-titre mt-3">{etab.nom}</h1>
          <p className="sv-accueil mt-2">{accueil}</p>
        </div>
      </div>
    </header>
  )
}

/** La barre des pages intérieures (menu, concierge, demandes) : retour, titre, langue. Collante. */
export function BarreHaut({ etab, code, langue, titre, retour }: { etab: Etablissement; code: string; langue: string; titre: string; retour: string }) {
  return (
    <div className="sv-barre-haut">
      <Link href={retour} prefetch={false} className="sv-rond-bouton" aria-label={ui(langue, 'retour')}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="sv-fleche-retour" aria-hidden>
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--sv-doux)]">{etab.nom}</p>
        <p className="truncate text-[1.02rem] font-bold tracking-tight">{titre}</p>
      </div>
      <SelecteurLangue code={code} langue={langue} langues={languesOffertes(etab)} titre={ui(langue, 'changerLangue')} fermer={ui(langue, 'fermer')} />
      {languesOffertes(etab).length < 2 && <span className="w-11" aria-hidden />}
    </div>
  )
}

/** La suggestion de langue, si le téléphone parle une langue offerte qui n'est pas affichée et qu'aucun choix n'a été fait. */
export function Suggestion({ code, langue, cible }: { code: string; langue: string; cible: string | null }) {
  if (!cible) return null
  return <SuggestionLangue code={code} langue={langue} cible={cible} drapeau={drapeau(cible)} texte={ui(cible, 'lireEn', { langue: nomLangue(cible) })} fermer={ui(langue, 'fermer')} />
}

const ICONE_ANNONCE: Record<Annonce['type'], string> = { plat_du_jour: '🍽️', promo: '🏷️', info: '💬', evenement: '🎉' }
const CLE_ANNONCE = { plat_du_jour: 'platDuJour', promo: 'promo', info: 'info', evenement: 'evenement' } as const

/** Le plat du jour, les promotions, les événements : la première en couleur, les autres en blanc. */
export function Annonces({ annonces, etab, langue }: { annonces: Annonce[]; etab: Etablissement; langue: string }) {
  const visibles = annonces
    .map((a) => ({ ...a, t: texte(a.titre, langue, etab.langue_defaut), x: texte(a.texte, langue, etab.langue_defaut) }))
    .filter((a) => a.t || a.x)
  if (!visibles.length) return null
  return (
    <section className="space-y-3" aria-label={ui(langue, 'platDuJour')}>
      {visibles.map((a, i) => {
        const carte = (
          <article className={`sv-annonce ${i === 0 ? 'reflet-premium' : 'sv-annonce-douce'}`}>
            <div className="relative z-[2] flex items-start gap-3">
              <span className="sv-annonce-icone" aria-hidden>
                {ICONE_ANNONCE[a.type]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="sv-annonce-type">{ui(langue, CLE_ANNONCE[a.type])}</p>
                {a.t && <h2 className="sv-annonce-titre">{a.t}</h2>}
                {a.x && <p className="sv-annonce-texte">{a.x}</p>}
              </div>
              {a.prix != null && etab.options.prix && <p className="sv-annonce-prix">{formaterPrix(a.prix, etab.devise, langue)}</p>}
            </div>
          </article>
        )
        return (
          <div key={a.id} className={`sv-entre sv-entre-${Math.min(i + 1, 4)}`}>
            {i === 0 ? (
              <Inclinaison className="sv-annonce-cadre" intensite={5}>
                {carte}
              </Inclinaison>
            ) : (
              carte
            )}
          </div>
        )
      })}
    </section>
  )
}

/** Où nous trouver : l'adresse (vers la carte), le téléphone, le site — en bas de l'accueil et du concierge. */
export function Coordonnees({ etab }: { etab: Etablissement }) {
  const tel = numeroTel(etab.telephone)
  const site = httpsSeulement(etab.site_web)
  if (!etab.adresse && !tel && !site) return null
  return (
    <address className="sv-coordonnees not-italic">
      {etab.adresse && (
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(etab.adresse)}`} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <span>{etab.adresse}</span>
        </a>
      )}
      {tel && etab.telephone && (
        <a href={`tel:${tel}`}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.6A1.5 1.5 0 0 1 5 4z" />
          </svg>
          <span dir="ltr">{etab.telephone}</span>
        </a>
      )}
      {site && (
        <a href={site} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
          </svg>
          <span dir="ltr">{domaine(site)}</span>
        </a>
      )}
    </address>
  )
}
