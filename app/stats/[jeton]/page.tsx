import type { Metadata, Viewport } from 'next'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { accesDossier, dossierDuJeton } from '@/lib/lien-stats'
import { dossier as lireDossier } from '@/lib/requetes/dossiers'
import { listerCartes, tapsJourHeure, totaux } from '@/lib/requetes/cartes'
import { cleAvis } from '@/lib/avis-manuels'
import { requete, requeteUne } from '@/lib/db'
import { rythmeAvis, resumeAvis } from '@/lib/avis-google'
import { direct, exploits } from '@/lib/requetes/exploits'
import { cartesProfil, course, pointDeDepart, profil } from '@/lib/requetes/profil'
import { classement } from '@/lib/requetes/classement'
import { depuisL, langueValide, locale, textes } from '@/lib/langue'
import { maintenantQuebec } from '@/lib/quebec'
import { prochainesNotes } from '@/lib/note-google'
import { surprisesPossibles } from '@/lib/surprises'
import { conseils } from '@/lib/conseils'
import { ETAPES_LANCEMENT } from '@/lib/lancement'
import DirectAujourdhui from '@/components/client/direct-aujourdhui'
import Paliers from '@/components/client/paliers'
import CommanderCartes from '@/components/client/commander-cartes'
import AjouterEcran from '@/components/client/ajouter-ecran'
import PremiersPas, { type EtapePas } from '@/components/client/premiers-pas'
import ListeLancement from '@/components/client/liste-lancement'
import SurpriseDuJour from '@/components/client/surprise-du-jour'
import Conseils from '@/components/client/conseils'
import ProchaineEtoile from '@/components/client/prochaine-etoile'
import AvantApres from '@/components/client/avant-apres'
import Course from '@/components/client/course'
import DetailCartes from '@/components/client/detail-cartes'
import NotificationsDing from '@/components/client/notifications-ding'
import PartagePalier from '@/components/client/partage-palier'
import Parrainage from '@/components/client/parrainage'
import BadgeAvis from '@/components/badge-avis'
import { baseCartesAffichee } from '@/lib/cartes-url'
import { bilanParrain } from '@/lib/parrainage'
import Logo from '@/components/client/logo'
import Verrou from '@/components/client/verrou'
import StatsTaps from '@/components/stats-taps'
import SectionAvis from '@/components/section-avis'
import AnimationsClient from '@/components/animations-client'
import { PERIODES, joursDepuis } from '@/components/selecteur-jours'
import { fraunces, inter } from '@/app/stats/polices'

export const dynamic = 'force-dynamic'

/**
 * Les statistiques d'un commerce, vues par le commerce lui-même — aux
 * couleurs et avec les animations du site taporacards.com.
 *
 * Publique, mais fermée : le jeton (HMAC, lib/lien-stats.ts) n'ouvre QUE ce
 * dossier. Uniquement des agrégats de ses propres cartes — ni destination,
 * ni code, ni note interne, ni lien vers le back-office (le menu n'existe que
 * pour une session ouverte). Pas d'indexation, pas d'adresse transmise aux
 * sites vers lesquels elle pointe.
 */
type Props = {
  params: Promise<{ jeton: string }>
  searchParams: Promise<{ p?: string; l?: string; desabonne?: string }>
}

// Une seule lecture du dossier par affichage, partagée avec les métadonnées.
const charger = cache(async (jeton: string) => {
  const a = await accesDossier(jeton)
  return { verrou: a.etat === 'verrouille' ? a : null, d: a.etat === 'ok' ? await lireDossier(a.id) : null }
})

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { jeton } = await params
  const sp = await searchParams
  const { d, verrou } = await charger(jeton)
  const l = langueValide(sp.l) ?? d?.langue ?? verrou?.langue ?? 'fr'
  return {
    title: textes(l).titre,
    robots: { index: false, follow: false, nocache: true },
    referrer: 'no-referrer',
    // « Ajouter à l'écran d'accueil » : la page s'ouvre ensuite comme une app.
    manifest: d ? `/stats/${jeton}/manifeste?l=${l}` : undefined,
    icons: { apple: '/icones/apple-touch-icon.png' },
    appleWebApp: { capable: true, title: 'Tapora', statusBarStyle: 'default' },
  }
}

