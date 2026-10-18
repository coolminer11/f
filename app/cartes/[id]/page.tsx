import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import QRCode from 'qrcode'
import { exigerEcriture, exigerSession } from '@/lib/auth'
import { basculerCarte, carte, derniersTaps, modifierCarte, supprimerCarte, totaux } from '@/lib/requetes/cartes'
import { nomsDossiers } from '@/lib/requetes/dossiers'
import { placesConfigure } from '@/lib/avis-google'
import { preparerCarte, premierReleve } from '@/lib/saisie-carte'
import SectionAvis from '@/components/section-avis'
import { cleAvis, suiviPour } from '@/lib/avis-manuels'
import { LigneSuivi } from '@/components/suivi-avis'
import { baseCartesAffichee, baseCartesConfiguree, urlPuce, urlQr } from '@/lib/cartes-url'
import StatsTaps from '@/components/stats-taps'
import SelecteurJours, { joursDepuis } from '@/components/selecteur-jours'
import ChampsCarte, { SaisieCarte } from '@/components/champs-carte'
import BoutonCopier from '@/components/bouton-copier'
import BoutonSupprimer from '@/components/bouton-supprimer'
import { Evolution, Tuile, depuis, nombreFr } from '@/components/tuiles-cartes'

export const dynamic = 'force-dynamic'

