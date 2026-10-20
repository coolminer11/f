'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { ecrireTapora, type EtatMessage } from '@/app/stats/[jeton]/actions'
import { locale, type Langue } from '@/lib/langue'

type Message = { id: string; auteur: 'client' | 'tapora'; sujet: string; texte: string; cree_le: string; par_nom: string | null }
type Sujets = Record<string, { fr: string; en: string }>

const T = {
  fr: {
    surtitre: 'Votre ligne directe',
    titre: 'Écrivez-nous',
    sous: 'Une question, une carte à changer de place, un nouveau design ? Votre message arrive directement chez Tapora ; la réponse s’affiche ici et dans vos courriels.',
    sujet: 'C’est à propos de…',
    message: 'Votre message',
    exemple: 'Bonjour ! Nous aimerions…',
    envoyer: 'Envoyer à Tapora',
    envoi: 'Envoi…',
    envoye: 'Message envoyé ✓ On vous répond vite, d’habitude dans la journée.',
    vous: 'Vous',
    tapora: 'Tapora',
    vide: 'Écrivez votre message (2 000 caractères au plus).',
    trop: 'Beaucoup de messages aujourd’hui : réessayez demain, ou écrivez à contact@taporacards.com.',
    lien: 'Ce lien n’est plus valide.',
    restant: (n: number) => `${n} caractère${n > 1 ? 's' : ''} restant${n > 1 ? 's' : ''}`,
  },
  en: {
    surtitre: 'Your direct line',
    titre: 'Write to us',
    sous: 'A question, a card to move, a new design? Your message goes straight to Tapora; the reply shows up here and in your email.',
    sujet: 'It’s about…',
    message: 'Your message',
    exemple: 'Hello! We would like to…',
    envoyer: 'Send to Tapora',
    envoi: 'Sending…',
    envoye: 'Message sent ✓ We usually reply the same day.',
    vous: 'You',
    tapora: 'Tapora',
    vide: 'Write your message (2,000 characters max).',
    trop: 'Lots of messages today: try again tomorrow, or email contact@taporacards.com.',
    lien: 'This link is no longer valid.',
    restant: (n: number) => `${n} character${n > 1 ? 's' : ''} left`,
  },
}

/**
 * Le fil avec Tapora, sur la page du client : ses messages à droite, nos
 * réponses à gauche, et le formulaire. Tout ce qui est envoyé arrive dans le
 * back-office (Messages) et par courriel chez Tapora.
 */
export default function MessagesTapora({
  jeton,
  langue,
  messages,
  sujets,
  sujetInitial,
}: {
  jeton: string
  langue: Langue
  messages: Message[]
  sujets: Sujets
  sujetInitial?: string
}) {
  const X = T[langue]
  const [etat, envoyer, enCours] = useActionState<EtatMessage, FormData>(ecrireTapora, { ok: false, erreur: null, envoye: 0 })
  const [sujet, setSujet] = useState(sujetInitial && sujetInitial in sujets ? sujetInitial : 'question')
  const [texte, setTexte] = useState('')
  const fil = useRef<HTMLOListElement>(null)
  const quand = (iso: string) => new Date(iso).toLocaleString(locale(langue), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Toronto' })

  // Après un envoi : le champ se vide, le fil descend au dernier message.
  useEffect(() => {
    if (etat.ok) setTexte('')
  }, [etat.envoye, etat.ok])
  useEffect(() => {
    fil.current?.scrollTo({ top: fil.current.scrollHeight })
  }, [messages.length])

  return (
    <section className="carte relative overflow-hidden p-6 sm:p-8" id="messages">
      <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 size-60 rounded-full bg-[var(--cl-menthe-pale)] opacity-60" />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cl-brique)]">{X.surtitre}</span>
          <h2 className="titre-client mt-2 !text-2xl sm:!text-3xl">{X.titre}</h2>
          <p className="mt-2 max-w-md text-[var(--cl-doux)]">{X.sous}</p>
          {messages.length > 0 && (
            <ol ref={fil} data-lenis-prevent className="mt-6 max-h-80 space-y-3 overflow-y-auto pr-1" aria-label={langue === 'fr' ? 'Vos échanges avec Tapora' : 'Your conversation with Tapora'}>
              {messages.map((m) => (
                <li key={m.id} className={`bulle flex ${m.auteur === 'client' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.auteur === 'client' ? 'rounded-br-md bg-[var(--cl-nuit)] text-[var(--cl-sur-nuit)]' : 'rounded-bl-md bg-[var(--cl-sable)] text-[var(--cl-encre)]'}`}>
                    <p className="whitespace-pre-line leading-relaxed">{m.texte}</p>
                    <p className={`mt-1 text-[11px] ${m.auteur === 'client' ? 'text-[var(--cl-blanc)]/60' : 'text-[var(--cl-doux)]'}`}>
                      {m.auteur === 'client' ? X.vous : m.par_nom ? `${X.tapora} · ${m.par_nom}` : X.tapora} · {quand(m.cree_le)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <form action={envoyer} className="space-y-4">
          <input type="hidden" name="jeton" value={jeton} />
          <input type="hidden" name="sujet" value={sujet} />
          <fieldset>
            <legend className="text-sm font-medium">{X.sujet}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(sujets).map(([cle, l]) => (
                <button
                  key={cle}
                  type="button"
                  onClick={() => setSujet(cle)}
                  aria-pressed={sujet === cle}
                  className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${sujet === cle ? 'bg-[var(--cl-nuit)] text-[var(--cl-sur-nuit)]' : 'bg-[var(--cl-sable)] text-[var(--cl-encre)] hover:bg-[var(--cl-sable-2)]'}`}
                >
                  {l[langue]}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="msg-texte" className="text-sm font-medium">
              {X.message}
            </label>
            <textarea
              id="msg-texte"
              name="texte"
              required
              rows={5}
              maxLength={2000}
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder={X.exemple}
              className="mt-2 w-full resize-y rounded-2xl border border-[var(--cl-ligne)] bg-[var(--cl-papier)] px-4 py-3 text-base outline-none transition focus:border-[var(--cl-brique)] focus:ring-2 focus:ring-[var(--cl-rose-pale)]"
            />
            {texte.length > 1700 && <p className="mt-1 text-xs text-[var(--cl-doux)]">{X.restant(2000 - texte.length)}</p>}
          </div>
          <div aria-live="polite" className="min-h-5 text-sm">
            {etat.ok && etat.envoye > 0 && <p className="font-medium text-[var(--cl-sapin)]">{X.envoye}</p>}
            {etat.erreur && <p className="font-medium text-[var(--cl-rouge)]">{X[etat.erreur]}</p>}
          </div>
          <button
            disabled={enCours || !texte.trim()}
            className="w-full rounded-full bg-[var(--cl-brique)] px-6 py-3.5 font-semibold text-[var(--cl-blanc)] transition hover:-translate-y-0.5 hover:bg-[var(--cl-brique-fonce)] disabled:translate-y-0 disabled:opacity-50 sm:w-auto"
          >
            {enCours ? X.envoi : X.envoyer}
          </button>
        </form>
      </div>
    </section>
  )
}
