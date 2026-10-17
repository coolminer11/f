import { BarreRepartition, GraphiqueColonnes, type Barre } from '@/components/graphiques'
import { tapsParHeure, tapsParJour, tapsParJourSemaine, type Totaux } from '@/lib/requetes/cartes'

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
  carteId,
  jours,
  totaux,
}: {
  carteId: string | null
  jours: number
  totaux: Totaux
}) {
  const [parJour, parHeure, parJourSemaine] = await Promise.all([
    tapsParJour(carteId, jours),
    tapsParHeure(carteId, jours),
    tapsParJourSemaine(carteId, jours),
  ])

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

      <div className="grid gap-4 lg:grid-cols-2">
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

      <div className="grid gap-4 lg:grid-cols-2">
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
    </div>
  )
}