export const viewport: Viewport = { themeColor: '#f7f1e7' }

// Pose la classe « attente » avant le premier affichage (voir globals.css) ;
// filet de sécurité : tout réapparaît au bout de 2,5 s quoi qu'il arrive.
const ANTI_ECLAIR = `(function(){try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var r=document.documentElement;r.classList.add('attente');setTimeout(function(){r.classList.remove('attente')},2500)}catch(e){}})()`

export default async function StatsClient({ params, searchParams }: Props) {
  const { jeton } = await params
  const sp = await searchParams
  const { d, verrou } = await charger(jeton)
  if (verrou) {
    const l = langueValide(sp.l)
    return (
      <div className={`${fraunces.variable} ${inter.variable} theme-client`} lang={(l ?? verrou.langue) === 'fr' ? 'fr-CA' : 'en-CA'}>
        <Verrou jeton={jeton} nom={verrou.nom} langue={l ?? verrou.langue} l={l ?? undefined} />
      </div>
    )
  }
  if (!d) notFound()
  const jours = joursDepuis(sp.p)
  const langue = langueValide(sp.l) ?? d.langue
  const fr = langue === 'fr'
  const T = textes(langue)
  const X = PLUS[langue]
  const nombre = new Intl.NumberFormat(locale(langue))
  // La langue choisie suit le visiteur de lien en lien ; sinon, celle du dossier.
  const suffixeL = sp.l ? `&l=${langue}` : ''
  const ql = sp.l ? `?l=${langue}` : ''
  const ici = maintenantQuebec()
  const cleManuelle = cleAvis({ type: 'dossier', id: d.id })

  const [cartes, t, places, maintenant, records, portrait, parCarte, lignesCourse, depart, grille, abonnes, detail] = await Promise.all([
    listerCartes(d.id),
    totaux({ dossier: d.id }, jours),
    requete<{ place_id: string }>(
      `select distinct place_id from cartes_nfc where dossier_id = $1::uuid and place_id is not null and actif`,
      [d.id],
    ),
    direct(d.id),
    exploits(d.id),
    profil(d.id),
    cartesProfil(d.id),
    course(d.id),
    pointDeDepart(d.id, cleManuelle),
    tapsJourHeure({ dossier: d.id }, 3650),
    requeteUne<{ n: number }>(`select count(*)::int as n from abonnements_push where dossier_id = $1::uuid`, [d.id]),
    classement(d.id, jours),
  ])
  const avisIds = [...places.map((p) => p.place_id), cleManuelle]
  const [avis, avis14, avisParJour, bilan, base] = await Promise.all([
    resumeAvis(avisIds, jours),
    resumeAvis(avisIds, 14),
    rythmeAvis(avisIds),
    bilanParrain(d.id),
    baseCartesAffichee(),
  ])
  const actives = cartes.filter((c) => c.actif)
  const chemin = `/stats/${jeton}`
  const ecart = t.precedent > 0 ? Math.round(((t.courant - t.precedent) / t.precedent) * 100) : null
  const moyenne = Math.round((t.courant / jours) * 10) / 10
  const partQr = t.courant ? Math.round((t.qr / t.courant) * 100) : 0
  // Cartes 100 % NFC : on ne parle de QR que s'il en a déjà servi.
  const avecQr = portrait.qr > 0

  // ---- Avis : note d'une fiche unique, gains, point de départ.
  const noteUnique = avis.fiches === 1 ? avis.note : null
  const etoile = avis.nb_actuel !== null && noteUnique !== null ? { nb: avis.nb_actuel, note: noteUnique } : null
  const prochaine = etoile ? prochainesNotes(etoile.nb, etoile.note, 1)[0] ?? null : null
  const gagnesDepuisPose = depart.avis_pose !== null && avis.nb_actuel !== null ? avis.nb_actuel - depart.avis_pose : null
  const avisGagnes14j = avis14.nb_actuel !== null && avis14.nb_debut !== null ? avis14.nb_actuel - avis14.nb_debut : null

  // ---- Premiers pas : de petites victoires dès les premiers jours.
  const etapes: EtapePas[] = [
    { cle: 'premier', libelle: X.pas.premier, fait: portrait.total >= 1 },
    { cle: 'dix', libelle: X.pas.dix, fait: portrait.total >= 10 },
    { cle: 'jour5', libelle: X.pas.jour5, fait: portrait.meilleur_jour_taps >= 5 },
    { cle: 'serie3', libelle: X.pas.serie3, fait: portrait.plus_longue_serie >= 3 },
    { cle: 'cinquante', libelle: X.pas.cinquante, fait: portrait.total >= 50 },
    ...(depart.avis_pose !== null && avis.nb_actuel !== null ? [{ cle: 'avis', libelle: X.pas.avis, fait: avis.nb_actuel > depart.avis_pose }] : []),
    { cle: 'cent', libelle: X.pas.cent, fait: portrait.total >= 100 },
  ]
  const montrerPas = etapes.some((e) => !e.fait)

  // ---- Liste de lancement : les 60 premiers jours, jusqu'à ce qu'elle soit finie.
  const auto = [...(portrait.total > 0 ? ['tester'] : []), ...((abonnes?.n ?? 0) > 0 ? ['notifs'] : [])]
  const faitesLancement = new Set([...d.lancement, ...auto])
  const joursDepuisPose = depart.pose ? Math.floor((Date.now() - new Date(depart.pose + 'T12:00:00Z').getTime()) / 86_400_000) : 0
  const montrerLancement = joursDepuisPose <= 60 && ETAPES_LANCEMENT.some((e) => !faitesLancement.has(e))

  // ---- Surprise du jour et conseils.
  const caseForte = grille.reduce<(typeof grille)[number] | null>((a, b) => (!a || b.taps > a.taps ? b : a), null)
  const surprises = surprisesPossibles(
    {
      profil: portrait,
      cartes: parCarte,
      caseForte,
      avisGagnesDepuisPose: gagnesDepuisPose,
      note: noteUnique,
      avisParSemaine: avisParJour ? avisParJour * 7 : null,
      jourIso: ici.jourIso,
      aujourdhui: ici.jour,
    },
    langue,
    d.id,
  )
  const numeroJour = Math.floor(new Date(ici.jour + 'T00:00:00Z').getTime() / 86_400_000)
  const rangSurprise = surprises.length ? numeroJour % surprises.length : 0
  const listeConseils = conseils(
    {
      profil: portrait,
      cartes: parCarte,
      aujourdhui: maintenant.aujourdhui,
      serie: records.serie,
      heureLocale: ici.heure,
      avisGagnes14j,
      taps14j: portrait.sept_jours + portrait.sept_precedents,
      prochaineNote: prochaine ? { cible: prochaine.cible, estimation: prochaine.estimation } : null,
      jourAnnee: numeroJour,
    },
    langue,
  )

  // ---- Bonjour : selon l'heure qu'il est au Québec.
  const h = ici.heure
  const [salut, emoji] = h >= 5 && h < 12 ? [X.matin, '☀️'] : h >= 12 && h < 18 ? [X.apresMidi, '🌤️'] : h >= 18 && h < 22 ? [X.soir, '🌆'] : [X.soir, '🌙']
  const phraseDuJour = maintenant.aujourdhui > 0 ? X.dejaAujourdhui(maintenant.aujourdhui) : h < 12 ? X.belleJournee : X.continuer

  // ---- « Votre année Tapora » : en décembre (l'année en cours) et en janvier (la précédente).
  const anneeBilan = ici.mois === 12 ? ici.annee : ici.mois === 1 ? ici.annee - 1 : null
  const joursAvantLundi = 8 - ici.jourIso

  async function desabonner(donnees: FormData) {
    'use server'
    // Le jeton est revérifié ici : une action serveur s'appelle sans la page.
    const j = String(donnees.get('jeton') ?? '')
    const dossierId = await dossierDuJeton(j)
    if (!dossierId) return
    await requete(`update dossiers_cartes set rapport_mensuel = false where id = $1::uuid`, [dossierId])
    redirect(`/stats/${j}?desabonne=1`)
  }

  return (
    <div className={`${fraunces.variable} ${inter.variable} theme-client`} lang={fr ? 'fr-CA' : 'en-CA'}>
      <script dangerouslySetInnerHTML={{ __html: ANTI_ECLAIR }} />
      <AnimationsClient langue={langue}>
        <div className="mx-auto max-w-5xl space-y-6 pb-10">
          {/* ---- Haut de page */}
          <header className="pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3" data-intro>
              <a href="https://taporacards.com" className="flex items-center gap-2.5" aria-label="Tapora Cards">
                <Logo />
                <span className="titre-client text-xl font-semibold">Tapora</span>
              </a>
              <div className="flex items-center gap-2">
                <nav className="flex rounded-full bg-[#ede3d3] p-1 text-sm" aria-label={fr ? 'Période' : 'Period'}>
                  {PERIODES.map((p) => (
                    <a
                      key={p}
                      href={`${chemin}?p=${p}${suffixeL}`}
                      aria-current={p === jours ? 'page' : undefined}
                      className={`rounded-full px-4 py-1.5 font-medium transition ${
                        p === jours ? 'bg-[#2a211a] text-[#fffaf2]' : 'text-[#6b5d50] hover:text-[#2a211a]'
                      }`}
                    >
                      {T.periode(p)}
                    </a>
                  ))}
                </nav>
                <a
                  href={`${chemin}?p=${jours}&l=${fr ? 'en' : 'fr'}`}
                  hrefLang={fr ? 'en' : 'fr'}
                  className="rounded-full bg-[#ede3d3] px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#6b5d50] transition hover:text-[#2a211a]"
                  aria-label={T.langueAutre}
                >
                  {fr ? 'EN' : 'FR'}
                </a>
              </div>
            </div>
            <p className="mt-12 text-base font-medium text-[#6b5d50]" data-intro>
              <span className="salut-emoji mr-1.5 inline-block" aria-hidden>
                {emoji}
              </span>
              {salut} — {X.bienvenue}
            </p>
            <h1 className="titre-client mt-3 text-5xl font-medium leading-[1.05] sm:text-6xl" data-mots>
              {d.nom}
            </h1>
            {d.ambassadeur_le && (
              <p className="mt-4" data-intro>
                <span className="pastille-ambassadeur relative inline-flex items-center gap-1.5 overflow-hidden rounded-full px-3.5 py-1.5 text-sm font-semibold text-[#5a3b05]">
                  🏅 {X.ambassadeur}
                </span>
              </p>
            )}
            <p className="mt-4 max-w-xl text-lg text-[#6b5d50]" data-intro>
              {phraseDuJour} {T.sousTitre(actives.length)}
            </p>
          </header>

          {sp.desabonne && <p className="rounded-2xl bg-[#e3efe7] px-5 py-4 text-sm font-medium text-[#2f6b4f]">{T.desabonne}</p>}

          {anneeBilan && portrait.total > 0 && (
            <a href={`${chemin}/annee${ql}`} className="banniere-annee group flex items-center justify-between gap-4 rounded-[1.5rem] p-5 text-[#fffaf2] sm:p-6" data-tuile>
              <span>
                <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-[#f6c9a8]">✨ {X.anneePrete}</span>
                <span className="titre-client mt-1 block text-2xl font-medium sm:text-3xl">{X.votreAnnee(anneeBilan)}</span>
              </span>
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#fffaf2] text-xl text-[#2a211a] transition group-hover:translate-x-1" aria-hidden>
                →
              </span>
            </a>
          )}

          {/* ---- Aujourd'hui, en direct */}
          <DirectAujourdhui
            jeton={jeton}
            langue={langue}
            initial={maintenant}
            record={{ taps: records.record_taps, jour: records.record_jour }}
            serie={{ jours: records.serie, inclutAujourdhui: records.serie_inclut_aujourdhui }}
          />

          {montrerLancement && (
            <ListeLancement jeton={jeton} langue={langue} etapes={ETAPES_LANCEMENT} cochees={d.lancement} auto={auto} />
          )}
          {montrerPas && <PremiersPas etapes={etapes} langue={langue} />}

          {/* ---- La surprise du jour et les conseils */}
          <div className={`grid grid-cols-1 gap-6 ${surprises.length && listeConseils.length ? 'lg:grid-cols-2' : ''}`}>
            {surprises.length > 0 && (
              <SurpriseDuJour surprise={surprises[rangSurprise]} jour={ici.jour} langue={langue} rang={rangSurprise + 1} total={surprises.length} />
            )}
            <Conseils liste={listeConseils} langue={langue} />
          </div>

          {/* ---- Les chiffres de la période */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="carte col-span-2 p-6" data-tuile>
              <p className="text-sm text-[#6b5d50]">{T.tapsPeriode(jours)}</p>
              <p className="titre-client mt-1 text-6xl font-medium sm:text-7xl">
                <span data-compteur={t.courant}>{nombre.format(t.courant)}</span>
              </p>
              <p className={`mt-2 text-sm font-medium ${ecart === null || ecart === 0 ? 'text-[#6b5d50]' : ecart > 0 ? 'text-[#2f6b4f]' : 'text-[#b0402a]'}`}>
                {ecart === null ? (t.courant > 0 ? T.premiersTaps : T.bientot) : ecart === 0 ? T.stable : T.ecart(ecart, jours)}
              </p>
            </div>
            <div className="carte p-5 sm:p-6" data-tuile>
              <p className="text-sm text-[#6b5d50]">{T.parJour}</p>
              <p className="titre-client mt-1 text-4xl font-medium">
                <span data-compteur={moyenne}>{moyenne.toLocaleString(locale(langue))}</span>
              </p>
              <p className="mt-2 text-sm text-[#6b5d50]">
                {T.dernierTap} {depuisL(t.dernier_tap, langue)}
              </p>
            </div>
            {avecQr ? (
              <div className="carte p-5 sm:p-6" data-tuile>
                <p className="text-sm text-[#6b5d50]">{T.parQr}</p>
                <p className="titre-client mt-1 text-4xl font-medium">
                  <span data-compteur={partQr}>{partQr}</span>
                  {fr ? ' %' : '%'}
                </p>
                <p className="mt-2 text-sm text-[#6b5d50]">{T.resteNfc}</p>
              </div>
            ) : (
              <div className="carte p-5 sm:p-6" data-tuile>
                <p className="text-sm text-[#6b5d50]">{X.depuisPose}</p>
                <p className="titre-client mt-1 text-4xl font-medium">
                  <span data-compteur={records.total}>{nombre.format(records.total)}</span>
                </p>
                <p className="mt-2 text-sm text-[#6b5d50]">{X.tapsAuTotal}</p>
              </div>
            )}
          </div>

          {/* ---- Paliers : la jauge vers le prochain, et la collection */}
          <Paliers
            dossierId={d.id}
            langue={langue}
            nbAvis={avis.nb_actuel}
            note={noteUnique}
            objectif={d.objectif_avis}
            avisParJour={avisParJour}
            totalTaps={records.total}
          />

          {(etoile || (depart.pose && depart.avis_pose !== null && avis.nb_actuel !== null)) && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*:only-child]:lg:col-span-2">
              {etoile && <ProchaineEtoile nb={etoile.nb} note={etoile.note} langue={langue} />}
              {depart.pose && depart.avis_pose !== null && avis.nb_actuel !== null && (
                <AvantApres langue={langue} pose={depart.pose} avisPose={depart.avis_pose} avisMaintenant={avis.nb_actuel} avisMoisAvant={depart.avis_mois_avant} />
              )}
            </div>
          )}

          <div data-bloc>
            <SectionAvis placeIds={avisIds} jours={jours} tapsPeriode={t.courant} pourClient langue={langue} />
          </div>

          <Course lignes={lignesCourse} langue={langue} joursAvantLundi={joursAvantLundi} />

          <StatsTaps portee={{ dossier: d.id }} jours={jours} totaux={t} langue={langue} sansQr={!avecQr} />

          <DetailCartes lignes={detail} jours={jours} langue={langue} lienExport={`${chemin}/export?p=${jours}${suffixeL}`} />

          {/* ---- Le Ding (le mode comptoir n'est plus proposé ; sa page existe toujours) */}
          <NotificationsDing jeton={jeton} langue={langue} />

          {/* ---- Le badge d'avis, pour le site du commerce */}
          {d.badge_actif && avis.nb_actuel !== null && (
            <section className="carte p-6 sm:p-8" id="badge">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c2552f]">{X.badgeSurtitre}</span>
              <h2 className="titre-client mt-2 !text-2xl sm:!text-3xl">{X.badgeTitre}</h2>
              <p className="mb-6 mt-2 max-w-2xl text-[#6b5d50]">{X.badgeSous}</p>
              <BadgeAvis base={base} cle={d.cle_badge} langue={langue} variante="client" />
            </section>
          )}

          <Parrainage
            jeton={jeton}
            langue={langue}
            partenaire={d.partenaire_public}
            siteWeb={d.site_web}
            ambassadeur={d.ambassadeur_le !== null}
            bilan={bilan}
          />

          <CommanderCartes jeton={jeton} langue={langue} />

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[#e2d6c3] pt-6 text-sm text-[#6b5d50]">
            <span>
              {T.faitPar}{' '}
              <a href="https://taporacards.com" className="titre-client font-semibold text-[#2a211a] hover:text-[#c2552f]">
                Tapora Cards
              </a>{' '}
              · {T.viePrivee}
            </span>
            {d.rapport_mensuel && (
              <form action={desabonner}>
                <input type="hidden" name="jeton" value={jeton} />
                <button className="hover:text-[#2a211a] hover:underline">{T.desabonner}</button>
              </form>
            )}
          </footer>
        </div>
      </AnimationsClient>
      {/* Calque des fenêtres flottantes (bravo, partage, écran d'accueil) : hors des blocs animés. */}
      <div id="calque-client" />
      <PartagePalier nom={d.nom} langue={langue} />
      <AjouterEcran langue={langue} />
    </div>
  )
}

