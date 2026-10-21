'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Annonce } from '@/lib/services/types'
import type { PlatDispo } from '@/lib/services/portail'
import { drapeau, nomLangue, texte, type Texte } from '@/lib/services/langues'
import { accueilAction, annonceAction, disponibiliteAction, platDuJourAction, toutDisponibleAction } from '@/app/service/[jeton]/actions'
import { toast } from '@/components/effets/toasts'
import { vibrer } from '@/components/effets/desintegration'
import Fenetre from '@/components/effets/fenetre'
import { TEXTES_PORTAIL, type LanguePortail } from '@/components/services/portail/textes'

type Etat = 'repos' | 'envoi' | 'ok' | 'erreur'

const versChamps = (t: Texte | null | undefined, langues: string[]) =>
  Object.fromEntries(langues.map((c) => [c, (t as Record<string, string> | undefined)?.[c] ?? '']))

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const versNombre = (prix: string) => Number(prix.replace(/\s|\$/g, '').replace(',', '.'))

function prixAffiche(p: number | null, l: LanguePortail) {
  if (p === null || !Number.isFinite(p)) return ''
  return new Intl.NumberFormat(l === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(p)
}

const dateLongue = (j: string, l: LanguePortail) =>
  j ? new Date(`${j}T12:00:00`).toLocaleDateString(l === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', day: 'numeric', month: 'long' }) : ''

/**
 * Les contrôles du service : ce que le personnel change lui-même, en un geste,
 * sans passer par Tapora — le plat du jour, les plats épuisés, le message
 * d'accueil, les annonces.
 */
export default function Controles({
  jeton,
  l,
  langues,
  langueDefaut,
  aujourdhui,
  plat,
  annonces,
  plats,
  accueil,
}: {
  jeton: string
  l: LanguePortail
  langues: string[]
  langueDefaut: string
  /** AAAA-MM-JJ, dans le fuseau de l'établissement. */
  aujourdhui: string
  plat: Annonce | null
  annonces: Annonce[]
  plats: PlatDispo[]
  accueil: Texte
}) {
  // La langue principale d'abord, puis les autres.
  const ordre = useMemo(() => [langueDefaut, ...langues.filter((c) => c !== langueDefaut)], [langues, langueDefaut])
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="cascade space-y-5">
        <PlatDuJour jeton={jeton} l={l} langues={ordre} aujourdhui={aujourdhui} plat={plat} />
        <Accueil jeton={jeton} l={l} langues={ordre} accueil={accueil} />
        <Annonces jeton={jeton} l={l} langueDefaut={langueDefaut} annonces={annonces} />
      </div>
      <Epuises jeton={jeton} l={l} langueDefaut={langueDefaut} plats={plats} />
    </div>
  )
}

function EnTete({ emoji, titre, sous, droite }: { emoji: string; titre: string; sous: string; droite?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-pale)] text-xl ring-1 ring-[var(--p-ligne)]" aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0">
          <h2 className="titre-portail text-xl font-medium leading-tight">{titre}</h2>
          <p className="mt-1 text-sm text-[var(--p-doux)]">{sous}</p>
        </div>
      </div>
      {droite}
    </div>
  )
}

