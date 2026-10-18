import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { dossierDuJeton } from '@/lib/lien-stats'
import { dossier as lireDossier } from '@/lib/requetes/dossiers'
import { anneeEnMois, avisEntre, cartesProfil, profil } from '@/lib/requetes/profil'
import { cleAvis } from '@/lib/avis-manuels'
import { requete } from '@/lib/db'
import { langueValide } from '@/lib/langue'
import { maintenantQuebec } from '@/lib/quebec'
import { PALIERS_AVIS, PALIERS_TAPS } from '@/lib/paliers'
import { fraunces, inter } from '@/app/stats/polices'
import AnneeTapora, { type Bilan } from '@/components/client/annee-tapora'
import PartagePalier from '@/components/client/partage-palier'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Votre année Tapora',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}
export const viewport: Viewport = { themeColor: '#2a211a' }

/**
 * « Votre année Tapora » : le bilan de l'année en une suite d'écrans plein
 * écran, façon stories. Ouvert en décembre (l'année en cours) et en janvier
 * (l'année écoulée) depuis la page client ; accessible toute l'année par
 * l'adresse directe, pour un aperçu.
 */
export default async function PageAnnee({
  params,
  searchParams,
}: {
  params: Promise<{ jeton: string }>
  searchParams: Promise<{ l?: string; a?: string }>
}) {
  const { jeton } = await params
  const sp = await searchParams
  const id = await dossierDuJeton(jeton)
  const d = id ? await lireDossier(id) : null
  if (!d) notFound()
  const langue = langueValide(sp.l) ?? d.langue
  const ici = maintenantQuebec()
  const demandee = Number(sp.a)
  const annee = Number.isInteger(demandee) && demandee >= 2024 && demandee <= ici.annee ? demandee : ici.mois === 1 ? ici.annee - 1 : ici.annee
  const debut = `${annee}-01-01`
  const fin = `${annee}-12-31`

  const places = await requete<{ place_id: string }>(
    `select distinct place_id from cartes_nfc where dossier_id = $1::uuid and place_id is not null`,
    [d.id],
  )
  const cles = [...places.map((p) => p.place_id), cleAvis({ type: 'dossier', id: d.id })]
  const [p, cartes, mois, avis] = await Promise.all([profil(d.id, debut, fin), cartesProfil(d.id, debut, fin), anneeEnMois(d.id, annee), avisEntre(cles, debut, fin)])

  const totalFin = mois.avant + p.total
  const gagnes = avis.debut !== null && avis.fin !== null ? avis.fin - avis.debut : null
  const actives = cartes.filter((c) => c.periode > 0)
  const star = actives.length > 1 ? actives[0] : null

  const bilan: Bilan = {
    annee,
    nom: d.nom,
    total: p.total,
    joursActifs: p.jours_actifs,
    meilleurJour: p.meilleur_jour,
    meilleurJourTaps: p.meilleur_jour_taps,
    heures: p.heures,
    semaine: p.semaine,
    mois: mois.mois,
    plusLongueSerie: p.plus_longue_serie,
    ios: p.ios,
    android: p.android,
    star: star ? { libelle: star.libelle, taps: star.periode, part: p.total ? Math.round((star.periode / p.total) * 100) : 0 } : null,
    avisGagnes: gagnes,
    note: avis.note,
    paliersTaps: PALIERS_TAPS.filter((x) => x > mois.avant && x <= totalFin),
    paliersAvis: avis.debut !== null && avis.fin !== null ? PALIERS_AVIS.filter((x) => x > avis.debut! && x <= avis.fin!) : [],
  }

  return (
    <div className={`${fraunces.variable} ${inter.variable} theme-client`} lang={langue === 'en' ? 'en-CA' : 'fr-CA'}>
      <AnneeTapora bilan={bilan} langue={langue} retour={`/stats/${jeton}${sp.l ? `?l=${langue}` : ''}`} />
      <div id="calque-client" />
      <PartagePalier nom={d.nom} langue={langue} />
    </div>
  )
}
