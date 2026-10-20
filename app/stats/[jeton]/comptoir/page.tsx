import type { Metadata, Viewport } from 'next'
import { notFound, redirect } from 'next/navigation'
import { accesDossier } from '@/lib/lien-stats'
import { dossier as lireDossier } from '@/lib/requetes/dossiers'
import { direct, exploits } from '@/lib/requetes/exploits'
import { profil } from '@/lib/requetes/profil'
import { langueValide } from '@/lib/langue'
import { maintenantQuebec } from '@/lib/quebec'
import { fraunces, inter } from '@/app/stats/polices'
import Comptoir from '@/components/client/comptoir'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mode comptoir — Tapora',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}
export const viewport: Viewport = { themeColor: '#2a211a' }

/** Combien de fois ce jour de semaine est revenu entre deux dates (incluses). */
function occurrences(debut: string, fin: string, jourIso: number): number {
  let n = 0
  for (let t = new Date(debut + 'T00:00:00Z').getTime(), b = new Date(fin + 'T00:00:00Z').getTime(); t <= b; t += 86_400_000) {
    if ((new Date(t).getUTCDay() || 7) === jourIso) n++
  }
  return n
}

/**
 * Le mode comptoir : un écran posé à la caisse (tablette, vieux téléphone,
 * télé) qui fête chaque tap avec l'équipe. Même clé que la page client :
 * le jeton n'ouvre que ce commerce.
 */
export default async function PageComptoir({
  params,
  searchParams,
}: {
  params: Promise<{ jeton: string }>
  searchParams: Promise<{ l?: string }>
}) {
  const { jeton } = await params
  const sp = await searchParams
  const acces = await accesDossier(jeton)
  // Page protégée : le mot de passe s'entre sur la page principale.
  if (acces.etat === 'verrouille') redirect(`/stats/${jeton}`)
  const id = acces.etat === 'ok' ? acces.id : null
  const d = id ? await lireDossier(id) : null
  if (!d) notFound()
  const langue = langueValide(sp.l) ?? d.langue
  const ici = maintenantQuebec()
  const [maintenant, records, portrait] = await Promise.all([direct(d.id), exploits(d.id), profil(d.id)])

  // L'objectif du jour : un peu mieux qu'un jour ordinaire du même nom.
  // Jamais moins de 5 : un objectif doit se sentir atteignable ET mérité.
  let objectif = 5
  if (portrait.premier_tap) {
    const n = occurrences(portrait.premier_tap, ici.jour, ici.jourIso)
    const aujourdhuiInclus = maintenant.aujourdhui
    const passe = portrait.semaine[ici.jourIso - 1] - aujourdhuiInclus
    const jours = n - 1
    if (jours >= 1) objectif = Math.max(5, Math.ceil((passe / jours) * 1.1))
  }

  return (
    <div className={`${fraunces.variable} ${inter.variable} theme-client`} lang={langue === 'en' ? 'en-CA' : 'fr-CA'}>
      <Comptoir
        jeton={jeton}
        langue={langue}
        nom={d.nom}
        jour={ici.jour}
        initial={maintenant}
        objectif={objectif}
        record={records.record_taps}
        serie={records.serie}
        serieInclutAujourdhui={records.serie_inclut_aujourdhui}
        retour={`/stats/${jeton}${sp.l ? `?l=${langue}` : ''}`}
      />
    </div>
  )
}