function BoutonEnregistrer({ etat, l, desactive }: { etat: Etat; l: LanguePortail; desactive?: boolean }) {
  const T = TEXTES_PORTAIL[l]
  return (
    <div className="flex items-center gap-3">
      <button disabled={etat === 'envoi' || desactive} className={`pt-bouton ${etat === 'ok' ? 'pt-bouton-vert' : ''}`}>
        {etat === 'envoi' ? T.enregistrement : etat === 'ok' ? T.enregistre : T.enregistrer}
      </button>
      {etat === 'erreur' && (
        <span role="alert" className="text-sm font-medium text-[var(--p-rouge)]">
          {T.erreur}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plat du jour : une vitrine, et l'éditeur dans une fenêtre
// ---------------------------------------------------------------------------

type Saisie = {
  id: string | null
  titre: Record<string, string>
  texte: Record<string, string>
  prix: string
  fin: string
  actif: boolean
}

function PlatDuJour({ jeton, l, langues, aujourdhui, plat }: { jeton: string; l: LanguePortail; langues: string[]; aujourdhui: string; plat: Annonce | null }) {
  const T = TEXTES_PORTAIL[l]
  const principale = langues[0]
  const [actuel, setActuel] = useState<Saisie | null>(() =>
    plat
      ? {
          id: plat.id,
          titre: versChamps(plat.titre, langues),
          texte: versChamps(plat.texte, langues),
          prix: plat.prix != null ? String(plat.prix).replace('.', l === 'fr' ? ',' : '.') : '',
          // Un plat d'hier : on repart d'aujourd'hui par défaut.
          fin: plat.fin && plat.fin >= aujourdhui ? plat.fin : aujourdhui,
          actif: plat.actif && (!plat.fin || plat.fin >= aujourdhui),
        }
      : null,
  )
  const [ouverte, setOuverte] = useState(false)
  const [bascule, setBascule] = useState(false)
  const fermer = useCallback(() => setOuverte(false), [])

  async function basculer() {
    if (!actuel || bascule) return
    const suivant = { ...actuel, actif: !actuel.actif }
    setActuel(suivant)
    setBascule(true)
    vibrer(10)
    const r = await platDuJourAction(jeton, suivant).catch(() => ({
      ok: false,
      id: null,
    }))
    setBascule(false)
    if (r.ok)
      toast(suivant.actif ? T.platEnregistre : T.platMasque, {
        ton: suivant.actif ? 'succes' : 'info',
        duree: 2600,
      })
    else {
      setActuel(actuel)
      toast(T.erreur, { ton: 'erreur' })
    }
  }

  const titre = actuel?.titre[principale]?.trim()
  const desc = actuel?.texte[principale]?.trim()
  const prix = actuel?.prix ? versNombre(actuel.prix) : null

  // La fenêtre reste hors de la carte : le reflet isole la carte (contexte d'empilement) et la couperait du reste.
  return (
    <div>
      <section className="pt-carte reflet-premium p-5 sm:p-6">
        <EnTete
          emoji="⭐"
          titre={T.platDuJour}
          sous={T.platDuJourSous}
          droite={
            actuel && (
              <button
                type="button"
                role="switch"
                aria-checked={actuel.actif}
                aria-label={T.affiche}
                title={T.affiche}
                disabled={bascule}
                className="pt-interrupteur mt-1"
                onClick={basculer}
              />
            )
          }
        />

        {actuel && titre ? (
          <div
            className={`relative mt-5 overflow-hidden rounded-[1.1rem] border border-[color-mix(in_oklab,var(--p-or-clair)_40%,transparent)] p-5 transition-opacity ${actuel.actif ? '' : 'opacity-55'}`}
            style={{
              background: 'linear-gradient(140deg, var(--p-or-pale), transparent 60%), var(--accent-pale)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="pt-surtitre">⭐ {T.platDuJour}</p>
                <p className="titre-portail mt-1.5 text-[1.6rem] font-medium leading-tight">{titre}</p>
                {desc && <p className="mt-1.5 text-sm leading-relaxed text-[var(--p-doux)]">{desc}</p>}
              </div>
              {prix !== null && Number.isFinite(prix) && <p className="pt-valeur pt-or shrink-0 text-[1.9rem]">{prixAffiche(prix, l)}</p>}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--p-doux)]">
                <span
                  className={`mr-2 inline-block size-2 rounded-full align-middle ${actuel.actif ? 'bg-[var(--p-vert)]' : 'bg-[var(--p-faible)]'}`}
                  aria-hidden
                />
                {actuel.actif ? (actuel.fin ? T.finAuto(dateLongue(actuel.fin, l)) : T.sansFin) : T.masque}
              </p>
              <button type="button" onClick={() => setOuverte(true)} className="pt-bouton-or !py-2.5 text-sm">
                ✎ {T.modifier}
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-carte-plate mt-5 flex flex-col items-center gap-3 px-6 py-8 text-center">
            <p className="text-sm text-[var(--p-doux)]">{T.aucunPlatDuJour}</p>
            <button type="button" onClick={() => setOuverte(true)} className="pt-bouton-or">
              ⭐ {T.creer}
            </button>
          </div>
        )}
      </section>

      <Fenetre ouverte={ouverte} fermer={fermer} titre={T.platDuJour} largeur="max-w-xl">
        {ouverte && (
          <EditeurPlat
            jeton={jeton}
            l={l}
            langues={langues}
            aujourdhui={aujourdhui}
            depart={
              actuel ?? {
                id: null,
                titre: versChamps(null, langues),
                texte: versChamps(null, langues),
                prix: '',
                fin: aujourdhui,
                actif: true,
              }
            }
            onEnregistre={(s) => {
              setActuel(s)
              setOuverte(false)
            }}
          />
        )}
      </Fenetre>
    </div>
  )
}

function EditeurPlat({
  jeton,
  l,
  langues,
  aujourdhui,
  depart,
  onEnregistre,
}: {
  jeton: string
  l: LanguePortail
  langues: string[]
  aujourdhui: string
  depart: Saisie
  onEnregistre: (s: Saisie) => void
}) {
  const T = TEXTES_PORTAIL[l]
  const principale = langues[0]
  const autres = langues.slice(1)
  const [s, setS] = useState<Saisie>(depart)
  const [etat, setEtat] = useState<Etat>('repos')
  const manquantes = autres.filter((c) => s.titre[principale]?.trim() && !s.titre[c]?.trim()).length
  const prixNombre = versNombre(s.prix)

  const maj = (champs: Partial<Saisie>) => {
    setS((x) => ({ ...x, ...champs }))
    setEtat('repos')
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    setEtat('envoi')
    const r = await platDuJourAction(jeton, s).catch(() => ({
      ok: false,
      id: null,
    }))
    if (!r.ok) {
      setEtat('erreur')
      toast(T.erreur, { ton: 'erreur' })
      return
    }
    vibrer(14)
    toast(s.actif ? T.platEnregistre : T.platMasque, {
      ton: 'succes',
      texte: s.titre[principale],
    })
    onEnregistre({ ...s, id: r.id })
  }

  return (
    <form onSubmit={envoyer} className="grid gap-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--p-ligne)] bg-[var(--p-surface-2)] px-4 py-3">
        <span className="text-sm font-semibold">{T.affiche}</span>
        <button
          type="button"
          role="switch"
          aria-checked={s.actif}
          aria-label={T.affiche}
          className="pt-interrupteur"
          onClick={() => maj({ actif: !s.actif })}
        />
      </div>
      <div>
        <label className="pt-etiquette" htmlFor="pdj-titre">
          {T.titre}{' '}
          {langues.length > 1 && (
            <span className="font-normal text-[var(--p-faible)]">
              · {drapeau(principale)} {T.principale}
            </span>
          )}
        </label>
        <input
          id="pdj-titre"
          required
          maxLength={120}
          value={s.titre[principale] ?? ''}
          onChange={(e) => maj({ titre: { ...s.titre, [principale]: e.target.value } })}
          placeholder={T.titreEx}
          className="pt-champ"
        />
      </div>
      <div>
        <label className="pt-etiquette" htmlFor="pdj-desc">
          {T.description}
        </label>
        <textarea
          id="pdj-desc"
          rows={2}
          maxLength={500}
          value={s.texte[principale] ?? ''}
          onChange={(e) => maj({ texte: { ...s.texte, [principale]: e.target.value } })}
          placeholder={T.descriptionEx}
          className="pt-champ resize-y"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="pt-etiquette" htmlFor="pdj-prix">
            {T.prix}
          </label>
          <div className="relative">
            <input
              id="pdj-prix"
              inputMode="decimal"
              value={s.prix}
              onChange={(e) =>
                maj({
                  prix: e.target.value.replace(/[^\d.,]/g, '').slice(0, 9),
                })
              }
              placeholder="24,00"
              className="pt-champ !pr-9"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3.5 my-auto h-fit text-sm text-[var(--p-faible)]">$</span>
          </div>
        </div>
        <div>
          <label className="pt-etiquette" htmlFor="pdj-fin">
            {T.jusquau}
          </label>
          <input id="pdj-fin" type="date" min={aujourdhui} value={s.fin} onChange={(e) => maj({ fin: e.target.value })} className="pt-champ" />
        </div>
      </div>

      {autres.length > 0 && (
        <details className="pt-carte-plate overflow-hidden">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
            <span>🌐 {T.traductions}</span>
            {manquantes > 0 && <span className="pt-pastille !bg-[var(--p-ambre-pale)] !text-[var(--p-ambre)]">{T.aTraduire(manquantes)}</span>}
          </summary>
          <div className="grid gap-4 border-t pt-sep px-4 py-4">
            {autres.map((c) => (
              <div key={c} className="grid gap-2">
                <p className="text-xs font-semibold text-[var(--p-doux)]">
                  {drapeau(c)} {nomLangue(c)}
                </p>
                <input
                  aria-label={`${T.titre} · ${nomLangue(c)}`}
                  maxLength={120}
                  value={s.titre[c] ?? ''}
                  onChange={(e) => maj({ titre: { ...s.titre, [c]: e.target.value } })}
                  placeholder={s.titre[principale] || T.titre}
                  className="pt-champ"
                  lang={c}
                  dir={c === 'ar' ? 'rtl' : undefined}
                />
                <textarea
                  aria-label={`${T.description} · ${nomLangue(c)}`}
                  rows={2}
                  maxLength={500}
                  value={s.texte[c] ?? ''}
                  onChange={(e) => maj({ texte: { ...s.texte, [c]: e.target.value } })}
                  placeholder={s.texte[principale] || T.description}
                  className="pt-champ resize-y"
                  lang={c}
                  dir={c === 'ar' ? 'rtl' : undefined}
                />
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Aperçu : ce que voit le client en haut du menu */}
      {s.titre[principale]?.trim() && (
        <div>
          <p className="pt-etiquette">{T.apercu}</p>
          <div className={`rounded-2xl border border-[var(--accent-moyen)] bg-[var(--accent-pale)] p-4 transition-opacity ${s.actif ? '' : 'opacity-50'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">⭐ {T.platDuJour}</p>
                <p className="titre-portail mt-1 text-lg font-medium leading-snug">{s.titre[principale]}</p>
                {s.texte[principale]?.trim() && <p className="mt-1 text-sm text-[var(--p-doux)]">{s.texte[principale]}</p>}
              </div>
              {s.prix && Number.isFinite(prixNombre) && <p className="shrink-0 font-semibold tabular-nums">{prixAffiche(prixNombre, l)}</p>}
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--p-faible)]">{s.actif ? (s.fin ? T.finAuto(dateLongue(s.fin, l)) : T.sansFin) : T.masque}</p>
        </div>
      )}

      <BoutonEnregistrer etat={etat} l={l} desactive={!s.titre[principale]?.trim()} />
    </form>
  )
}

// ---------------------------------------------------------------------------
// Message d'accueil
// ---------------------------------------------------------------------------

function Accueil({ jeton, l, langues, accueil }: { jeton: string; l: LanguePortail; langues: string[]; accueil: Texte }) {
  const T = TEXTES_PORTAIL[l]
  const [champs, setChamps] = useState(() => versChamps(accueil, langues))
  const [langue, setLangue] = useState(langues[0])
  const [etat, setEtat] = useState<Etat>('repos')

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    setEtat('envoi')
    const ok = await accueilAction(jeton, champs).catch(() => false)
    setEtat(ok ? 'ok' : 'erreur')
    toast(ok ? T.accueilEnregistre : T.erreur, {
      ton: ok ? 'succes' : 'erreur',
      texte: ok ? champs[langues[0]] || undefined : undefined,
    })
  }

  return (
    <form onSubmit={envoyer} className="pt-carte p-5 sm:p-6">
      <EnTete emoji="👋" titre={T.accueil} sous={T.accueilSous} />
      {langues.length > 1 && (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-0.5" role="tablist">
          {langues.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={langue === c} aria-pressed={langue === c} onClick={() => setLangue(c)} className="pt-puce">
              {drapeau(c)} {nomLangue(c)}
              {!champs[c]?.trim() && <span className="ml-1 text-[var(--p-ambre)]">•</span>}
            </button>
          ))}
        </div>
      )}
      <textarea
        key={langue}
        aria-label={`${T.accueil} · ${nomLangue(langue)}`}
        rows={3}
        maxLength={300}
        value={champs[langue] ?? ''}
        onChange={(e) => {
          setChamps({ ...champs, [langue]: e.target.value })
          setEtat('repos')
        }}
        placeholder={T.accueilEx}
        className="pt-champ mt-4 resize-y"
        lang={langue}
        dir={langue === 'ar' ? 'rtl' : undefined}
      />
      <div className="mt-1.5 flex justify-end text-xs tabular-nums text-[var(--p-faible)]">{(champs[langue] ?? '').length} / 300</div>
      <div className="mt-2">
        <BoutonEnregistrer etat={etat} l={l} />
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Annonces
// ---------------------------------------------------------------------------

function Annonces({ jeton, l, langueDefaut, annonces }: { jeton: string; l: LanguePortail; langueDefaut: string; annonces: Annonce[] }) {
  const T = TEXTES_PORTAIL[l]
  const [actifs, setActifs] = useState<Record<string, boolean>>(() => Object.fromEntries(annonces.map((a) => [a.id, a.actif])))

  async function basculer(a: Annonce) {
    const v = !actifs[a.id]
    const nom = texte(a.titre, l, langueDefaut) || '—'
    setActifs((x) => ({ ...x, [a.id]: v }))
    vibrer(10)
    const ok = await annonceAction(jeton, a.id, v).catch(() => false)
    if (!ok) {
      setActifs((x) => ({ ...x, [a.id]: !v }))
      toast(T.erreur, { ton: 'erreur' })
    } else
      toast(v ? T.annonceAffichee(nom) : T.annonceMasquee(nom), {
        ton: v ? 'succes' : 'info',
        duree: 2400,
      })
  }

  return (
    <section className="pt-carte p-5 sm:p-6">
      <EnTete emoji="📣" titre={T.autresAnnonces} sous={T.autresAnnoncesSous} />
      {annonces.length === 0 ? (
        <p className="pt-carte-plate mt-5 px-4 py-5 text-center text-sm text-[var(--p-doux)]">{T.aucuneAnnonce}</p>
      ) : (
        <ul className="mt-5 divide-y divide-[var(--p-ligne)]">
          {annonces.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-3">
              <div className={`min-w-0 flex-1 transition-opacity ${actifs[a.id] ? '' : 'opacity-55'}`}>
                <p className="truncate font-semibold">{texte(a.titre, l, langueDefaut) || '—'}</p>
                <p className="mt-0.5 text-xs text-[var(--p-faible)]">
                  {T.typesAnnonce[a.type]}
                  {a.fin
                    ? ` · ${T.jusquau.toLowerCase()} ${new Date(`${a.fin}T12:00:00`).toLocaleDateString(l === 'fr' ? 'fr-CA' : 'en-CA', { day: 'numeric', month: 'short' })}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(actifs[a.id])}
                aria-label={`${T.affiche} : ${texte(a.titre, l, langueDefaut)}`}
                className="pt-interrupteur"
                onClick={() => basculer(a)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Plats épuisés (« 86 »)
// ---------------------------------------------------------------------------

function Epuises({ jeton, l, langueDefaut, plats }: { jeton: string; l: LanguePortail; langueDefaut: string; plats: PlatDispo[] }) {
  const T = TEXTES_PORTAIL[l]
  const [dispo, setDispo] = useState<Record<string, boolean>>(() => Object.fromEntries(plats.map((p) => [p.id, p.disponible])))
  const [recherche, setRecherche] = useState('')
  const [seulement, setSeulement] = useState(false)
  const [confirmer, setConfirmer] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const fermerConfirmation = useCallback(() => setConfirmer(false), [])

  const nbEpuises = Object.values(dispo).filter((v) => !v).length
  const plusieursMenus = new Set(plats.map((p) => p.menu_id)).size > 1

  // Regroupés par menu puis section, filtrés par la recherche (sans accents).
  const blocs = useMemo(() => {
    const q = sansAccents(recherche.trim())
    const sortie: { cle: string; titre: string; plats: PlatDispo[] }[] = []
    for (const p of plats) {
      if (seulement && dispo[p.id]) continue
      const nom = texte(p.nom, l, langueDefaut)
      if (q && !sansAccents(`${nom} ${texte(p.section, l, langueDefaut)}`).includes(q)) continue
      const section = texte(p.section, l, langueDefaut)
      const titre = plusieursMenus ? `${texte(p.menu, l, langueDefaut)} · ${section}` : section
      const cle = `${p.menu_id}:${section}`
      const dernier = sortie[sortie.length - 1]
      if (dernier?.cle === cle) dernier.plats.push(p)
      else sortie.push({ cle, titre, plats: [p] })
    }
    return sortie
  }, [plats, recherche, seulement, dispo, l, langueDefaut, plusieursMenus])

  async function basculer(p: PlatDispo) {
    const v = !dispo[p.id]
    const nom = texte(p.nom, l, langueDefaut) || '—'
    setDispo((x) => ({ ...x, [p.id]: v }))
    vibrer(v ? 10 : [10, 40, 10])
    const ok = await disponibiliteAction(jeton, p.id, v).catch(() => false)
    if (!ok) {
      setDispo((x) => ({ ...x, [p.id]: !v }))
      toast(T.erreur, { ton: 'erreur' })
    } else
      toast(v ? T.platDispo(nom) : T.platEpuise(nom), {
        ton: v ? 'succes' : 'alerte',
        duree: 2200,
      })
  }

  async function toutRemettre() {
    setOccupe(true)
    const n = await toutDisponibleAction(jeton).catch(() => null)
    setOccupe(false)
    setConfirmer(false)
    if (n === null) return toast(T.erreur, { ton: 'erreur' })
    setDispo((x) => Object.fromEntries(Object.keys(x).map((k) => [k, true])))
    vibrer(16)
    toast(T.toutDisponibleOk(n), { ton: 'succes' })
  }

  return (
    <>
      <section className="pt-carte p-5 sm:p-6 lg:sticky lg:top-5">
        <EnTete
          emoji="🚫"
          titre={T.epuises}
          sous={T.epuisesSous}
          droite={
            <span
              className={`pt-pastille shrink-0 ${nbEpuises ? '!bg-[var(--p-rouge-pale)] !text-[var(--p-rouge)]' : '!bg-[var(--p-vert-pale)] !text-[var(--p-vert)]'}`}
            >
              {T.nEpuises(nbEpuises)}
            </span>
          }
        />

        {plats.length === 0 ? (
          <p className="pt-carte-plate mt-5 px-4 py-8 text-center text-sm text-[var(--p-doux)]">{T.aucunPlat}</p>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 my-auto h-fit text-[var(--p-faible)]" aria-hidden>
                  ⌕
                </span>
                <input
                  type="search"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder={T.rechercher}
                  aria-label={T.rechercher}
                  className="pt-champ !pl-9"
                />
              </div>
              <button type="button" className="pt-puce" aria-pressed={seulement} onClick={() => setSeulement((v) => !v)}>
                {T.seulementEpuises}
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1 lg:max-h-[calc(100vh-22rem)]">
              {blocs.length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-[var(--p-doux)]">{seulement && !recherche ? T.nEpuises(0) : T.aucunResultat}</p>
              ) : (
                blocs.map((b) => (
                  <div key={b.cle} className="mb-4 last:mb-0">
                    <p className="sticky top-0 z-[1] bg-[var(--p-surface)] py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--p-faible)]">
                      {b.titre}
                    </p>
                    <ul className="divide-y divide-[var(--p-ligne)]">
                      {b.plats.map((p) => {
                        const ok = dispo[p.id]
                        return (
                          <li key={p.id} className="flex items-center gap-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p
                                className={`truncate font-medium transition-colors ${ok ? '' : 'text-[var(--p-faible)] line-through decoration-[var(--p-rouge)] decoration-2'}`}
                              >
                                {texte(p.nom, l, langueDefaut) || '—'}
                              </p>
                              {p.prix !== null && <p className="text-xs tabular-nums text-[var(--p-faible)]">{prixAffiche(p.prix, l)}</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => basculer(p)}
                              aria-pressed={!ok}
                              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition-[background-color,color,border-color,transform] active:scale-95 ${
                                ok
                                  ? 'border-[var(--p-ligne-forte)] bg-[var(--p-surface)] text-[var(--p-vert)] hover:border-[var(--p-rouge)] hover:text-[var(--p-rouge)]'
                                  : 'border-transparent bg-[var(--p-rouge)] text-white shadow-[0_8px_18px_-10px_var(--p-rouge)]'
                              }`}
                            >
                              {ok ? `● ${T.disponible}` : `✕ ${T.epuise}`}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end border-t pt-sep pt-4">
              <button type="button" onClick={() => setConfirmer(true)} disabled={nbEpuises === 0} className="pt-bouton-doux !py-2.5 text-sm">
                ↺ {T.toutDisponible}
              </button>
            </div>
          </>
        )}
      </section>

      <Fenetre ouverte={confirmer} fermer={fermerConfirmation} titre={T.confirmerTout} largeur="max-w-sm">
        <p className="text-sm leading-relaxed text-[var(--p-doux)]">{T.confirmerToutTexte(nbEpuises)}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={fermerConfirmation} className="pt-bouton-fantome">
            {T.annuler}
          </button>
          <button type="button" onClick={toutRemettre} disabled={occupe} className="pt-bouton">
            {occupe ? T.enregistrement : T.confirmer}
          </button>
        </div>
      </Fenetre>
    </>
  )
}
