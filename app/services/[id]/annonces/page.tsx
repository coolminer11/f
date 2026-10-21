import { notFound } from 'next/navigation'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import { annonces as lireAnnonces, lireEtablissement } from '@/lib/services/donnees'
import { texte } from '@/lib/services/langues'
import type { Annonce, Etablissement } from '@/lib/services/types'
import { argent } from '@/lib/format'
import { dateCourte } from '@/lib/langue'
import BoutonEnvoi from '@/components/bouton-envoi'
import Cache from '@/components/services/bo/cache'
import Confirmer from '@/components/services/bo/confirmer'
import BoutonFenetre from '@/components/services/bo/bouton-fenetre'
import ChampsLangues, { ATraduire } from '@/components/services/bo/champs-langues'
import { Bloc, Pastille } from '@/components/services/bo/elements'
import { creerAnnonceAction, modifierAnnonceAction, supprimerAnnonceAction } from '../../actions'
import Triable, { FlechesTri, PoigneeTri } from '@/components/services/bo/triable'

export const dynamic = 'force-dynamic'

const TYPES: Record<Annonce['type'], { icone: string; nom: string; aide: string }> = {
  plat_du_jour: { icone: '🍽️', nom: 'Plat du jour', aide: 'En tête du menu, le jour dit.' },
  promo: { icone: '🏷️', nom: 'Promotion', aide: '5 à 7, menu du midi, rabais…' },
  info: { icone: 'ℹ️', nom: 'Information', aide: 'Fermeture, travaux, nouveauté.' },
  evenement: { icone: '🎉', nom: 'Événement', aide: 'Spectacle, dégustation, soirée à thème.' },
}

function statut(a: Annonce, auj: string): { ton: 'positif' | 'accent' | 'neutre'; texte: string } {
  if (!a.actif) return { ton: 'neutre', texte: 'Désactivée' }
  if (a.debut && a.debut > auj) return { ton: 'accent', texte: `Programmée · ${dateCourte(a.debut, 'fr')}` }
  if (a.fin && a.fin < auj) return { ton: 'neutre', texte: 'Terminée' }
  return { ton: 'positif', texte: '● En ligne' }
}

