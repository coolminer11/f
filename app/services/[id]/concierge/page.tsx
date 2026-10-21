import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import { lireEtablissement, rubriques as lireRubriques } from '@/lib/services/donnees'
import { texte } from '@/lib/services/langues'
import { RUBRIQUES, type Etablissement, type Rubrique } from '@/lib/services/types'
import BoutonEnvoi from '@/components/bouton-envoi'
import Cache from '@/components/services/bo/cache'
import Confirmer from '@/components/services/bo/confirmer'
import BoutonFenetre from '@/components/services/bo/bouton-fenetre'
import ChampsLangues, { ATraduire } from '@/components/services/bo/champs-langues'
import { Bloc, Pastille } from '@/components/services/bo/elements'
import { creerRubriqueAction, deplacerRubriqueAction, modifierRubriqueAction, supprimerRubriqueAction, wifiAction } from '../../actions'

export const dynamic = 'force-dynamic'

const petitBouton = 'grid size-7 place-items-center rounded-lg text-xs text-[var(--color-encre-doux)] hover:bg-[var(--color-fond)] disabled:opacity-30'

function Formulaire({ e, r, retour }: { e: Etablissement; r?: Rubrique; retour: string }) {
  return (
    <form action={r ? modifierRubriqueAction : creerRubriqueAction} className="space-y-4">
      <Cache etab={e.id} retour={retour} ancre={r ? `rubrique-${r.id}` : undefined} id={r?.id} />
      <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
        <label>
          <span className="etiquette">Rubrique</span>
          <select name="type" defaultValue={r?.type ?? 'recommandation'} className="champ">
            {RUBRIQUES.map((x) => (
              <option key={x.cle} value={x.cle}>
                {x.icone} {x.fr}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="etiquette">Icône</span>
          <input name="icone" defaultValue={r?.icone ?? ''} maxLength={16} className="champ text-center text-lg" placeholder="🏰" />
        </label>
      </div>
      <ChampsLangues nom="titre" libelle="Titre" valeurs={r?.titre} langues={e.langues} defaut={e.langue_defaut} max={120} requis exemple="Petit-déjeuner" />
      <ChampsLangues nom="texte" libelle="Texte" valeurs={r?.texte} langues={e.langues} defaut={e.langue_defaut} multiligne lignes={3} max={2000} exemple="Servi de 7 h à 10 h 30 au rez-de-chaussée." />
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="etiquette">Lien (carte, réservation… facultatif)</span>
          <input name="lien" defaultValue={r?.lien ?? ''} className="champ" placeholder="https://maps.google.com/…" />
        </label>
        <label>
          <span className="etiquette">Téléphone (facultatif)</span>
          <input name="telephone" defaultValue={r?.telephone ?? ''} className="champ" placeholder="418 555-0100" />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="actif" defaultChecked={r?.actif ?? true} /> Visible pour les clients
        </label>
        <BoutonEnvoi attente="…">{r ? 'Enregistrer' : 'Ajouter la rubrique'}</BoutonEnvoi>
      </div>
    </form>
  )
}

export default async function Concierge({ params }: { params: Promise<{ id: string }> }) {
  await exigerProprietaire()
  const { id } = await params
  const e = await lireEtablissement(id)
  if (!e) notFound()
  const liste = await lireRubriques(e.id, true)
  const ici = `/services/${e.id}/concierge`
  const D = e.langue_defaut
  const visibles = liste.filter((r) => r.actif)

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        {!e.options.concierge && (
          <p className="carte border-[var(--color-attention)] px-4 py-3 text-sm">
            Le concierge est <strong>désactivé</strong> : les clients ne le voient pas.{' '}
            <Link href={`/services/${e.id}/reglages#options`} className="font-medium text-[var(--color-accent)] hover:underline">
              L’activer dans les réglages →
            </Link>
          </p>
        )}

        <Bloc id="wifi" titre="📶 Wi-Fi des clients" sous="Affiché avec un bouton « Copier le mot de passe » (et compté dans les statistiques).">
          <form action={wifiAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Cache etab={e.id} retour={ici} ancre="wifi" />
            <label>
              <span className="etiquette">Nom du réseau</span>
              <input name="wifi_nom" defaultValue={e.wifi_nom ?? ''} maxLength={64} className="champ" placeholder="Hotel-Invites" />
            </label>
            <label>
              <span className="etiquette">Mot de passe</span>
              <input name="wifi_mdp" defaultValue={e.wifi_mdp ?? ''} maxLength={64} className="champ font-mono" placeholder="(réseau ouvert)" />
            </label>
            <BoutonEnvoi attente="…">Enregistrer</BoutonEnvoi>
          </form>
        </Bloc>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-encre-doux)]">
            {visibles.length} rubrique{visibles.length > 1 ? 's' : ''} visible{visibles.length > 1 ? 's' : ''} · horaires, services, bonnes adresses, urgences.
          </p>
          <BoutonFenetre titre="Nouvelle rubrique" libelle="+ Nouvelle rubrique" largeur="max-w-2xl">
            <Formulaire e={e} retour={ici} />
          </BoutonFenetre>
        </div>

        {liste.length === 0 ? (
          <div className="carte grid place-items-center gap-2 px-6 py-12 text-center">
            <span className="text-4xl" aria-hidden>
              🛎️
            </span>
            <h2 className="text-base font-semibold">Le concierge est vide</h2>
            <p className="max-w-md text-sm text-[var(--color-encre-doux)]">Ajoutez les horaires, la réception, le stationnement et vos bonnes adresses du quartier.</p>
          </div>
        ) : (
          <ul className="cascade space-y-3">
            {liste.map((r, i) => {
              const type = RUBRIQUES.find((x) => x.cle === r.type)
              return (
                <li key={r.id} data-ligne id={`rubrique-${r.id}`} className={`carte scroll-mt-24 p-4 ${r.actif ? '' : 'opacity-70'}`}>
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl text-xl" style={{ background: `${e.couleur}1a` }} aria-hidden>
                      {r.icone ?? type?.icone ?? 'ℹ️'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{texte(r.titre, D)}</span>
                        <Pastille>{type?.fr ?? r.type}</Pastille>
                        {!r.actif && <Pastille>Masquée</Pastille>}
                        <ATraduire textes={[r.titre, r.texte]} langues={e.langues} defaut={D} />
                      </div>
                      {texte(r.texte, D) && <p className="mt-0.5 line-clamp-2 text-sm text-[var(--color-encre-doux)]">{texte(r.texte, D)}</p>}
                      {(r.lien || r.telephone) && (
                        <p className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--color-encre-doux)]">
                          {r.telephone && <span>📞 {r.telephone}</span>}
                          {r.lien && (
                            <a href={r.lien} target="_blank" rel="noreferrer" className="truncate text-[var(--color-accent)] hover:underline">
                              🔗 {r.lien.replace(/^https:\/\//, '').slice(0, 40)}
                            </a>
                          )}
                        </p>
                      )}
                    </div>
                    <form className="flex shrink-0 items-center gap-0.5">
                      <Cache etab={e.id} retour={ici} ancre={`rubrique-${r.id}`} id={r.id} />
                      <button formAction={deplacerRubriqueAction} name="sens" value="-1" disabled={i === 0} className={petitBouton} title="Monter">
                        ↑
                      </button>
                      <button formAction={deplacerRubriqueAction} name="sens" value="1" disabled={i === liste.length - 1} className={petitBouton} title="Descendre">
                        ↓
                      </button>
                      <Confirmer
                        action={supprimerRubriqueAction}
                        poussiere
                        titre="Supprimer cette rubrique ?"
                        texte={`« ${texte(r.titre, D)} » disparaîtra du concierge, dans toutes les langues.`}
                        libelle="✕"
                        titreBouton="Supprimer"
                        className={`${petitBouton} hover:text-[var(--color-negatif)]`}
                      />
                    </form>
                  </div>
                  <details className="group mt-2">
                    <summary className="ml-[3.25rem] inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline">
                      <span className="transition group-open:rotate-90">›</span> Modifier
                    </summary>
                    <div className="mt-3 border-t border-[var(--color-ligne)] pt-4">
                      <Formulaire e={e} r={r} retour={ici} />
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <aside>
        <Bloc titre="Ce que voient les clients" sous="Le concierge sur le téléphone.">
          <div className="mx-auto max-w-[15rem] overflow-hidden rounded-[1.6rem] border-[6px] border-[#1c1712] bg-[#fbf6ee] p-3 shadow-xl">
            <p className="truncate px-1 text-xs font-semibold text-[#2a211a]">{e.nom}</p>
            {e.wifi_nom && (
              <div className="mt-2 rounded-xl px-2.5 py-2 text-white shadow" style={{ background: e.couleur }}>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/75">📶 Wi-Fi</p>
                <p className="text-[11px] font-semibold">{e.wifi_nom}</p>
                {e.wifi_mdp && <p className="font-mono text-[10px] text-white/85">{e.wifi_mdp}</p>}
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {visibles.slice(0, 8).map((r) => (
                <div key={r.id} className="rounded-xl bg-white p-2 shadow-sm">
                  <span className="text-base" aria-hidden>
                    {r.icone ?? RUBRIQUES.find((x) => x.cle === r.type)?.icone}
                  </span>
                  <p className="line-clamp-2 text-[9px] font-semibold leading-tight text-[#2a211a]">{texte(r.titre, D)}</p>
                </div>
              ))}
            </div>
            {visibles.length > 8 && <p className="mt-1.5 text-center text-[9px] text-[#6b5d50]">+ {visibles.length - 8} autres</p>}
          </div>
        </Bloc>
      </aside>
    </div>
  )
}
