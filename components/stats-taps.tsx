import { BarreRepartition, CarteChaleur, GraphiqueColonnes, GraphiqueLignes, type Barre } from '@/components/graphiques'
import {
  cumulDepuisPose,
  tapsJourHeure,
  tapsParHeure,
  tapsParJour,
  tapsParJourSemaine,
  type Portee,
  type Totaux,
} from '@/lib/requetes/cartes'

const nombre = (n: number) => new Intl.NumberFormat('fr-CA').format(n)

function dateCourte(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j)).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

function dateLongue(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j)).toLocaleDateString('fr-CA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

/**
 * Les graphiques communs au tableau de bord et à la fiche d'une carte. La
 * période choisie en haut de page s'applique à tout ce qui est ici.
 */
export default async function StatsTaps({
  portee,
  jours,
  totaux,
  avecCumul = true,
}: {
  portee: Portee
  jours: number
  totaux: Totaux
  avecCumul?: boolean
}) {
  const [parJour, parHeure, parJourSemaine, grille, cumul] = await Promise.all([
    tapsParJour(portee, jours),
    tapsParHeure(portee, jours),
    tapsParJourSemaine(portee, jours),
    tapsJourHeure(portee, jours),
    avecCumul ? cumulDepuisPose(portee) : Promise.resolve([]),
  ])
  const caseForte = grille.reduce((a, b) => (b.taps > a.taps ? b : a), grille[0])

  const barresJour: Barre[] = parJour.map((p) => ({
    etiquette: String(Number(p.jour.slice(8, 10))),
    detail: dateLongue(p.jour),
    valeur: p.taps,
  }))
  const barresHeure: Barre[] = parHeure.map((h) => ({
    etiquette: `${h.cle} h`,
    detail: `de ${h.cle} h à ${(h.cle + 1) % 24} h`,
    valeur: h.taps,
  }))
  const barresSemaine: Barre[] = parJourSemaine.map((d) => ({
    etiquette: JOURS[d.cle - 1].slice(0, 3) + '.',
    detail: JOURS[d.cle - 1],
    valeur: d.taps,
  }))

  const heureForte = parHeure.reduce((a, b) => (b.taps > a.taps ? b : a), parHeure[0])
  const jourFort = parJourSemaine.reduce((a, b) => (b.taps > a.taps ? b : a), parJourSemaine[0])

  return (
    <div className="space-y-4">
      <section className="carte p-5">
        <h2 className="text-sm font-semibold">Taps par jour</h2>
        <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">{jours} derniers jours, heure du Québec</p>
        <div className="mt-4">
          <GraphiqueColonnes
            barres={barresJour}
            pasEtiquettes={jours > 31 ? 15 : jours > 7 ? 5 : 1}
            resume={`Taps par jour sur ${jours} jours, ${totaux.courant} au total.`}
          />
        </div>
      </section>

      <section className="carte p-5">
        <h2 className="text-sm font-semibold">Quand les clients tapent</h2>
        <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
          {totaux.courant > 0 && caseForte.taps > 0
            ? `Moment le plus fort : le ${JOURS[caseForte.jour - 1]} entre ${caseForte.heure} h et ${(caseForte.heure + 1) % 24} h`
            : 'Jour × heure, sur la période — pas encore assez de taps pour dégager une tendance'}
        </p>
        <div className="mt-4">
          <CarteChaleur cases={grille} resume={`Taps par jour de la semaine et par heure, sur ${jours} jours.`} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="carte p-5">
          <h2 className="text-sm font-semibold">Heures d’affluence</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
            {totaux.courant > 0 && heureForte.taps > 0
              ? `Pointe entre ${heureForte.cle} h et ${(heureForte.cle + 1) % 24} h`
              : 'Pas encore assez de taps pour dégager une tendance'}
          </p>
          <div className="mt-4">
            <GraphiqueColonnes
              barres={barresHeure}
              pasEtiquettes={4}
              hauteur={120}
              resume="Répartition des taps selon l’heure de la journée."
            />
          </div>
        </section>

        <section className="carte p-5">
          <h2 className="text-sm font-semibold">Jours de la semaine</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
            {totaux.courant > 0 && jourFort.taps > 0
              ? `Le ${JOURS[jourFort.cle - 1]} est le jour le plus actif`
              : 'Pas encore assez de taps pour dégager une tendance'}
          </p>
          <div className="mt-4">
            <GraphiqueColonnes
              barres={barresSemaine}
              hauteur={120}
              resume="Répartition des taps selon le jour de la semaine."
            />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="carte p-5">
          <h2 className="text-sm font-semibold">Puce ou code QR</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
            Le QR rattrape les téléphones dont le NFC est éteint ou absent.
          </p>
          <div className="mt-4">
            <BarreRepartition
              resume={`${totaux.nfc} taps par la puce, ${totaux.qr} par le code QR.`}
              segments={[
                { nom: 'Puce NFC', valeur: totaux.nfc, serie: 1 },
                { nom: 'Code QR', valeur: totaux.qr, serie: 2 },
              ]}
            />
          </div>
        </section>

        <section className="carte p-5">
          <h2 className="text-sm font-semibold">Téléphones</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">Type d’appareil, sans rien qui identifie la personne.</p>
          <div className="mt-4">
            <BarreRepartition
              resume={`${totaux.ios} iPhone, ${totaux.android} Android, ${totaux.autre} autres.`}
              segments={[
                { nom: 'iPhone', valeur: totaux.ios, serie: 1 },
                { nom: 'Android', valeur: totaux.android, serie: 2 },
                { nom: 'Autre', valeur: totaux.autre, serie: 'attenuee' },
              ]}
            />
          </div>
        </section>
      </div>

      {avecCumul && cumul.length > 1 && (
        <section className="carte p-5">
          <h2 className="text-sm font-semibold">Taps cumulés depuis la pose</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
            {nombre(cumul[cumul.length - 1].cumul)} taps depuis le {dateLongue(cumul[0].jour)}
          </p>
          <div className="mt-4">
            <GraphiqueLignes
              series={[{ nom: 'Taps cumulés', slot: 1, valeurs: cumul.map((c) => c.cumul) }]}
              etiquettes={cumul.map((c) => dateCourte(c.jour))}
              details={cumul.map((c) => dateLongue(c.jour))}
              resume={`Taps cumulés depuis la pose : ${cumul[cumul.length - 1].cumul} au total.`}
            />
          </div>
        </section>
      )}
    </div>
  )
}