function Formulaire({ e, a, retour, type, auj }: { e: Etablissement; a?: Annonce; retour: string; type?: Annonce['type']; auj: string }) {
  const t = a?.type ?? type ?? 'info'
  return (
    <form action={a ? modifierAnnonceAction : creerAnnonceAction} className="space-y-4">
      <Cache etab={e.id} retour={retour} ancre={a ? `annonce-${a.id}` : undefined} id={a?.id} />
      <fieldset>
        <legend className="etiquette">Type</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(TYPES) as Annonce['type'][]).map((k) => (
            <label
              key={k}
              title={TYPES[k].aide}
              className="flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border border-[var(--color-ligne)] p-2.5 text-xs has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-doux)]"
            >
              <input type="radio" name="type" value={k} defaultChecked={k === t} className="sr-only" />
              <span className="text-lg" aria-hidden>
                {TYPES[k].icone}
              </span>
              <span className="font-semibold">{TYPES[k].nom}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <ChampsLangues nom="titre" libelle="Titre" valeurs={a?.titre} langues={e.langues} defaut={e.langue_defaut} max={120} requis exemple="Poutine au canard confit" />
      <ChampsLangues nom="texte" libelle="Texte (facultatif)" valeurs={a?.texte} langues={e.langues} defaut={e.langue_defaut} multiligne max={600} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="etiquette">Prix ($, facultatif)</span>
          <input name="prix" inputMode="decimal" defaultValue={a?.prix != null ? String(a.prix).replace('.', ',') : ''} className="champ tabular-nums" />
        </label>
        <label>
          <span className="etiquette">À partir du</span>
          <input type="date" name="debut" defaultValue={a ? (a.debut ?? '') : t === 'plat_du_jour' ? auj : ''} className="champ" />
        </label>
        <label>
          <span className="etiquette">Jusqu’au (inclus)</span>
          <input type="date" name="fin" defaultValue={a ? (a.fin ?? '') : t === 'plat_du_jour' ? auj : ''} className="champ" />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="actif" defaultChecked={a?.actif ?? true} /> Publiée
        </label>
        <BoutonEnvoi attente="…">{a ? 'Enregistrer' : 'Publier l’annonce'}</BoutonEnvoi>
      </div>
      <p className="text-xs text-[var(--color-encre-doux)]">Sans dates, l’annonce reste en ligne jusqu’à ce que vous la désactiviez.</p>
    </form>
  )
}

export default async function Annonces({ params }: { params: Promise<{ id: string }> }) {
  await exigerProprietaire()
  const { id } = await params
  const e = await lireEtablissement(id)
  if (!e) notFound()
  const liste = await lireAnnonces(e.id, e.options.fuseau, true)
  const ici = `/services/${e.id}/annonces`
  const auj = new Date().toLocaleDateString('en-CA', { timeZone: e.options.fuseau })
  const D = e.langue_defaut
  const enLigne = liste.filter((a) => statut(a, auj).ton === 'positif')

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-encre-doux)]">
            {enLigne.length} annonce{enLigne.length > 1 ? 's' : ''} en ligne · {liste.length} au total. Elles s’affichent en haut de la page client.
          </p>
          <div className="flex flex-wrap gap-2">
            {e.type === 'restaurant' && (
              <BoutonFenetre titre="Plat du jour" libelle="🍽️ Plat du jour" className="bouton bouton-secondaire" largeur="max-w-2xl">
                <Formulaire e={e} retour={ici} type="plat_du_jour" auj={auj} />
              </BoutonFenetre>
            )}
            <BoutonFenetre titre="Nouvelle annonce" libelle="+ Nouvelle annonce" largeur="max-w-2xl">
              <Formulaire e={e} retour={ici} type={e.type === 'hotel' ? 'evenement' : 'promo'} auj={auj} />
            </BoutonFenetre>
          </div>
        </div>

        {liste.length === 0 ? (
          <div className="carte grid place-items-center gap-2 px-6 py-12 text-center">
            <span className="text-4xl" aria-hidden>
              📣
            </span>
            <h2 className="text-base font-semibold">Aucune annonce</h2>
            <p className="max-w-md text-sm text-[var(--color-encre-doux)]">
              {e.type === 'hotel' ? 'Une dégustation ce soir, le spa en promotion, des travaux à l’étage : annoncez-le ici.' : 'Le plat du jour, le 5 à 7, la soirée de jeudi : annoncez-le ici.'}
            </p>
          </div>
        ) : (
          <Triable quoi="annonces" etab={e.id} as="ul" className="cascade space-y-3" libelle="Annonces">
            {liste.map((a, i) => {
              const st = statut(a, auj)
              return (
                <li key={a.id} data-ligne data-tri-id={a.id} id={`annonce-${a.id}`} className={`carte scroll-mt-24 p-4 ${st.ton === 'neutre' ? 'opacity-75' : ''}`}>
                  <div className="flex items-start gap-2">
                    <PoigneeTri libelle={`Déplacer « ${texte(a.titre, D)} »`} className="mt-1.5 -ml-1" />
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl text-xl" style={{ background: `${e.couleur}1a` }} aria-hidden>
                      {TYPES[a.type].icone}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{texte(a.titre, D)}</span>
                        <Pastille ton={st.ton}>{st.texte}</Pastille>
                        <ATraduire textes={[a.titre, a.texte]} langues={e.langues} defaut={D} />
                      </div>
                      {texte(a.texte, D) && <p className="mt-0.5 line-clamp-2 text-sm text-[var(--color-encre-doux)]">{texte(a.texte, D)}</p>}
                      <p className="mt-1 text-xs text-[var(--color-encre-doux)]">
                        {TYPES[a.type].nom}
                        {a.prix != null && <> · <span className="font-semibold text-[var(--color-encre)]">{argent(a.prix)}</span></>}
                        {' · '}
                        {a.debut || a.fin
                          ? a.debut && a.fin && a.debut === a.fin
                            ? `le ${dateCourte(a.debut, 'fr')}`
                            : `${a.debut ? `du ${dateCourte(a.debut, 'fr')}` : 'dès maintenant'} ${a.fin ? `au ${dateCourte(a.fin, 'fr')}` : 'sans fin'}`
                          : 'sans date de fin'}
                      </p>
                    </div>
                    <form className="flex shrink-0 items-center gap-0.5">
                      <Cache etab={e.id} retour={ici} ancre={`annonce-${a.id}`} id={a.id} />
                      <FlechesTri premier={i === 0} dernier={i === liste.length - 1} className="grid size-7 place-items-center rounded-lg text-xs hover:bg-[var(--color-fond)] disabled:opacity-30" />
                      <Confirmer
                        action={supprimerAnnonceAction}
                        poussiere
                        titre="Supprimer cette annonce ?"
                        texte={`« ${texte(a.titre, D)} » disparaîtra de la page client. Pour la retirer temporairement, décochez plutôt « Publiée ».`}
                        libelle="✕"
                        titreBouton="Supprimer"
                        className="grid size-7 place-items-center rounded-lg text-xs text-[var(--color-encre-doux)] hover:bg-[var(--color-fond)] hover:text-[var(--color-negatif)]"
                      />
                    </form>
                  </div>
                  <details className="group mt-2">
                    <summary className="ml-[5rem] inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline">
                      <span className="transition group-open:rotate-90">›</span> Modifier
                    </summary>
                    <div className="mt-3 border-t border-[var(--color-ligne)] pt-4">
                      <Formulaire e={e} a={a} retour={ici} auj={auj} />
                    </div>
                  </details>
                </li>
              )
            })}
          </Triable>
        )}
      </div>

      <aside>
        <Bloc titre="Ce que voient les clients" sous="Les annonces en ligne aujourd’hui, dans l’ordre.">
          <div className="mx-auto max-w-[15rem] overflow-hidden rounded-[1.6rem] border-[6px] border-[#1c1712] bg-[#fbf6ee] p-3 shadow-xl">
            <p className="truncate px-1 text-xs font-semibold text-[#2a211a]">{e.nom}</p>
            {enLigne.length === 0 ? (
              <p className="px-1 py-6 text-center text-[11px] text-[#6b5d50]">Aucune annonce en ce moment.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {enLigne.slice(0, 4).map((a) => (
                  <div key={a.id} className="rounded-xl p-2.5 text-white shadow" style={{ background: `linear-gradient(135deg, ${e.couleur}, ${e.couleur}cc)` }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/75">
                      {TYPES[a.type].icone} {TYPES[a.type].nom}
                    </p>
                    <p className="text-[11px] font-semibold leading-tight">{texte(a.titre, D)}</p>
                    {texte(a.texte, D) && <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-white/80">{texte(a.texte, D)}</p>}
                    {a.prix != null && <p className="mt-1 text-[10px] font-bold">{argent(a.prix)}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Bloc>
      </aside>
    </div>
  )
}
