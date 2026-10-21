import { notFound } from 'next/navigation'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import { lireEtablissement } from '@/lib/services/donnees'
import { LANGUES, texte } from '@/lib/services/langues'
import { urlFichier } from '@/lib/services/fichiers'
import type { Options } from '@/lib/services/types'
import BoutonEnvoi from '@/components/bouton-envoi'
import Cache from '@/components/services/bo/cache'
import Confirmer from '@/components/services/bo/confirmer'
import CouleurMarque from '@/components/services/bo/couleur-marque'
import ChampsLangues from '@/components/services/bo/champs-langues'
import { Bloc, ICONE_TYPE, Interrupteur, NOM_TYPE, PastilleFormule } from '@/components/services/bo/elements'
import {
  accueilAction,
  apparenceAction,
  basculerEtablissementAction,
  coordonneesAction,
  formuleAction,
  identiteAction,
  languesAction,
  optionsAction,
  supprimerEtablissementAction,
} from '../../actions'

export const dynamic = 'force-dynamic'

const SECTIONS = [
  ['identite', 'Identité'],
  ['marque', 'Image de marque'],
  ['langues', 'Langues'],
  ['messages', 'Messages'],
  ['options', 'Options'],
  ['coordonnees', 'Coordonnées et avis'],
  ['abonnement', 'Abonnement'],
  ['danger', 'Zone de danger'],
] as const

const OPTIONS: [keyof Omit<Options, 'fuseau' | 'merci'>, string, string][] = [
  ['menu', 'Menu', 'Le menu interactif, et ses PDF par langue.'],
  ['appel', 'Demandes en un tap', 'Appeler le serveur, l’addition… ou serviettes, ménage, départ tardif.'],
  ['concierge', 'Concierge', 'Horaires, services, bonnes adresses, urgences.'],
  ['wifi', 'Wi-Fi', 'Le réseau et son mot de passe, à copier d’un tap.'],
  ['avis', 'Avis après une demande', 'Noter l’expérience juste après l’appel. Le lien Google est offert à tous, quelle que soit la note.'],
  ['recherche', 'Recherche et filtres', 'Chercher un plat, filtrer végé, sans gluten…'],
  ['prix', 'Prix', 'Afficher les prix dans le menu.'],
  ['allergenes', 'Allergènes', 'Les 11 allergènes prioritaires, plat par plat.'],
  ['photos', 'Photos', 'Les photos des plats.'],
  [
    'commande',
    'Commandes',
    'Commander depuis le menu : à la table (restaurant), ou en chambre (menus « service aux chambres »). Paiement à l’addition ou porté à la chambre.',
  ],
]

const FUSEAUX = [
  ['America/Toronto', 'Québec et Ontario (heure de l’Est)'],
  ['America/Halifax', 'Maritimes (Atlantique)'],
  ['America/St_Johns', 'Terre-Neuve'],
  ['America/Winnipeg', 'Manitoba (Centre)'],
  ['America/Regina', 'Saskatchewan'],
  ['America/Edmonton', 'Alberta (Rocheuses)'],
  ['America/Vancouver', 'Colombie-Britannique (Pacifique)'],
  ['Europe/Paris', 'France'],
] as const

