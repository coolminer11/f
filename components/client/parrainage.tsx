'use client'

import { useActionState, useState } from 'react'
import { recommander, type EtatRecommandation } from '@/app/stats/[jeton]/actions'
import type { Langue } from '@/lib/langue'

const TEXTES = {
  fr: {
    surtitre: 'Parrainage',
    titre: 'Recommandez-nous à un commerçant',
    sous: 'Vous connaissez un commerce qui mériterait plus d’avis ? Donnez-nous son nom : on le contacte en disant que ça vient de vous, sans le harceler.',
    avantages: [
      ['🎁', '10 % pour votre filleul', 'sur sa première commande, de votre part.'],
      ['📣', 'De la visibilité pour vous', 'votre commerce mis en vedette sur taporacards.com et sur notre LinkedIn.'],
      ['🏅', 'Le titre d’Ambassadeur', 'une pastille sur cette page dès que son commerce nous rejoint.'],
    ],
    commerce: 'Nom du commerce',
    commerceEx: 'Boulangerie du Coin',
    contact: 'Personne à contacter',
    contactEx: 'Marie (propriétaire)',
    courriel: 'Courriel',
    telephone: 'Téléphone',
    unDesDeux: 'Un courriel ou un téléphone suffit.',
    message: 'Un mot pour nous (facultatif)',
    messageEx: 'Elle a ouvert en septembre, elle cherche à se faire connaître.',
    partenaire: 'Afficher mon commerce sur la page Partenaires de taporacards.com',
    dejaPartenaire: 'Votre commerce est sur la page Partenaires de taporacards.com',
    site: 'Votre site web (pour le lien)',
    envoyer: 'Envoyer la recommandation',
    envoi: 'Envoi…',
    merci: (c: string) => `Merci ! On contacte ${c} cette semaine.`,
    merciSous: 'Et on lui dit que ça vient de vous. Vous verrez votre pastille d’Ambassadeur ici dès qu’il nous rejoint.',
    encore: 'Recommander un autre commerce',
    bilan: (r: number, c: number) =>
      `Vous nous avez recommandé ${r} commerce${r > 1 ? 's' : ''}${c ? ` · ${c} nous ${c > 1 ? 'ont' : 'a'} rejoints` : ''}. Merci !`,
    ambassadeur: 'Vous êtes Ambassadeur Tapora',
  },
  en: {
    surtitre: 'Referral',
    titre: 'Recommend us to a business owner',
    sous: 'Know a business that deserves more reviews? Give us its name: we reach out saying it comes from you, without being pushy.',
    avantages: [
      ['🎁', '10% off for your referral', 'on their first order, from you.'],
      ['📣', 'Visibility for you', 'your business featured on taporacards.com and on our LinkedIn.'],
      ['🏅', 'The Ambassador title', 'a badge on this page as soon as they join us.'],
    ],
    commerce: 'Business name',
    commerceEx: 'Corner Bakery',
    contact: 'Person to contact',
    contactEx: 'Marie (owner)',
    courriel: 'Email',
    telephone: 'Phone',
    unDesDeux: 'An email or a phone number is enough.',
    message: 'A word for us (optional)',
    messageEx: 'She opened in September and wants to get known.',
    partenaire: 'Show my business on the taporacards.com Partners page',
    dejaPartenaire: 'Your business is on the taporacards.com Partners page',
    site: 'Your website (for the link)',
    envoyer: 'Send the recommendation',
    envoi: 'Sending…',
    merci: (c: string) => `Thank you! We’ll reach out to ${c} this week.`,
    merciSous: 'And we’ll tell them it comes from you. Your Ambassador badge shows up here as soon as they join.',
    encore: 'Recommend another business',
    bilan: (r: number, c: number) => `You recommended ${r} business${r > 1 ? 'es' : ''}${c ? ` · ${c} joined us` : ''}. Thank you!`,
    ambassadeur: 'You are a Tapora Ambassador',
  },
} as const

const champ =
  'mt-1.5 block w-full rounded-2xl border border-[var(--cl-ligne)] bg-[var(--cl-papier)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--cl-gris)] focus:border-[var(--cl-brique)]'

/**
 * « Recommandez-nous » : le parrainage sans carte gratuite. Le filleul a
 * 10 % sur sa première commande ; le parrain, de la visibilité et la
 * pastille d'Ambassadeur.
 */
