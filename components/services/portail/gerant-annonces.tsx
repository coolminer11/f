'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Annonce } from '@/lib/services/types'
import { texte } from '@/lib/services/langues'
import { toast } from '@/components/effets/toasts'
import { desintegrer, vibrer } from '@/components/effets/desintegration'
import Fenetre from '@/components/effets/fenetre'
import { annonceAction } from '@/app/service/[jeton]/actions'
import { annonceGerantAction, supprimerAnnonceGerantAction } from '@/app/service/[jeton]/actions-gerant'
import { EnTete } from '@/components/services/portail/controles'
import { Confirmation, OngletsLangues, languesManquantes, prixAffiche, prixVersSaisie, reapparaitre, useRelire, versChamps } from '@/components/services/portail/gerant-commun'
import { TEXTES_PORTAIL, type LanguePortail } from '@/components/services/portail/textes'

type TypeAnnonce = 'promo' | 'info' | 'evenement'
type Saisie = {
  id: string | null
  type: TypeAnnonce
  titre: Record<string, string>
  texte: Record<string, string>
  prix: string
  debut: string
  fin: string
  actif: boolean
}

const ICONES: Record<TypeAnnonce, string> = { promo: '🏷️', info: 'ℹ️', evenement: '🎉' }

const dateCourte = (j: string, l: LanguePortail) => new Date(`${j}T12:00:00`).toLocaleDateString(l === 'fr' ? 'fr-CA' : 'en-CA', { day: 'numeric', month: 'long' })

/**
 * Les annonces du gérant : promotions, infos et événements, avec leurs dates.
 * Le plat du jour reste dans Contrôles (le personnel le règle en un geste) :
 * ici, un lien y mène.
 */
