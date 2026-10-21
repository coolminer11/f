import Link from 'next/link'
import { exigerProprietaire } from '@/lib/services/proprietaire'
import { listerEtablissements } from '@/lib/services/donnees'
import { apercuEnsemble } from '@/lib/services/admin'
import { LANGUES } from '@/lib/services/langues'
import { urlFichier } from '@/lib/services/fichiers'
import { argent } from '@/lib/format'
import BoutonEnvoi from '@/components/bouton-envoi'
import Inclinaison from '@/components/effets/inclinaison'
import BoutonFenetre from '@/components/services/bo/bouton-fenetre'
import Chiffre from '@/components/services/bo/chiffre'
import Apparition from '@/components/services/bo/apparition'
import { Courbe, ICONE_TYPE, NOM_TYPE, assombrir, joursEssai } from '@/components/services/bo/elements'
import { creerDemoAction, creerEtablissementAction } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tapora Services' }

/** La pastille de formule, version carte bancaire (sur fond coloré). */
function Formule({ e }: { e: { actif: boolean; formule: 'essai' | 'actif' | 'suspendu'; essai_jusqua: string | null; prix_mensuel: number | null } }) {
  const j = joursEssai(e)
  const texte = !e.actif
    ? 'Désactivé'
    : e.formule === 'suspendu'
      ? 'Suspendu'
      : e.formule === 'actif'
        ? `${e.prix_mensuel != null ? `${e.prix_mensuel.toLocaleString('fr-CA')} $/mois` : 'Actif'}`
        : j === null
          ? 'Essai'
          : j < 0
            ? `Essai échu (${-j} j)`
            : `Essai · J-${j}`
  const alerte = !e.actif || e.formule === 'suspendu' || (j !== null && j <= 5)
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${alerte ? 'bg-[#ffd27a] text-[#2a1a00]' : 'bg-white/15 text-white'}`}>
      {texte}
    </span>
  )
}

function FormulaireDemo() {
  return (
    <form action={creerDemoAction} className="space-y-4">
      <p className="text-sm text-[var(--color-encre-doux)]">
        Un établissement complet en dix secondes, pour montrer le produit fini à un client : tout est traduit en français, anglais et espagnol, avec un
        mois d’activité inventée pour que les statistiques soient vivantes.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ['restaurant', 'Bistro Le Saint-Laurent', 'Carte, brunch et boissons · 36 plats avec variantes, allergènes et étiquettes · plat du jour · 21 places'],
            ['hotel', 'Hôtel Le Vieux-Port', 'Concierge de Québec (12 rubriques) · service aux chambres · Wi-Fi · 16 chambres et zones sur 3 étages'],
          ] as const
        ).map(([t, nom, detail], i) => (
          <label
            key={t}
            className="flex cursor-pointer flex-col gap-1 rounded-2xl border border-[var(--color-ligne)] p-4 transition has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-doux)]"
          >
            <input type="radio" name="type" value={t} defaultChecked={i === 0} className="sr-only" />
            <span className="text-2xl" aria-hidden>
              {ICONE_TYPE[t]}
            </span>
            <span className="text-sm font-semibold">{nom}</span>
            <span className="text-xs leading-relaxed text-[var(--color-encre-doux)]">{detail}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <BoutonEnvoi attente="Création de la démo…">Créer la démo</BoutonEnvoi>
      </div>
    </form>
  )
}

function FormulaireNouveau() {
  return (
    <form action={creerEtablissementAction} className="space-y-4">
      <p className="text-sm text-[var(--color-encre-doux)]">
        Les demandes par défaut sont créées tout de suite (serveur, addition… ou serviettes, ménage…) ; pour un hôtel, l’ossature du concierge aussi.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(['restaurant', 'hotel'] as const).map((t, i) => (
          <label
            key={t}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-ligne)] p-3 text-sm font-medium has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-doux)]"
          >
            <input type="radio" name="type" value={t} defaultChecked={i === 0} className="sr-only" />
            <span className="text-xl" aria-hidden>
              {ICONE_TYPE[t]}
            </span>
            {NOM_TYPE[t]}
          </label>
        ))}
      </div>
      <label className="block">
        <span className="etiquette">Nom</span>
        <input name="nom" required maxLength={120} className="champ" placeholder="Bistro Le Saint-Laurent" />
      </label>
      <label className="block">
        <span className="etiquette">Langue par défaut</span>
        <select name="langue_defaut" defaultValue="fr" className="champ">
          {LANGUES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.drapeau} {l.nom}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-[var(--color-encre-doux)]">Au Québec : le français, toujours affiché en premier.</span>
      </label>
      <fieldset>
        <legend className="etiquette">Langues offertes aux clients</legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {LANGUES.map((l) => (
            <label key={l.code} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-ligne)] px-2.5 py-2 text-sm has-[:checked]:border-[var(--color-accent)]">
              <input type="checkbox" name="langues" value={l.code} defaultChecked={l.code === 'fr' || l.code === 'en'} />
              <span aria-hidden>{l.drapeau}</span> {l.nom}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end">
        <BoutonEnvoi attente="Création…">Créer l’établissement</BoutonEnvoi>
      </div>
    </form>
  )
}

export default async function Services() {
  await exigerProprietaire()
  const [liste, ensemble] = await Promise.all([listerEtablissements(), apercuEnsemble()])

  const payants = liste.filter((e) => e.actif && e.formule === 'actif')
  const revenu = payants.reduce((s, e) => s + (e.prix_mensuel ?? 0), 0)
  const essais = liste.filter((e) => e.actif && e.formule === 'essai')
  const potentiel = essais.reduce((s, e) => s + (e.prix_mensuel ?? 0), 0)
  const finissent = essais.filter((e) => {
    const j = joursEssai(e)
    return j !== null && j <= 7
  })
  const notes = liste.map((e) => e.note).filter((n): n is number => n !== null)
  const enAttente = Object.values(ensemble.ouvertes).reduce((s, n) => s + n, 0)
  const visites = liste.reduce((s, e) => s + e.ouvertures_7j, 0)
  const demandes = liste.reduce((s, e) => s + e.demandes_7j, 0)
  const total14 = Array.from({ length: 14 }, (_, i) => Object.values(ensemble.tendances).reduce((s, t) => s + (t[i] ?? 0), 0))
  const aujourdhui = new Date().toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Toronto' })

  const actions = (
    <div className="flex flex-wrap gap-2">
      <BoutonFenetre titre="Créer une démo" libelle="✦ Créer une démo" className="bouton bouton-secondaire">
        <FormulaireDemo />
      </BoutonFenetre>
      <BoutonFenetre titre="Nouvel établissement" libelle="+ Nouvel établissement" largeur="max-w-xl">
        <FormulaireNouveau />
      </BoutonFenetre>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Le relevé : comme le haut d'un compte de banque privée. */}
      <section className="fond-maillage reflet-premium overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#1c1611] p-6 text-[#f8f3ea] shadow-[0_40px_80px_-40px_rgb(28_22_17/0.9)] sm:p-8">
        <div className="relative z-[2]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e4a53a]">
              <span aria-hidden>🔒</span> Privé · propriétaire du logiciel
            </span>
            <span className="text-xs capitalize text-white/50">{aujourdhui}</span>
          </div>
          <h1 className="mt-5 text-white">Tapora Services</h1>
          <div className="mt-6 grid items-end gap-6 lg:grid-cols-[1fr_22rem]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Revenu mensuel récurrent</p>
              <p className="mt-2 text-5xl font-semibold tracking-tight sm:text-6xl" style={{ fontFamily: 'var(--police-fraunces), ui-serif, Georgia, serif' }}>
                <Chiffre valeur={revenu} genre="argent" />
              </p>
              <p className="mt-2 text-sm text-white/60">
                {payants.length} abonnement{payants.length > 1 ? 's' : ''} actif{payants.length > 1 ? 's' : ''} · {argent(revenu * 12)} par an
                {essais.length > 0 && (
                  <>
                    {' '}
                    · <span className="text-[#e4a53a]">+{argent(potentiel)}</span> en essai
                  </>
                )}
              </p>
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between text-[11px] uppercase tracking-[0.16em] text-white/45">
                <span>Visites · 14 jours</span>
                <span className="tabular-nums text-white/70">{total14.reduce((s, n) => s + n, 0).toLocaleString('fr-CA')}</span>
              </div>
              <Apparition>
                <Courbe serie={total14} libelle={`Visites des 14 derniers jours, tous établissements : ${total14.join(', ')}`} />
              </Apparition>
            </div>
          </div>
          <dl className="cascade mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3 lg:grid-cols-5">
            {(
              [
                ['Établissements en ligne', <Chiffre key="a" valeur={liste.filter((e) => e.actif && e.formule !== 'suspendu').length} />, `sur ${liste.length}`],
                ['Essais en cours', <Chiffre key="b" valeur={essais.length} />, finissent.length ? `${finissent.length} finissent dans 7 j` : 'aucun ne finit cette semaine'],
                ['Visites · 7 jours', <Chiffre key="c" valeur={visites} />, 'pages ouvertes'],
                ['Demandes · 7 jours', <Chiffre key="d" valeur={demandes} />, enAttente ? `${enAttente} en attente maintenant` : 'aucune en attente'],
                ['Note moyenne · 90 j', <Chiffre key="e" valeur={notes.length ? notes.reduce((s, n) => s + n, 0) / notes.length : null} genre="note" />, `${notes.length} établissement${notes.length > 1 ? 's' : ''} noté${notes.length > 1 ? 's' : ''}`],
              ] as const
            ).map(([libelle, valeur, sous]) => (
              <div key={libelle} className="bg-[#1c1611]/80 px-4 py-3.5">
                <dt className="text-[11px] text-white/50">{libelle}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight">{valeur}</dd>
                <dd className={`mt-0.5 text-[11px] ${libelle.startsWith('Demandes') && enAttente ? 'text-[#ffd27a]' : 'text-white/40'}`}>{sous}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6">{actions}</div>
        </div>
      </section>

      {liste.length === 0 ? (
        <div className="carte grid place-items-center gap-3 px-6 py-14 text-center">
          <span className="text-4xl" aria-hidden>
            ✨
          </span>
          <h2 className="text-base font-semibold">Aucun établissement pour l’instant</h2>
          <p className="max-w-md text-sm text-[var(--color-encre-doux)]">
            Créez une démo pour voir le produit fini en dix secondes — menu traduit, demandes, concierge et un mois de statistiques — ou partez de zéro
            avec un vrai client.
          </p>
          {actions}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Vos établissements</h2>
            <span className="text-xs text-[var(--color-encre-doux)]">{liste.length} au total</span>
          </div>
          <div className="cascade grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {liste.map((e) => {
              const attente = ensemble.ouvertes[e.id] ?? 0
              const logo = urlFichier(e.logo)
              const serie = ensemble.tendances[e.id] ?? Array(14).fill(0)
              const max = Math.max(1, ...serie)
              return (
                <Inclinaison key={e.id} className={`rounded-[1.4rem] ${e.actif ? '' : 'grayscale'}`}>
                  <Link
                    href={`/services/${e.id}`}
                    className="reflet-premium relative flex aspect-[1.586/1] min-h-[13.5rem] flex-col justify-between overflow-hidden rounded-[1.4rem] p-5 text-white shadow-[0_24px_50px_-26px_rgb(28_22_17/0.85)] [text-shadow:0_1px_2px_rgb(0_0_0/0.25)]"
                    style={{ background: `radial-gradient(120% 90% at 0% 0%, ${e.couleur}, ${assombrir(e.couleur, 0.45)} 55%, ${assombrir(e.couleur, 0.82)})` }}
                  >
                    <div className="relative z-[2] flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/15 text-lg backdrop-blur" aria-hidden>
                          {logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logo} alt="" className="size-full object-cover" />
                          ) : (
                            ICONE_TYPE[e.type]
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold leading-tight">{e.nom}</p>
                          <p className="truncate text-[11px] uppercase tracking-[0.14em] text-white/60">
                            {NOM_TYPE[e.type]} · {e.langues.map((l) => l.toUpperCase()).join(' ')}
                          </p>
                        </div>
                      </div>
                      <Formule e={e} />
                    </div>

                    <div className="relative z-[2] flex items-center gap-3">
                      {/* La « puce » de la carte. */}
                      <span aria-hidden className="relative h-7 w-9 overflow-hidden rounded-md bg-gradient-to-br from-[#f7e0a3] via-[#d9b25f] to-[#a77f2e] shadow-inner">
                        <span className="absolute inset-x-0 top-1/3 h-px bg-black/25" />
                        <span className="absolute inset-x-0 top-2/3 h-px bg-black/25" />
                        <span className="absolute inset-y-0 left-1/2 w-px bg-black/25" />
                      </span>
                      <span aria-hidden className="text-sm text-white/60">
                        )))
                      </span>
                      <span className="ml-auto flex h-7 items-end gap-[3px]" aria-label={`Visites des 14 derniers jours : ${serie.join(', ')}`}>
                        {serie.map((v, i) => (
                          <span key={i} className="w-[5px] rounded-full bg-white/70" style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: 0.35 + (i / serie.length) * 0.65 }} />
                        ))}
                      </span>
                    </div>

                    <div className="relative z-[2]">
                      <p className="font-mono text-[11px] tracking-[0.28em] text-white/55">VISITES · 7 J</p>
                      <div className="flex items-end justify-between gap-3">
                        <p className="font-mono text-2xl font-semibold tracking-[0.08em]">
                          <Chiffre valeur={e.ouvertures_7j} />
                        </p>
                        <dl className="flex gap-4 text-right text-[11px]">
                          <div>
                            <dt className="text-white/55">Demandes</dt>
                            <dd className="text-sm font-semibold tabular-nums">{e.demandes_7j.toLocaleString('fr-CA')}</dd>
                          </div>
                          <div>
                            <dt className="text-white/55">Note</dt>
                            <dd className="text-sm font-semibold tabular-nums">{e.note !== null ? `${e.note.toLocaleString('fr-CA')} ★` : '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-white/55">{e.type === 'hotel' ? 'Chambres' : 'Places'}</dt>
                            <dd className="text-sm font-semibold tabular-nums">{e.emplacements}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    {attente > 0 && (
                      <span className="absolute right-5 top-14 z-[2] inline-flex items-center gap-1.5 rounded-full bg-[#ffd27a] px-2 py-0.5 text-[11px] font-bold text-[#2a1a00] [text-shadow:none]">
                        <span className="size-1.5 animate-pulse rounded-full bg-[#b54708]" /> {attente} en attente
                      </span>
                    )}
                  </Link>
                </Inclinaison>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
