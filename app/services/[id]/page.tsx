import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import { emplacements, lireEtablissement } from '@/lib/services/donnees'
import { pouls, statsService } from '@/lib/services/stats'
import { compteContenu, traductionsManquantes } from '@/lib/services/admin'
import { urlPortail } from '@/lib/services/acces'
import { drapeau, nomLangue } from '@/lib/services/langues'
import { baseCartesAffichee } from '@/lib/cartes-url'
import { nombre, pourcent } from '@/lib/format'
import { dateCourte, dateLongue, plage } from '@/lib/langue'
import { CarteChaleur, GraphiqueColonnes, GraphiqueLignes } from '@/components/graphiques'
import { Evolution, depuis } from '@/components/tuiles-cartes'
import SelecteurJours, { joursDepuis } from '@/components/selecteur-jours'
import BoutonCopier from '@/components/bouton-copier'
import BoutonEnvoi from '@/components/bouton-envoi'
import GenerateurMotDePasse from '@/components/generateur-mot-de-passe'
import Cache from '@/components/services/bo/cache'
import Confirmer from '@/components/services/bo/confirmer'
import Chiffre from '@/components/services/bo/chiffre'
import Apparition from '@/components/services/bo/apparition'
import { Bloc, ListeBarres, Pastille, TuileChiffre } from '@/components/services/bo/elements'
import { motDePassePortailAction, renouvelerLienPortailAction, retirerMotDePassePortailAction } from '../actions'

export const dynamic = 'force-dynamic'

const etoiles = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)

