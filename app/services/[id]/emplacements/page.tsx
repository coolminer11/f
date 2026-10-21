import { notFound } from 'next/navigation'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import { emplacements, lireEtablissement } from '@/lib/services/donnees'
import type { Emplacement } from '@/lib/services/types'
import { baseCartesAffichee } from '@/lib/cartes-url'
import BoutonEnvoi from '@/components/bouton-envoi'
import BoutonCopier from '@/components/bouton-copier'
import Cache from '@/components/services/bo/cache'
import Confirmer from '@/components/services/bo/confirmer'
import BoutonFenetre from '@/components/services/bo/bouton-fenetre'
import Chiffre from '@/components/services/bo/chiffre'
import { Bloc, Pastille, TuileChiffre } from '@/components/services/bo/elements'
import {
  basculerEmplacementAction,
  creerEmplacementAction,
  creerEmplacementsAction,
  deplacerEmplacementAction,
  modifierEmplacementAction,
  supprimerEmplacementAction,
} from '../../actions'

export const dynamic = 'force-dynamic'

const TYPES: [Emplacement['type'], string, string][] = [
  ['table', 'Table', '🍽️'],
  ['chambre', 'Chambre', '🛏️'],
  ['zone', 'Zone', '📍'],
  ['comptoir', 'Comptoir / bar', '🍸'],
]
const petitBouton = 'grid size-7 place-items-center rounded-lg text-xs text-[var(--color-encre-doux)] hover:bg-[var(--color-fond)] disabled:opacity-30'

