'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Compteur from '@/components/effets/compteur'
import { vibrer } from '@/components/effets/desintegration'
import { toast } from '@/components/effets/toasts'
import { useLieu } from './contexte'
import Feuille from './feuille'
import { SuiviEnCours } from './demande'
import { BarrePanier, FeuillePanier, Quantite, useFormatPrix, usePanier } from './panier'
import { balise, eclat, mouvementReduit, rebond, remplir, sansAccents } from './outils'

export type PlatVivant = {
  id: string
  nom: string
  description: string
  /** Le prix affiché (déjà formaté), ou « à partir de » le plus petit format. */
  prix: string | null
  prixNombre: number | null
  /** Le prix du plat lui-même (sans format) : celui que retient le serveur quand un format n'a pas de prix. */
  prixBase: number | null
  aPartirDe: boolean
  variantes: { nom: string; prix: string | null; prixNombre: number | null }[]
  photo: string | null
  allergenes: string[]
  etiquettes: string[]
  disponible: boolean
}
export type SectionVivante = { id: string; nom: string; description: string; plats: PlatVivant[] }
export type ChoixMenu = { id: string; nom: string; enService: boolean; href: string }
export type Nommes = Record<string, { nom: string; icone: string }>
/**
 * Les commandes (option de l'établissement) : `ici`, ce menu se commande en ce
 * moment (servi maintenant ; à l'hôtel, le service aux chambres). Sinon, le
 * panier reste visible mais la fiche n'a pas de bouton « Ajouter ».
 */
export type CommandeMenu = { ici: boolean; hotel: boolean; merci: string | null }

const CLE_ALLERGIES = 'tapora_allergies'

/**
 * Le menu vivant : les onglets des sections restent en haut et suivent la
 * lecture, la recherche trouve « creme brulee » dans « Crème brûlée », les
 * filtres (végé, sans gluten…) et les allergies (retenues sur ce téléphone,
 * pour tous les établissements Tapora) masquent ce qui ne convient pas ; un
 * plat s'ouvre en grand, photo, formats et allergènes.
 */