export default async function FicheCarte({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ p?: string; erreur?: string; message?: string; nouvelle?: string }>
}) {
  const moi = await exigerSession()
  const { id } = await params
  const p = await searchParams
  const jours = joursDepuis(p.p)
  const c = await carte(id)
  if (!c) notFound()

  const [t, derniers, dossiers, base, suivi] = await Promise.all([
    totaux({ carte: c.id }, jours),
    derniersTaps(c.id, 12),
    nomsDossiers(),
    baseCartesAffichee(),
    // Une carte d'un dossier suit les avis du dossier ; seule une carte isolée a les siens.
    c.dossier_id ? Promise.resolve(null) : suiviPour({ type: 'carte', id: c.id }),
  ])
  const adressePuce = urlPuce(base, c.code)
  const adresseQr = urlQr(base, c.code)
  const qrSvg = await QRCode.toString(adresseQr, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
  const configuree = Boolean(baseCartesConfiguree())
  const peutEcrire = moi.role !== 'lecture'
  const partQr = t.courant ? Math.round((t.qr / t.courant) * 100) : 0
  const moyenneJour = t.courant / jours

  async function enregistrer(donnees: FormData) {
    'use server'
    await exigerEcriture()
    const analyse = SaisieCarte.safeParse(Object.fromEntries(donnees))
    if (!analyse.success) {
      redirect(`/cartes/${id}?erreur=${encodeURIComponent(analyse.error.issues[0].message)}`)
    }
    const saisie = await preparerCarte(analyse.data)
    await modifierCarte(id, saisie)
    await premierReleve(saisie.placeId)
    revalidatePath(`/cartes/${id}`)
    redirect(`/cartes/${id}?message=${encodeURIComponent('Carte mise à jour. La nouvelle destination s’applique dès le prochain tap.')}`)
  }

  async function basculer() {
    'use server'
    await exigerEcriture()
    await basculerCarte(id, !c!.actif)
    revalidatePath(`/cartes/${id}`)
  }

  async function supprimer() {
    'use server'
    await exigerEcriture()
    await supprimerCarte(id)
    revalidatePath('/cartes')
    redirect('/cartes')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/cartes" className="text-sm text-[var(--color-encre-doux)] hover:underline">
            ← Cartes NFC
          </Link>
          <h1 className="mt-1 text-lg font-bold tracking-tight">
            {c.libelle}{' '}
            <span className={`ml-1 rounded px-1.5 py-0.5 align-middle text-xs font-semibold ${c.actif ? 'bg-green-50 text-[var(--color-positif)]' : 'bg-[var(--color-fond)] text-[var(--color-encre-doux)]'}`}>
              {c.actif ? '● Active' : '○ Désactivée'}
            </span>
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
            {c.dossier_id ? (
              <Link href={`/cartes/dossiers/${c.dossier_id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                {c.dossier_nom}
              </Link>
            ) : (
              'Sans dossier'
            )}{' '}
            · code <span className="chiffre font-semibold text-[var(--color-encre)]">{c.code}</span> ·
            créée {depuis(c.cree_le)}
          </p>
        </div>
        {peutEcrire && (
          <form action={basculer}>
            <button className="bouton bouton-secondaire">{c.actif ? 'Désactiver' : 'Réactiver'}</button>
          </form>
        )}
      </div>

      {p.erreur && (
        <p className="carte border-[var(--color-negatif)] bg-red-50 px-4 py-3 text-sm font-medium text-[var(--color-negatif)]">{p.erreur}</p>
      )}
      {p.message && (
        <p className="carte border-[var(--color-positif)] bg-green-50 px-4 py-3 text-sm font-medium text-[var(--color-positif)]">{p.message}</p>
      )}
      {!c.actif && (
        <p className="carte bg-[var(--color-fond)] px-4 py-3 text-sm text-[var(--color-encre-doux)]">
          Désactivée : un tap affiche « Carte pas encore activée » au lieu de rediriger, et rien n’est compté.
        </p>
      )}

      <section className="carte grid gap-5 p-5 md:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">À écrire sur la puce</h2>
            <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
              Dans l’app de programmation NFC (NFC Tools, par exemple) : « Écrire » → « URL » → coller.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="chiffre min-w-0 flex-1 truncate rounded-md border border-[var(--color-ligne)] bg-[var(--color-fond)] px-3 py-2 text-sm">
                {adressePuce}
              </code>
              <BoutonCopier texte={adressePuce} />
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Destination actuelle</h2>
            <a href={c.destination} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-[var(--color-accent)] hover:underline">
              {c.destination}
            </a>
          </div>
          {!configuree && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <strong>N’écrivez pas encore cette adresse sur une puce</strong> : c’est celle de l’hébergeur
              du moment. Configurez <code>URL_CARTES</code> (ex. <code>https://go.taporacards.com</code>) d’abord.
            </p>
          )}
        </div>
        <div className="text-center">
          <div
            className="mx-auto size-36 rounded-lg border border-[var(--color-ligne)] bg-white p-1.5 [&_svg]:size-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
            role="img"
            aria-label={`Code QR menant à ${adresseQr}`}
          />
          <div className="mt-2 flex justify-center gap-2 text-xs">
            <a href={`/cartes/${c.id}/qr?format=svg`} className="font-semibold text-[var(--color-accent)] hover:underline">
              SVG
            </a>
            <span className="text-[var(--color-encre-doux)]">·</span>
            <a href={`/cartes/${c.id}/qr?format=png`} className="font-semibold text-[var(--color-accent)] hover:underline">
              PNG
            </a>
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-encre-doux)]">QR à imprimer sur la carte</p>
        </div>
      </section>

      <SelecteurJours chemin={`/cartes/${c.id}`} jours={jours} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="carte p-4">
          <div className="text-xs font-medium text-[var(--color-encre-doux)]">Taps, {jours} derniers jours</div>
          <div className="mt-1 text-5xl font-semibold tracking-tight" style={{ fontVariantNumeric: 'proportional-nums' }}>
            {nombreFr.format(t.courant)}
          </div>
          <div className="mt-1.5">
            <Evolution courant={t.courant} precedent={t.precedent} libelle={`vs ${jours} j précédents`} />
          </div>
        </div>
        <Tuile
          libelle="Moyenne par jour"
          valeur={moyenneJour.toLocaleString('fr-CA', { maximumFractionDigits: 1 })}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">sur {jours} jours</span>}
        />
        <Tuile
          libelle="Depuis la pose"
          valeur={nombreFr.format(c.taps_total)}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">taps au total</span>}
        />
        <Tuile
          libelle="Dernier tap"
          valeur={depuis(c.dernier_tap)}
          sous={<span className="text-xs text-[var(--color-encre-doux)]">{partQr} % par code QR sur la période</span>}
        />
      </div>

      {peutEcrire && suivi && (
        <section id="avis" className="carte scroll-mt-4 px-5 py-2">
          <h2 className="pt-2 text-sm font-semibold">Avis Google</h2>
          <LigneSuivi s={suivi} retour={`/cartes/${c.id}`} avecNom={false} />
        </section>
      )}

      <SectionAvis
        placeIds={[
          ...(c.place_id ? [c.place_id] : []),
          cleAvis(c.dossier_id ? { type: 'dossier', id: c.dossier_id } : { type: 'carte', id: c.id }),
        ]}
        jours={jours}
        tapsPeriode={t.courant}
      />

      <StatsTaps portee={{ carte: c.id }} jours={jours} totaux={t} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="carte p-5">
          <h2 className="text-sm font-semibold">Derniers taps</h2>
          {derniers.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-encre-doux)]">
              Aucun tap encore. Approchez un téléphone de la carte pour tester : il apparaîtra ici.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--color-ligne)] text-sm">
              {derniers.map((d, i) => (
                <li key={i} className="flex items-center justify-between py-1.5">
                  <span className="text-[var(--color-encre-doux)]">
                    {new Date(d.tape_le).toLocaleString('fr-CA', {
                      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      timeZone: 'America/Toronto',
                    })}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded border border-[var(--color-ligne)] px-1.5 py-0.5 text-xs">
                      {d.canal === 'qr' ? 'Code QR' : 'Puce NFC'}
                    </span>
                    <span className="w-16 text-right text-xs text-[var(--color-encre-doux)]">
                      {d.appareil === 'ios' ? 'iPhone' : d.appareil === 'android' ? 'Android' : 'Autre'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {peutEcrire && (
          <section className="carte p-5">
            <h2 className="text-sm font-semibold">Modifier</h2>
            <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
              Changer la destination ne demande pas de toucher à la carte : le prochain tap ira à la nouvelle adresse.
            </p>
            <form action={enregistrer} className="mt-3 space-y-4">
              <ChampsCarte
                dossiers={dossiers}
                googleConfigure={placesConfigure()}
                valeurs={{
                  libelle: c.libelle,
                  dossier_id: c.dossier_id,
                  destination: c.destination,
                  note: c.note,
                  place_id: c.place_id,
                  fiche_nom: c.fiche_nom,
                }}
              />
              <button className="bouton">Enregistrer</button>
            </form>
          </section>
        )}
      </div>

      {peutEcrire && (
        <details className="carte border-[var(--color-negatif)] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--color-negatif)]">Supprimer cette carte</summary>
          <p className="mt-2 text-sm text-[var(--color-encre-doux)]">
            Les statistiques partent avec elle. Le code {c.code} ne sera jamais réattribué : une carte
            oubliée dans un tiroir ne mènera jamais chez quelqu’un d’autre. Pour l’arrêter sans perdre
            l’historique, désactivez-la plutôt.
          </p>
          <form action={supprimer} className="mt-3">
            <BoutonSupprimer quoi={`la carte ${c.code}`} avertissement="Ses statistiques seront perdues." />
          </form>
        </details>
      )}
    </div>
  )
}
