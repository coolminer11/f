import type { Metadata } from 'next'
import { annonces, rubriques, typesDemandes } from '@/lib/services/donnees'
import { texte } from '@/lib/services/langues'
import { dictionnaire } from '@/lib/services/ui'
import { compterUneFois, langueChoisie, langueSuggeree, menusLegers } from '@/lib/services/client'
import { Annonces, Cadre, Coordonnees, EnTete, Suggestion } from '@/components/services/client/cadre'
import CentreDemandes, { SuiviEnCours, type TypeDemandeUi } from '@/components/services/client/demande'
import { Tuile, TuileAvis, TuileWifi } from '@/components/services/client/tuiles'
import { httpsSeulement } from '@/components/services/client/outils'
import { lieuDeLaPage, titreLieu, type ParamsLieu } from './lieu'

export const dynamic = 'force-dynamic'

export async function generateMetadata(p: ParamsLieu): Promise<Metadata> {
  return { title: await titreLieu(p) }
}

/**
 * L'accueil d'une table ou d'une chambre : ce qu'on voit en tapant la carte.
 * Restaurant : appeler le serveur, l'addition, le menu. Hôtel : les demandes
 * en un tap, le service aux chambres, le concierge. Partout : le Wi-Fi,
 * l'avis, le plat du jour.
 */
export default async function AccueilService(p: ParamsLieu) {
  const { code, l, lieu, lien, sp } = await lieuDeLaPage(p)
  const { etab, langue } = lieu
  const o = etab.options
  const hotel = etab.type === 'hotel'
  const t = dictionnaire(langue)

  const [types, listeMenus, rubs, enCours, suggeree, choisie] = await Promise.all([
    o.appel ? typesDemandes(etab.id) : Promise.resolve([]),
    o.menu ? menusLegers(etab.id) : Promise.resolve([]),
    o.concierge ? rubriques(etab.id) : Promise.resolve([]),
    annonces(etab.id, o.fuseau),
    langueSuggeree(etab, langue),
    langueChoisie(l),
  ])
  // « ?q » vient des codes QR imprimés ; une carte NFC ouvre l'adresse nue.
  await compterUneFois(lieu, 'ouverture', null, langue, 'o', sp.q !== undefined ? 'qr' : 'nfc')

  const typesUi: TypeDemandeUi[] = types.map((d) => ({ cle: d.cle, libelle: texte(d.libelle, langue, etab.langue_defaut) || d.cle, icone: d.icone, avec_note: d.avec_note }))
  const google = o.avis ? httpsSeulement(etab.avis_url) : null
  const merci = o.merci ? texte(o.merci, langue, etab.langue_defaut) || null : null
  const nomMenu = (m: (typeof listeMenus)[number]) => texte(m.nom, langue, etab.langue_defaut)

  // Les tuiles, dans l'ordre d'importance ; s'il en reste une seule sur sa ligne, elle prend toute la largeur.
  const tuiles: { cle: string; rendu: (large: boolean) => React.ReactNode }[] = []
  let tuileMenu: React.ReactNode = null
  if (listeMenus.length) {
    if (hotel) {
      const chambre = listeMenus.find((m) => m.type === 'room_service')
      const autres = listeMenus.filter((m) => m.type !== 'room_service')
      if (chambre)
        tuiles.push({ cle: 'chambre', rendu: (large) => <Tuile href={lien('/menu', { m: chambre.id })} icone="🛎️" titre={t.roomService} sous={t.roomServiceSous} large={large} /> })
      if (autres.length)
        tuiles.push({ cle: 'resto', rendu: (large) => <Tuile href={lien('/menu', { m: autres[0].id })} icone="🍽️" titre={t.restaurant} sous={autres.length > 1 ? autres.map(nomMenu).join(' · ') : t.restaurantSous} large={large} /> })
    } else {
      // Au restaurant, le menu passe en premier, sur toute la largeur.
      tuileMenu = <Tuile href={lien('/menu')} icone="📖" titre={t.menu} sous={listeMenus.length > 1 ? listeMenus.map(nomMenu).filter(Boolean).join(' · ') : t.menuSous} large accent={!o.appel} />
    }
  }
  if (o.concierge && (rubs.length || (o.wifi && etab.wifi_nom)))
    tuiles.push({ cle: 'concierge', rendu: (large) => <Tuile href={lien('/concierge')} icone="🗝️" titre={t.concierge} sous={t.conciergeSous} large={large} /> })
  if (o.wifi && etab.wifi_nom) tuiles.push({ cle: 'wifi', rendu: (large) => <TuileWifi nom={etab.wifi_nom!} motDePasse={etab.wifi_mdp} large={large} /> })
  if (o.avis) tuiles.push({ cle: 'avis', rendu: (large) => <TuileAvis google={google} large={large} /> })
  const derniereLarge = tuiles.length % 2 === 1

  return (
    <Cadre etab={etab} code={code} langue={langue} memoriserLangue={l === langue ? langue : null} vu="o">
      <EnTete etab={etab} emplacement={lieu.emplacement} code={code} langue={langue} />
      <div className="sv-colonne sv-pile">
        {!choisie && <Suggestion code={code} langue={langue} cible={suggeree} />}
        <Annonces annonces={enCours} etab={etab} langue={langue} />
        {/* Sans demandes en un tap, les commandes envoyées se suivent quand même ici. */}
        {o.commande && !(o.appel && typesUi.length > 0) && <SuiviEnCours merci={merci} className="sv-entre" />}
        {tuileMenu && <div className="sv-entre sv-entre-2">{tuileMenu}</div>}

        {o.appel && typesUi.length > 0 && (
          <section aria-labelledby="sv-titre-demandes" className="sv-entre sv-entre-2">
            <div className={hotel ? 'sv-entete-section' : undefined}>
              <h2 id="sv-titre-demandes" className={hotel ? 'sv-section-titre' : 'sr-only'}>
                {hotel ? t.demandes : t.demandesTitre}
              </h2>
              {hotel && <p className="sv-doux text-[0.9rem]">{t.demandesAide}</p>}
            </div>
            <CentreDemandes
              types={typesUi}
              limite={hotel ? 4 : undefined}
              lienTout={hotel && typesUi.length > 4 ? lien('/demandes') : undefined}
              avis={o.avis ? { google } : null}
              merci={merci}
              accentPremier={!hotel}
            />
          </section>
        )}

        {tuiles.length > 0 && (
          <section aria-label={etab.nom} className="sv-grille cascade">
            {tuiles.map((x, i) => {
              const large = derniereLarge && i === tuiles.length - 1
              return (
                <div key={x.cle} className={large ? 'col-span-2' : ''}>
                  {x.rendu(large)}
                </div>
              )
            })}
          </section>
        )}

        <Coordonnees etab={etab} />
      </div>
    </Cadre>
  )
}
