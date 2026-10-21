import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import { lireEtablissement, menus as lireMenus } from '@/lib/services/donnees'
import { traductionsManquantes } from '@/lib/services/admin'
import { drapeau, nomLangue, texte, type Texte } from '@/lib/services/langues'
import { urlFichier } from '@/lib/services/fichiers'
import { ALLERGENES, ETIQUETTES, type Etablissement, type Menu, type Plat, type Section } from '@/lib/services/types'
import { argent } from '@/lib/format'
import { JOURS_COURTS } from '@/lib/langue'
import BoutonEnvoi from '@/components/bouton-envoi'
import Cache from '@/components/services/bo/cache'
import Confirmer from '@/components/services/bo/confirmer'
import BoutonFenetre from '@/components/services/bo/bouton-fenetre'
import ChampsLangues, { ATraduire } from '@/components/services/bo/champs-langues'
import { Bloc, Pastille } from '@/components/services/bo/elements'
import {
  basculerPlatAction,
  creerMenuAction,
  creerPlatAction,
  creerSectionAction,
  deplacerMenuAction,
  deplacerPlatAction,
  deplacerSectionAction,
  dupliquerPlatAction,
  importerMenuAction,
  modifierMenuAction,
  modifierPlatAction,
  modifierSectionAction,
  pdfMenuAction,
  supprimerMenuAction,
  supprimerPlatAction,
  supprimerSectionAction,
} from '../../actions'

export const dynamic = 'force-dynamic'

const TYPES_MENU: [Menu['type'], string][] = [
  ['carte', 'La carte'],
  ['dejeuner', 'Déjeuner / brunch'],
  ['boissons', 'Boissons'],
  ['room_service', 'Service aux chambres'],
  ['autre', 'Autre'],
]

const prixTexte = (v: number | null) => (v === null ? '' : String(v).replace('.', ','))
const petitBouton = 'grid size-7 place-items-center rounded-lg text-xs text-[var(--color-encre-doux)] hover:bg-[var(--color-fond)] hover:text-[var(--color-encre)] disabled:opacity-30'

function aTraduire(t: Texte, langues: string[], defaut: string): boolean {
  const v = t as Record<string, string | undefined>
  return Boolean(v[defaut]?.trim()) && langues.some((l) => l !== defaut && !v[l]?.trim())
}

function horaire(m: Menu): string {
  const jours = m.jours.length === 7 ? 'tous les jours' : m.jours.map((j) => JOURS_COURTS.fr[j - 1]).join(' ')
  return m.heure_debut && m.heure_fin ? `${m.heure_debut.replace(':', ' h ')} – ${m.heure_fin.replace(':', ' h ')} · ${jours}` : `toute la journée · ${jours}`
}