export default function MenuVivant({
  barre,
  menu,
  choix,
  sections,
  options,
  etiquettes,
  allergenes,
  monnaie,
  appel,
  commande,
}: {
  barre: React.ReactNode
  menu: { id: string; nom: string; description: string; enService: boolean; horaire: string | null; pdf: string | null }
  choix: ChoixMenu[]
  sections: SectionVivante[]
  options: { recherche: boolean; allergenes: boolean; photos: boolean; prix: boolean }
  etiquettes: Nommes
  allergenes: Nommes
  /** Pour faire rouler le prix sur la fiche du plat. */
  monnaie: { locale: string; devise: string }
  /** Service aux chambres : appeler pour commander. */
  appel?: { tel: string } | null
  /** Commander depuis le menu (null : l'option est coupée). */
  commande?: CommandeMenu | null
}) {
  const { code, langue, t } = useLieu()
  const panier = usePanier(code)
  const [feuillePanier, setFeuillePanier] = useState(false)
  const formatTotal = useFormatPrix(monnaie)
  const commandable = Boolean(commande?.ici)
  const [recherche, setRecherche] = useState('')
  const [filtres, setFiltres] = useState<string[]>([])
  const [exclus, setExclus] = useState<string[]>([])
  const [feuilleAllergies, setFeuilleAllergies] = useState(false)
  const [plat, setPlat] = useState<PlatVivant | null>(null)
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null)
  const onglets = useRef<HTMLDivElement>(null)
  const clic = useRef(0)
  // Un autre menu : on repart de sa première section.
  useEffect(() => setActive(sections[0]?.id ?? null), [menu.id, sections])

  // Les allergies déclarées une fois restent : on ne redemande pas à chaque restaurant.
  useEffect(() => {
    if (!options.allergenes) return
    try {
      const l = JSON.parse(localStorage.getItem(CLE_ALLERGIES) ?? '[]')
      if (Array.isArray(l)) setExclus(l.filter((x) => typeof x === 'string' && x in allergenes))
    } catch {
      // Rien de retenu.
    }
  }, [options.allergenes, allergenes])
  const changerExclus = (l: string[]) => {
    setExclus(l)
    try {
      localStorage.setItem(CLE_ALLERGIES, JSON.stringify(l))
    } catch {
      // Stockage bloqué : le filtre vaut pour cette page.
    }
  }

  const etiquettesPresentes = useMemo(() => {
    const vues = new Set(sections.flatMap((s) => s.plats.flatMap((p) => p.etiquettes)))
    return Object.keys(etiquettes).filter((c) => vues.has(c))
  }, [sections, etiquettes])

  const q = sansAccents(recherche.trim())
  const filtrees = useMemo(
    () =>
      sections
        .map((s) => ({
          ...s,
          plats: s.plats.filter(
            (p) =>
              (!q || sansAccents(`${p.nom} ${p.description}`).includes(q)) &&
              filtres.every((f) => p.etiquettes.includes(f)) &&
              !exclus.some((a) => p.allergenes.includes(a)),
          ),
        }))
        .filter((s) => s.plats.length > 0),
    [sections, q, filtres, exclus],
  )
  const total = filtrees.reduce((n, s) => n + s.plats.length, 0)
  const filtre = Boolean(q || filtres.length || exclus.length)

  // Les onglets suivent la lecture.
  useEffect(() => {
    const ids = filtrees.map((s) => s.id)
    if (!ids.length) return
    let attente = 0
    // La section courante : la dernière dont le titre est passé sous la barre (ou la dernière, tout en bas).
    const calculer = () => {
      attente = 0
      if (Date.now() - clic.current < 900) return
      const enBas = window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      let courante = ids[0]
      for (const id of ids) {
        const el = document.getElementById(`section-${id}`)
        if (el && el.getBoundingClientRect().top <= 150) courante = id
      }
      setActive(enBas ? ids[ids.length - 1] : courante)
    }
    const defiler = () => {
      if (!attente) attente = requestAnimationFrame(calculer)
    }
    window.addEventListener('scroll', defiler, { passive: true })
    calculer()
    return () => {
      window.removeEventListener('scroll', defiler)
      cancelAnimationFrame(attente)
    }
  }, [filtrees])

  // L'onglet actif reste visible dans la barre (en LTR comme en RTL).
  useEffect(() => {
    const barreOnglets = onglets.current
    const onglet = barreOnglets?.querySelector<HTMLElement>(`[data-section="${active}"]`)
    if (!barreOnglets || !onglet) return
    const a = onglet.getBoundingClientRect()
    const b = barreOnglets.getBoundingClientRect()
    barreOnglets.scrollBy({ left: a.left + a.width / 2 - (b.left + b.width / 2), behavior: mouvementReduit() ? 'auto' : 'smooth' })
  }, [active])

  const allerA = (id: string) => {
    clic.current = Date.now()
    setActive(id)
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: mouvementReduit() ? 'auto' : 'smooth', block: 'start' })
  }

  const ouvrir = useCallback(
    (p: PlatVivant) => {
      setPlat(p)
      balise(code, 'plat', p.id, langue)
    },
    [code, langue],
  )

  const formatPrix = useMemo(() => {
    const decimales = plat?.prixNombre != null && !Number.isInteger(plat.prixNombre) ? 2 : 0
    return (v: number) => {
      try {
        return new Intl.NumberFormat(monnaie.locale, { style: 'currency', currency: monnaie.devise || 'CAD', minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v)
      } catch {
        return `${v.toFixed(decimales)} $`
      }
    }
  }, [plat, monnaie])

  return (
    <>
      <div className="sv-collant sv-verre-bas">
        {barre}
        {filtrees.length > 1 && (
          <nav ref={onglets} className="sv-onglets" aria-label={menu.nom}>
            {filtrees.map((s) => (
              <button key={s.id} type="button" className="sv-onglet" data-section={s.id} aria-current={active === s.id} onClick={() => allerA(s.id)}>
                {s.nom}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="sv-colonne pt-5">
        {choix.length > 1 && (
          <div className="sv-choix-menus -mx-4 mb-5 px-4" role="list">
            {choix.map((c) => (
              <Link key={c.id} href={c.href} prefetch={false} replace role="listitem" className="sv-choix-menu" aria-current={c.id === menu.id}>
                {c.enService && <span className="sv-point-vert" aria-label={t.enService} />}
                {c.nom}
              </Link>
            ))}
          </div>
        )}

        <header className="sv-entre">
          <p className="sv-surtitre">{menu.enService ? t.enService : t.menus}</p>
          <h1 className="sv-titre mt-2">{menu.nom}</h1>
          {menu.description && <p className="sv-doux mt-2 leading-relaxed">{menu.description}</p>}
          {!menu.enService && (
            <p className="sv-hors-service mt-4">
              <span aria-hidden>🕐</span>
              <span>
                <strong>{t.pasEnService}</strong>
                {menu.horaire ? ` · ${menu.horaire}` : ''}
              </span>
            </p>
          )}
          {menu.enService && menu.horaire && <p className="sv-doux mt-2 text-sm">{menu.horaire}</p>}
          {commandable && sections.length > 0 && (
            <p className="sv-commander-aide mt-4">
              <span aria-hidden>🛎️</span>
              {t.commanderAide}
            </p>
          )}
        </header>
        {commande && <SuiviEnCours merci={commande.merci} className="mt-5" />}

        {(options.recherche || options.allergenes) && sections.length > 0 && (
          <div className="mt-6 space-y-3">
            {options.recherche && (
              <div className="sv-recherche">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input type="search" className="sv-champ" placeholder={t.rechercher} value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label={t.rechercher} enterKeyHint="search" />
              </div>
            )}
            {(etiquettesPresentes.length > 0 || options.allergenes) && (
              <div className="sv-puces -mx-4 px-4" role="group" aria-label={t.filtres}>
                {options.allergenes && (
                  <button type="button" className="sv-puce" aria-pressed={exclus.length > 0} onClick={() => setFeuilleAllergies(true)}>
                    <span aria-hidden>⚠️</span>
                    {t.allergies}
                    {exclus.length > 0 && <span className="sv-puce-nombre">{exclus.length}</span>}
                  </button>
                )}
                {options.recherche &&
                  etiquettesPresentes.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="sv-puce"
                      aria-pressed={filtres.includes(c)}
                      onClick={() => setFiltres((f) => (f.includes(c) ? f.filter((x) => x !== c) : [...f, c]))}
                    >
                      <span aria-hidden>{etiquettes[c].icone}</span>
                      {etiquettes[c].nom}
                    </button>
                  ))}
              </div>
            )}
            {filtre && (
              <div className="flex items-center justify-between text-sm">
                <span className="sv-doux" aria-live="polite">
                  {remplir(total === 1 ? t.plat : t.plats, { n: total })}
                </span>
                <button
                  type="button"
                  className="sv-lien"
                  onClick={() => {
                    setRecherche('')
                    setFiltres([])
                    changerExclus([])
                  }}
                >
                  {t.effacer}
                </button>
              </div>
            )}
          </div>
        )}

        {sections.length === 0 && (
          <div className="sv-vide mt-8">
            <span aria-hidden>🍽️</span>
            <p>{t.aucunMenu}</p>
          </div>
        )}
        {sections.length > 0 && filtrees.length === 0 && (
          <div className="sv-vide mt-8">
            <span aria-hidden>🔍</span>
            <p>{t.aucunResultat}</p>
          </div>
        )}

        <div className="mt-6 space-y-9">
          {filtrees.map((s) => (
            <section key={s.id} id={`section-${s.id}`} className="sv-section" aria-labelledby={`titre-${s.id}`}>
              <h2 id={`titre-${s.id}`} className="sv-section-titre">
                {s.nom}
              </h2>
              {s.description && <p className="sv-doux mt-1 text-sm leading-relaxed">{s.description}</p>}
              <div className="sv-carte mt-3 px-4">
                {s.plats.map((p) => (
                  <LignePlat key={p.id} p={p} photos={options.photos} prix={options.prix} etiquettes={etiquettes} onOuvrir={ouvrir} dansPanier={commande ? panier.quantites[p.id] : undefined} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {(menu.pdf || appel) && (
          <div className="mt-9 grid gap-3">
            {appel && (
              <a href={`tel:${appel.tel}`} className="sv-bouton sv-bouton-plein">
                <span aria-hidden>📞</span>
                {t.appeler}
              </a>
            )}
            {menu.pdf && (
              <a href={menu.pdf} target="_blank" rel="noopener noreferrer" className="sv-bouton sv-bouton-2 sv-bouton-plein" onClick={() => balise(code, 'pdf', menu.id, langue)}>
                <span aria-hidden>📄</span>
                {t.menuPdf}
              </a>
            )}
          </div>
        )}

        {options.allergenes && sections.length > 0 && <p className="sv-avertissement mt-8">{t.avertissementAllergies}</p>}
        {/* La barre du panier ne cache jamais la fin du menu. */}
        {commande && panier.nombre > 0 && <div className="h-24" aria-hidden />}
      </div>

      {commande && (
        <>
          <BarrePanier panier={panier} montrerPrix={options.prix} formatPrix={formatTotal} onOuvrir={() => setFeuillePanier(true)} />
          <FeuillePanier
            ouverte={feuillePanier}
            onFermer={() => setFeuillePanier(false)}
            panier={panier}
            hotel={commande.hotel}
            montrerPrix={options.prix}
            formatPrix={formatTotal}
            merci={commande.merci}
          />
        </>
      )}

      <Feuille
        ouverte={Boolean(plat)}
        onFermer={() => setPlat(null)}
        fermer={t.fermer}
        entete={
          plat?.photo && options.photos ? (
            <div className="sv-photo-grande">
              <Photo src={plat.photo} alt={plat.nom} />
            </div>
          ) : undefined
        }
      >
        {plat && (
          <div className="sv-fiche">
            <div className="flex items-start justify-between gap-4 pe-10">
              <h2 className="sv-sous-titre">{plat.nom}</h2>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {!plat.disponible && <span className="sv-badge sv-badge-alerte">{t.epuise}</span>}
              {plat.etiquettes
                .filter((e) => etiquettes[e])
                .map((e) => (
                  <span key={e} className="sv-badge sv-badge-accent">
                    <span aria-hidden>{etiquettes[e].icone}</span> {etiquettes[e].nom}
                  </span>
                ))}
            </div>
            {options.prix && plat.prixNombre != null && (
              <p className="sv-fiche-prix mt-4">
                {plat.aPartirDe && <span className="sv-doux me-1.5 text-sm font-medium">{t.aPartirDe}</span>}
                <Compteur valeur={plat.prixNombre} format={formatPrix} duree={1100} />
              </p>
            )}
            {plat.description && <p className="sv-fiche-texte mt-4">{plat.description}</p>}
            {plat.variantes.length > 0 && !(commandable && plat.disponible) && (
              <div className="mt-5">
                <p className="sv-etiquette">{t.formats}</p>
                <ul className="sv-variantes mt-2">
                  {plat.variantes.map((v, i) => (
                    <li key={i}>
                      <span>{v.nom}</span>
                      {options.prix && v.prix && <strong>{v.prix}</strong>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {commandable && plat.disponible && (
              <AjoutPlat
                key={plat.id}
                plat={plat}
                montrerPrix={options.prix}
                formatPrix={formatTotal}
                onAjouter={(l) => {
                  if (!panier.place(plat.id, l.variante, l.note)) {
                    toast(t.panierPlein, { ton: 'alerte' })
                    return false
                  }
                  panier.ajouter({ plat_id: plat.id, nom: plat.nom, ...l })
                  toast(t.ajoute, { texte: `${l.quantite} × ${plat.nom}${l.varianteNom ? ` · ${l.varianteNom}` : ''}`, ton: 'succes', duree: 2600 })
                  setTimeout(() => setPlat(null), mouvementReduit() ? 0 : 380)
                  return true
                }}
              />
            )}
            {options.allergenes && plat.allergenes.length > 0 && (
              <div className="mt-5">
                <p className="sv-etiquette">{t.contient}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {plat.allergenes
                    .filter((a) => allergenes[a])
                    .map((a) => (
                      <span key={a} className="sv-badge" data-exclu={exclus.includes(a)}>
                        <span aria-hidden>{allergenes[a].icone}</span> {allergenes[a].nom}
                      </span>
                    ))}
                </div>
              </div>
            )}
            {options.allergenes && <p className="sv-avertissement mt-5">{t.avertissementAllergies}</p>}
          </div>
        )}
      </Feuille>

      {options.allergenes && (
        <Feuille ouverte={feuilleAllergies} onFermer={() => setFeuilleAllergies(false)} titre={t.allergies} fermer={t.fermer}>
          <p className="sv-doux text-[0.95rem]">{t.masquerAllergenes}</p>
          <div className="mt-4 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
            {Object.entries(allergenes).map(([c, a]) => (
              <button
                key={c}
                type="button"
                className="sv-allergene"
                aria-pressed={exclus.includes(c)}
                onClick={() => changerExclus(exclus.includes(c) ? exclus.filter((x) => x !== c) : [...exclus, c])}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {a.icone}
                </span>
                <span className="flex-1 text-start">{a.nom}</span>
                <span className="sv-case" aria-hidden />
              </button>
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            {exclus.length > 0 && (
              <button type="button" className="sv-bouton sv-bouton-2 flex-1" onClick={() => changerExclus([])}>
                {t.effacer}
              </button>
            )}
            <button type="button" className="sv-bouton flex-1" onClick={() => setFeuilleAllergies(false)}>
              {remplir(total === 1 ? t.plat : t.plats, { n: total })}
            </button>
          </div>
        </Feuille>
      )}
    </>
  )
}

function LignePlat({
  p,
  photos,
  prix,
  etiquettes,
  onOuvrir,
  dansPanier,
}: {
  p: PlatVivant
  photos: boolean
  prix: boolean
  etiquettes: Nommes
  onOuvrir: (p: PlatVivant) => void
  /** Combien de ce plat est déjà dans la commande. */
  dansPanier?: number
}) {
  const { t } = useLieu()
  return (
    <button type="button" className="sv-plat" data-epuise={!p.disponible} onClick={() => onOuvrir(p)}>
      <span className="min-w-0 flex-1">
        <span className="sv-plat-nom">
          {dansPanier ? (
            <span key={dansPanier} className="sv-plat-panier" aria-label={`${dansPanier} × ${t.commande}`}>
              {dansPanier}×
            </span>
          ) : null}
          {p.nom}
          {p.etiquettes
            .filter((e) => etiquettes[e])
            .slice(0, 3)
            .map((e) => (
              <span key={e} className="sv-plat-etiquette" title={etiquettes[e].nom} aria-label={etiquettes[e].nom}>
                {etiquettes[e].icone}
              </span>
            ))}
        </span>
        {p.description && <span className="sv-plat-desc">{p.description}</span>}
        <span className="mt-2 flex flex-wrap items-center gap-2">
          {prix && p.prix && (
            <span className="sv-plat-prix">
              {p.aPartirDe && <span className="sv-doux me-1 text-[0.78rem] font-medium">{t.aPartirDe}</span>}
              {p.prix}
            </span>
          )}
          {!p.disponible && <span className="sv-badge sv-badge-alerte">{t.epuise}</span>}
        </span>
      </span>
      {photos && p.photo && (
        <span className="sv-plat-photo">
          <Photo src={p.photo} alt="" paresseuse />
        </span>
      )}
    </button>
  )
}

/**
 * Ajouter un plat à la commande : le format (s'il y en a), la quantité, une
 * précision facultative, puis « Ajouter · 24 $ » — le prix roule avec la
 * quantité, et le bouton jaillit d'un éclat aux couleurs de l'établissement.
 */
function AjoutPlat({
  plat,
  montrerPrix,
  formatPrix,
  onAjouter,
}: {
  plat: PlatVivant
  montrerPrix: boolean
  formatPrix: (v: number) => string
  onAjouter: (l: { variante: number | null; varianteNom: string | null; quantite: number; note: string | null; prix: number | null }) => boolean
}) {
  const { t } = useLieu()
  const [variante, setVariante] = useState<number | null>(plat.variantes.length ? 0 : null)
  const [quantite, setQuantite] = useState(1)
  const [avecNote, setAvecNote] = useState(false)
  const [note, setNote] = useState('')
  const bouton = useRef<HTMLButtonElement>(null)
  const v = variante !== null ? plat.variantes[variante] : null
  // Le même calcul que le serveur : le prix du format, sinon celui du plat.
  const unitaire = v ? (v.prixNombre ?? plat.prixBase) : plat.prixBase
  const montant = unitaire !== null ? Math.round(unitaire * quantite * 100) / 100 : null

  function ajouter() {
    const ok = onAjouter({ variante, varianteNom: v?.nom ?? null, quantite, note: note.replace(/\s+/g, ' ').trim().slice(0, 140) || null, prix: unitaire })
    if (!ok) return
    rebond(bouton.current)
    eclat(bouton.current)
    vibrer([12, 40, 18])
  }

  return (
    <div className="sv-ajout mt-6">
      {plat.variantes.length > 0 && (
        <fieldset>
          <legend className="sv-etiquette">{t.choisirFormat}</legend>
          <div className="sv-formats mt-2" role="radiogroup">
            {plat.variantes.map((x, i) => (
              <button key={i} type="button" role="radio" aria-checked={variante === i} className="sv-format" onClick={() => setVariante(i)}>
                <span className="sv-format-rond" aria-hidden />
                <span className="flex-1 text-start">{x.nom}</span>
                {montrerPrix && x.prix && <strong>{x.prix}</strong>}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-5 flex items-center justify-between gap-4">
        <span className="sv-etiquette">{t.quantite}</span>
        <Quantite valeur={quantite} onChanger={setQuantite} grand />
      </div>

      {avecNote ? (
        <div className="mt-4">
          <label className="sv-etiquette" htmlFor={`sv-note-${plat.id}`}>
            {t.notePlat}
          </label>
          <input
            id={`sv-note-${plat.id}`}
            className="sv-champ mt-2"
            maxLength={140}
            placeholder={t.notePlatEx}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
            enterKeyHint="done"
          />
        </div>
      ) : (
        <button type="button" className="sv-lien mt-4 text-[0.9rem]" onClick={() => setAvecNote(true)}>
          ＋ {t.notePlat}
        </button>
      )}

      <button ref={bouton} type="button" className="sv-bouton sv-bouton-plein mt-5" onClick={ajouter}>
        <span aria-hidden>🛎️</span>
        {montrerPrix && montant !== null ? (
          <>
            {t.ajouter}
            <span aria-hidden>·</span>
            <Compteur valeur={montant} format={formatPrix} duree={650} />
          </>
        ) : (
          t.ajouter
        )}
      </button>
    </div>
  )
}

/** Une photo qui apparaît en fondu une fois chargée (même déjà en cache avant l'hydratation). */
function Photo({ src, alt, paresseuse }: { src: string; alt: string; paresseuse?: boolean }) {
  return (
    <img
      src={src}
      alt={alt}
      loading={paresseuse ? 'lazy' : 'eager'}
      decoding="async"
      ref={(el) => {
        if (el?.complete && el.naturalWidth) el.dataset.chargee = 'true'
      }}
      onLoad={(e) => (e.currentTarget.dataset.chargee = 'true')}
      onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
    />
  )
}
