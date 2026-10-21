import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { accesPortail } from '@/lib/services/acces'
import { lireEtablissement } from '@/lib/services/donnees'
import { pouls, statsService } from '@/lib/services/stats'
import { autresAnnonces, fileJson, groupes, nonLus, platDuJour, platsDisponibilite, retoursRecents } from '@/lib/services/portail'
import CadrePortail, { type Onglet } from '@/components/services/portail/cadre-portail'
import VerrouPortail from '@/components/services/portail/verrou-portail'
import FileLive from '@/components/services/portail/file-live'
import Controles from '@/components/services/portail/controles'
import StatsPortail, { PERIODES, type Periode } from '@/components/services/portail/stats-portail'
import AvisPortail from '@/components/services/portail/avis-portail'
import type { LanguePortail } from '@/components/services/portail/textes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ jeton: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

const ONGLETS: Onglet[] = ['file', 'controles', 'stats', 'avis']

async function languePortail(defaut: string): Promise<LanguePortail> {
  const c = (await cookies()).get('tapora_portail_langue')?.value
  if (c === 'fr' || c === 'en') return c
  return defaut === 'en' ? 'en' : 'fr'
}

/** AAAA-MM-JJ dans le fuseau de l'établissement. */
const aujourdhuiDans = (fuseau: string) => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { jeton } = await params
  const a = await accesPortail(jeton)
  if (a.etat === 'invalide') return { title: 'Tapora', robots: { index: false, follow: false } }
  const nom = a.etat === 'verrouille' ? a.nom : ((await lireEtablissement(a.id))?.nom ?? 'Tapora')
  return {
    title: { absolute: `${nom} · Portail` },
    robots: { index: false, follow: false, nocache: true },
    manifest: `/service/${jeton}/manifeste`,
    appleWebApp: { capable: true, title: nom.length <= 14 ? nom : 'Service', statusBarStyle: 'black-translucent' },
    formatDetection: { telephone: false },
  }
}

/**
 * Le portail du personnel d'un établissement : la file en direct, les
 * contrôles du service, les statistiques et les avis. L'accès passe par le
 * lien secret (et le mot de passe, si l'établissement en a un) : chaque
 * lecture et chaque action revérifie le jeton.
 */
export default async function PagePortail({ params, searchParams }: Props) {
  const { jeton } = await params
  const sp = await searchParams
  const a = await accesPortail(jeton)
  if (a.etat === 'invalide') notFound()

  const etab = await lireEtablissement(a.id)
  if (!etab) notFound()
  const l = await languePortail(etab.langue_defaut)
  const marque = { nom: etab.nom, type: etab.type, couleur: etab.couleur, logo: etab.logo }

  if (a.etat === 'verrouille') {
    return (
      <CadrePortail etab={marque} l={l} jeton={jeton}>
        <VerrouPortail jeton={jeton} nom={etab.nom} l={l} />
      </CadrePortail>
    )
  }

  const v = typeof sp.v === 'string' && (ONGLETS as string[]).includes(sp.v) ? (sp.v as Onglet) : 'file'
  const fuseau = etab.options.fuseau || 'America/Toronto'
  const id = a.id

  if (v === 'file') {
    const [file, secteurs] = await Promise.all([fileJson(id), groupes(id)])
    return (
      <CadrePortail etab={marque} l={l} jeton={jeton} onglet="file" ouvertes={file.pouls.ouvertes} nonLus={file.nonLus} fuseau={fuseau}>
        <FileLive
          jeton={jeton}
          l={l}
          initial={file}
          groupes={secteurs}
          type={etab.type}
          langueDefaut={etab.langue_defaut}
          fuseau={fuseau}
          cle={`tapora_portail:${id.slice(0, 8)}`}
        />
      </CadrePortail>
    )
  }

  // Les pastilles des onglets, pour les autres écrans.
  const [p, n] = await Promise.all([pouls(id), nonLus(id)])
  const cadre = (enfants: React.ReactNode) => (
    <CadrePortail etab={marque} l={l} jeton={jeton} onglet={v} ouvertes={p.ouvertes} nonLus={n} fuseau={fuseau}>
      {enfants}
    </CadrePortail>
  )

  if (v === 'controles') {
    const [plat, annonces, plats] = await Promise.all([platDuJour(id), autresAnnonces(id), platsDisponibilite(id)])
    return cadre(
      <Controles
        jeton={jeton}
        l={l}
        langues={etab.langues}
        langueDefaut={etab.langue_defaut}
        aujourdhui={aujourdhuiDans(fuseau)}
        plat={plat}
        annonces={annonces}
        plats={plats}
        accueil={etab.accueil}
      />,
    )
  }

  if (v === 'stats') {
    const demande = Number(sp.p)
    const periode: Periode = (PERIODES as readonly number[]).includes(demande) ? (demande as Periode) : 30
    const s = await statsService(id, periode, fuseau, etab.langue_defaut)
    return cadre(<StatsPortail s={s} l={l} jeton={jeton} periode={periode} type={etab.type} fuseau={fuseau} />)
  }

  const retours = await retoursRecents(id)
  return cadre(<AvisPortail jeton={jeton} l={l} retours={retours} langueDefaut={etab.langue_defaut} fuseau={fuseau} />)
}
