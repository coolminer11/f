import { requeteUne } from '@/lib/db'
import BoutonEnvoi from '@/components/bouton-envoi'
import Cache from '@/components/services/bo/cache'
import { Bloc, Pastille } from '@/components/services/bo/elements'
import { historiqueRapportsService } from '@/lib/services/rapport'
import { envoyerRapportAction, rapportMensuelAction } from '@/app/services/actions-rapport'

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const nomMois = (m: string) => `${MOIS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
const STATUTS: Record<string, [string, 'positif' | 'attention' | 'negatif' | 'neutre']> = {
  envoye: ['envoyé', 'positif'],
  simule: ['simulé', 'attention'],
  echec: ['échec', 'negatif'],
  en_cours: ['en cours', 'neutre'],
}

/**
 * Le rapport mensuel d'un établissement, dans le back-office : à qui il part,
 * l'interrupteur, l'aperçu, « Envoyer maintenant » et les derniers envois.
 */
export default async function BlocRapport({ etab, retour }: { etab: string; retour: string }) {
  const [e, historique] = await Promise.all([
    requeteUne<{ rapport_mensuel: boolean; contact_courriel: string | null }>(`select rapport_mensuel, contact_courriel from etablissements where id = $1::uuid`, [etab]),
    historiqueRapportsService(etab),
  ])
  if (!e) return null
  const courriel = e.contact_courriel?.trim() || null
  return (
    <Bloc
      id="rapport"
      titre="Rapport mensuel"
      sous="Le 1er de chaque mois, le contact de l’établissement reçoit le résumé du mois écoulé : visites, demandes, temps de réponse, avis, plats les plus regardés."
      actions={
        <a href={`/services/${etab}/rapport`} target="_blank" rel="noreferrer" className="bouton bouton-secondaire text-xs">
          Aperçu ↗
        </a>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          {courriel ? (
            <p>
              Envoyé à <strong className="font-semibold">{courriel}</strong>
            </p>
          ) : (
            <p className="text-[var(--color-attention)]">Aucun courriel de contact : ajoutez-le dans Réglages pour que le rapport parte.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={rapportMensuelAction}>
            <Cache etab={etab} retour={retour} />
            <input type="hidden" name="rapport" value={e.rapport_mensuel ? 'non' : 'oui'} />
            <BoutonEnvoi attente="…" secondaire className="text-xs">
              {e.rapport_mensuel ? 'Désactiver' : 'Activer le rapport'}
            </BoutonEnvoi>
          </form>
          {courriel && (
            <form action={envoyerRapportAction}>
              <Cache etab={etab} retour={retour} />
              <BoutonEnvoi attente="Envoi…" className="text-xs">
                Envoyer le mois dernier
              </BoutonEnvoi>
            </form>
          )}
        </div>
      </div>
      {!e.rapport_mensuel && <p className="mt-2 text-xs text-[var(--color-encre-doux)]">Désactivé : aucun rapport ne part le 1er du mois.</p>}
      {historique.length > 0 && (
        <ul className="mt-4 divide-y divide-[var(--color-ligne)] text-sm">
          {historique.map((h) => {
            const [libelle, ton] = STATUTS[h.statut] ?? [h.statut, 'neutre']
            return (
              <li key={h.mois} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="capitalize">{nomMois(h.mois)}</span>
                <span className="flex items-center gap-2 text-xs text-[var(--color-encre-doux)]">
                  {h.destinataire}
                  <Pastille ton={ton} titre={h.erreur ?? undefined}>
                    {libelle}
                  </Pastille>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Bloc>
  )
}