export default async function Reglages({ params }: { params: Promise<{ id: string }> }) {
  await exigerProprietaire()
  const { id } = await params
  const e = await lireEtablissement(id)
  if (!e) notFound()
  const ici = `/services/${e.id}/reglages`
  const D = e.langue_defaut
  const logo = urlFichier(e.logo)
  const couverture = urlFichier(e.couverture)

  return (
    <div className="grid gap-6 lg:grid-cols-[12rem_1fr]">
      <nav className="hidden lg:block" aria-label="Sections des réglages">
        <ul className="sticky top-24 space-y-0.5 text-sm">
          {SECTIONS.map(([ancre, nom]) => (
            <li key={ancre}>
              <a
                href={`#${ancre}`}
                className={`block rounded-lg px-3 py-1.5 transition hover:bg-[var(--color-fond)] ${ancre === 'danger' ? 'text-[var(--color-negatif)]' : 'text-[var(--color-encre-doux)] hover:text-[var(--color-encre)]'}`}
              >
                {nom}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-5">
        <Bloc id="identite" titre="Identité">
          <form action={identiteAction} className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
            <Cache etab={e.id} retour={ici} ancre="identite" />
            <label>
              <span className="etiquette">Nom affiché aux clients</span>
              <input name="nom" defaultValue={e.nom} required maxLength={120} className="champ" />
            </label>
            <fieldset className="flex gap-2">
              <legend className="etiquette">Type</legend>
              {(['restaurant', 'hotel'] as const).map((t) => (
                <label
                  key={t}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--color-ligne)] px-3 py-2 text-sm has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-doux)]"
                >
                  <input type="radio" name="type" value={t} defaultChecked={e.type === t} className="sr-only" />
                  {ICONE_TYPE[t]} {NOM_TYPE[t]}
                </label>
              ))}
            </fieldset>
            <BoutonEnvoi attente="…">Enregistrer</BoutonEnvoi>
          </form>
        </Bloc>

        <Bloc id="marque" titre="Image de marque" sous="La couleur des boutons et de l’en-tête, le logo et l’image du haut de la page client.">
          <form action={apparenceAction} className="space-y-5">
            <Cache etab={e.id} retour={ici} ancre="marque" />
            <CouleurMarque couleur={e.couleur} nom={e.nom} logo={logo} couverture={couverture} type={e.type} accueil={texte(e.accueil, D)} />
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['logo', 'Logo', 'Carré de préférence, 600 px suffisent.', logo],
                  ['couverture', 'Image de couverture', 'Large (salle, façade, plat vedette) ; 2 000 px au plus.', couverture],
                ] as const
              ).map(([n, l, aide, actuel]) => (
                <div key={n} className="rounded-xl border border-[var(--color-ligne)] p-3">
                  <span className="etiquette">{l}</span>
                  <div className="flex items-center gap-3">
                    {actuel ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={actuel} alt="" className={`shrink-0 rounded-lg object-cover ${n === 'logo' ? 'size-14' : 'h-14 w-24'}`} />
                    ) : (
                      <span className={`grid shrink-0 place-items-center rounded-lg bg-[var(--color-fond)] text-xs text-[var(--color-encre-doux)] ${n === 'logo' ? 'size-14' : 'h-14 w-24'}`}>aucun</span>
                    )}
                    <div className="min-w-0 space-y-1">
                      <input type="file" name={n} accept="image/*" className="max-w-full text-xs" />
                      {actuel && (
                        <label className="flex items-center gap-1.5 text-xs text-[var(--color-encre-doux)]">
                          <input type="checkbox" name={`retirer_${n}`} /> Retirer
                        </label>
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--color-encre-doux)]">{aide}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <BoutonEnvoi attente="Enregistrement…">Enregistrer l’image de marque</BoutonEnvoi>
            </div>
          </form>
        </Bloc>

        <Bloc id="langues" titre="Langues" sous="La page client s’ouvre dans la langue du téléphone si elle est offerte, sinon dans la langue par défaut.">
          {D !== 'fr' && (
            <p className="mb-4 rounded-xl border border-[var(--color-attention)] bg-amber-50 px-3 py-2 text-sm text-[var(--color-attention)]">
              ⚠ La langue par défaut n’est pas le français. Au Québec, la Charte de la langue française exige que le français soit offert et passe en premier.
            </p>
          )}
          <form action={languesAction} className="space-y-4">
            <Cache etab={e.id} retour={ici} ancre="langues" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[22rem] text-sm">
                <thead className="text-left text-xs text-[var(--color-encre-doux)]">
                  <tr>
                    <th className="pb-2 font-medium">Langue</th>
                    <th className="pb-2 text-center font-medium">Offerte</th>
                    <th className="pb-2 text-center font-medium">Par défaut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-ligne)]">
                  {LANGUES.map((l) => (
                    <tr key={l.code}>
                      <td className="py-1.5">
                        <span aria-hidden>{l.drapeau}</span> {l.nom} <span className="text-xs uppercase text-[var(--color-encre-doux)]">{l.code}</span>
                      </td>
                      <td className="py-1.5 text-center">
                        <input type="checkbox" name="langues" value={l.code} defaultChecked={e.langues.includes(l.code)} aria-label={`Offrir ${l.nom}`} />
                      </td>
                      <td className="py-1.5 text-center">
                        <input type="radio" name="langue_defaut" value={l.code} defaultChecked={D === l.code} aria-label={`${l.nom} par défaut`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--color-encre-doux)]">Retirer une langue ne supprime pas ses traductions : la rajouter les retrouve.</p>
              <BoutonEnvoi attente="…">Enregistrer les langues</BoutonEnvoi>
            </div>
          </form>
        </Bloc>

        <Bloc id="messages" titre="Messages" sous="Ce que lit le client en arrivant, et après avoir envoyé une demande.">
          <form action={accueilAction} className="space-y-4">
            <Cache etab={e.id} retour={ici} ancre="messages" />
            <div className="grid gap-4 md:grid-cols-2">
              <ChampsLangues
                nom="accueil"
                libelle="Message d’accueil"
                valeurs={e.accueil}
                langues={e.langues}
                defaut={D}
                multiligne
                max={400}
                exemple={e.type === 'hotel' ? 'Bienvenue ! Tout ce qu’il vous faut pendant votre séjour, à portée de main.' : 'Bienvenue ! Le menu, votre serveur et l’addition sont à un tap.'}
              />
              <ChampsLangues
                nom="merci"
                libelle="Après une demande (facultatif)"
                valeurs={e.options.merci}
                langues={e.langues}
                defaut={D}
                multiligne
                max={200}
                exemple="C’est noté ! Quelqu’un arrive."
                aide="Vide : le message par défaut de Tapora, déjà traduit."
              />
            </div>
            <div className="flex justify-end">
              <BoutonEnvoi attente="…">Enregistrer les messages</BoutonEnvoi>
            </div>
          </form>
        </Bloc>

        <Bloc id="options" titre="Options" sous="Ce que la page client propose. Tout change immédiatement, sans réimprimer les cartes.">
          <form action={optionsAction} className="space-y-4">
            <Cache etab={e.id} retour={ici} ancre="options" />
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {OPTIONS.map(([n, l, aide]) => (
                <Interrupteur key={n} name={n} coche={e.options[n]} libelle={l} aide={aide} />
              ))}
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="min-w-[16rem]">
                <span className="etiquette">Fuseau horaire (heures de service des menus, statistiques)</span>
                <select name="fuseau" defaultValue={e.options.fuseau} className="champ">
                  {FUSEAUX.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <BoutonEnvoi attente="…">Enregistrer les options</BoutonEnvoi>
            </div>
          </form>
        </Bloc>

        <Bloc id="coordonnees" titre="Coordonnées et avis">
          <form action={coordonneesAction} className="space-y-4">
            <Cache etab={e.id} retour={ici} ancre="coordonnees" />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="etiquette">Adresse</span>
                <input name="adresse" defaultValue={e.adresse ?? ''} maxLength={300} className="champ" placeholder="125, rue Saint-Paul, Québec (Québec)" />
              </label>
              <label>
                <span className="etiquette">Téléphone</span>
                <input name="telephone" defaultValue={e.telephone ?? ''} maxLength={40} className="champ" placeholder="418 555-0123" />
              </label>
              <label>
                <span className="etiquette">Site web</span>
                <input name="site_web" defaultValue={e.site_web ?? ''} className="champ" placeholder="https://…" />
              </label>
              <label className="md:col-span-2">
                <span className="etiquette">Lien « Écrire un avis » Google</span>
                <input name="avis_url" defaultValue={e.avis_url ?? ''} className="champ" placeholder="https://search.google.com/local/writereview?placeid=…" />
                <span className="mt-1 block text-xs text-[var(--color-encre-doux)]">
                  Proposé à chaque client après sa note, quelle qu’elle soit — filtrer les avis selon la note est interdit par Google.
                </span>
              </label>
              <label>
                <span className="etiquette">Wi-Fi : réseau</span>
                <input name="wifi_nom" defaultValue={e.wifi_nom ?? ''} maxLength={64} className="champ" />
              </label>
              <label>
                <span className="etiquette">Wi-Fi : mot de passe</span>
                <input name="wifi_mdp" defaultValue={e.wifi_mdp ?? ''} maxLength={64} className="champ font-mono" />
              </label>
            </div>
            <div className="flex justify-end">
              <BoutonEnvoi attente="…">Enregistrer les coordonnées</BoutonEnvoi>
            </div>
          </form>
        </Bloc>

        <Bloc id="abonnement" titre="Abonnement" sous="Interne : jamais affiché à l’établissement." actions={<PastilleFormule e={e} />}>
          <form action={formuleAction} className="space-y-4">
            <Cache etab={e.id} retour={ici} ancre="abonnement" />
            <div className="grid gap-3 sm:grid-cols-3">
              <label>
                <span className="etiquette">Formule</span>
                <select name="formule" defaultValue={e.formule} className="champ">
                  <option value="essai">Essai</option>
                  <option value="actif">Actif (payant)</option>
                  <option value="suspendu">Suspendu (pages hors ligne)</option>
                </select>
              </label>
              <label>
                <span className="etiquette">Fin de l’essai</span>
                <input type="date" name="essai_jusqua" defaultValue={e.essai_jusqua ?? ''} className="champ" />
              </label>
              <label>
                <span className="etiquette">Prix mensuel ($)</span>
                <input name="prix_mensuel" inputMode="decimal" defaultValue={e.prix_mensuel != null ? String(e.prix_mensuel).replace('.', ',') : ''} className="champ tabular-nums" placeholder="25" />
              </label>
              <label>
                <span className="etiquette">Contact</span>
                <input name="contact_nom" defaultValue={e.contact_nom ?? ''} maxLength={120} className="champ" placeholder="Nom du gérant" />
              </label>
              <label className="sm:col-span-2">
                <span className="etiquette">Courriel du contact</span>
                <input name="contact_courriel" type="email" defaultValue={e.contact_courriel ?? ''} maxLength={254} className="champ" />
              </label>
              <label className="sm:col-span-3">
                <span className="etiquette">Notes</span>
                <textarea name="notes" defaultValue={e.notes ?? ''} rows={3} maxLength={4000} className="champ" placeholder="Conditions négociées, rappels, historique…" />
              </label>
            </div>
            <div className="flex justify-end">
              <BoutonEnvoi attente="…">Enregistrer l’abonnement</BoutonEnvoi>
            </div>
          </form>
        </Bloc>

        <section id="danger" data-ligne className="carte scroll-mt-24 border-[color-mix(in_srgb,var(--color-negatif)_35%,transparent)] p-5">
          <h2 className="text-sm font-semibold text-[var(--color-negatif)]">Zone de danger</h2>
          <div className="mt-4 divide-y divide-[var(--color-ligne)]">
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">{e.actif ? 'Désactiver l’établissement' : 'Réactiver l’établissement'}</p>
                <p className="text-xs text-[var(--color-encre-doux)]">
                  {e.actif ? 'Ses pages client et son portail se ferment ; rien n’est effacé.' : 'Ses pages client et son portail rouvrent tels quels.'}
                </p>
              </div>
              <Confirmer
                action={basculerEtablissementAction}
                champs={{ etab: e.id, retour: ici, ancre: 'danger' }}
                danger={e.actif}
                titre={e.actif ? 'Désactiver l’établissement ?' : 'Réactiver l’établissement ?'}
                texte={e.actif ? 'Les clients qui touchent une carte verront une page introuvable, et le portail du personnel se ferme. Vous pourrez le réactiver à tout moment.' : 'Les cartes, les QR et le portail fonctionneront de nouveau.'}
                confirmer={e.actif ? 'Désactiver' : 'Réactiver'}
                libelle={e.actif ? 'Désactiver' : 'Réactiver'}
                className={`bouton ${e.actif ? 'bouton-secondaire' : ''} text-xs`}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">Supprimer définitivement</p>
                <p className="text-xs text-[var(--color-encre-doux)]">Menus, emplacements, demandes, avis et statistiques : tout part, sans retour possible.</p>
              </div>
              <Confirmer
                action={supprimerEtablissementAction}
                champs={{ etab: e.id, retour: ici }}
                poussiere
                saisie={e.nom}
                titre="Supprimer l’établissement ?"
                texte={<>Tout ce qui appartient à « {e.nom} » sera effacé pour de bon. Les cartes et les QR imprimés ne mèneront plus nulle part.</>}
                confirmer="Supprimer pour toujours"
                libelle="Supprimer…"
                className="bouton bouton-danger text-xs"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
