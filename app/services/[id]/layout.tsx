import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import { emplacements, lireEtablissement } from '@/lib/services/donnees'
import { pouls } from '@/lib/services/stats'
import { jetonPortail } from '@/lib/services/acces'
import { urlFichier } from '@/lib/services/fichiers'
import { drapeau, nomLangue } from '@/lib/services/langues'
import OngletsService, { type Onglet } from '@/components/services/bo/onglets'
import { ICONE_TYPE, NOM_TYPE, PastilleFormule } from '@/components/services/bo/elements'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  await exigerProprietaire()
  const e = await lireEtablissement((await params).id)
  return { title: e ? `${e.nom} · Tapora Services` : 'Tapora Services' }
}

/** La console d'un établissement : son en-tête, ses liens directs et ses onglets. */
export default async function ConsoleEtablissement({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  await exigerProprietaire()
  const { id } = await params
  const e = await lireEtablissement(id)
  if (!e) notFound()
  const [lieux, p] = await Promise.all([emplacements(e.id), pouls(e.id)])
  const premier = lieux.find((l) => l.actif)
  const base = `/services/${e.id}`
  const logo = urlFichier(e.logo)

  const onglets: Onglet[] = [
    { href: base, libelle: 'Aperçu' },
    { href: `${base}/menu`, libelle: e.type === 'hotel' ? 'Service aux chambres' : 'Menu' },
    { href: `${base}/annonces`, libelle: 'Annonces' },
    ...(e.type === 'hotel' || e.options.concierge ? [{ href: `${base}/concierge`, libelle: 'Concierge' }] : []),
    { href: `${base}/demandes`, libelle: 'Demandes', compte: p.ouvertes, alerte: p.ouvertes > 0 },
    { href: `${base}/emplacements`, libelle: e.type === 'hotel' ? 'Chambres et zones' : 'Emplacements', compte: lieux.filter((l) => l.actif).length },
    { href: `${base}/facturation`, libelle: 'Facturation' },
    { href: `${base}/reglages`, libelle: 'Réglages' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/services" className="text-sm text-[var(--color-encre-doux)] hover:underline">
            ← Tapora Services
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl text-2xl shadow-sm"
              style={{ background: `${e.couleur}1f`, color: e.couleur, boxShadow: `inset 0 0 0 1px ${e.couleur}33` }}
              aria-hidden
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="size-full object-cover" />
              ) : (
                ICONE_TYPE[e.type]
              )}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight">{e.nom}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--color-encre-doux)]">
                <span>{NOM_TYPE[e.type]}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex gap-0.5" title={e.langues.map(nomLangue).join(', ')}>
                  {e.langues.map((l) => (
                    <span key={l} aria-label={nomLangue(l)}>
                      {drapeau(l)}
                    </span>
                  ))}
                </span>
                <PastilleFormule e={e} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {premier ? (
            <a href={`/s/${premier.code}`} target="_blank" rel="noreferrer" className="bouton bouton-secondaire" title={`Comme si vous étiez à « ${premier.libelle} »`}>
              Vue client ↗
            </a>
          ) : (
            <span className="bouton bouton-secondaire cursor-not-allowed opacity-50" title="Créez d’abord un emplacement">
              Vue client ↗
            </span>
          )}
          <a href={`/service/${jetonPortail(e.id, e.version_lien)}`} target="_blank" rel="noreferrer" className="bouton">
            Portail du personnel ↗
          </a>
        </div>
      </div>

      <OngletsService base={base} onglets={onglets} />

      {children}
    </div>
  )
}
