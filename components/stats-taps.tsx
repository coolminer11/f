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

import { JOURS, dateCourte, dateLongue, heure, locale, plage, textes, type Langue } from '@/lib/langue'

/**
 * Les graphiques communs au tableau de bord et à la fiche d'une carte. La
 * période choisie en haut de page s'applique à tout ce qui est ici.
 */
export default async function StatsTaps({
  portee,
  jours,
  totaux,
  avecCumul = true,
  langue = 'fr',
}: {
  portee: Portee
  jours: number
  totaux: Totaux
  avecCumul?: boolean
  /** La page client peut s'afficher en anglais ; le back-office reste en français. */
  langue?: Langue
}) {
  const T = textes(langue)
  const J = JOURS[langue]
  const nombre = (n: number) => new Intl.NumberFormat(locale(langue)).format(n)
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
    detail: dateLongue(p.jour, langue),
    valeur: p.taps,
  }))
  const barresHeure: Barre[] = parHeure.map((h) => ({
    etiquette: heure(h.cle, langue),
    detail: plage(h.cle, langue),
    valeur: h.taps,
  }))
  const barresSemaine: Barre[] = parJourSemaine.map((d) => ({
    etiquette: J[d.cle - 1].slice(0, 3) + (langue === 'fr' ? '.' : ''),
    detail: J[d.cle - 1],
    valeur: d.taps,
  }))

  const heureForte = parHeure.reduce((a, b) => (b.taps > a.taps ? b : a), parHeure[0])
  const jourFort = parJourSemaine.reduce((a, b) => (b.taps > a.taps ? b : a), parJourSemaine[0])

  return (
    <div className="space-y-4">
      <section className="carte p-5">
        <h2 className="text-sm font-semibold">{T.tapsParJour}</h2>
        <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">{T.tapsParJourSous(jours)}</p>
        <div className="mt-4">
          <GraphiqueColonnes
            barres={barresJour}
            pasEtiquettes={jours > 31 ? 15 : jours > 7 ? 5 : 1}
            resume={T.tapsParJourResume(jours, totaux.courant)}
            langue={langue}
          />
        </div>
      </section>

      <section className="carte p-5">
        <h2 className="text-sm font-semibold">{T.quand}</h2>
        <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
          {totaux.courant > 0 && caseForte.taps > 0
            ? T.momentFort(J[caseForte.jour - 1], plage(caseForte.heure, langue))
            : T.pasAssezGrille}
        </p>
        <div className="mt-4">
          <CarteChaleur cases={grille} resume={T.grilleResume(jours)} langue={langue} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="carte p-5">
          <h2 className="text-sm font-semibold">{T.affluence}</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
            {totaux.courant > 0 && heureForte.taps > 0
              ? T.pointe(plage(heureForte.cle, langue))
              : T.pasAssez}
          </p>
          <div className="mt-4">
            <GraphiqueColonnes
              barres={barresHeure}
              pasEtiquettes={4}
              hauteur={120}
              resume={T.heureResume}
              langue={langue}
            />
          </div>
        </section>

        <section className="carte p-5">
          <h2 className="text-sm font-semibold">{T.joursSemaine}</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
            {totaux.courant > 0 && jourFort.taps > 0
              ? T.jourFort(J[jourFort.cle - 1])
              : T.pasAssez}
          </p>
          <div className="mt-4">
            <GraphiqueColonnes
              barres={barresSemaine}
              hauteur={120}
              resume={T.semaineResume}
              langue={langue}
            />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="carte p-5">
          <h2 className="text-sm font-semibold">{T.puceQr}</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">{T.puceQrSous}</p>
          <div className="mt-4">
            <BarreRepartition
              resume={T.puceQrResume(totaux.nfc, totaux.qr)}
              langue={langue}
              segments={[
                { nom: T.puce, valeur: totaux.nfc, serie: 1 },
                { nom: T.qr, valeur: totaux.qr, serie: 2 },
              ]}
            />
          </div>
        </section>

        <section className="carte p-5">
          <h2 className="text-sm font-semibold">{T.telephones}</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">{T.telephonesSous}</p>
          <div className="mt-4">
            <BarreRepartition
              resume={T.telephonesResume(totaux.ios, totaux.android, totaux.autre)}
              langue={langue}
              segments={[
                { nom: 'iPhone', valeur: totaux.ios, serie: 1 },
                { nom: 'Android', valeur: totaux.android, serie: 2 },
                { nom: T.autre, valeur: totaux.autre, serie: 'attenuee' },
              ]}
            />
          </div>
        </section>
      </div>

      {avecCumul && cumul.length > 1 && (
        <section className="carte p-5">
          <h2 className="text-sm font-semibold">{T.cumul}</h2>
          <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">
            {T.cumulSous(nombre(cumul[cumul.length - 1].cumul), dateLongue(cumul[0].jour, langue))}
          </p>
          <div className="mt-4">
            <GraphiqueLignes
              series={[{ nom: T.cumulSerie, slot: 1, valeurs: cumul.map((c) => c.cumul) }]}
              etiquettes={cumul.map((c) => dateCourte(c.jour, langue))}
              details={cumul.map((c) => dateLongue(c.jour, langue))}
              resume={T.cumulResume(cumul[cumul.length - 1].cumul)}
              unite={T.taps}
              langue={langue}
            />
          </div>
        </section>
      )}
    </div>
  )
}
