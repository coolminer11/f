import { notFound } from 'next/navigation'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import { emplacements, lireEtablissement, typesDemandes } from '@/lib/services/donnees'
import { historiqueDemandes } from '@/lib/services/admin'
import { detailsCommandes } from '@/lib/services/demandes'
import { argent } from '@/lib/format'
import { drapeau, texte } from '@/lib/services/langues'
import type { Etablissement, StatutDemande, TypeDemande } from '@/lib/services/types'
import BoutonEnvoi from '@/components/bouton-envoi'
import Cache from '@/components/services/bo/cache'
import Triable, { FlechesTri, PoigneeTri } from '@/components/services/bo/triable'
import Confirmer from '@/components/services/bo/confirmer'
import BoutonFenetre from '@/components/services/bo/bouton-fenetre'
import Chiffre from '@/components/services/bo/chiffre'
import ChampsLangues, { ATraduire } from '@/components/services/bo/champs-langues'
import { Bloc, Pastille, TuileChiffre, duree } from '@/components/services/bo/elements'
import {
  creerTypeDemandeAction,
  modifierTypeDemandeAction,
  retablirDemandesAction,
  supprimerTypeDemandeAction,
} from '../../actions'

export const dynamic = 'force-dynamic'

const STATUTS: Record<StatutDemande, { libelle: string; ton: 'attention' | 'accent' | 'positif' | 'neutre' }> = {
  nouvelle: { libelle: 'En attente', ton: 'attention' },
  prise: { libelle: 'Prise en charge', ton: 'accent' },
  faite: { libelle: 'Terminée', ton: 'positif' },
  annulee: { libelle: 'Annulée', ton: 'neutre' },
}
const PERIODES = [1, 7, 30, 90]
const petitBouton = 'grid size-7 place-items-center rounded-lg text-xs text-[var(--color-encre-doux)] hover:bg-[var(--color-fond)] disabled:opacity-30'

function mediane(v: number[]): number | null {
  if (!v.length) return null
  const t = [...v].sort((a, b) => a - b)
  const m = Math.floor(t.length / 2)
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2
}

function Formulaire({ e, t, retour }: { e: Etablissement; t?: TypeDemande; retour: string }) {
  return (
    <form action={t ? modifierTypeDemandeAction : creerTypeDemandeAction} className="space-y-4">
      <Cache etab={e.id} retour={retour} ancre={t ? `type-${t.id}` : undefined} id={t?.id} />
      <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
        <label>
          <span className="etiquette">Icône</span>
          <input name="icone" defaultValue={t?.icone ?? ''} maxLength={16} className="champ text-center text-lg" placeholder="🧊" />
        </label>
        <ChampsLangues nom="libelle" libelle="Bouton affiché au client" valeurs={t?.libelle} langues={e.langues} defaut={e.langue_defaut} max={60} requis exemple="De la glace" />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            ['avec_note', 'Message libre', 'Le client peut préciser (« 2 oreillers », « réveil à 6 h 30 »).', t?.avec_note ?? false],
            ['avis_apres', 'Avis juste après', 'Une fois envoyée, on lui propose de noter son expérience — et le lien Google, offert à tous.', t?.avis_apres ?? false],
            ['actif', 'Visible', 'Le bouton apparaît sur la page client.', t?.actif ?? true],
          ] as const
        ).map(([n, l, aide, coche]) => (
          <label key={n} className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--color-ligne)] p-3 text-sm has-[:checked]:border-[var(--color-accent)]">
            <input type="checkbox" name={n} defaultChecked={coche} className="mt-0.5" />
            <span>
              <span className="block font-medium">{l}</span>
              <span className="block text-xs text-[var(--color-encre-doux)]">{aide}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <BoutonEnvoi attente="…">{t ? 'Enregistrer' : 'Ajouter la demande'}</BoutonEnvoi>
      </div>
    </form>
  )
}