export default async function Apercu({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ p?: string }>
}) {
  await exigerProprietaire()
  const { id } = await params
  const sp = await searchParams
  const e = await lireEtablissement(id)
  if (!e) notFound()
  const jours = joursDepuis(sp.p)
  const [s, maintenant, lieux, base, contenu, manque] = await Promise.all([
    statsService(e.id, jours, e.options.fuseau, e.langue_defaut),
    pouls(e.id),
    emplacements(e.id),
    baseCartesAffichee(),
    compteContenu(e.id),
    traductionsManquantes(e.id, e.langues, e.langue_defaut),
  ])
  const ici = `/services/${e.id}`
  const hotel = e.type === 'hotel'
  const premier = lieux.find((l) => l.actif)
  const portail = urlPortail(e.id, e.version_lien, base)
  const aTraduire = Object.values(manque).reduce((t, n) => t + n, 0)
  const pas = Math.max(1, Math.ceil(s.parJour.length / 10))
  const totalLangues = s.langues.reduce((t, l) => t + l.n, 0)
  const vuesContenu = hotel ? s.topRubriques.reduce((t, r) => t + r.vues, 0) : s.vuesMenu
  const conversion = s.nbRetours ? Math.round((s.googleClics / s.nbRetours) * 100) : null

  const etapes: { fait: boolean; libelle: string; lien: string }[] = [
    hotel
      ? { fait: contenu.rubriques >= 3, libelle: 'Concierge rempli (3 rubriques ou plus)', lien: `${ici}/concierge` }
      : { fait: contenu.plats > 0, libelle: 'Menu en ligne', lien: `${ici}/menu` },
    { fait: contenu.emplacements > 0, libelle: hotel ? 'Chambres créées' : 'Tables créées', lien: `${ici}/emplacements` },
    { fait: contenu.types > 0, libelle: 'Demandes en un tap', lien: `${ici}/demandes` },
    { fait: Boolean(e.avis_url), libelle: 'Lien d’avis Google', lien: `${ici}/reglages#coordonnees` },
    { fait: Boolean(e.wifi_nom), libelle: 'Wi-Fi des clients', lien: hotel ? `${ici}/concierge` : `${ici}/reglages#coordonnees` },
    { fait: Boolean(e.logo), libelle: 'Logo et couleur', lien: `${ici}/reglages#marque` },
    { fait: e.protege, libelle: 'Portail protégé par mot de passe', lien: '#acces' },
    { fait: aTraduire === 0, libelle: aTraduire ? `Traductions (${aTraduire} à faire)` : 'Traductions complètes', lien: `${ici}/menu#traductions` },
  ]
  const faites = etapes.filter((x) => x.fait).length

  return (
    <div className="space-y-5">
      {/* En ce moment : se met à jour tout seul (rafraîchissement du back-office). */}
      <section className="carte flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4" aria-label="En ce moment">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-encre-doux)]">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--color-positif)] opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-[var(--color-positif)]" />
          </span>
          En direct
        </div>
        {(
          [
            ['Demandes ouvertes', <Chiffre key="o" valeur={maintenant.ouvertes} />, maintenant.ouvertes > 0 ? 'text-[var(--color-attention)]' : ''],
            [
              'Plus longue attente',
              <Chiffre key="a" valeur={maintenant.plusAncienneSec} genre="duree" />,
              (maintenant.plusAncienneSec ?? 0) > 180 ? 'text-[var(--color-negatif)]' : '',
            ],
            ['Visites · dernière heure', <Chiffre key="v" valeur={maintenant.visitesHeure} />, ''],
            ['Demandes aujourd’hui', <Chiffre key="d" valeur={maintenant.demandesAujourdhui} />, ''],
          ] as const
        ).map(([libelle, valeur, ton]) => (
          <div key={libelle}>
            <p className="text-[11px] text-[var(--color-encre-doux)]">{libelle}</p>
            <p className={`text-lg font-semibold tabular-nums ${ton}`}>{valeur}</p>
          </div>
        ))}
        <Link href={`${ici}/demandes`} className="ml-auto text-sm font-medium text-[var(--color-accent)] hover:underline">
          Historique des demandes →
        </Link>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SelecteurJours chemin={ici} jours={jours} />
        <p className="text-xs text-[var(--color-encre-doux)]">Comparé aux {jours} jours précédents · heure de {e.options.fuseau.split('/')[1]?.replace('_', ' ')}</p>
      </div>

      <div className="cascade grid grid-cols-2 gap-3 md:grid-cols-4">
        <TuileChiffre libelle="Visites" icone="👁" valeur={<Chiffre valeur={s.ouvertures} />} sous={<Evolution courant={s.ouvertures} precedent={s.ouverturesPrec} libelle="vs période d’avant" />} />
        <TuileChiffre libelle="Demandes" icone="🙋" valeur={<Chiffre valeur={s.demandes} />} sous={<Evolution courant={s.demandes} precedent={s.demandesPrec} libelle="vs période d’avant" />} />
        <TuileChiffre
          libelle="Temps de réponse médian"
          icone="⏱"
          valeur={<Chiffre valeur={s.reponseMediane} genre="duree" />}
          sous={
            <span className="text-xs text-[var(--color-encre-doux)]">
              {s.pctRapides !== null ? `${Math.round(s.pctRapides)} % pris en moins de 2 min` : 'aucune demande prise'}
            </span>
          }
        />
        <TuileChiffre
          libelle="Note des clients"
          icone="★"
          valeur={<Chiffre valeur={s.note} genre="note" />}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">{nombre(s.nbRetours)} avis laissés après une demande</span>}
        />
        <TuileChiffre
          libelle={hotel ? 'Lectures du concierge' : 'Vues du menu'}
          icone={hotel ? '🛎️' : '📖'}
          valeur={<Chiffre valeur={vuesContenu} />}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">{s.ouvertures ? `${Math.round((vuesContenu / s.ouvertures) * 100)} % des visites` : '—'}</span>}
        />
        <TuileChiffre
          libelle="Clics vers Google"
          icone="G"
          valeur={<Chiffre valeur={s.googleClics} />}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">{conversion !== null ? `${conversion} % des avis laissés` : 'offert à chaque client'}</span>}
        />
        <TuileChiffre libelle="Wi-Fi copié" icone="📶" valeur={<Chiffre valeur={s.wifi} />} />
        <TuileChiffre libelle="Menus PDF ouverts" icone="📄" valeur={<Chiffre valeur={s.pdf} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Bloc titre="Visites et demandes, jour par jour" sous="Une visite = une page ouverte depuis une carte ou un QR." className="lg:col-span-2">
          <Apparition>
          <GraphiqueLignes
            series={[
              { nom: 'Visites', slot: 1, valeurs: s.parJour.map((j) => j.ouvertures) },
              { nom: 'Demandes', slot: 2, valeurs: s.parJour.map((j) => j.demandes) },
            ]}
            etiquettes={s.parJour.map((j) => dateCourte(j.jour, 'fr'))}
            details={s.parJour.map((j) => dateLongue(j.jour, 'fr'))}
            pasEtiquettes={pas}
            unite="visites"
            resume={`Sur ${jours} jours : ${s.ouvertures} visites et ${s.demandes} demandes.`}
          />
          </Apparition>
        </Bloc>
        <Bloc
          id="lancement"
          titre="Prêt à lancer"
          sous={`${faites} sur ${etapes.length} étapes`}
          actions={<Pastille ton={faites === etapes.length ? 'positif' : 'attention'}>{Math.round((faites / etapes.length) * 100)} %</Pastille>}
        >
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-grille)]">
            <div className="h-full rounded-full bg-[var(--color-positif)] transition-all" style={{ width: `${(faites / etapes.length) * 100}%` }} />
          </div>
          <ul className="space-y-1.5 text-sm">
            {etapes.map((x) => (
              <li key={x.libelle}>
                <Link href={x.lien} className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-[var(--color-fond)]">
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                      x.fait ? 'bg-[var(--color-positif)] text-white' : 'border border-dashed border-[var(--color-encre-doux)] text-transparent'
                    }`}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className={x.fait ? 'text-[var(--color-encre-doux)] line-through decoration-1' : 'font-medium'}>{x.libelle}</span>
                </Link>
              </li>
            ))}
          </ul>
          {(contenu.epuises > 0 || (!hotel && contenu.plats > 0 && contenu.sans_photo === contenu.plats)) && (
            <div className="mt-3 space-y-1 border-t border-[var(--color-ligne)] pt-3 text-xs text-[var(--color-encre-doux)]">
              {contenu.epuises > 0 && <p>· {contenu.epuises} plat{contenu.epuises > 1 ? 's' : ''} marqué{contenu.epuises > 1 ? 's' : ''} épuisé{contenu.epuises > 1 ? 's' : ''}.</p>}
              {!hotel && contenu.plats > 0 && contenu.sans_photo === contenu.plats && <p>· Aucune photo : les plats avec photo se vendent mieux.</p>}
            </div>
          )}
        </Bloc>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc titre="Quand les clients demandent" sous="Demandes par heure : pour placer le personnel au bon moment.">
          <Apparition>
          <GraphiqueColonnes
            barres={s.parHeure.map((h) => ({ etiquette: `${h.heure}`, detail: plage(h.heure, 'fr'), valeur: h.demandes }))}
            unite="demandes"
            pasEtiquettes={3}
            resume="Nombre de demandes selon l’heure de la journée."
          />
          </Apparition>
        </Bloc>
        <Bloc titre="Semaine type" sous="Visites par jour et par heure.">
          <Apparition>
          <CarteChaleur cases={s.grille.map((g) => ({ jour: g.jour, heure: g.heure, taps: g.n }))} resume="Visites selon le jour de la semaine et l’heure." />
          </Apparition>
        </Bloc>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Bloc titre="Demandes par type">
          <ListeBarres
            lignes={s.parType.map((t) => ({ cle: t.cle, libelle: `${t.icone ?? '•'} ${t.libelle}`, valeur: t.n }))}
            vide="Aucune demande pour cette période."
          />
        </Bloc>
        <Bloc titre={hotel ? 'Rubriques les plus lues' : 'Plats les plus regardés'}>
          <ListeBarres
            lignes={(hotel ? s.topRubriques.map((r) => ({ cle: r.id, libelle: r.titre, valeur: r.vues })) : s.topPlats.map((p) => ({ cle: p.id, libelle: p.nom, valeur: p.vues })))}
            unite="vues"
            vide="Pas encore de vues."
          />
        </Bloc>
        <Bloc titre="Langues des clients" sous={totalLangues ? `${nombre(totalLangues)} visites` : undefined}>
          <ListeBarres
            lignes={s.langues.map((l) => ({
              cle: l.langue,
              libelle: (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden>{drapeau(l.langue)}</span>
                  {nomLangue(l.langue)}
                  {!e.langues.includes(l.langue) && <Pastille ton="attention">non offerte</Pastille>}
                </span>
              ),
              valeur: l.n,
            }))}
            vide="Pas encore de visites."
          />
        </Bloc>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Bloc titre="Avis après une demande" sous="Proposés juste après « Appeler le serveur » ou « L’addition ». Le lien Google est offert à tous.">
          <ul className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((n) => {
              const v = s.repartition[n - 1] ?? 0
              const max = Math.max(1, ...s.repartition)
              return (
                <li key={n} className="flex items-center gap-2 text-sm">
                  <span className="w-8 shrink-0 tabular-nums text-[var(--color-encre-doux)]">{n} ★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-grille)]">
                    <span className="block h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: n >= 4 ? 'var(--color-positif)' : n === 3 ? 'var(--color-attention)' : 'var(--color-negatif)' }} />
                  </span>
                  <span className="w-8 shrink-0 text-right tabular-nums">{v}</span>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-[var(--color-encre-doux)]">
            {s.nbRetours ? `${pourcent((s.googleClics / Math.max(1, s.nbRetours)) * 100)} des clients qui ont noté sont allés sur Google.` : 'Aucun avis pour cette période.'}
          </p>
        </Bloc>
        <Bloc titre="Ce que disent les clients" sous="Les commentaires laissés avec une note." className="lg:col-span-2">
          {s.commentaires.filter((c) => c.commentaire).length === 0 ? (
            <p className="text-sm text-[var(--color-encre-doux)]">Aucun commentaire pour cette période.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-[var(--color-ligne)] overflow-y-auto pr-1">
              {s.commentaires
                .filter((c) => c.commentaire)
                .map((c, i) => (
                  <li key={i} className="py-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-encre-doux)]">
                      <span className={c.note >= 4 ? 'text-[var(--color-positif)]' : c.note === 3 ? 'text-[var(--color-attention)]' : 'text-[var(--color-negatif)]'} aria-label={`${c.note} sur 5`}>
                        {etoiles(c.note)}
                      </span>
                      {c.emplacement && <span>{c.emplacement}</span>}
                      <span>· {depuis(c.cree_le)}</span>
                      {c.google && <Pastille ton="positif">→ Google</Pastille>}
                    </div>
                    <p className="mt-0.5">« {c.commentaire} »</p>
                  </li>
                ))}
            </ul>
          )}
        </Bloc>
      </div>

      <Bloc titre={hotel ? 'Par chambre et par zone' : 'Par table et par zone'} sous="Les emplacements actifs, du plus visité au moins visité.">
        {s.parEmplacement.length === 0 ? (
          <p className="text-sm text-[var(--color-encre-doux)]">
            Aucun emplacement. <Link href={`${ici}/emplacements`} className="font-medium text-[var(--color-accent)] hover:underline">En créer →</Link>
          </p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs text-[var(--color-encre-doux)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Emplacement</th>
                  <th className="py-2 pr-3 font-medium">Groupe</th>
                  <th className="py-2 pr-3 text-right font-medium">Visites</th>
                  <th className="py-2 pr-3 text-right font-medium">Demandes</th>
                  <th className="py-2 text-right font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-ligne)]">
                {s.parEmplacement.map((l) => (
                  <tr key={l.id}>
                    <td className="py-1.5 pr-3 font-medium">{l.libelle}</td>
                    <td className="py-1.5 pr-3 text-[var(--color-encre-doux)]">{l.groupe ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{nombre(l.ouvertures)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{nombre(l.demandes)}</td>
                    <td className="py-1.5 text-right tabular-nums">{l.note !== null ? `${l.note.toLocaleString('fr-CA')} ★` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloc>

      <Bloc id="acces" titre="Liens et accès" sous="Ce que vous donnez à l’établissement : la page des clients, le portail de l’équipe, les QR à imprimer.">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <span className="etiquette">Page client (exemple : {premier?.libelle ?? 'aucun emplacement'})</span>
              {premier ? (
                <div className="flex gap-2">
                  <input readOnly value={`${base}/s/${premier.code}`} className="champ font-mono text-xs" aria-label="Adresse de la page client" />
                  <BoutonCopier texte={`${base}/s/${premier.code}`} />
                  <a href={`/s/${premier.code}`} target="_blank" rel="noreferrer" className="bouton bouton-secondaire shrink-0 text-xs">
                    Ouvrir ↗
                  </a>
                </div>
              ) : (
                <Link href={`${ici}/emplacements`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
                  Créer des emplacements →
                </Link>
              )}
              <p className="mt-1 text-xs text-[var(--color-encre-doux)]">Chaque table ou chambre a sa propre adresse : la demande arrive au personnel avec le bon numéro.</p>
            </div>
            <div>
              <span className="etiquette">Codes QR à imprimer</span>
              <div className="flex flex-wrap gap-2">
                <a href={`${ici}/qr`} className="bouton bouton-secondaire text-xs">
                  ⬇ Planche de QR (PDF, {lieux.filter((l) => l.actif).length})
                </a>
                <Link href={`${ici}/emplacements`} className="bouton bouton-secondaire text-xs">
                  Gérer les emplacements
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="etiquette">Portail du personnel</span>
                {e.protege ? <Pastille ton="positif">🔒 protégé</Pastille> : <Pastille ton="attention">sans mot de passe</Pastille>}
              </div>
              <div className="flex gap-2">
                <input readOnly value={portail} className="champ font-mono text-xs" aria-label="Adresse du portail du personnel" />
                <BoutonCopier texte={portail} />
              </div>
              <div className="mt-2">
                <Confirmer
                  action={renouvelerLienPortailAction}
                  champs={{ etab: e.id, retour: ici, ancre: 'acces' }}
                  titre="Créer un nouveau lien du portail ?"
                  texte="L’ancien lien cessera de fonctionner tout de suite : chaque appareil de l’équipe devra ouvrir le nouveau."
                  confirmer="Créer le nouveau lien"
                  libelle="↻ Nouveau lien (l’ancien ne marchera plus)"
                  className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
                />
              </div>
            </div>
            <form action={motDePassePortailAction} className="space-y-2">
              <Cache etab={e.id} retour={ici} ancre="acces" />
              <span className="etiquette">{e.protege ? 'Changer le mot de passe du portail' : 'Protéger le portail par un mot de passe'}</span>
              <div className="flex flex-wrap items-start gap-2">
                <GenerateurMotDePasse interdits={[e.nom]} />
                <BoutonEnvoi attente="…">Enregistrer</BoutonEnvoi>
              </div>
            </form>
            {e.protege && (
              <Confirmer
                action={retirerMotDePassePortailAction}
                champs={{ etab: e.id, retour: ici, ancre: 'acces' }}
                titre="Retirer le mot de passe ?"
                texte="Le lien seul ouvrira de nouveau le portail du personnel."
                confirmer="Retirer"
                libelle="Retirer le mot de passe"
              />
            )}
          </div>
        </div>
      </Bloc>
    </div>
  )
}