export default function Parrainage({
  jeton,
  langue,
  partenaire,
  siteWeb,
  ambassadeur,
  bilan,
}: {
  jeton: string
  langue: Langue
  partenaire: boolean
  siteWeb: string | null
  ambassadeur: boolean
  bilan: { recommandes: number; clients: number }
}) {
  const T = TEXTES[langue]
  const [etat, envoyer, enCours] = useActionState<EtatRecommandation, FormData>(recommander, { ok: false, erreur: null })
  const [cle, setCle] = useState(0)
  const [afficher, setAfficher] = useState(true)
  const merci = etat.ok && afficher

  return (
    <section className="carte relative overflow-hidden p-6 sm:p-8" id="parrainage">
      <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 size-64 rounded-full bg-[var(--cl-miel-pale)] opacity-60" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-10 size-56 rounded-full bg-[var(--cl-rose-pale)] opacity-70" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cl-brique)]">{T.surtitre}</span>
          {ambassadeur && (
            <span className="pastille-ambassadeur relative overflow-hidden rounded-full px-3 py-1 text-xs font-semibold text-[var(--cl-miel-texte)]">
              🏅 {T.ambassadeur}
            </span>
          )}
        </div>
        <h2 className="titre-client mt-2 !text-2xl sm:!text-3xl">{T.titre}</h2>
        <p className="mt-2 max-w-2xl text-[var(--cl-doux)]">{T.sous}</p>

        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {T.avantages.map(([emoji, titre, texte]) => (
            <li key={titre} className="rounded-2xl border border-[var(--cl-ligne-douce)] bg-[var(--cl-papier)]/80 p-4" data-tuile>
              <span className="grid size-10 place-items-center rounded-xl bg-[var(--cl-sable)] text-xl" aria-hidden>
                {emoji}
              </span>
              <strong className="titre-client mt-3 block text-lg font-semibold">{titre}</strong>
              <span className="mt-0.5 block text-sm leading-relaxed text-[var(--cl-doux)]">{texte}</span>
            </li>
          ))}
        </ul>

        {bilan.recommandes > 0 && <p className="mt-4 text-sm font-medium text-[var(--cl-sapin)]">{T.bilan(bilan.recommandes, bilan.clients)}</p>}

        {merci ? (
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl bg-[var(--cl-vert-pale)] p-5" role="status">
            <span className="coche-merci grid size-12 shrink-0 place-items-center rounded-full bg-[var(--cl-sapin)] text-xl text-white" aria-hidden>
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <p className="titre-client text-xl font-semibold">{T.merci(etat.commerce ?? '')}</p>
              <p className="mt-0.5 text-sm text-[var(--cl-sapin-fonce)]">{T.merciSous}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAfficher(false)
                setCle((k) => k + 1)
              }}
              className="rounded-full bg-[var(--cl-papier)] px-4 py-2 text-sm font-semibold text-[var(--cl-encre)] transition hover:-translate-y-0.5"
            >
              {T.encore}
            </button>
          </div>
        ) : (
          <form key={cle} action={(f) => { setAfficher(true); return envoyer(f) }} className="mt-6 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="jeton" value={jeton} />
            <input type="hidden" name="langue" value={langue} />
            <label className="text-sm font-medium">
              {T.commerce}
              <input name="commerce" required maxLength={120} placeholder={T.commerceEx} className={champ} />
            </label>
            <label className="text-sm font-medium">
              {T.contact}
              <input name="contact" maxLength={120} placeholder={T.contactEx} className={champ} />
            </label>
            <label className="text-sm font-medium">
              {T.courriel}
              <input name="courriel" type="email" maxLength={254} className={champ} />
            </label>
            <label className="text-sm font-medium">
              {T.telephone}
              <input name="telephone" type="tel" maxLength={40} className={champ} />
              <span className="mt-1 block text-xs font-normal text-[var(--cl-doux)]">{T.unDesDeux}</span>
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              {T.message}
              <textarea name="message" maxLength={500} rows={2} placeholder={T.messageEx} className={`${champ} resize-none`} />
            </label>
            <div className="rounded-2xl bg-[var(--cl-sable)] p-4 sm:col-span-2">
              {partenaire ? (
                <p className="flex items-center gap-2 text-sm font-medium text-[var(--cl-sapin-fonce)]">
                  <input type="hidden" name="partenaire" value="on" />
                  <span aria-hidden>✓</span> {T.dejaPartenaire}
                </p>
              ) : (
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" name="partenaire" defaultChecked className="mt-0.5 size-4 accent-[var(--cl-brique)]" />
                  <span className="font-medium">{T.partenaire}</span>
                </label>
              )}
              <label className="mt-3 block text-sm font-medium">
                {T.site}
                <input name="site_web" maxLength={300} defaultValue={siteWeb ?? ''} placeholder="lecafe.ca" className={champ} />
              </label>
            </div>
            {etat.erreur && <p className="text-sm font-medium text-[var(--cl-rouge)] sm:col-span-2">{etat.erreur}</p>}
            <div className="sm:col-span-2">
              <button
                disabled={enCours}
                className="rounded-full bg-[var(--cl-brique)] px-6 py-3 text-sm font-semibold text-[var(--cl-blanc)] shadow-[0_10px_24px_-12px_#c2552f] transition hover:-translate-y-0.5 hover:bg-[var(--cl-brique-fonce)] disabled:opacity-60"
              >
                {enCours ? T.envoi : T.envoyer}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