export default async function Demandes({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ cle?: string; statut?: string; lieu?: string; j?: string }>
}) {
  await exigerProprietaire()
  const { id } = await params
  const sp = await searchParams
  const e = await lireEtablissement(id)
  if (!e) notFound()
  const jours = PERIODES.includes(Number(sp.j)) ? Number(sp.j) : 7
  const [types, lieux, lignes] = await Promise.all([
    typesDemandes(e.id, true),
    emplacements(e.id),
    historiqueDemandes(e.id, { cle: sp.cle || null, statut: sp.statut && sp.statut in STATUTS ? sp.statut : null, emplacement: sp.lieu || null, jours }),
  ])
  // Les commandes : leurs lignes et leur total, lus à part (l'historique ne les porte pas).
  const commandes = await detailsCommandes(
    e.id,
    lignes.filter((l) => l.cle === 'commande').map((l) => l.id),
  )
  const valides = lignes.filter((l) => l.cle === 'commande' && l.statut !== 'annulee' && commandes.has(l.id))
  const ventes = valides.reduce((t, l) => t + (commandes.get(l.id)?.total ?? 0), 0)
  const ici = `/services/${e.id}/demandes`
  const D = e.langue_defaut
  const attentes = lignes.map((l) => l.attente_sec).filter((x): x is number => x !== null)
  const durees = lignes.map((l) => l.duree_sec).filter((x): x is number => x !== null)
  const rapides = attentes.length ? Math.round((attentes.filter((x) => x <= 120).length / attentes.length) * 100) : null
  const ouvertes = lignes.filter((l) => l.statut === 'nouvelle' || l.statut === 'prise').length
  const fuseau = e.options.fuseau
  const quand = (iso: string) =>
    new Date(iso).toLocaleString('fr-CA', { timeZone: fuseau, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·')

  return (
    <div className="space-y-5">
      <Bloc
        titre="Les demandes en un tap"
        sous={e.type === 'hotel' ? 'Les boutons de la chambre : serviettes, ménage, départ tardif…' : 'Les boutons de la table : le serveur, l’addition, de l’eau…'}
        actions={
          <>
            <form action={retablirDemandesAction}>
              <Cache etab={e.id} retour={ici} />
              <BoutonEnvoi secondaire attente="…" className="text-xs">
                ↺ Rétablir les demandes par défaut
              </BoutonEnvoi>
            </form>
            <BoutonFenetre titre="Nouvelle demande" libelle="+ Nouvelle demande" largeur="max-w-2xl">
              <Formulaire e={e} retour={ici} />
            </BoutonFenetre>
          </>
        }
      >
        {types.length === 0 ? (
          <p className="text-sm text-[var(--color-encre-doux)]">Aucune demande : la page client n’affiche pas de boutons d’appel.</p>
        ) : (
          <Triable quoi="types" etab={e.id} as="ul" className="cascade grid gap-2 md:grid-cols-2" libelle="Demandes">
            {types.map((t, i) => (
              <li key={t.id} data-ligne data-tri-id={t.id} id={`type-${t.id}`} className={`scroll-mt-24 rounded-2xl border border-[var(--color-ligne)] bg-white p-3 ${t.actif ? '' : 'opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <PoigneeTri libelle={`Déplacer « ${texte(t.libelle, D)} »`} className="mt-1.5 -ml-1" />
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl text-xl text-white shadow-sm" style={{ background: e.couleur }} aria-hidden>
                    {t.icone ?? '•'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{texte(t.libelle, D)}</span>
                      <ATraduire textes={[t.libelle]} langues={e.langues} defaut={D} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {t.avis_apres && <Pastille ton="accent">★ avis juste après</Pastille>}
                      {t.avec_note && <Pastille>✍ message libre</Pastille>}
                      {!t.actif && <Pastille>masquée</Pastille>}
                    </div>
                  </div>
                  <form className="flex shrink-0 items-center gap-0.5">
                    <Cache etab={e.id} retour={ici} ancre={`type-${t.id}`} id={t.id} />
                    <FlechesTri premier={i === 0} dernier={i === types.length - 1} className={petitBouton} />
                    <Confirmer
                      action={supprimerTypeDemandeAction}
                      poussiere
                      titre="Retirer cette demande ?"
                      texte={`Le bouton « ${texte(t.libelle, D)} » disparaîtra de la page client. Son historique reste dans les statistiques.`}
                      confirmer="Retirer"
                      libelle="✕"
                      titreBouton="Retirer"
                      className={`${petitBouton} hover:text-[var(--color-negatif)]`}
                    />
                  </form>
                </div>
                <details className="group mt-1.5">
                  <summary className="ml-[3.25rem] inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline">
                    <span className="transition group-open:rotate-90">›</span> Modifier
                  </summary>
                  <div className="mt-3 border-t border-[var(--color-ligne)] pt-3">
                    <Formulaire e={e} t={t} retour={ici} />
                  </div>
                </details>
              </li>
            ))}
          </Triable>
        )}
      </Bloc>

      <div className="cascade grid grid-cols-2 gap-3 md:grid-cols-5">
        <TuileChiffre libelle={`Demandes · ${jours === 1 ? '24 h' : `${jours} j`}`} valeur={<Chiffre valeur={lignes.length} />} sous={lignes.length === 300 ? <span className="text-xs text-[var(--color-encre-doux)]">300 dernières</span> : undefined} />
        <TuileChiffre libelle="Encore ouvertes" valeur={<Chiffre valeur={ouvertes} className={ouvertes ? 'text-[var(--color-attention)]' : ''} />} />
        <TuileChiffre libelle="Prise en charge (médiane)" valeur={<Chiffre valeur={mediane(attentes)} genre="duree" />} />
        <TuileChiffre libelle="Prises en moins de 2 min" valeur={<Chiffre valeur={rapides} genre="pourcent" />} />
        <TuileChiffre libelle="Réglées (médiane)" valeur={<Chiffre valeur={mediane(durees)} genre="duree" />} />
      </div>
      {valides.length > 0 && (
        <p className="-mt-2 text-sm text-[var(--color-encre-doux)]">
          Dont <strong className="text-[var(--color-encre)]">{valides.length}</strong> commande{valides.length > 1 ? 's' : ''} pour{' '}
          <strong className="text-[var(--color-encre)] tabular-nums">{argent(ventes)}</strong> aux prix du menu.
        </p>
      )}

      <Bloc titre="Historique" sous="Chaque demande, de l’appel à la fin, à l’heure de l’établissement.">
        <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_8rem_auto] sm:items-end">
          <label>
            <span className="etiquette">Demande</span>
            <select name="cle" defaultValue={sp.cle ?? ''} className="champ">
              <option value="">Toutes</option>
              {types.map((t) => (
                <option key={t.id} value={t.cle}>
                  {t.icone} {texte(t.libelle, D)}
                </option>
              ))}
              {(e.options.commande || sp.cle === 'commande') && <option value="commande">🍽️ Commandes</option>}
            </select>
          </label>
          <label>
            <span className="etiquette">Statut</span>
            <select name="statut" defaultValue={sp.statut ?? ''} className="champ">
              <option value="">Tous</option>
              {(Object.keys(STATUTS) as StatutDemande[]).map((s) => (
                <option key={s} value={s}>
                  {STATUTS[s].libelle}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="etiquette">{e.type === 'hotel' ? 'Chambre ou zone' : 'Table ou zone'}</span>
            <select name="lieu" defaultValue={sp.lieu ?? ''} className="champ">
              <option value="">Partout</option>
              {lieux.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.libelle}
                  {l.groupe ? ` · ${l.groupe}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="etiquette">Période</span>
            <select name="j" defaultValue={String(jours)} className="champ">
              {PERIODES.map((p) => (
                <option key={p} value={p}>
                  {p === 1 ? '24 heures' : `${p} jours`}
                </option>
              ))}
            </select>
          </label>
          <button className="bouton bouton-secondaire">Filtrer</button>
        </form>

        {lignes.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-encre-doux)]">Aucune demande pour ces filtres.</p>
        ) : (
          <div className="max-h-[36rem] overflow-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="sticky top-0 z-[1] bg-white text-left text-xs text-[var(--color-encre-doux)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Quand</th>
                  <th className="py-2 pr-3 font-medium">Où</th>
                  <th className="py-2 pr-3 font-medium">Demande</th>
                  <th className="py-2 pr-3 font-medium">Statut</th>
                  <th className="py-2 pr-3 font-medium">Par</th>
                  <th className="py-2 pr-3 text-right font-medium">Prise en</th>
                  <th className="py-2 text-right font-medium">Réglée en</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-ligne)]">
                {lignes.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums text-[var(--color-encre-doux)]">{quand(l.cree_le)}</td>
                    <td className="py-1.5 pr-3">
                      <span className="font-medium">{l.emplacement ?? '—'}</span>
                      {l.groupe && <span className="text-xs text-[var(--color-encre-doux)]"> · {l.groupe}</span>}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span>
                        {l.icone} {l.libelle}
                      </span>
                      <span className="ml-1.5 text-xs" title={`Langue du client : ${l.langue}`}>
                        {drapeau(l.langue)}
                      </span>
                      {commandes.get(l.id) && (
                        <div className="mt-1 text-xs">
                          <ul className="space-y-0.5">
                            {commandes.get(l.id)!.details.map((x, i) => (
                              <li key={i}>
                                <span className="font-semibold tabular-nums">{x.quantite}×</span> {x.nom}
                                {x.variante && <span className="text-[var(--color-encre-doux)]"> · {x.variante}</span>}
                                {x.note && <span className="italic text-[var(--color-encre-doux)]"> « {x.note} »</span>}
                              </li>
                            ))}
                          </ul>
                          {commandes.get(l.id)!.total !== null && (
                            <p className="mt-0.5 font-semibold tabular-nums">Total : {argent(commandes.get(l.id)!.total!)}</p>
                          )}
                        </div>
                      )}
                      {l.note && <p className="text-xs italic text-[var(--color-encre-doux)]">« {l.note} »</p>}
                    </td>
                    <td className="py-1.5 pr-3">
                      <Pastille ton={STATUTS[l.statut].ton}>{STATUTS[l.statut].libelle}</Pastille>
                    </td>
                    <td className="py-1.5 pr-3 text-[var(--color-encre-doux)]">{l.prise_par ?? '—'}</td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${(l.attente_sec ?? 0) > 300 ? 'font-semibold text-[var(--color-negatif)]' : ''}`}>{duree(l.attente_sec)}</td>
                    <td className="py-1.5 text-right tabular-nums">{duree(l.duree_sec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloc>
    </div>
  )
}
