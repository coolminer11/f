import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigerEcriture, exigerSession } from '@/lib/auth'
import {
  basculerLien,
  dossier as lireDossier,
  modifierDossier,
  rattacherCartes,
  renouvelerLien,
  supprimerDossier,
} from '@/lib/requetes/dossiers'
import { creerCartesEnLot, listerCartes, tapsParCarte, tendances, totaux } from '@/lib/requetes/cartes'
import { listerClients } from '@/lib/requetes/ventes'
import { enregistrerFiche, placesConfigure } from '@/lib/avis-google'
import { cleAvis, suiviPour } from '@/lib/avis-manuels'
import { LigneSuivi } from '@/components/suivi-avis'
import { premierReleve } from '@/lib/saisie-carte'
import { urlStats } from '@/lib/lien-stats'
import { baseCartesAffichee } from '@/lib/cartes-url'
import { envoyerRapport, historiqueRapports, moisPrecedent, nomMois } from '@/lib/rapports'
import { messagerieConfiguree } from '@/lib/courriel'
import StatsTaps from '@/components/stats-taps'
import SectionAvis from '@/components/section-avis'
import TableauCartes from '@/components/tableau-cartes'
import SelecteurJours, { joursDepuis } from '@/components/selecteur-jours'
import ChampsDossier, { SaisieDossier, valeursDossier } from '@/components/champs-dossier'
import ChoixFiche from '@/components/choix-fiche'
import { Destination } from '@/components/champs-carte'
import BoutonCopier from '@/components/bouton-copier'
import BoutonSupprimer from '@/components/bouton-supprimer'
import { Evolution, Tuile, depuis, nombreFr } from '@/components/tuiles-cartes'

export const dynamic = 'force-dynamic'

const SaisieLot = z.object({
  prefixe: z.string().trim().min(1, 'Donnez un nom de base (ex. « Table »).').max(80),
  nombre: z.coerce.number().int().min(1, 'Au moins une carte.').max(200, 'Au plus 200 cartes à la fois.'),
  premier: z.coerce.number().int().min(0).max(9999),
  destination: Destination,
  place_id: z.string().regex(/^[A-Za-z0-9_-]{10,255}$/).optional().or(z.literal('')),
  fiche_nom: z.string().max(200).optional(),
  fiche_adresse: z.string().max(300).optional(),
})

const STATUTS: Record<string, string> = {
  envoye: '✓ envoyé',
  simule: 'simulé (messagerie non configurée)',
  echec: '✕ échec',
  en_cours: 'en cours…',
}

