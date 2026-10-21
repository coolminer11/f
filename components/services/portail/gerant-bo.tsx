import { gerantProtege } from '@/lib/services/acces'
import BoutonEnvoi from '@/components/bouton-envoi'
import GenerateurMotDePasse from '@/components/generateur-mot-de-passe'
import Cache from '@/components/services/bo/cache'
import Confirmer from '@/components/services/bo/confirmer'
import { Pastille } from '@/components/services/bo/elements'
import { motDePasseGerantAction, retirerMotDePasseGerantAction } from '@/app/services/actions-gerant'

/**
 * Le back-office du propriétaire, section « Liens et accès » : le mot de
 * passe du gérant. Avec lui, le gérant tient son menu, ses annonces et ses
 * informations depuis le portail, sans passer par Tapora.
 */
export default async function AccesGerantBo({ etab, nom, retour }: { etab: string; nom: string; retour: string }) {
  const protege = await gerantProtege(etab)
  return (
    <div className="space-y-2 border-t border-[var(--color-ligne)] pt-4" data-acces="gerant">
      <div className="flex items-center justify-between gap-2">
        <span className="etiquette">Mode gérant du portail</span>
        {protege ? <Pastille ton="positif">✦ activé</Pastille> : <Pastille ton="neutre">désactivé</Pastille>}
      </div>
      <p className="text-xs leading-relaxed text-[var(--color-encre-doux)]">
        Avec ce second mot de passe, le gérant modifie lui-même, depuis le portail, ses plats, ses prix, ses photos, ses allergènes, ses annonces, son Wi-Fi et
        son lien d’avis. Le mode reste ouvert 12 heures par appareil. Vous, connecté ici, y entrez sans mot de passe.
      </p>
      <form action={motDePasseGerantAction} className="space-y-2" data-formulaire="gerant">
        <Cache etab={etab} retour={retour} ancre="acces" />
        <span className="etiquette">{protege ? 'Changer le mot de passe du gérant' : 'Choisir le mot de passe du gérant'}</span>
        <div className="flex flex-wrap items-start gap-2">
          <GenerateurMotDePasse interdits={[nom]} />
          <BoutonEnvoi attente="…">Enregistrer</BoutonEnvoi>
        </div>
      </form>
      {protege && (
        <Confirmer
          action={retirerMotDePasseGerantAction}
          champs={{ etab, retour, ancre: 'acces' }}
          titre="Retirer le mode gérant ?"
          texte="Le portail redevient celui du personnel seulement : le menu, les annonces et l’établissement ne se modifient plus que d’ici."
          confirmer="Retirer"
          libelle="Retirer le mode gérant"
        />
      )}
    </div>
  )
}