export default function GerantAnnonces({
  jeton,
  l,
  langues,
  aujourdhui,
  annonces,
}: {
  jeton: string
  l: LanguePortail
  langues: string[]
  /** AAAA-MM-JJ dans le fuseau de l'établissement. */
  aujourdhui: string
  annonces: Annonce[]
}) {
  const T = TEXTES_PORTAIL[l].gerant
  const [relire] = useRelire()
  const [edition, setEdition] = useState<Saisie | null>(null)
  const [aSupprimer, setASupprimer] = useState<{ id: string; el: HTMLElement | null } | null>(null)
  const fermer = useCallback(() => setEdition(null), [])
  const fermerSuppression = useCallback(() => setASupprimer(null), [])

  function ouvrir(a: Annonce | null) {
    setEdition(
      a
        ? {
            id: a.id,
            type: a.type === 'info' || a.type === 'evenement' ? a.type : 'promo',
            titre: versChamps(a.titre, langues),
            texte: versChamps(a.texte, langues),
            prix: prixVersSaisie(a.prix, l),
            debut: a.debut ?? '',
            fin: a.fin ?? '',
            actif: a.actif,
          }
        : { id: null, type: 'promo', titre: versChamps(null, langues), texte: versChamps(null, langues), prix: '', debut: '', fin: '', actif: true },
    )
  }

  async function supprimer() {
    const s = aSupprimer
    if (!s) return
    vibrer([10, 40, 18])
    await desintegrer(s.el)
    const r = await supprimerAnnonceGerantAction(jeton, s.id).catch(() => ({ ok: false as const, erreur: TEXTES_PORTAIL[l].erreur }))
    if (r.ok) {
      toast(T.annonceSupprimee, { ton: 'succes', duree: 2400 })
      relire()
    } else {
      reapparaitre(s.el)
      toast(TEXTES_PORTAIL[l].erreur, { ton: 'erreur', texte: r.erreur })
    }
  }

  return (
    <>
      <div className="cascade space-y-5">
        <section className="pt-carte fond-maillage reflet-premium p-5 sm:p-6">
          <EnTete
            emoji="📣"
            titre={T.annoncesTitre}
            sous={T.annoncesSous}
            droite={
              <button type="button" className="pt-bouton hidden shrink-0 sm:inline-flex" onClick={() => ouvrir(null)}>
                ＋ {T.nouvelleAnnonce}
              </button>
            }
          />
          <button type="button" className="pt-bouton mt-5 w-full sm:hidden" onClick={() => ouvrir(null)}>
            ＋ {T.nouvelleAnnonce}
          </button>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--p-or-clair)_40%,transparent)] bg-[var(--p-or-pale)] px-4 py-3">
            <p className="text-sm">⭐ {T.platDuJourIci}</p>
            <Link href={`/service/${jeton}?v=controles`} prefetch={false} className="pt-bouton-or !py-2 text-sm">
              {T.allerControles} →
            </Link>
          </div>
        </section>

        <section className="pt-carte p-5 sm:p-6">
          {annonces.length === 0 ? (
            <p className="pt-carte-plate px-4 py-8 text-center text-sm text-[var(--p-doux)]">{T.aucuneAnnonce}</p>
          ) : (
            <ul className="divide-y divide-[var(--p-ligne)]">
              {annonces.map((a) => (
                <LigneAnnonce
                  key={a.id}
                  jeton={jeton}
                  l={l}
                  principale={langues[0]}
                  aujourdhui={aujourdhui}
                  annonce={a}
                  ouvrir={() => ouvrir(a)}
                  supprimer={(el) => setASupprimer({ id: a.id, el })}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <Fenetre ouverte={edition !== null} fermer={fermer} titre={edition?.id ? T.modifierAnnonce : T.nouvelleAnnonce} largeur="max-w-xl">
        {edition && <EditeurAnnonce key={edition.id ?? 'nouvelle'} jeton={jeton} l={l} langues={langues} depart={edition} fermer={fermer} relire={relire} />}
      </Fenetre>

      <Confirmation
        l={l}
        ouverte={aSupprimer !== null}
        fermer={fermerSuppression}
        titre={T.confirmerSupprimerAnnonce}
        texte={T.confirmerSupprimerAnnonceTexte}
        onConfirmer={() => void supprimer()}
      />
    </>
  )
}

function LigneAnnonce({
  jeton,
  l,
  principale,
  aujourdhui,
  annonce: a,
  ouvrir,
  supprimer,
}: {
  jeton: string
  l: LanguePortail
  principale: string
  aujourdhui: string
  annonce: Annonce
  ouvrir: () => void
  supprimer: (el: HTMLElement | null) => void
}) {
  const T = TEXTES_PORTAIL[l].gerant
  const ligne = useRef<HTMLLIElement>(null)
  const [relire] = useRelire()
  const [actif, setActif] = useState(a.actif)
  useEffect(() => setActif(a.actif), [a.actif])
  const titre = texte(a.titre, principale, principale) || '—'
  const corps = texte(a.texte, principale, principale)
  const type: TypeAnnonce = a.type === 'info' || a.type === 'evenement' ? a.type : 'promo'
  const statut = !actif
    ? { texte: T.masquee, couleur: 'bg-[var(--p-faible)]' }
    : a.fin && a.fin < aujourdhui
      ? { texte: T.terminee, couleur: 'bg-[var(--p-faible)]' }
      : a.debut && a.debut > aujourdhui
        ? { texte: T.programmee(dateCourte(a.debut, l)), couleur: 'bg-[var(--p-ambre)]' }
        : { texte: a.fin ? `${T.enLigne} · ${T.jusquau(dateCourte(a.fin, l))}` : T.enLigne, couleur: 'bg-[var(--p-vert)]' }

  async function basculer() {
    const v = !actif
    setActif(v)
    vibrer(10)
    const ok = await annonceAction(jeton, a.id, v).catch(() => false)
    if (!ok) {
      setActif(!v)
      toast(TEXTES_PORTAIL[l].erreur, { ton: 'erreur' })
      return
    }
    toast(v ? TEXTES_PORTAIL[l].annonceAffichee(titre) : TEXTES_PORTAIL[l].annonceMasquee(titre), { ton: v ? 'succes' : 'info', duree: 2400 })
    relire()
  }

  return (
    <li ref={ligne} className="flex items-center gap-3 py-3.5" data-ligne data-annonce={a.id}>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-pale)] text-lg ring-1 ring-[var(--p-ligne)]" aria-hidden>
        {ICONES[type]}
      </span>
      <button type="button" onClick={ouvrir} className={`min-w-0 flex-1 text-left transition-opacity ${actif ? '' : 'opacity-55'}`} aria-label={`${T.modifierAnnonce} : ${titre}`}>
        <span className="flex items-baseline gap-2">
          <span className="truncate font-semibold">{titre}</span>
          {a.prix !== null && <span className="pt-or shrink-0 text-sm font-semibold tabular-nums">{prixAffiche(a.prix, l)}</span>}
        </span>
        {corps && <span className="mt-0.5 block truncate text-sm text-[var(--p-doux)]">{corps}</span>}
        <span className="mt-1 flex items-center gap-1.5 text-xs text-[var(--p-faible)]">
          <span className={`inline-block size-2 rounded-full ${statut.couleur}`} aria-hidden />
          {T.types[type]} · {statut.texte}
        </span>
      </button>
      <button type="button" role="switch" aria-checked={actif} aria-label={`${T.affichee} : ${titre}`} className="pt-interrupteur" onClick={() => void basculer()} />
      <button type="button" className="pt-bouton-fantome !px-2.5 !py-2 text-[var(--p-rouge)]" aria-label={`${T.supprimer} : ${titre}`} title={T.supprimer} onClick={() => supprimer(ligne.current)}>
        🗑
      </button>
    </li>
  )
}

function EditeurAnnonce({
  jeton,
  l,
  langues,
  depart,
  fermer,
  relire,
}: {
  jeton: string
  l: LanguePortail
  langues: string[]
  depart: Saisie
  fermer: () => void
  relire: () => void
}) {
  const T = TEXTES_PORTAIL[l].gerant
  const principale = langues[0]
  const [s, setS] = useState<Saisie>(depart)
  const [langue, setLangue] = useState(principale)
  const [envoi, setEnvoi] = useState(false)
  const maj = (c: Partial<Saisie>) => setS((x) => ({ ...x, ...c }))
  const rtl = langue === 'ar' ? 'rtl' : undefined

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    const r = await annonceGerantAction(jeton, s).catch(() => ({ ok: false as const, erreur: TEXTES_PORTAIL[l].erreur }))
    setEnvoi(false)
    if (!r.ok) {
      toast(TEXTES_PORTAIL[l].erreur, { ton: 'erreur', texte: r.erreur })
      return
    }
    vibrer(14)
    toast(s.id ? T.annonceEnregistree : T.annonceAjoutee, { ton: 'succes', texte: s.titre[principale] })
    relire()
    fermer()
  }

  return (
    <form onSubmit={envoyer} className="grid gap-4">
      <fieldset>
        <legend className="pt-etiquette">{T.type}</legend>
        <div className="flex flex-wrap gap-1.5">
          {(['promo', 'evenement', 'info'] as const).map((t) => (
            <button key={t} type="button" className="pt-puce" aria-pressed={s.type === t} onClick={() => maj({ type: t })}>
              {ICONES[t]} {T.types[t]}
            </button>
          ))}
        </div>
      </fieldset>

      <OngletsLangues l={l} langues={langues} active={langue} choisir={setLangue} manquantes={languesManquantes([s.titre, s.texte], langues)} />

      <div>
        <label className="pt-etiquette" htmlFor="annonce-titre">
          {T.titre}
        </label>
        <input
          id="annonce-titre"
          name="titre"
          required={langue === principale}
          maxLength={120}
          value={s.titre[langue] ?? ''}
          onChange={(e) => maj({ titre: { ...s.titre, [langue]: e.target.value } })}
          placeholder={langue === principale ? T.titreEx : s.titre[principale] || T.titreEx}
          className="pt-champ"
          lang={langue}
          dir={rtl}
        />
      </div>
      <div>
        <label className="pt-etiquette" htmlFor="annonce-texte">
          {T.texte}
        </label>
        <textarea
          id="annonce-texte"
          name="texte"
          rows={3}
          maxLength={600}
          value={s.texte[langue] ?? ''}
          onChange={(e) => maj({ texte: { ...s.texte, [langue]: e.target.value } })}
          placeholder={langue === principale ? T.texteEx : s.texte[principale] || T.texteEx}
          className="pt-champ resize-y"
          lang={langue}
          dir={rtl}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="pt-etiquette" htmlFor="annonce-prix">
            {T.prixFacultatif}
          </label>
          <input id="annonce-prix" name="prix" inputMode="decimal" maxLength={12} value={s.prix} onChange={(e) => maj({ prix: e.target.value })} className="pt-champ tabular-nums" />
        </div>
        <div>
          <label className="pt-etiquette" htmlFor="annonce-debut">
            {T.debut}
          </label>
          <input id="annonce-debut" name="debut" type="date" value={s.debut} onChange={(e) => maj({ debut: e.target.value })} className="pt-champ" />
        </div>
        <div>
          <label className="pt-etiquette" htmlFor="annonce-fin">
            {T.fin}
          </label>
          <input id="annonce-fin" name="fin" type="date" min={s.debut || undefined} value={s.fin} onChange={(e) => maj({ fin: e.target.value })} className="pt-champ" />
        </div>
      </div>
      <p className="-mt-2 text-xs text-[var(--p-faible)]">{T.datesAide}</p>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--p-ligne)] bg-[var(--p-surface-2)] px-4 py-3">
        <span className="text-sm font-semibold">{T.affichee}</span>
        <button type="button" role="switch" aria-checked={s.actif} aria-label={T.affichee} className="pt-interrupteur" onClick={() => maj({ actif: !s.actif })} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="pt-bouton-doux" onClick={fermer}>
          {T.annuler}
        </button>
        <button disabled={envoi} className="pt-bouton">
          {envoi ? TEXTES_PORTAIL[l].enregistrement : s.id ? TEXTES_PORTAIL[l].enregistrer : T.ajouter}
        </button>
      </div>
    </form>
  )
}