export default async function FicheDossier({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ p?: string; erreur?: string; message?: string }>
}) {
  const moi = await exigerSession()
  const { id } = await params
  const sp = await searchParams
  const jours = joursDepuis(sp.p)
  const d = await lireDossier(id)
  if (!d) notFound()

  const [cartes, sansDossier, t, parCarte, courbes, clients, base, historique, moisDernier, suivi] = await Promise.all([
    listerCartes(d.id),
    listerCartes().then((toutes) => toutes.filter((c) => !c.dossier_id)),
    totaux({ dossier: d.id }, jours),
    tapsParCarte(jours),
    tendances(14),
    listerClients(),
    baseCartesAffichee(),
    historiqueRapports(d.id),
    moisPrecedent(),
    suiviPour({ type: 'dossier', id: d.id }),
  ])
  const peutEcrire = moi.role !== 'lecture'
  const actives = cartes.filter((c) => c.actif)
  const placeIds = [...new Set(cartes.map((c) => c.place_id).filter(Boolean) as string[])]
  const avisIds = [...placeIds, cleAvis({ type: 'dossier', id: d.id })]
  const lien = urlStats(d.id, d.version_lien, base)
  const courrielClient = clients.find((c) => c.id === d.client_id)?.courriel ?? null
  const destinataire = d.courriel_rapport ?? courrielClient
  const ici = `/cartes/dossiers/${d.id}`

  async function enregistrer(donnees: FormData) {
    'use server'
    await exigerEcriture()
    const analyse = SaisieDossier.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) redirect(`${ici}?erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)
    await modifierDossier(id, valeursDossier(analyse.data))
    revalidatePath(ici)
    redirect(`${ici}?message=${encodeURIComponent('Dossier enregistré.')}`)
  }

  async function creerLot(donnees: FormData) {
    'use server'
    await exigerEcriture()
    const analyse = SaisieLot.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) redirect(`${ici}?erreur=${encodeURIComponent(analyse.error.issues[0].message)}#lot`)
    const v = analyse.data
    const placeId = v.place_id || null
    if (placeId) await enregistrerFiche({ place_id: placeId, nom: v.fiche_nom || null, adresse: v.fiche_adresse || null })
    const n = await creerCartesEnLot({
      prefixe: v.prefixe,
      nombre: v.nombre,
      premier: v.premier,
      dossierId: id,
      destination: v.destination,
      placeId,
    })
    await premierReleve(placeId)
    revalidatePath(ici)
    redirect(`${ici}?message=${encodeURIComponent(`${n} cartes créées. Téléchargez la planche de QR et la liste à programmer plus bas.`)}#exports`)
  }

  async function rattacher(donnees: FormData) {
    'use server'
    await exigerEcriture()
    await rattacherCartes(id, donnees.getAll('carte').map(String))
    revalidatePath(ici)
    redirect(`${ici}?message=${encodeURIComponent('Cartes ajoutées au dossier.')}`)
  }

  async function nouveauLien() {
    'use server'
    await exigerEcriture()
    await renouvelerLien(id)
    revalidatePath(ici)
    redirect(`${ici}?message=${encodeURIComponent('Nouveau lien créé. L’ancien ne fonctionne plus.')}#lien`)
  }

  async function basculer() {
    'use server'
    await exigerEcriture()
    await basculerLien(id, !d!.lien_actif)
    revalidatePath(ici)
    redirect(`${ici}#lien`)
  }

  async function envoyerMaintenant() {
    'use server'
    await exigerEcriture()
    const r = await envoyerRapport(id, moisDernier, base, true)
    revalidatePath(ici)
    const texte =
      r.statut === 'envoye'
        ? `Rapport de ${nomMois(moisDernier)} envoyé.`
        : r.statut === 'simule'
          ? 'Rapport simulé : la messagerie n’est pas configurée, rien n’est parti.'
          : r.erreur ?? 'Envoi impossible.'
    redirect(`${ici}?${r.statut === 'echec' || r.statut === 'sans_courriel' ? 'erreur' : 'message'}=${encodeURIComponent(texte)}#rapport`)
  }

  async function supprimer() {
    'use server'
    await exigerEcriture()
    await supprimerDossier(id)
    revalidatePath('/cartes/dossiers')
    redirect('/cartes/dossiers')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/cartes/dossiers" className="text-sm text-[var(--color-encre-doux)] hover:underline">← Dossiers</Link>
          <h1 className="mt-1 text-lg font-bold tracking-tight">{d.nom}</h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            {d.nb_cartes} carte{d.nb_cartes > 1 ? 's' : ''} · {d.client_nom ? `client : ${d.client_nom}` : 'sans client de facturation'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={lien} target="_blank" rel="noreferrer" className="bouton bouton-secondaire">Vue du client ↗</a>
          {peutEcrire && <Link href={`/cartes/nouvelle?dossier=${d.id}`} className="bouton">Nouvelle carte</Link>}
        </div>
      </div>

      {sp.erreur && <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">{sp.erreur}</p>}
      {sp.message && <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">{sp.message}</p>}

      <SelecteurJours chemin={ici} jours={jours} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="carte p-4">
          <div className="text-xs font-medium text-[var(--color-encre-doux)]">Taps, {jours} derniers jours</div>
          <div className="mt-1 text-5xl font-semibold tracking-tight" style={{ fontVariantNumeric: 'proportional-nums' }}>{nombreFr.format(t.courant)}</div>
          <div className="mt-1.5"><Evolution courant={t.courant} precedent={t.precedent} libelle={`vs ${jours} j précédents`} /></div>
        </div>
        <Tuile libelle="Cartes actives" valeur={`${actives.length}`} sous={<span className="text-xs text-[var(--color-encre-doux)]">{t.cartes_tapees} utilisée{t.cartes_tapees > 1 ? 's' : ''} sur la période</span>} />
        <Tuile libelle="Moyenne par carte active" valeur={nombreFr.format(actives.length ? Math.round(t.courant / actives.length) : 0)} sous={<span className="text-xs text-[var(--color-encre-doux)]">taps sur {jours} jours</span>} />
        <Tuile libelle="Dernier tap" valeur={depuis(t.dernier_tap)} sous={<span className="text-xs text-[var(--color-encre-doux)]">{t.courant ? Math.round((t.qr / t.courant) * 100) : 0} % par code QR</span>} />
      </div>

      {peutEcrire && suivi && (
        <section id="avis" className="carte scroll-mt-4 px-5 py-2">
          <h2 className="pt-2 text-sm font-semibold">Avis Google</h2>
          <LigneSuivi s={suivi} retour={ici} avecNom={false} />
        </section>
      )}

      <SectionAvis placeIds={avisIds} jours={jours} tapsPeriode={t.courant} />

      <TableauCartes
        cartes={cartes}
        parCarte={parCarte}
        courbes={courbes}
        jours={jours}
        afficherDossier={false}
        titre="Les cartes de ce dossier"
        vide={peutEcrire ? 'Aucune carte encore : créez-les en lot ci-dessous, ou ajoutez des cartes existantes.' : 'Aucune carte.'}
      />

      <StatsTaps portee={{ dossier: d.id }} jours={jours} totaux={t} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section id="lien" className="carte scroll-mt-4 p-5">
          <h2 className="text-sm font-semibold">Lien privé du client</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-encre-doux)]">
            Le client y voit les statistiques de SES cartes, et rien d’autre : ni vos autres clients, ni vos factures,
            ni les destinations. Le lien ne se devine pas ; si vous le renouvelez, l’ancien cesse de fonctionner.
          </p>
          {d.lien_actif ? (
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-[var(--color-ligne)] bg-[var(--color-fond)] px-3 py-2 text-xs">{lien}</code>
              <BoutonCopier texte={lien} />
            </div>
          ) : (
            <p className="mt-3 rounded-md bg-[var(--color-fond)] px-3 py-2 text-sm text-[var(--color-encre-doux)]">Lien désactivé : la page affiche « introuvable ».</p>
          )}
          {peutEcrire && (
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={nouveauLien}><button className="bouton bouton-secondaire text-xs">Renouveler le lien</button></form>
              <form action={basculer}><button className="bouton bouton-secondaire text-xs">{d.lien_actif ? 'Désactiver le lien' : 'Réactiver le lien'}</button></form>
            </div>
          )}
        </section>

        <section id="rapport" className="carte scroll-mt-4 p-5">
          <h2 className="text-sm font-semibold">Rapport mensuel</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-encre-doux)]">
            {d.rapport_mensuel
              ? destinataire
                ? `Envoyé automatiquement le 1er de chaque mois à ${destinataire}.`
                : 'Activé, mais aucun courriel : renseignez-le dans « Modifier le dossier ».'
              : 'Désactivé. Activez-le dans « Modifier le dossier » : le client le recevra le 1er de chaque mois.'}
            {!messagerieConfiguree() && ' La messagerie n’est pas configurée : les envois sont simulés.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`${ici}/rapport?mois=${moisDernier.slice(0, 7)}`} className="bouton bouton-secondaire text-xs">
              Aperçu — {nomMois(moisDernier)}
            </Link>
            {peutEcrire && destinataire && (
              <form action={envoyerMaintenant}>
                <button className="bouton bouton-secondaire text-xs">Envoyer {nomMois(moisDernier)} maintenant</button>
              </form>
            )}
          </div>
          {historique.length > 0 && (
            <ul className="mt-3 divide-y divide-[var(--color-ligne)] text-xs">
              {historique.map((h) => (
                <li key={h.mois} className="flex justify-between gap-2 py-1.5">
                  <span>{nomMois(h.mois)}</span>
                  <span className={h.statut === 'echec' ? 'text-[var(--color-negatif)]' : 'text-[var(--color-encre-doux)]'} title={h.erreur ?? undefined}>
                    {STATUTS[h.statut] ?? h.statut} {h.destinataire ? `· ${h.destinataire}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section id="exports" className="carte scroll-mt-4 p-5">
        <h2 className="text-sm font-semibold">Programmer et imprimer</h2>
        <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
          La liste des adresses à écrire sur les puces, et une planche de codes QR prête pour l’imprimeur.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`${ici}/export?format=csv`} className="bouton bouton-secondaire text-xs">Liste à programmer (CSV)</a>
          <a href={`${ici}/export?format=pdf`} className="bouton bouton-secondaire text-xs">Planche de QR (PDF)</a>
        </div>
      </section>

      {peutEcrire && (
        <section id="lot" className="carte scroll-mt-4 p-5">
          <h2 className="text-sm font-semibold">Créer des cartes en lot</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
            Par exemple « Table » × 24 donne « Table 1 » à « Table 24 », chacune avec son propre code et ses propres statistiques.
          </p>
          <form action={creerLot} className="mt-3 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="etiquette" htmlFor="prefixe">Nom de base</label>
                <input id="prefixe" name="prefixe" className="champ" required maxLength={80} placeholder="Table" />
              </div>
              <div>
                <label className="etiquette" htmlFor="nombre">Nombre de cartes</label>
                <input id="nombre" name="nombre" type="number" min={1} max={200} className="champ" required defaultValue={10} />
              </div>
              <div>
                <label className="etiquette" htmlFor="premier">Premier numéro</label>
                <input id="premier" name="premier" type="number" min={0} max={9999} className="champ" required defaultValue={1} />
              </div>
            </div>
            <div>
              <label className="etiquette" htmlFor="destination_lot">Destination de toutes les cartes</label>
              <input id="destination_lot" name="destination" type="url" className="champ" required placeholder="https://g.page/r/…/review" />
            </div>
            <ChoixFiche configure={placesConfigure()} initiale={placeIds.length === 1 ? { place_id: placeIds[0], nom: cartes.find((c) => c.place_id)?.fiche_nom ?? null } : null} champDestination="destination_lot" />
            <button className="bouton">Créer les cartes</button>
          </form>
        </section>
      )}

      {peutEcrire && sansDossier.length > 0 && (
        <details className="carte p-5">
          <summary className="cursor-pointer text-sm font-semibold">Ajouter des cartes existantes ({sansDossier.length} sans dossier)</summary>
          <form action={rattacher} className="mt-3 space-y-3">
            <ul className="max-h-64 space-y-1 overflow-auto text-sm">
              {sansDossier.map((c) => (
                <li key={c.id}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="carte" value={c.id} className="size-4 accent-[var(--color-accent)]" />
                    {c.libelle} <span className="chiffre text-xs text-[var(--color-encre-doux)]">{c.code}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button className="bouton bouton-secondaire text-xs">Ajouter au dossier</button>
          </form>
        </details>
      )}

      {peutEcrire && (
        <details className="carte p-5">
          <summary className="cursor-pointer text-sm font-semibold">Modifier le dossier</summary>
          <form action={enregistrer} className="mt-3 space-y-4">
            <ChampsDossier
              clients={clients}
              valeurs={{ nom: d.nom, client_id: d.client_id, courriel_rapport: d.courriel_rapport, rapport_mensuel: d.rapport_mensuel, note: d.note }}
            />
            <button className="bouton">Enregistrer</button>
          </form>
        </details>
      )}

      {peutEcrire && (
        <details className="carte border-[var(--color-negatif)] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--color-negatif)]">Supprimer ce dossier</summary>
          <p className="mt-2 text-sm text-[var(--color-encre-doux)]">
            Les cartes et leurs statistiques restent : elles redeviennent « sans dossier ». Le lien du client cesse de fonctionner.
          </p>
          <form action={supprimer} className="mt-3">
            <BoutonSupprimer quoi={`le dossier ${d.nom}`} avertissement="Les cartes sont conservées." />
          </form>
        </details>
      )}
    </div>
  )
}
