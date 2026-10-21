import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { typesDemandes } from '@/lib/services/donnees'
import { texte } from '@/lib/services/langues'
import { dictionnaire } from '@/lib/services/ui'
import { BarreHaut, Cadre } from '@/components/services/client/cadre'
import CentreDemandes from '@/components/services/client/demande'
import { Tuile } from '@/components/services/client/tuiles'
import { httpsSeulement } from '@/components/services/client/outils'
import { lieuDeLaPage, titreLieu, type ParamsLieu } from '../lieu'

export const dynamic = 'force-dynamic'

export async function generateMetadata(p: ParamsLieu): Promise<Metadata> {
  return { title: await titreLieu(p, 'demandes') }
}

/** Toutes les demandes d'une chambre (ou d'une table), en un tap, avec leur suivi en direct. */
export default async function PageDemandes(p: ParamsLieu) {
  const { code, l, lieu, lien } = await lieuDeLaPage(p, '/demandes')
  const { etab, langue } = lieu
  const o = etab.options
  if (!o.appel) redirect(lien(''))
  const t = dictionnaire(langue)
  const types = await typesDemandes(etab.id)
  const merci = o.merci ? texte(o.merci, langue, etab.langue_defaut) || null : null

  return (
    <Cadre etab={etab} code={code} langue={langue} memoriserLangue={l === langue ? langue : null}>
      <div className="sv-collant sv-verre-bas">
        <BarreHaut etab={etab} code={code} langue={langue} titre={t.demandes} retour={lien('')} />
      </div>
      <div className="sv-colonne sv-pile pt-6">
        <header className="sv-entre">
          <p className="sv-surtitre">{lieu.emplacement.libelle}</p>
          <h1 className="sv-titre mt-2">{t.demandesTitre}</h1>
          <p className="sv-doux mt-2">{t.demandesAide}</p>
        </header>
        <div className="sv-entre sv-entre-1">
          <CentreDemandes
            types={types.map((d) => ({ cle: d.cle, libelle: texte(d.libelle, langue, etab.langue_defaut) || d.cle, icone: d.icone, avec_note: d.avec_note }))}
            avis={o.avis ? { google: httpsSeulement(etab.avis_url) } : null}
            merci={merci}
            accentPremier={etab.type === 'restaurant'}
          />
        </div>
        {o.concierge && (
          <div className="sv-entre sv-entre-3">
            <Tuile href={lien('/concierge')} icone="🗝️" titre={t.concierge} sous={t.conciergeSous} large />
          </div>
        )}
      </div>
    </Cadre>
  )
}
