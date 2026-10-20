import { approuverMaquetteAction } from '@/app/stats/[jeton]/actions'
import { ETAPES_CLIENT, ORDRE_ETAPES, type CommandeClient } from '@/lib/portail'
import { locale, type Langue } from '@/lib/langue'

const T = {
  fr: {
    surtitre: 'Vos commandes',
    titre: 'Où en sont vos cartes',
    cartes: (q: number) => `${q} cartes`,
    maquettePrete: 'Votre maquette est prête',
    maquetteSous: 'Regardez-la tranquillement. Un clic l’approuve et lance la fabrication ; sinon, dites-nous ce que vous aimeriez changer.',
    voir: 'Voir la maquette',
    approuver: 'J’approuve la maquette',
    changer: 'Demander un changement',
    approuvee: (d: string) => `Maquette approuvée le ${d} — merci !`,
    merci: 'Merci ! Votre approbation est notée : la fabrication est lancée.',
    delai: 'Fabrication sur mesure : un peu plus longue qu’une carte standard. Nous vous écrivons dès qu’elles arrivent.',
    fait: (d: string) => `le ${d}`,
  },
  en: {
    surtitre: 'Your orders',
    titre: 'Where your cards are at',
    cartes: (q: number) => `${q} cards`,
    maquettePrete: 'Your design is ready',
    maquetteSous: 'Take your time. One click approves it and starts production; otherwise, tell us what you would like to change.',
    voir: 'See the design',
    approuver: 'I approve the design',
    changer: 'Ask for a change',
    approuvee: (d: string) => `Design approved on ${d} — thank you!`,
    merci: 'Thank you! Your approval is recorded: production is on its way.',
    delai: 'Custom production takes a little longer than a standard card. We’ll write as soon as they arrive.',
    fait: (d: string) => `on ${d}`,
  },
}

/**
 * Les commandes en cours du client, sur sa page : l'étape où elles en sont
 * (en mots de client), et — quand la maquette est jointe — de quoi la voir
 * et l'approuver en un clic. L'approbation fait avancer la commande toute
 * seule dans le back-office.
 */
export default function CommandesClient({
  commandes,
  jeton,
  langue,
  merci,
  suffixeL,
}: {
  commandes: CommandeClient[]
  jeton: string
  langue: Langue
  merci: boolean
  suffixeL: string
}) {
  const enCours = commandes.filter((c) => c.etape !== 'facturee')
  if (!enCours.length) return null
  const X = T[langue]
  const jour = (iso: string) => new Date(iso).toLocaleDateString(locale(langue), { day: 'numeric', month: 'long', timeZone: 'America/Toronto' })

  return (
    <section className="carte p-6 sm:p-8" id="commandes">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c2552f]">{X.surtitre}</span>
      <h2 className="titre-client mt-2 !text-2xl sm:!text-3xl">{X.titre}</h2>
      {merci && <p className="mt-4 rounded-2xl bg-[#e3efe7] px-5 py-3 text-sm font-medium text-[#2f6b4f]">{X.merci}</p>}
      <div className="mt-6 space-y-8">
        {enCours.map((c) => {
          const rang = ORDRE_ETAPES.indexOf(c.etape)
          const aApprouver = c.maquette && !c.maquette_approuvee_le && rang <= ORDRE_ETAPES.indexOf('maquette')
          return (
            <article key={c.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">
                  {c.produit_nom} · {X.cartes(c.quantite)}
                </h3>
                <span className="text-xs text-[#6b5d50]">{c.numero}</span>
              </div>
              {/* La frise : une pastille par étape, la courante en terre cuite. */}
              <ol className="mt-4 grid grid-cols-7 gap-1.5" aria-label={X.surtitre}>
                {ORDRE_ETAPES.map((e, i) => (
                  <li key={e} className="min-w-0">
                    <span className={`block h-2 rounded-full ${i < rang ? 'bg-[#2a211a]' : i === rang ? 'bg-[#c2552f]' : 'bg-[#ede3d3]'}`} />
                    <span className={`mt-1.5 hidden text-[11px] leading-tight sm:block ${i === rang ? 'font-semibold text-[#2a211a]' : 'text-[#6b5d50]'}`}>{ETAPES_CLIENT[e][langue]}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-sm">
                <strong>{ETAPES_CLIENT[c.etape][langue]}</strong>
                {c.etapes[c.etape] && <span className="text-[#6b5d50]"> · {X.fait(jour(c.etapes[c.etape]))}</span>}
              </p>

              {aApprouver ? (
                <div className="mt-4 rounded-2xl bg-[#fdf3dc] p-5">
                  <p className="font-semibold text-[#5a3b05]">✨ {X.maquettePrete}</p>
                  <p className="mt-1 text-sm text-[#6b4a05]">{X.maquetteSous}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <a
                      href={`/stats/${jeton}/maquette/${c.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-[#fffaf2] px-5 py-2.5 text-sm font-semibold text-[#2a211a] ring-1 ring-[#e2d6c3] transition hover:ring-[#c2552f]"
                    >
                      {X.voir} ↗
                    </a>
                    <form action={approuverMaquetteAction}>
                      <input type="hidden" name="jeton" value={jeton} />
                      <input type="hidden" name="commande" value={c.id} />
                      <input type="hidden" name="l" value={suffixeL ? langue : ''} />
                      <button className="rounded-full bg-[#2f6b4f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245840]">✓ {X.approuver}</button>
                    </form>
                    <a href={`/stats/${jeton}?sujet=design${suffixeL}#messages`} className="px-2 text-sm font-semibold text-[#c2552f] hover:underline">
                      {X.changer}
                    </a>
                  </div>
                </div>
              ) : (
                c.maquette_approuvee_le && <p className="mt-2 text-sm text-[#2f6b4f]">✓ {X.approuvee(jour(c.maquette_approuvee_le))}</p>
              )}
              {rang >= ORDRE_ETAPES.indexOf('approuvee') && rang < ORDRE_ETAPES.indexOf('recue') && <p className="mt-2 text-sm text-[#6b5d50]">{X.delai}</p>}
            </article>
          )
        })}
      </div>
    </section>
  )
}
