import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { rubriques } from '@/lib/services/donnees'
import { texte } from '@/lib/services/langues'
import { RUBRIQUES } from '@/lib/services/types'
import { dictionnaire, RUBRIQUES_UI } from '@/lib/services/ui'
import { compterUneFois } from '@/lib/services/client'
import { BarreHaut, Cadre, Coordonnees } from '@/components/services/client/cadre'
import ListeConcierge, { type GroupeConcierge } from '@/components/services/client/concierge'
import { CarteWifiLieu } from '@/components/services/client/wifi'
import { Tuile } from '@/components/services/client/tuiles'
import { domaine, httpsSeulement, numeroTel } from '@/components/services/client/outils'
import { lieuDeLaPage, titreLieu, type ParamsLieu } from '../lieu'

export const dynamic = 'force-dynamic'

export async function generateMetadata(p: ParamsLieu): Promise<Metadata> {
  return { title: await titreLieu(p, 'concierge') }
}

/** Le concierge : Wi-Fi, horaires, services, bonnes adresses, urgences — rangés par genre. */
export default async function PageConcierge(p: ParamsLieu) {
  const { code, l, lieu, lien } = await lieuDeLaPage(p, '/concierge')
  const { etab, langue } = lieu
  const o = etab.options
  if (!o.concierge) redirect(lien(''))
  const d = etab.langue_defaut
  const t = dictionnaire(langue)
  const liste = await rubriques(etab.id)
  await compterUneFois(lieu, 'concierge', null, langue, 'c')

  const groupes: GroupeConcierge[] = RUBRIQUES.map((g) => ({
    type: g.cle,
    icone: g.icone,
    nom: RUBRIQUES_UI[g.cle]?.[langue] ?? RUBRIQUES_UI[g.cle]?.en ?? g.fr,
    rubriques: liste
      .filter((r) => r.type === g.cle)
      .map((r) => {
        const lienSur = httpsSeulement(r.lien)
        const tel = numeroTel(r.telephone)
        return {
          id: r.id,
          icone: r.icone || g.icone,
          titre: texte(r.titre, langue, d),
          texte: texte(r.texte, langue, d),
          lien: lienSur,
          domaine: lienSur ? domaine(lienSur) : null,
          tel,
          telAffiche: tel ? r.telephone : null,
        }
      })
      .filter((r) => r.titre),
  })).filter((g) => g.rubriques.length > 0)
  const wifi = o.wifi && etab.wifi_nom

  return (
    <Cadre etab={etab} code={code} langue={langue} memoriserLangue={l === langue ? langue : null} vu="c">
      <div className="sv-collant sv-verre-bas">
        <BarreHaut etab={etab} code={code} langue={langue} titre={t.concierge} retour={lien('')} />
      </div>
      <div className="sv-colonne sv-pile pt-6">
        <header className="sv-entre">
          <p className="sv-surtitre">{lieu.emplacement.libelle}</p>
          <h1 className="sv-titre mt-2">{t.concierge}</h1>
          <p className="sv-doux mt-2">{t.conciergeSous}</p>
        </header>

        {wifi && (
          <div className="sv-entre sv-entre-1">
            <CarteWifiLieu nom={etab.wifi_nom!} motDePasse={etab.wifi_mdp} />
          </div>
        )}

        {groupes.length > 0 ? (
          <ListeConcierge groupes={groupes} />
        ) : (
          !wifi && (
            <div className="sv-vide">
              <span aria-hidden>🗝️</span>
              <p>{t.aucuneRubrique}</p>
            </div>
          )
        )}

        {o.appel && etab.type === 'hotel' && (
          <div className="sv-entre sv-entre-3">
            <Tuile href={lien('/demandes')} icone="🛎️" titre={t.demandes} sous={t.demandesSous} large accent />
          </div>
        )}

        <Coordonnees etab={etab} />
      </div>
    </Cadre>
  )
}
