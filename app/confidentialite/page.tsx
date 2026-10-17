import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Confidentialité — Tapora S.E.N.C.',
}

/**
 * Règles de confidentialité, publiques.
 *
 * Google exige une adresse publique de ce genre avant de laisser publier
 * l'application qui envoie les courriels depuis le compte Gmail de la
 * société — sans publication, l'autorisation expire tous les sept jours.
 * Le texte dit exactement ce que fait le code, ni plus ni moins.
 */
export default function Confidentialite() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-lg font-bold tracking-tight">Règles de confidentialité</h1>
      <p className="text-[var(--color-encre-doux)]">
        Tapora S.E.N.C. — NEQ 3382462367 — Québec, Canada
      </p>

      <h2 className="pt-2 font-semibold">De quoi il s’agit</h2>
      <p>
        « Tapora back-office » est l’outil de gestion interne de Tapora S.E.N.C. : comptabilité,
        facturation et reçus de vente. Il est réservé aux associés de la société et n’est pas
        offert au public.
      </p>

      <h2 className="pt-2 font-semibold">Accès au compte Gmail</h2>
      <p>
        L’application demande une seule permission Google : <strong>envoyer des courriels</strong>{' '}
        (<code>gmail.send</code>) depuis le compte de la société, pour transmettre aux clients
        leurs reçus et factures en PDF. Elle ne lit pas la boîte de réception, ne consulte aucun
        message, ne supprime rien et n’accède pas aux contacts.
      </p>

      <h2 className="pt-2 font-semibold">Renseignements sur les clients</h2>
      <p>
        Le nom, l’adresse et le courriel d’un client ne servent qu’à établir et transmettre ses
        documents de vente, et à tenir les registres comptables que la loi impose. Ils ne sont ni
        vendus, ni partagés, ni utilisés à des fins publicitaires. Ils sont hébergés au Canada
        (Supabase, région ca-central-1) et conservés le temps exigé par les lois fiscales.
      </p>

      <h2 className="pt-2 font-semibold">Vos droits</h2>
      <p>
        Pour consulter, corriger ou faire retirer les renseignements qui vous concernent, dans la
        limite des obligations fiscales de conservation, écrivez à{' '}
        <a href="mailto:taporasenc@gmail.com" className="underline">
          taporasenc@gmail.com
        </a>
        .
      </p>
    </article>
  )
}
