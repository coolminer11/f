'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Menu, Plat, Section } from '@/lib/services/types'
import { ALLERGENES, ETIQUETTES } from '@/lib/services/types'
import { texte } from '@/lib/services/langues'
import { toast } from '@/components/effets/toasts'
import { desintegrer, vibrer } from '@/components/effets/desintegration'
import Fenetre from '@/components/effets/fenetre'
import { disponiblePlatGerantAction, deplacerPlatGerantAction, deplacerSectionGerantAction, dupliquerPlatGerantAction, photoPlatGerantAction, platGerantAction, sectionGerantAction, supprimerPlatGerantAction, supprimerSectionGerantAction } from '@/app/service/[jeton]/actions-gerant'
import { EnTete } from '@/components/services/portail/controles'
import { Confirmation, OngletsLangues, languesManquantes, prixAffiche, prixVersSaisie, reapparaitre, sansAccents, useRelire, versChamps } from '@/components/services/portail/gerant-commun'
import { TEXTES_PORTAIL, type LanguePortail } from '@/components/services/portail/textes'

type SaisieFormat = { nom: Record<string, string>; prix: string }
type Saisie = {
  id: string | null
  section_id: string
  nom: Record<string, string>
  description: Record<string, string>
  prix: string
  variantes: SaisieFormat[]
  allergenes: string[]
  etiquettes: string[]
  disponible: boolean
  photo: string | null
}

/**
 * Le menu, tenu par le gérant : chaque plat (nom et description dans chaque
 * langue, prix et formats, photo, allergènes, étiquettes, disponibilité),
 * les sections (ajout, nom, ordre). Chaque geste est en ligne tout de suite.
 */