const PLUS = {
  fr: {
    matin: 'Bon matin',
    apresMidi: 'Bon après-midi',
    soir: 'Bonsoir',
    bienvenue: 'bienvenue !',
    dejaAujourdhui: (n: number) => `Votre carte a déjà travaillé aujourd’hui : ${n} tap${n > 1 ? 's' : ''}.`,
    belleJournee: 'Une belle journée vous attend.',
    continuer: 'On continue sur cette lancée ?',
    depuisPose: 'Depuis la pose',
    tapsAuTotal: 'taps au total',
    anneePrete: 'C’est prêt',
    votreAnnee: (a: number) => `Votre année Tapora ${a}`,
    ambassadeur: 'Ambassadeur Tapora',
    badgeSurtitre: 'Sur votre site web',
    badgeTitre: 'Montrez vos avis à tout le monde',
    badgeSous: 'Un petit badge à coller sur votre site : votre note et votre nombre d’avis Google, mis à jour tout seuls. Les visiteurs voient tout de suite que vos clients vous aiment.',
    comptoirTitre: 'Le mode comptoir',
    comptoirSous: 'Un écran à la caisse qui fête chaque tap avec l’équipe : un « ding », des confettis, l’objectif du jour qui se remplit.',
    comptoirOuvrir: 'Ouvrir le mode comptoir',
    comptoirAstuce: 'Parfait sur une tablette, même une vieille.',
    pas: {
      premier: 'Premier tap',
      dix: '10 taps',
      jour5: 'Une journée à 5 taps',
      serie3: '3 jours de suite',
      cinquante: '50 taps',
      avis: 'Premier avis grâce à Tapora',
      cent: '100 taps',
    },
  },
  en: {
    matin: 'Good morning',
    apresMidi: 'Good afternoon',
    soir: 'Good evening',
    bienvenue: 'welcome back!',
    dejaAujourdhui: (n: number) => `Your card is already at work today: ${n} tap${n > 1 ? 's' : ''}.`,
    belleJournee: 'A great day is waiting.',
    continuer: 'Shall we keep the momentum going?',
    depuisPose: 'Since installation',
    tapsAuTotal: 'taps in total',
    anneePrete: 'It’s ready',
    votreAnnee: (a: number) => `Your ${a} Tapora year`,
    ambassadeur: 'Tapora Ambassador',
    badgeSurtitre: 'On your website',
    badgeTitre: 'Show your reviews to everyone',
    badgeSous: 'A small badge to paste on your website: your Google rating and review count, updated automatically. Visitors see right away that your customers love you.',
    comptoirTitre: 'Counter mode',
    comptoirSous: 'A screen at the register that celebrates every tap with the team: a “ding”, confetti, and today’s goal filling up.',
    comptoirOuvrir: 'Open counter mode',
    comptoirAstuce: 'Perfect on a tablet, even an old one.',
    pas: {
      premier: 'First tap',
      dix: '10 taps',
      jour5: 'A 5-tap day',
      serie3: '3 days in a row',
      cinquante: '50 taps',
      avis: 'First review thanks to Tapora',
      cent: '100 taps',
    },
  },
}