function FormulairePlat({ e, plat, sections, retour }: { e: Etablissement; plat: Plat; sections: Section[]; retour: string }) {
  const lignesVariantes = plat.variantes.length + 2
  const photo = urlFichier(plat.photo)
  return (
    <form action={modifierPlatAction} className="space-y-4 border-t border-[var(--color-ligne)] pt-4">
      <Cache etab={e.id} retour={retour} ancre={`plat-${plat.id}`} id={plat.id} />
      <input type="hidden" name="nb_variantes" value={lignesVariantes} />
      <div className="grid gap-4 md:grid-cols-2">
        <ChampsLangues nom="nom" libelle="Nom" valeurs={plat.nom} langues={e.langues} defaut={e.langue_defaut} max={120} requis />
        <ChampsLangues nom="description" libelle="Description" valeurs={plat.description} langues={e.langues} defaut={e.langue_defaut} multiligne max={600} />
      </div>
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
        <label>
          <span className="etiquette">Prix ($)</span>
          <input name="prix" defaultValue={prixTexte(plat.prix)} inputMode="decimal" className="champ tabular-nums" placeholder="ex. 16,50" />
        </label>
        <label>
          <span className="etiquette">Section</span>
          <select name="section_id" defaultValue={plat.section_id} className="champ">
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {texte(s.nom, e.langue_defaut)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="disponible" defaultChecked={plat.disponible} /> En stock
        </label>
      </div>

      <fieldset>
        <legend className="etiquette">Variantes (tailles, formats…) — le prix de chacune remplace le prix du plat</legend>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase text-[var(--color-encre-doux)]">
                {e.langues.map((l) => (
                  <th key={l} className="pb-1 pr-2 font-bold">
                    {l}
                  </th>
                ))}
                <th className="w-24 pb-1 font-bold">Prix</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: lignesVariantes }, (_, i) => {
                const v = plat.variantes[i]
                const noms = (v?.nom ?? {}) as Record<string, string | undefined>
                return (
                  <tr key={i}>
                    {e.langues.map((l) => (
                      <td key={l} className="pb-1.5 pr-2">
                        <input
                          name={`v${i}_nom_${l}`}
                          defaultValue={noms[l] ?? ''}
                          maxLength={60}
                          className={`champ !py-1.5 text-sm ${v && noms[e.langue_defaut] && !noms[l] ? '!border-dashed !border-[var(--color-attention)]' : ''}`}
                          placeholder={v ? (noms[e.langue_defaut] ? `À traduire : ${noms[e.langue_defaut]}` : '') : i === plat.variantes.length ? 'ex. Grande' : ''}
                          aria-label={`Variante ${i + 1} — ${nomLangue(l)}`}
                        />
                      </td>
                    ))}
                    <td className="pb-1.5">
                      {Object.entries(noms)
                        .filter(([l, x]) => !e.langues.includes(l) && x)
                        .map(([l, x]) => (
                          <input key={l} type="hidden" name={`v${i}_nom_${l}`} value={x} />
                        ))}
                      <input name={`v${i}_prix`} defaultValue={prixTexte(v?.prix ?? null)} inputMode="decimal" className="champ !py-1.5 text-sm tabular-nums" aria-label={`Prix de la variante ${i + 1}`} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-[var(--color-encre-doux)]">Videz une ligne pour retirer la variante. Deux lignes vides sont toujours offertes.</p>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <fieldset>
          <legend className="etiquette">Allergènes (Santé Canada)</legend>
          <div className="flex flex-wrap gap-1.5">
            {ALLERGENES.map((a) => (
              <label
                key={a.cle}
                className="cursor-pointer rounded-full border border-[var(--color-ligne)] px-2.5 py-1 text-xs has-[:checked]:border-[var(--color-negatif)] has-[:checked]:bg-red-50 has-[:checked]:font-semibold has-[:checked]:text-[var(--color-negatif)]"
              >
                <input type="checkbox" name="allergenes" value={a.cle} defaultChecked={plat.allergenes.includes(a.cle)} className="sr-only" />
                {a.icone} {a.fr}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="etiquette">Étiquettes</legend>
          <div className="flex flex-wrap gap-1.5">
            {ETIQUETTES.map((t) => (
              <label
                key={t.cle}
                className="cursor-pointer rounded-full border border-[var(--color-ligne)] px-2.5 py-1 text-xs has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-doux)] has-[:checked]:font-semibold has-[:checked]:text-[var(--color-accent)]"
              >
                <input type="checkbox" name="etiquettes" value={t.cle} defaultChecked={plat.etiquettes.includes(t.cle)} className="sr-only" />
                {t.icone} {t.fr}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="size-14 rounded-xl object-cover" />
          )}
          <label>
            <span className="etiquette">{photo ? 'Remplacer la photo' : 'Photo'}</span>
            <input type="file" name="photo" accept="image/*" className="text-xs" />
          </label>
          {photo && (
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-encre-doux)]">
              <input type="checkbox" name="retirer_photo" /> Retirer
            </label>
          )}
        </div>
        <BoutonEnvoi attente="Enregistrement…">Enregistrer le plat</BoutonEnvoi>
      </div>
    </form>
  )
}

function LignePlat({
  e,
  plat,
  sections,
  retour,
  premier,
  dernier,
}: {
  e: Etablissement
  plat: Plat
  sections: Section[]
  retour: string
  premier: boolean
  dernier: boolean
}) {
  const photo = urlFichier(plat.photo)
  const nom = texte(plat.nom, e.langue_defaut)
  const prix =
    plat.variantes.length > 0
      ? plat.variantes.map((v) => `${texte(v.nom, e.langue_defaut)} ${v.prix !== null ? argent(v.prix) : ''}`.trim()).join(' · ')
      : plat.prix !== null
        ? argent(plat.prix)
        : '—'
  return (
    <li data-ligne id={`plat-${plat.id}`} className="scroll-mt-28 py-2.5">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--color-fond)] text-lg text-[var(--color-encre-doux)]">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="size-full object-cover" />
          ) : (
            <span aria-hidden>🍽</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`font-medium ${plat.disponible ? '' : 'text-[var(--color-encre-doux)] line-through'}`}>{nom}</span>
            <ATraduire textes={[plat.nom, plat.description, ...plat.variantes.map((v) => v.nom)]} langues={e.langues} defaut={e.langue_defaut} />
            {plat.etiquettes.map((t) => {
              const x = ETIQUETTES.find((y) => y.cle === t)
              return x ? (
                <span key={t} title={x.fr} className="text-xs">
                  {x.icone}
                </span>
              ) : null
            })}
          </div>
          {texte(plat.description, e.langue_defaut) && <p className="line-clamp-1 text-xs text-[var(--color-encre-doux)]">{texte(plat.description, e.langue_defaut)}</p>}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
            <span className="font-semibold tabular-nums">{prix}</span>
            {plat.allergenes.length > 0 && (
              <span className="text-[var(--color-encre-doux)]" title={plat.allergenes.map((a) => ALLERGENES.find((x) => x.cle === a)?.fr ?? a).join(', ')}>
                · {plat.allergenes.map((a) => ALLERGENES.find((x) => x.cle === a)?.icone ?? a).join(' ')}
              </span>
            )}
          </p>
        </div>
        <form className="flex shrink-0 items-center gap-0.5">
          <Cache etab={e.id} retour={retour} ancre={`plat-${plat.id}`} id={plat.id} />
          <button
            formAction={basculerPlatAction}
            name="disponible"
            value={plat.disponible ? '0' : '1'}
            title={plat.disponible ? 'Marquer épuisé' : 'Remettre en stock'}
            className={`mr-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
              plat.disponible
                ? 'border-[color-mix(in_srgb,var(--color-positif)_30%,transparent)] bg-green-50 text-[var(--color-positif)] hover:bg-red-50 hover:text-[var(--color-negatif)]'
                : 'border-[color-mix(in_srgb,var(--color-negatif)_30%,transparent)] bg-red-50 text-[var(--color-negatif)] hover:bg-green-50 hover:text-[var(--color-positif)]'
            }`}
          >
            {plat.disponible ? '● En stock' : '○ Épuisé'}
          </button>
          <button formAction={deplacerPlatAction} name="sens" value="-1" disabled={premier} className={petitBouton} title="Monter">
            ↑
          </button>
          <button formAction={deplacerPlatAction} name="sens" value="1" disabled={dernier} className={petitBouton} title="Descendre">
            ↓
          </button>
          <button formAction={dupliquerPlatAction} className={petitBouton} title="Dupliquer">
            ⧉
          </button>
          <Confirmer
            action={supprimerPlatAction}
            poussiere
            titre="Supprimer ce plat ?"
            texte={<>« {nom} » disparaîtra du menu, dans toutes les langues. Pour le retirer un soir seulement, marquez-le plutôt « épuisé ».</>}
            libelle="✕"
            titreBouton="Supprimer"
            className={`${petitBouton} hover:!text-[var(--color-negatif)]`}
          />
        </form>
      </div>
      <details className="group mt-1">
        <summary className="ml-[3.75rem] inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline">
          <span className="transition group-open:rotate-90">›</span> Modifier
        </summary>
        <div className="mt-2">
          <FormulairePlat e={e} plat={plat} sections={sections} retour={retour} />
        </div>
      </details>
    </li>
  )
}

export default async function EditeurMenu({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string; trad?: string }> }) {
  await exigerProprietaire()
  const { id } = await params
  const sp = await searchParams
  const e = await lireEtablissement(id)
  if (!e) notFound()
  const [liste, manque] = await Promise.all([lireMenus(e.id, e.options.fuseau, true), traductionsManquantes(e.id, e.langues, e.langue_defaut)])
  const ici = `/services/${e.id}/menu`
  const menu = liste.find((m) => m.id === sp.m) ?? liste[0] ?? null
  const trad = sp.trad === '1'
  const retour = menu ? `${ici}?m=${menu.id}${trad ? '&trad=1' : ''}` : ici
  const D = e.langue_defaut
  const totalManque = Object.values(manque).reduce((s, n) => s + n, 0)
  const nbPlats = (m: Menu) => m.sections.reduce((s, x) => s + x.plats.length, 0)
  const platsATraduire = menu
    ? menu.sections.flatMap((s) => s.plats).filter((p) => aTraduire(p.nom, e.langues, D) || aTraduire(p.description, e.langues, D)).length
    : 0

  const formulaireNouveauMenu = (
    <form action={creerMenuAction} className="space-y-4">
      <Cache etab={e.id} retour={ici} />
      <label className="block">
        <span className="etiquette">Type</span>
        <select name="type" defaultValue={e.type === 'hotel' ? 'room_service' : 'carte'} className="champ">
          {TYPES_MENU.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <ChampsLangues nom="nom" libelle="Nom du menu" langues={e.langues} defaut={D} max={80} requis exemple="La carte" />
      <div className="flex justify-end">
        <BoutonEnvoi attente="Création…">Créer le menu</BoutonEnvoi>
      </div>
    </form>
  )

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
      <aside className="space-y-4">
        <div className="carte p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">Menus</h2>
            <BoutonFenetre titre="Nouveau menu" libelle="+ Nouveau" className="text-xs font-semibold text-[var(--color-accent)] hover:underline">
              {formulaireNouveauMenu}
            </BoutonFenetre>
          </div>
          {liste.length === 0 ? (
            <p className="px-1 pb-1 text-xs text-[var(--color-encre-doux)]">Aucun menu.</p>
          ) : (
            <ul className="cascade space-y-1">
              {liste.map((m, i) => (
                <li key={m.id} className="group flex items-center gap-1">
                  <Link
                    href={`${ici}?m=${m.id}`}
                    aria-current={m.id === menu?.id ? 'page' : undefined}
                    className={`min-w-0 flex-1 rounded-xl px-2.5 py-2 text-sm transition ${
                      m.id === menu?.id ? 'bg-[var(--color-encre)] text-white shadow' : 'hover:bg-[var(--color-fond)]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {m.actif && m.en_service && <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-positif)]" title="Servi en ce moment" />}
                      <span className={`truncate font-medium ${m.actif ? '' : 'opacity-60'}`}>{texte(m.nom, D) || 'Sans nom'}</span>
                    </span>
                    <span className={`block text-[11px] ${m.id === menu?.id ? 'text-white/60' : 'text-[var(--color-encre-doux)]'}`}>
                      {nbPlats(m)} plat{nbPlats(m) > 1 ? 's' : ''}
                      {m.actif ? '' : ' · masqué'}
                    </span>
                  </Link>
                  <form className="flex flex-col opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <Cache etab={e.id} retour={`${ici}?m=${m.id}`} id={m.id} />
                    <button formAction={deplacerMenuAction} name="sens" value="-1" disabled={i === 0} className="text-[10px] leading-none text-[var(--color-encre-doux)] disabled:opacity-20" title="Monter">
                      ▲
                    </button>
                    <button formAction={deplacerMenuAction} name="sens" value="1" disabled={i === liste.length - 1} className="text-[10px] leading-none text-[var(--color-encre-doux)] disabled:opacity-20" title="Descendre">
                      ▼
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Bloc id="traductions" titre="Traductions" sous={totalManque ? `${totalManque} texte${totalManque > 1 ? 's' : ''} à traduire, tout compris` : 'Tout est traduit.'}>
          {e.langues.length < 2 ? (
            <p className="text-xs text-[var(--color-encre-doux)]">
              Une seule langue. <Link href={`/services/${e.id}/reglages#langues`} className="font-medium text-[var(--color-accent)] hover:underline">En ajouter →</Link>
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {e.langues
                .filter((l) => l !== D)
                .map((l) => (
                  <li key={l} className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{drapeau(l)}</span>
                      {nomLangue(l)}
                    </span>
                    {(manque[l] ?? 0) === 0 ? <Pastille ton="positif">✓ complet</Pastille> : <Pastille ton="attention">{manque[l]} à faire</Pastille>}
                  </li>
                ))}
            </ul>
          )}
        </Bloc>
      </aside>

      <div data-ligne className="min-w-0 space-y-4">
        {!menu ? (
          <div className="carte grid place-items-center gap-3 px-6 py-14 text-center">
            <span className="text-4xl" aria-hidden>
              📖
            </span>
            <h2 className="text-base font-semibold">{e.type === 'hotel' ? 'Pas encore de menu du service aux chambres' : 'Pas encore de menu'}</h2>
            <p className="max-w-md text-sm text-[var(--color-encre-doux)]">Créez un menu, puis ajoutez-y des sections et des plats — ou collez un menu entier en texte.</p>
            <BoutonFenetre titre="Nouveau menu" libelle="+ Créer un menu">
              {formulaireNouveauMenu}
            </BoutonFenetre>
          </div>
        ) : (
          <>
            <section className="carte p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{texte(menu.nom, D)}</h2>
                    <ATraduire textes={[menu.nom, menu.description]} langues={e.langues} defaut={D} />
                    {!menu.actif ? <Pastille>Masqué aux clients</Pastille> : menu.en_service ? <Pastille ton="positif">● Servi en ce moment</Pastille> : <Pastille>Hors service</Pastille>}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
                    {TYPES_MENU.find(([v]) => v === menu.type)?.[1]} · {horaire(menu)} · {menu.sections.length} section{menu.sections.length > 1 ? 's' : ''} · {nbPlats(menu)} plat
                    {nbPlats(menu) > 1 ? 's' : ''}
                  </p>
                  {texte(menu.description, D) && <p className="mt-1 text-sm text-[var(--color-encre-doux)]">{texte(menu.description, D)}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {e.langues.length > 1 && (
                    <Link href={trad ? `${ici}?m=${menu.id}` : `${ici}?m=${menu.id}&trad=1`} className={`bouton text-xs ${trad ? '' : 'bouton-secondaire'}`}>
                      {trad ? '✓ ' : ''}À traduire ({platsATraduire})
                    </Link>
                  )}
                  <BoutonFenetre titre="Importer un menu en texte" libelle="⇪ Importer" className="bouton bouton-secondaire text-xs" largeur="max-w-2xl">
                    <form action={importerMenuAction} className="space-y-3">
                      <Cache etab={e.id} retour={retour} />
                      <label className="block">
                        <span className="etiquette">Dans le menu</span>
                        <select name="menu" defaultValue={menu.id} className="champ">
                          {liste.map((m) => (
                            <option key={m.id} value={m.id}>
                              {texte(m.nom, D)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="etiquette">Le menu, collé tel quel ({nomLangue(D)})</span>
                        <textarea
                          name="texte"
                          rows={12}
                          required
                          className="champ font-mono text-xs"
                          placeholder={'## Entrées\nSoupe du jour | Selon l’humeur du chef | 7\nFrites maison | 5,50\n\n## Plats\nPoutine classique | Frites, fromage en grains, sauce | 16'}
                        />
                      </label>
                      <p className="text-xs leading-relaxed text-[var(--color-encre-doux)]">
                        Une ligne qui commence par <code className="rounded bg-[var(--color-fond)] px-1">##</code> ouvre une section. Chaque autre ligne est un plat :{' '}
                        <code className="rounded bg-[var(--color-fond)] px-1">nom | description | prix</code>, ou <code className="rounded bg-[var(--color-fond)] px-1">nom | prix</code>, ou
                        le nom seul. Les traductions se font ensuite, plat par plat.
                      </p>
                      <div className="flex justify-end">
                        <BoutonEnvoi attente="Import…">Importer</BoutonEnvoi>
                      </div>
                    </form>
                  </BoutonFenetre>
                  <Confirmer
                    action={supprimerMenuAction}
                    poussiere
                    champs={{ etab: e.id, retour: ici, id: menu.id }}
                    titre="Supprimer tout ce menu ?"
                    texte={`« ${texte(menu.nom, D)} » sera supprimé avec ses ${menu.sections.length} sections et ses ${nbPlats(menu)} plats. Pour le cacher sans rien perdre, décochez plutôt « Visible » dans ses réglages.`}
                    confirmer="Supprimer le menu"
                    libelle="Supprimer"
                  />
                </div>
              </div>

              <details className="group mt-4 rounded-xl border border-[var(--color-ligne)]">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold">
                  <span className="transition group-open:rotate-90">›</span> Réglages du menu : nom, horaires, PDF
                </summary>
                <div className="space-y-5 border-t border-[var(--color-ligne)] p-4">
                  <form action={modifierMenuAction} className="space-y-4">
                    <Cache etab={e.id} retour={retour} id={menu.id} />
                    <div className="grid gap-4 md:grid-cols-2">
                      <ChampsLangues nom="nom" libelle="Nom" valeurs={menu.nom} langues={e.langues} defaut={D} max={80} requis />
                      <ChampsLangues nom="description" libelle="Description (facultative)" valeurs={menu.description} langues={e.langues} defaut={D} multiligne max={400} />
                    </div>
                    <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
                      <label>
                        <span className="etiquette">Type</span>
                        <select name="type" defaultValue={menu.type} className="champ">
                          {TYPES_MENU.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <fieldset>
                        <legend className="etiquette">Servi</legend>
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="time" name="heure_debut" defaultValue={menu.heure_debut ?? ''} className="champ w-32" aria-label="Début du service" />
                          <span className="text-sm text-[var(--color-encre-doux)]">à</span>
                          <input type="time" name="heure_fin" defaultValue={menu.heure_fin ?? ''} className="champ w-32" aria-label="Fin du service" />
                          <label className="ml-2 flex items-center gap-1.5 text-sm">
                            <input type="checkbox" name="toute_la_journee" defaultChecked={!menu.heure_debut} /> Toute la journée
                          </label>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {JOURS_COURTS.fr.map((j, i) => (
                            <label
                              key={j}
                              className="cursor-pointer rounded-lg border border-[var(--color-ligne)] px-2.5 py-1 text-xs font-semibold has-[:checked]:border-[var(--color-encre)] has-[:checked]:bg-[var(--color-encre)] has-[:checked]:text-white"
                            >
                              <input type="checkbox" name="jours" value={i + 1} defaultChecked={menu.jours.includes(i + 1)} className="sr-only" />
                              {j}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="actif" defaultChecked={menu.actif} /> Visible pour les clients
                      </label>
                      <BoutonEnvoi attente="Enregistrement…">Enregistrer le menu</BoutonEnvoi>
                    </div>
                  </form>

                  <div>
                    <h3 className="text-sm font-semibold">Menu en PDF, langue par langue</h3>
                    <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
                      Facultatif : le client qui lit dans cette langue peut ouvrir le PDF (votre menu imprimé, tel quel). Le menu interactif reste la vue principale.
                    </p>
                    <ul className="mt-3 divide-y divide-[var(--color-ligne)] rounded-xl border border-[var(--color-ligne)]">
                      {e.langues.map((l) => {
                        const pdf = urlFichier(menu.pdf[l])
                        return (
                          <li key={l} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                            <span className="inline-flex items-center gap-2">
                              <span aria-hidden>{drapeau(l)}</span> {nomLangue(l)}
                            </span>
                            <form action={pdfMenuAction} className="flex flex-wrap items-center gap-2">
                              <Cache etab={e.id} retour={retour} id={menu.id} />
                              <input type="hidden" name="langue" value={l} />
                              {pdf ? (
                                <>
                                  <a href={pdf} target="_blank" rel="noreferrer" className="text-xs font-medium text-[var(--color-accent)] hover:underline">
                                    📄 Voir le PDF ↗
                                  </a>
                                  <BoutonEnvoi secondaire name="geste" value="retirer" attente="…" className="!px-2.5 !py-1 text-xs">
                                    Retirer
                                  </BoutonEnvoi>
                                </>
                              ) : (
                                <>
                                  <input type="file" name="pdf" accept="application/pdf" className="max-w-[14rem] text-xs" />
                                  <BoutonEnvoi secondaire attente="Envoi…" className="!px-2.5 !py-1 text-xs">
                                    Téléverser
                                  </BoutonEnvoi>
                                </>
                              )}
                            </form>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              </details>
            </section>

            {trad && (
              <p className="carte border-dashed px-4 py-3 text-sm text-[var(--color-encre-doux)]">
                Filtre : seulement les plats qui ont une traduction manquante ({platsATraduire}).{' '}
                <Link href={`${ici}?m=${menu.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                  Tout afficher
                </Link>
              </p>
            )}

            {menu.sections.map((s, i) => {
              const plats = trad ? s.plats.filter((p) => aTraduire(p.nom, e.langues, D) || aTraduire(p.description, e.langues, D)) : s.plats
              if (trad && !plats.length && !aTraduire(s.nom, e.langues, D)) return null
              return (
                <section key={s.id} data-ligne id={`section-${s.id}`} className="carte scroll-mt-24 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold">{texte(s.nom, D)}</h2>
                        <ATraduire textes={[s.nom, s.description]} langues={e.langues} defaut={D} />
                        <span className="text-xs text-[var(--color-encre-doux)]">
                          {s.plats.length} plat{s.plats.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      {texte(s.description, D) && <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">{texte(s.description, D)}</p>}
                    </div>
                    <form className="flex items-center gap-0.5">
                      <Cache etab={e.id} retour={retour} ancre={`section-${s.id}`} id={s.id} />
                      <button formAction={deplacerSectionAction} name="sens" value="-1" disabled={i === 0} className={petitBouton} title="Monter la section">
                        ↑
                      </button>
                      <button formAction={deplacerSectionAction} name="sens" value="1" disabled={i === menu.sections.length - 1} className={petitBouton} title="Descendre la section">
                        ↓
                      </button>
                      <Confirmer
                        action={supprimerSectionAction}
                        poussiere
                        titre="Supprimer cette section ?"
                        texte={`« ${texte(s.nom, D)} » sera supprimée avec ses ${s.plats.length} plats.`}
                        libelle="Supprimer"
                        className="ml-1 text-xs font-semibold text-[var(--color-negatif)] hover:underline"
                      />
                    </form>
                  </div>

                  <details className="group mt-2">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline">
                      <span className="transition group-open:rotate-90">›</span> Renommer la section
                    </summary>
                    <form action={modifierSectionAction} className="mt-3 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                      <Cache etab={e.id} retour={retour} ancre={`section-${s.id}`} id={s.id} />
                      <ChampsLangues nom="nom" libelle="Nom" valeurs={s.nom} langues={e.langues} defaut={D} max={80} requis />
                      <ChampsLangues nom="description" libelle="Sous-titre (facultatif)" valeurs={s.description} langues={e.langues} defaut={D} max={300} />
                      <BoutonEnvoi attente="…">Enregistrer</BoutonEnvoi>
                    </form>
                  </details>

                  {plats.length > 0 && (
                    <ul className="mt-3 divide-y divide-[var(--color-ligne)]">
                      {plats.map((p, k) => (
                        <LignePlat key={p.id} e={e} plat={p} sections={menu.sections} retour={retour} premier={k === 0} dernier={k === plats.length - 1} />
                      ))}
                    </ul>
                  )}

                  {!trad && (
                    <form action={creerPlatAction} className="mt-3 grid gap-2 rounded-xl border border-dashed border-[var(--color-ligne)] p-3 sm:grid-cols-[1.2fr_1.6fr_6rem_auto] sm:items-center">
                      <Cache etab={e.id} retour={retour} ancre={`section-${s.id}`} />
                      <input type="hidden" name="section" value={s.id} />
                      <input name={`nom_${D}`} required maxLength={120} className="champ" placeholder="Nouveau plat" aria-label="Nom du nouveau plat" />
                      <input name={`description_${D}`} maxLength={600} className="champ" placeholder="Description (facultative)" aria-label="Description du nouveau plat" />
                      <input name="prix" inputMode="decimal" className="champ tabular-nums" placeholder="Prix" aria-label="Prix du nouveau plat" />
                      <BoutonEnvoi secondaire attente="…">
                        + Ajouter
                      </BoutonEnvoi>
                    </form>
                  )}
                </section>
              )
            })}

            {!trad && (
              <form action={creerSectionAction} className="carte grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-end">
                <Cache etab={e.id} retour={retour} />
                <input type="hidden" name="menu" value={menu.id} />
                <ChampsLangues nom="nom" libelle="Nouvelle section" langues={e.langues} defaut={D} max={80} requis exemple="Entrées, Desserts, Vins…" />
                <BoutonEnvoi attente="…">+ Ajouter la section</BoutonEnvoi>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