export default async function Emplacements({ params }: { params: Promise<{ id: string }> }) {
  await exigerProprietaire()
  const { id } = await params
  const e = await lireEtablissement(id)
  if (!e) notFound()
  const [lieux, base] = await Promise.all([emplacements(e.id), baseCartesAffichee()])
  const ici = `/services/${e.id}/emplacements`
  const hotel = e.type === 'hotel'
  const groupes = [...new Set(lieux.map((l) => l.groupe ?? ''))]
  const nomsGroupes = groupes.filter(Boolean)
  const actifs = lieux.filter((l) => l.actif).length

  return (
    <div className="space-y-5">
      <div className="cascade grid grid-cols-2 gap-3 md:grid-cols-4">
        <TuileChiffre libelle="Emplacements actifs" valeur={<Chiffre valeur={actifs} />} sous={<span className="text-xs text-[var(--color-encre-doux)]">sur {lieux.length}</span>} />
        <TuileChiffre libelle="Groupes" valeur={<Chiffre valeur={nomsGroupes.length} />} sous={<span className="text-xs text-[var(--color-encre-doux)]">{nomsGroupes.slice(0, 3).join(', ') || 'aucun'}</span>} />
        <div className="carte col-span-2 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-medium text-[var(--color-encre-doux)]">Codes QR à imprimer</p>
            <p className="mt-0.5 text-sm">12 par page Lettre, avec le nom et le code de chaque emplacement.</p>
          </div>
          <a href={`/services/${e.id}/qr`} className={`bouton ${actifs ? '' : 'pointer-events-none opacity-50'}`}>
            ⬇ Planche complète ({actifs})
          </a>
        </div>
      </div>

      <Bloc
        titre="Créer en série"
        sous={hotel ? '« Chambre 101 » à « Chambre 120 » en un geste.' : '« Table 1 » à « Table 24 » en un geste.'}
        actions={
          <BoutonFenetre titre="Un seul emplacement" libelle="+ Un seul" className="bouton bouton-secondaire text-xs">
            <form action={creerEmplacementAction} className="space-y-3">
              <Cache etab={e.id} retour={ici} />
              <label className="block">
                <span className="etiquette">Nom</span>
                <input name="libelle" required maxLength={60} className="champ" placeholder={hotel ? 'Lobby, Piscine, Spa…' : 'Bar, Terrasse, Salon privé…'} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="etiquette">Type</span>
                  <select name="type" defaultValue="zone" className="champ">
                    {TYPES.map(([v, l, i]) => (
                      <option key={v} value={v}>
                        {i} {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="etiquette">Groupe (facultatif)</span>
                  <input name="groupe" list="groupes-emplacements" maxLength={60} className="champ" />
                </label>
              </div>
              <div className="flex justify-end">
                <BoutonEnvoi attente="…">Ajouter</BoutonEnvoi>
              </div>
            </form>
          </BoutonFenetre>
        }
      >
        <form action={creerEmplacementsAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_5.5rem_5.5rem_1fr_1fr_auto] lg:items-end">
          <Cache etab={e.id} retour={ici} />
          <label>
            <span className="etiquette">Nom de base</span>
            <input name="prefixe" required maxLength={40} defaultValue={hotel ? 'Chambre' : 'Table'} className="champ" />
          </label>
          <label>
            <span className="etiquette">De</span>
            <input name="de" type="number" min={0} max={99999} required defaultValue={hotel ? 101 : 1} className="champ tabular-nums" />
          </label>
          <label>
            <span className="etiquette">À</span>
            <input name="a" type="number" min={0} max={99999} required defaultValue={hotel ? 110 : 12} className="champ tabular-nums" />
          </label>
          <label>
            <span className="etiquette">Type</span>
            <select name="type" defaultValue={hotel ? 'chambre' : 'table'} className="champ">
              {TYPES.map(([v, l, i]) => (
                <option key={v} value={v}>
                  {i} {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="etiquette">Groupe (facultatif)</span>
            <input name="groupe" list="groupes-emplacements" maxLength={60} className="champ" placeholder={hotel ? '1er étage' : 'Salle, Terrasse…'} />
          </label>
          <BoutonEnvoi attente="Création…">Créer</BoutonEnvoi>
        </form>
        <datalist id="groupes-emplacements">
          {nomsGroupes.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </Bloc>

      {lieux.length === 0 ? (
        <div className="carte grid place-items-center gap-2 px-6 py-12 text-center">
          <span className="text-4xl" aria-hidden>
            {hotel ? '🛏️' : '🍽️'}
          </span>
          <h2 className="text-base font-semibold">Aucun emplacement</h2>
          <p className="max-w-md text-sm text-[var(--color-encre-doux)]">
            Chaque {hotel ? 'chambre' : 'table'} reçoit sa carte et son QR : la demande arrive au personnel avec le bon numéro.
          </p>
        </div>
      ) : (
        groupes.map((g) => {
          const membres = lieux.filter((l) => (l.groupe ?? '') === g)
          return (
            <Bloc
              key={g || 'sans-groupe'}
              titre={g || 'Sans groupe'}
              sous={`${membres.length} emplacement${membres.length > 1 ? 's' : ''} · ${membres.filter((l) => l.actif).length} actif${membres.filter((l) => l.actif).length > 1 ? 's' : ''}`}
              actions={
                g ? (
                  <a href={`/services/${e.id}/qr?groupe=${encodeURIComponent(g)}`} className="bouton bouton-secondaire text-xs">
                    ⬇ QR du groupe
                  </a>
                ) : undefined
              }
            >
              <ul className="divide-y divide-[var(--color-ligne)]">
                {membres.map((l) => {
                  const k = lieux.findIndex((x) => x.id === l.id)
                  const url = `${base}/s/${l.code}`
                  return (
                    <li key={l.id} data-ligne id={`lieu-${l.id}`} className={`scroll-mt-24 py-2 ${l.actif ? '' : 'opacity-60'}`}>
                      <form action={modifierEmplacementAction} className="flex flex-wrap items-center gap-2">
                        <Cache etab={e.id} retour={ici} ancre={`lieu-${l.id}`} id={l.id} />
                        <span className="w-6 text-center text-base" aria-hidden>
                          {TYPES.find(([v]) => v === l.type)?.[2]}
                        </span>
                        <input name="libelle" defaultValue={l.libelle} required maxLength={60} className="champ !w-40 !py-1.5 text-sm font-medium" aria-label="Nom" />
                        <select name="type" defaultValue={l.type} className="champ !w-32 !py-1.5 text-sm" aria-label="Type">
                          {TYPES.map(([v, lib]) => (
                            <option key={v} value={v}>
                              {lib}
                            </option>
                          ))}
                        </select>
                        <input name="groupe" defaultValue={l.groupe ?? ''} list="groupes-emplacements" maxLength={60} className="champ !w-36 !py-1.5 text-sm" placeholder="Groupe" aria-label="Groupe" />
                        <BoutonEnvoi secondaire attente="…" className="!px-2.5 !py-1 text-xs">
                          Enregistrer
                        </BoutonEnvoi>
                        <span className="ml-auto flex flex-wrap items-center gap-1.5">
                          <a href={`/s/${l.code}`} target="_blank" rel="noreferrer" title={url} className="rounded-md bg-[var(--color-fond)] px-1.5 py-0.5 font-mono text-[11px] tracking-wider hover:underline">
                            {l.code}
                          </a>
                          <BoutonCopier texte={url} />
                          <a href={`/services/${e.id}/qr?e=${l.id}`} className="text-xs font-semibold text-[var(--color-accent)] hover:underline" title="QR de cet emplacement (PDF)">
                            QR
                          </a>
                          <button
                            formAction={basculerEmplacementAction}
                            name="actif"
                            value={l.actif ? '0' : '1'}
                            className="rounded-full border border-[var(--color-ligne)] px-2 py-0.5 text-[11px] font-semibold hover:bg-[var(--color-fond)]"
                          >
                            {l.actif ? <span className="text-[var(--color-positif)]">● Actif</span> : <span className="text-[var(--color-encre-doux)]">○ Inactif</span>}
                          </button>
                          <button formAction={deplacerEmplacementAction} name="sens" value="-1" disabled={k === 0} className={petitBouton} title="Monter">
                            ↑
                          </button>
                          <button formAction={deplacerEmplacementAction} name="sens" value="1" disabled={k === lieux.length - 1} className={petitBouton} title="Descendre">
                            ↓
                          </button>
                          <Confirmer
                            action={supprimerEmplacementAction}
                            poussiere
                            titre={`Supprimer « ${l.libelle} » ?`}
                            texte="Sa carte NFC et son QR ne mèneront plus nulle part, et le code ne pourra pas être réutilisé. Pour une pause, désactivez-le plutôt. L’historique reste dans les statistiques."
                            libelle="✕"
                            titreBouton="Supprimer"
                            className={`${petitBouton} hover:text-[var(--color-negatif)]`}
                          />
                        </span>
                      </form>
                    </li>
                  )
                })}
              </ul>
              {!membres.some((x) => x.actif) && (
                <p className="mt-2">
                  <Pastille>Tout le groupe est désactivé</Pastille>
                </p>
              )}
            </Bloc>
          )
        })
      )}
    </div>
  )
}
