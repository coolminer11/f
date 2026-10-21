import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { menus } from '@/lib/services/donnees'
import { texte } from '@/lib/services/langues'
import { urlFichier } from '@/lib/services/fichiers'
import { ALLERGENES, ETIQUETTES } from '@/lib/services/types'
import { formaterHeure, formaterPrix, locale, nomListe, ui } from '@/lib/services/ui'
import { compterUneFois } from '@/lib/services/client'
import { BarreHaut, Cadre } from '@/components/services/client/cadre'
import MenuVivant, { type Nommes, type SectionVivante } from '@/components/services/client/menu-vivant'
import { numeroTel } from '@/components/services/client/outils'
import { lieuDeLaPage, titreLieu, type ParamsLieu } from '../lieu'

export const dynamic = 'force-dynamic'

export async function generateMetadata(p: ParamsLieu): Promise<Metadata> {
  return { title: await titreLieu(p, 'menu') }
}

/** Le menu vivant d'un établissement : ?m= choisit le menu (sinon celui servi maintenant). */
export default async function PageMenu(p: ParamsLieu) {
  const { code, l, lieu, lien, sp, un } = await lieuDeLaPage(p, '/menu')
  const { etab, langue } = lieu
  const o = etab.options
  if (!o.menu) redirect(lien(''))
  const d = etab.langue_defaut
  const tous = await menus(etab.id, o.fuseau)
  const voulu = un(sp.m)
  const menu = tous.find((m) => m.id === voulu) ?? tous.find((m) => m.en_service) ?? tous[0]
  const cle = menu ? `m-${menu.id.slice(0, 8)}` : 'm'
  if (menu) await compterUneFois(lieu, 'menu', menu.id, langue, cle)

  const prix = (n: number | null) => (n == null ? null : formaterPrix(n, etab.devise, langue))
  const sections: SectionVivante[] = (menu?.sections ?? [])
    .map((s) => ({
      id: s.id,
      nom: texte(s.nom, langue, d),
      description: texte(s.description, langue, d),
      plats: s.plats
        .map((pl) => {
          const variantes = (pl.variantes ?? []).map((v) => ({ nom: texte(v.nom, langue, d), n: v.prix }))
          const prixFormats = variantes.map((v) => v.n).filter((n): n is number => n != null)
          const base = pl.prix ?? (prixFormats.length ? Math.min(...prixFormats) : null)
          return {
            id: pl.id,
            nom: texte(pl.nom, langue, d),
            description: texte(pl.description, langue, d),
            prix: prix(base),
            prixNombre: base,
            aPartirDe: pl.prix == null && new Set(prixFormats).size > 1,
            variantes: variantes.filter((v) => v.nom).map((v) => ({ nom: v.nom, prix: prix(v.n) })),
            photo: o.photos ? urlFichier(pl.photo) : null,
            allergenes: o.allergenes ? pl.allergenes : [],
            etiquettes: pl.etiquettes ?? [],
            disponible: pl.disponible,
          }
        })
        .filter((pl) => pl.nom),
    }))
    .filter((s) => s.plats.length > 0)

  const horaire = menu?.heure_debut && menu.heure_fin ? ui(langue, 'servi', { debut: formaterHeure(menu.heure_debut, langue), fin: formaterHeure(menu.heure_fin, langue) }) : null
  const pdf = menu ? urlFichier(menu.pdf?.[langue] ?? menu.pdf?.[d] ?? Object.values(menu.pdf ?? {})[0]) : null
  const nomMenu = menu ? texte(menu.nom, langue, d) || ui(langue, 'menu') : ui(langue, 'menu')
  const etiquettes: Nommes = Object.fromEntries(ETIQUETTES.map((e) => [e.cle, { nom: nomListe('etiquette', ETIQUETTES, e.cle, langue), icone: e.icone }]))
  const allergenes: Nommes = Object.fromEntries(ALLERGENES.map((a) => [a.cle, { nom: nomListe('allergene', ALLERGENES, a.cle, langue), icone: a.icone }]))
  const tel = menu?.type === 'room_service' ? numeroTel(etab.telephone) : null

  return (
    <Cadre etab={etab} code={code} langue={langue} memoriserLangue={l === langue ? langue : null} vu={cle}>
      <MenuVivant
        barre={<BarreHaut etab={etab} code={code} langue={langue} titre={nomMenu} retour={lien('')} />}
        menu={{ id: menu?.id ?? '', nom: nomMenu, description: menu ? texte(menu.description, langue, d) : '', enService: menu?.en_service ?? true, horaire, pdf }}
        choix={tous.map((m) => ({ id: m.id, nom: texte(m.nom, langue, d) || ui(langue, 'menu'), enService: Boolean(m.en_service), href: lien('/menu', { m: m.id }) }))}
        sections={sections}
        options={{ recherche: o.recherche, allergenes: o.allergenes, photos: o.photos, prix: o.prix }}
        etiquettes={etiquettes}
        allergenes={allergenes}
        monnaie={{ locale: locale(langue), devise: etab.devise }}
        appel={tel ? { tel } : null}
      />
    </Cadre>
  )
}