export default function GerantMenu({ jeton, l, langues, menus }: { jeton: string; l: LanguePortail; langues: string[]; menus: Menu[] }) {
  const T = TEXTES_PORTAIL[l].gerant
  const principale = langues[0]
  const [relire] = useRelire()
  const [menuId, setMenuId] = useState(menus[0]?.id ?? '')
  const [recherche, setRecherche] = useState('')
  const [plat, setPlat] = useState<Saisie | null>(null)
  const [section, setSection] = useState<{ id: string | null; nom: Record<string, string>; description: Record<string, string> } | null>(null)
  const [aSupprimer, setASupprimer] = useState<{ quoi: 'plat' | 'section'; id: string; nom: string; el: HTMLElement | null } | null>(null)
  const fermerPlat = useCallback(() => setPlat(null), [])
  const fermerSection = useCallback(() => setSection(null), [])
  const fermerSuppression = useCallback(() => setASupprimer(null), [])

  const menu = menus.find((m) => m.id === menuId) ?? menus[0]
  const tous = useMemo(() => menus.flatMap((m) => m.sections.flatMap((s) => s.plats)), [menus])
  const nTraduire = useMemo(
    () => tous.filter((p) => langues.slice(1).some((c) => !p.nom[c as keyof typeof p.nom]?.trim())).length,
    [tous, langues],
  )
  const nEpuises = tous.filter((p) => !p.disponible).length
  const q = sansAccents(recherche.trim())
  const visibles = (s: Section) => (q ? s.plats.filter((p) => sansAccents(`${texte(p.nom, principale, principale)} ${texte(p.description, principale, principale)}`).includes(q)) : s.plats)

  const nomDe = (p: Plat) => texte(p.nom, principale, principale) || '—'

  function ouvrirPlat(p: Plat | null, sectionId: string) {
    setPlat(
      p
        ? {
            id: p.id,
            section_id: p.section_id,
            nom: versChamps(p.nom, langues),
            description: versChamps(p.description, langues),
            prix: prixVersSaisie(p.prix, l),
            variantes: p.variantes.map((v) => ({ nom: versChamps(v.nom, langues), prix: prixVersSaisie(v.prix, l) })),
            allergenes: [...p.allergenes],
            etiquettes: [...p.etiquettes],
            disponible: p.disponible,
            photo: p.photo,
          }
        : {
            id: null,
            section_id: sectionId,
            nom: versChamps(null, langues),
            description: versChamps(null, langues),
            prix: '',
            variantes: [],
            allergenes: [],
            etiquettes: [],
            disponible: true,
            photo: null,
          },
    )
  }

  async function geste(action: () => Promise<{ ok: boolean; erreur?: string }>, succes: string, el?: HTMLElement | null) {
    const r = await action().catch(() => ({ ok: false, erreur: TEXTES_PORTAIL[l].erreur }))
    if (r.ok) {
      toast(succes, { ton: 'succes', duree: 2400 })
      relire()
    } else {
      reapparaitre(el ?? null)
      toast(TEXTES_PORTAIL[l].erreur, { ton: 'erreur', texte: 'erreur' in r ? r.erreur : undefined })
    }
    return r.ok
  }

  async function supprimer() {
    const s = aSupprimer
    if (!s) return
    vibrer([10, 40, 18])
    await desintegrer(s.el)
    if (s.quoi === 'plat') await geste(() => supprimerPlatGerantAction(jeton, s.id), T.platSupprime, s.el)
    else await geste(() => supprimerSectionGerantAction(jeton, s.id), T.sectionSupprimee, s.el)
  }

  if (!menus.length) {
    return (
      <section className="pt-carte p-8 text-center">
        <p className="text-[var(--p-doux)]">{T.aucunMenu}</p>
      </section>
    )
  }

  return (
    <>
      <div className="cascade space-y-5">
        <section className="pt-carte fond-maillage reflet-premium p-5 sm:p-6">
          <EnTete
            emoji="🍽️"
            titre={T.menuTitre}
            sous={T.menuSous}
            droite={
              <div className="hidden shrink-0 flex-wrap justify-end gap-1.5 sm:flex">
                <span className="pt-puce !cursor-default">{T.plats(tous.length)}</span>
                {nTraduire > 0 && <span className="pt-puce !cursor-default !text-[var(--p-ambre)]">{T.aTraduire(nTraduire)}</span>}
                {nEpuises > 0 && <span className="pt-puce !cursor-default !text-[var(--p-rouge)]">{T.nEpuises(nEpuises)}</span>}
              </div>
            }
          />
          {menus.length > 1 && (
            <div className="mt-5 flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label={T.menuTitre}>
              {menus.map((m) => (
                <button key={m.id} type="button" className="pt-puce" aria-pressed={m.id === menu.id} onClick={() => setMenuId(m.id)}>
                  {texte(m.nom, principale, principale) || '—'}
                  {!m.actif && <span className="ml-1 font-normal text-[var(--p-faible)]">· {T.menuMasque}</span>}
                </button>
              ))}
            </div>
          )}
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={T.rechercher}
            aria-label={T.rechercher}
            className="pt-champ mt-4"
          />
        </section>

        {menu.sections.map((s, i) => {
          const liste = visibles(s)
          if (q && !liste.length) return null
          const nomSection = texte(s.nom, principale, principale) || '—'
          return (
            <section key={s.id} className="pt-carte p-5 sm:p-6" data-section={s.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="titre-portail text-xl font-medium leading-tight">{nomSection}</h2>
                  <p className="mt-0.5 text-xs text-[var(--p-faible)]">{T.plats(s.plats.length)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="pt-bouton-fantome !py-2 text-xs"
                    onClick={() => setSection({ id: s.id, nom: versChamps(s.nom, langues), description: versChamps(s.description, langues) })}
                  >
                    ✎ {T.renommerSection}
                  </button>
                  {!q && (
                    <>
                      <button type="button" className="pt-bouton-fantome !px-2.5 !py-2" disabled={i === 0} aria-label={`${T.monter} : ${nomSection}`} title={T.monter} onClick={() => void geste(() => deplacerSectionGerantAction(jeton, s.id, -1), T.sectionEnregistree)}>
                        ↑
                      </button>
                      <button type="button" className="pt-bouton-fantome !px-2.5 !py-2" disabled={i === menu.sections.length - 1} aria-label={`${T.descendre} : ${nomSection}`} title={T.descendre} onClick={() => void geste(() => deplacerSectionGerantAction(jeton, s.id, 1), T.sectionEnregistree)}>
                        ↓
                      </button>
                    </>
                  )}
                  {s.plats.length === 0 && (
                    <button
                      type="button"
                      className="pt-bouton-fantome !px-2.5 !py-2 text-[var(--p-rouge)]"
                      aria-label={`${T.supprimerSection} : ${nomSection}`}
                      title={T.supprimerSection}
                      onClick={(e) => setASupprimer({ quoi: 'section', id: s.id, nom: nomSection, el: e.currentTarget.closest<HTMLElement>('[data-section]') })}
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>

              {liste.length === 0 ? (
                <p className="pt-carte-plate mt-4 px-4 py-5 text-center text-sm text-[var(--p-doux)]">{T.sectionVide}</p>
              ) : (
                <ul className="mt-4 divide-y divide-[var(--p-ligne)]">
                  {liste.map((p, j) => (
                    <LignePlat
                      key={p.id}
                      jeton={jeton}
                      l={l}
                      langues={langues}
                      plat={p}
                      premier={j === 0}
                      dernier={j === liste.length - 1}
                      recherche={Boolean(q)}
                      ouvrir={() => ouvrirPlat(p, s.id)}
                      geste={geste}
                      supprimer={(el) => setASupprimer({ quoi: 'plat', id: p.id, nom: nomDe(p), el })}
                    />
                  ))}
                </ul>
              )}
              <button type="button" className="pt-bouton-doux mt-4 !py-2.5 text-sm" onClick={() => ouvrirPlat(null, s.id)}>
                ＋ {T.ajouterPlat}
              </button>
            </section>
          )
        })}

        {q && menu.sections.every((s) => !visibles(s).length) && <p className="pt-carte-plate px-4 py-6 text-center text-sm text-[var(--p-doux)]">{T.aucunResultat}</p>}

        {!q && (
          <button
            type="button"
            className="pt-carte-plate flex w-full items-center justify-center gap-2 px-4 py-5 text-sm font-semibold text-[var(--p-doux)] transition-colors hover:text-[var(--p-encre)]"
            onClick={() => setSection({ id: null, nom: versChamps(null, langues), description: versChamps(null, langues) })}
          >
            ＋ {T.nouvelleSection}
          </button>
        )}
      </div>

      <Fenetre ouverte={plat !== null} fermer={fermerPlat} titre={plat?.id ? T.modifierPlat : T.nouveauPlat} largeur="max-w-2xl">
        {plat && (
          <EditeurPlat
            key={plat.id ?? 'nouveau'}
            jeton={jeton}
            l={l}
            langues={langues}
            menus={menus}
            depart={plat}
            fermer={fermerPlat}
            relire={relire}
          />
        )}
      </Fenetre>

      <Fenetre ouverte={section !== null} fermer={fermerSection} titre={section?.id ? T.modifierSection : T.nouvelleSection} largeur="max-w-lg">
        {section && <EditeurSection jeton={jeton} l={l} langues={langues} menuId={menu.id} depart={section} fermer={fermerSection} relire={relire} />}
      </Fenetre>

      <Confirmation
        l={l}
        ouverte={aSupprimer !== null}
        fermer={fermerSuppression}
        titre={aSupprimer?.quoi === 'section' ? T.confirmerSupprimerSection : T.confirmerSupprimer(aSupprimer?.nom ?? '')}
        texte={aSupprimer?.quoi === 'section' ? aSupprimer.nom : T.confirmerSupprimerTexte}
        onConfirmer={() => void supprimer()}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Une ligne du menu
// ---------------------------------------------------------------------------

function LignePlat({
  jeton,
  l,
  langues,
  plat,
  premier,
  dernier,
  recherche,
  ouvrir,
  geste,
  supprimer,
}: {
  jeton: string
  l: LanguePortail
  langues: string[]
  plat: Plat
  premier: boolean
  dernier: boolean
  recherche: boolean
  ouvrir: () => void
  geste: (action: () => Promise<{ ok: boolean; erreur?: string }>, succes: string, el?: HTMLElement | null) => Promise<boolean>
  supprimer: (el: HTMLElement | null) => void
}) {
  const T = TEXTES_PORTAIL[l].gerant
  const principale = langues[0]
  const ligne = useRef<HTMLLIElement>(null)
  const [dispo, setDispo] = useState(plat.disponible)
  // Relu du serveur (un geste ailleurs, dans Contrôles par exemple) : l'interrupteur suit.
  useEffect(() => setDispo(plat.disponible), [plat.disponible])
  const nom = texte(plat.nom, principale, principale) || '—'
  const desc = texte(plat.description, principale, principale)
  const manquantes = langues.slice(1).filter((c) => !plat.nom[c as keyof typeof plat.nom]?.trim()).length
  const prix = plat.prix ?? (plat.variantes.length ? Math.min(...plat.variantes.map((v) => v.prix ?? Infinity)) : null)

  async function basculer() {
    const v = !dispo
    setDispo(v)
    vibrer(10)
    const ok = await geste(() => disponiblePlatGerantAction(jeton, plat.id, v), v ? TEXTES_PORTAIL[l].platDispo(nom) : TEXTES_PORTAIL[l].platEpuise(nom))
    if (!ok) setDispo(!v)
  }

  return (
    <li ref={ligne} className="flex items-center gap-3 py-3" data-ligne data-plat={plat.id}>
      <button type="button" onClick={ouvrir} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${T.modifierPlat} : ${nom}`}>
        {plat.photo ? (
          <img src={plat.photo} alt="" loading="lazy" className={`size-14 shrink-0 rounded-xl object-cover ring-1 ring-[var(--p-ligne)] ${dispo ? '' : 'opacity-50 grayscale'}`} />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-[var(--accent-pale)] text-xl ring-1 ring-[var(--p-ligne)]" aria-hidden>
            🍽️
          </span>
        )}
        <span className={`min-w-0 flex-1 transition-opacity ${dispo ? '' : 'opacity-55'}`}>
          <span className="flex items-baseline gap-2">
            <span className="truncate font-semibold">{nom}</span>
            {prix !== null && Number.isFinite(prix) && <span className="pt-or shrink-0 text-sm font-semibold tabular-nums">{prixAffiche(prix, l)}</span>}
          </span>
          {desc && <span className="mt-0.5 block truncate text-sm text-[var(--p-doux)]">{desc}</span>}
          <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
            {!dispo && <span className="font-semibold text-[var(--p-rouge)]">{T.epuise}</span>}
            {manquantes > 0 && <span className="text-[var(--p-ambre)]">• {T.aTraduire(manquantes)}</span>}
            {plat.etiquettes.map((e) => {
              const d = ETIQUETTES.find((x) => x.cle === e)
              return d ? (
                <span key={e} title={l === 'fr' ? d.fr : d.en} aria-label={l === 'fr' ? d.fr : d.en}>
                  {d.icone}
                </span>
              ) : null
            })}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" role="switch" aria-checked={dispo} aria-label={`${T.disponible} : ${nom}`} title={dispo ? T.disponible : T.epuise} className="pt-interrupteur mr-1.5" onClick={() => void basculer()} />
        <button type="button" className="pt-bouton-fantome hidden !px-2.5 !py-2 sm:inline-flex" aria-label={`${T.dupliquer} : ${nom}`} title={T.dupliquer} onClick={() => void geste(() => dupliquerPlatGerantAction(jeton, plat.id), T.platDuplique)}>
          ⧉
        </button>
        {!recherche && (
          <>
            <button type="button" className="pt-bouton-fantome hidden !px-2.5 !py-2 sm:inline-flex" disabled={premier} aria-label={`${T.monter} : ${nom}`} title={T.monter} onClick={() => void geste(() => deplacerPlatGerantAction(jeton, plat.id, -1), T.platEnregistre)}>
              ↑
            </button>
            <button type="button" className="pt-bouton-fantome hidden !px-2.5 !py-2 sm:inline-flex" disabled={dernier} aria-label={`${T.descendre} : ${nom}`} title={T.descendre} onClick={() => void geste(() => deplacerPlatGerantAction(jeton, plat.id, 1), T.platEnregistre)}>
              ↓
            </button>
          </>
        )}
        <button type="button" className="pt-bouton-fantome !px-2.5 !py-2 text-[var(--p-rouge)]" aria-label={`${T.supprimer} : ${nom}`} title={T.supprimer} onClick={() => supprimer(ligne.current)}>
          🗑
        </button>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// La fenêtre d'un plat
// ---------------------------------------------------------------------------

function EditeurPlat({
  jeton,
  l,
  langues,
  menus,
  depart,
  fermer,
  relire,
}: {
  jeton: string
  l: LanguePortail
  langues: string[]
  menus: Menu[]
  depart: Saisie
  fermer: () => void
  relire: () => void
}) {
  const T = TEXTES_PORTAIL[l].gerant
  const principale = langues[0]
  const [s, setS] = useState<Saisie>(depart)
  const [langue, setLangue] = useState(principale)
  const [envoi, setEnvoi] = useState(false)
  const [envoiPhoto, setEnvoiPhoto] = useState(false)
  const fichier = useRef<HTMLInputElement>(null)
  const manquantes = languesManquantes([s.nom, s.description, ...s.variantes.map((v) => v.nom)], langues)
  const maj = (c: Partial<Saisie>) => setS((x) => ({ ...x, ...c }))
  const basculer = (liste: 'allergenes' | 'etiquettes', cle: string) =>
    setS((x) => ({ ...x, [liste]: x[liste].includes(cle) ? x[liste].filter((c) => c !== cle) : [...x[liste], cle] }))
  const rtl = langue === 'ar' ? 'rtl' : undefined

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    const r = await platGerantAction(jeton, {
      id: s.id,
      section_id: s.section_id,
      nom: s.nom,
      description: s.description,
      prix: s.prix,
      variantes: s.variantes,
      allergenes: s.allergenes,
      etiquettes: s.etiquettes,
      disponible: s.disponible,
    }).catch(() => ({ ok: false as const, erreur: TEXTES_PORTAIL[l].erreur }))
    setEnvoi(false)
    if (!r.ok) {
      toast(TEXTES_PORTAIL[l].erreur, { ton: 'erreur', texte: r.erreur })
      return
    }
    vibrer(14)
    relire()
    if (s.id) {
      toast(T.platEnregistre, { ton: 'succes', texte: s.nom[principale] })
      fermer()
    } else {
      // Un plat neuf : la fenêtre reste ouverte, pour sa photo.
      toast(T.platAjoute, { ton: 'succes', texte: T.platAjouteSous })
      maj({ id: r.id })
    }
  }

  async function photo(retirer: boolean) {
    if (!s.id) return
    const d = new FormData()
    d.set('jeton', jeton)
    d.set('plat', s.id)
    const f = fichier.current?.files?.[0]
    if (retirer) d.set('retirer', '1')
    else if (f) d.set('photo', f)
    else return
    setEnvoiPhoto(true)
    const r = await photoPlatGerantAction(d).catch(() => ({ ok: false as const, erreur: TEXTES_PORTAIL[l].erreur }))
    setEnvoiPhoto(false)
    if (fichier.current) fichier.current.value = ''
    if (!r.ok) {
      toast(TEXTES_PORTAIL[l].erreur, { ton: 'erreur', texte: r.erreur })
      return
    }
    maj({ photo: r.photo })
    toast(r.photo ? T.photoOk : T.photoRetiree, { ton: 'succes', duree: 2400 })
    relire()
  }

  return (
    <form onSubmit={envoyer} className="grid gap-4">
      <OngletsLangues l={l} langues={langues} active={langue} choisir={setLangue} manquantes={manquantes} />

      <div>
        <label className="pt-etiquette" htmlFor="plat-nom">
          {T.nom}
        </label>
        <input
          id="plat-nom"
          name="nom"
          required={langue === principale}
          maxLength={120}
          value={s.nom[langue] ?? ''}
          onChange={(e) => maj({ nom: { ...s.nom, [langue]: e.target.value } })}
          placeholder={langue === principale ? T.nomEx : s.nom[principale] || T.nomEx}
          className="pt-champ"
          lang={langue}
          dir={rtl}
        />
      </div>
      <div>
        <label className="pt-etiquette" htmlFor="plat-description">
          {T.description}
        </label>
        <textarea
          id="plat-description"
          name="description"
          rows={2}
          maxLength={600}
          value={s.description[langue] ?? ''}
          onChange={(e) => maj({ description: { ...s.description, [langue]: e.target.value } })}
          placeholder={langue === principale ? T.descriptionEx : s.description[principale] || T.descriptionEx}
          className="pt-champ resize-y"
          lang={langue}
          dir={rtl}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="pt-etiquette" htmlFor="plat-prix">
            {T.prix}
          </label>
          <input id="plat-prix" name="prix" inputMode="decimal" maxLength={12} value={s.prix} onChange={(e) => maj({ prix: e.target.value })} placeholder={T.prixEx} className="pt-champ tabular-nums" />
          <p className="mt-1 text-xs text-[var(--p-faible)]">{T.prixAide}</p>
        </div>
        <div>
          <label className="pt-etiquette" htmlFor="plat-section">
            {T.section}
          </label>
          <select id="plat-section" name="section" value={s.section_id} onChange={(e) => maj({ section_id: e.target.value })} className="pt-champ">
            {menus.map((m) => (
              <optgroup key={m.id} label={texte(m.nom, principale, principale) || '—'}>
                {m.sections.map((x) => (
                  <option key={x.id} value={x.id}>
                    {texte(x.nom, principale, principale) || '—'}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="pt-etiquette">{T.formats}</legend>
        <p className="-mt-1 mb-2 text-xs text-[var(--p-faible)]">{T.formatsAide}</p>
        <div className="space-y-2">
          {s.variantes.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                aria-label={`${T.format} ${i + 1}`}
                name={`format_nom_${i}`}
                maxLength={60}
                value={v.nom[langue] ?? ''}
                onChange={(e) => maj({ variantes: s.variantes.map((x, k) => (k === i ? { ...x, nom: { ...x.nom, [langue]: e.target.value } } : x)) })}
                placeholder={v.nom[principale] || T.formatEx}
                className="pt-champ min-w-0 flex-1"
                lang={langue}
                dir={rtl}
              />
              <input
                aria-label={`${T.prix} · ${T.format} ${i + 1}`}
                name={`format_prix_${i}`}
                inputMode="decimal"
                maxLength={12}
                value={v.prix}
                onChange={(e) => maj({ variantes: s.variantes.map((x, k) => (k === i ? { ...x, prix: e.target.value } : x)) })}
                placeholder={T.prixEx}
                className="pt-champ w-28 tabular-nums"
              />
              <button type="button" className="pt-bouton-fantome !px-2.5 !py-2 text-[var(--p-rouge)]" aria-label={`${T.retirer} · ${T.format} ${i + 1}`} onClick={() => maj({ variantes: s.variantes.filter((_, k) => k !== i) })}>
                ×
              </button>
            </div>
          ))}
        </div>
        {s.variantes.length < 12 && (
          <button type="button" className="pt-bouton-fantome mt-1.5 !px-0 !py-1.5 text-sm" onClick={() => maj({ variantes: [...s.variantes, { nom: versChamps(null, langues), prix: '' }] })}>
            {T.ajouterFormat}
          </button>
        )}
      </fieldset>

      <fieldset>
        <legend className="pt-etiquette">{T.allergenes}</legend>
        <p className="-mt-1 mb-2 text-xs text-[var(--p-faible)]">{T.allergenesAide}</p>
        <div className="flex flex-wrap gap-1.5">
          {ALLERGENES.map((a) => (
            <button key={a.cle} type="button" className="pt-puce" aria-pressed={s.allergenes.includes(a.cle)} onClick={() => basculer('allergenes', a.cle)}>
              {a.icone} {l === 'fr' ? a.fr : a.en}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="pt-etiquette">{T.etiquettes}</legend>
        <div className="flex flex-wrap gap-1.5">
          {ETIQUETTES.map((e) => (
            <button key={e.cle} type="button" className="pt-puce" aria-pressed={s.etiquettes.includes(e.cle)} onClick={() => basculer('etiquettes', e.cle)}>
              {e.icone} {l === 'fr' ? e.fr : e.en}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--p-ligne)] bg-[var(--p-surface-2)] px-4 py-3">
        <span className="text-sm font-semibold">{s.disponible ? T.disponible : T.epuise}</span>
        <button type="button" role="switch" aria-checked={s.disponible} aria-label={T.disponible} className="pt-interrupteur" onClick={() => maj({ disponible: !s.disponible })} />
      </div>

      <div className="rounded-2xl border border-[var(--p-ligne)] p-4">
        <p className="pt-etiquette">{T.photo}</p>
        {s.id ? (
          <div className="flex flex-wrap items-center gap-4">
            {s.photo ? (
              <img src={s.photo} alt="" className="size-20 rounded-xl object-cover ring-1 ring-[var(--p-ligne)]" />
            ) : (
              <span className="grid size-20 place-items-center rounded-xl bg-[var(--accent-pale)] text-2xl ring-1 ring-[var(--p-ligne)]" aria-hidden>
                📷
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs text-[var(--p-faible)]">{T.photoAide}</p>
              <div className="flex flex-wrap gap-2">
                <label className={`pt-bouton-doux cursor-pointer !py-2.5 text-sm ${envoiPhoto ? 'pointer-events-none opacity-60' : ''}`}>
                  {envoiPhoto ? T.envoiPhoto : s.photo ? T.changerPhoto : T.ajouterPhoto}
                  <input ref={fichier} type="file" name="photo" accept="image/*" className="sr-only" disabled={envoiPhoto} onChange={() => void photo(false)} />
                </label>
                {s.photo && (
                  <button type="button" className="pt-bouton-fantome !py-2.5 text-sm" disabled={envoiPhoto} onClick={() => void photo(true)}>
                    {T.retirerPhoto}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--p-doux)]">{T.photoApres}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="pt-bouton-doux" onClick={fermer}>
          {s.id && !depart.id ? TEXTES_PORTAIL[l].fermer : T.annuler}
        </button>
        <button disabled={envoi} className="pt-bouton">
          {envoi ? TEXTES_PORTAIL[l].enregistrement : s.id ? TEXTES_PORTAIL[l].enregistrer : T.ajouter}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// La fenêtre d'une section
// ---------------------------------------------------------------------------

function EditeurSection({
  jeton,
  l,
  langues,
  menuId,
  depart,
  fermer,
  relire,
}: {
  jeton: string
  l: LanguePortail
  langues: string[]
  menuId: string
  depart: { id: string | null; nom: Record<string, string>; description: Record<string, string> }
  fermer: () => void
  relire: () => void
}) {
  const T = TEXTES_PORTAIL[l].gerant
  const principale = langues[0]
  const [nom, setNom] = useState(depart.nom)
  const [description, setDescription] = useState(depart.description)
  const [langue, setLangue] = useState(principale)
  const [envoi, setEnvoi] = useState(false)
  const rtl = langue === 'ar' ? 'rtl' : undefined

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    const r = await sectionGerantAction(jeton, { id: depart.id, menu_id: menuId, nom, description }).catch(() => ({ ok: false as const, erreur: TEXTES_PORTAIL[l].erreur }))
    setEnvoi(false)
    if (!r.ok) {
      toast(TEXTES_PORTAIL[l].erreur, { ton: 'erreur', texte: r.erreur })
      return
    }
    vibrer(14)
    toast(depart.id ? T.sectionEnregistree : T.sectionAjoutee, { ton: 'succes', texte: nom[principale] })
    relire()
    fermer()
  }

  return (
    <form onSubmit={envoyer} className="grid gap-4">
      <OngletsLangues l={l} langues={langues} active={langue} choisir={setLangue} manquantes={languesManquantes([nom], langues)} />
      <div>
        <label className="pt-etiquette" htmlFor="section-nom">
          {T.nom}
        </label>
        <input
          id="section-nom"
          name="nom"
          required={langue === principale}
          maxLength={80}
          value={nom[langue] ?? ''}
          onChange={(e) => setNom({ ...nom, [langue]: e.target.value })}
          placeholder={langue === principale ? T.sectionEx : nom[principale] || T.sectionEx}
          className="pt-champ"
          lang={langue}
          dir={rtl}
        />
      </div>
      {depart.id && (
        <div>
          <label className="pt-etiquette" htmlFor="section-description">
            {T.description}
          </label>
          <textarea
            id="section-description"
            name="description"
            rows={2}
            maxLength={300}
            value={description[langue] ?? ''}
            onChange={(e) => setDescription({ ...description, [langue]: e.target.value })}
            className="pt-champ resize-y"
            lang={langue}
            dir={rtl}
          />
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="pt-bouton-doux" onClick={fermer}>
          {T.annuler}
        </button>
        <button disabled={envoi} className="pt-bouton">
          {envoi ? TEXTES_PORTAIL[l].enregistrement : depart.id ? TEXTES_PORTAIL[l].enregistrer : T.ajouter}
        </button>
      </div>
    </form>
  )
}
