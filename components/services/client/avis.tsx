'use client'

import { useState } from 'react'
import { toast } from '@/components/effets/toasts'
import { vibrer } from '@/components/effets/desintegration'
import { commenter, noter, versGoogle } from '@/app/s/[code]/actions'
import type { DictionnaireUi } from '@/lib/services/ui'

const CLE_AVIS = (code: string) => `tapora_avis_${code}`

/** A-t-on déjà demandé l'avis récemment ? (noté : 12 h ; « plus tard » : 30 min) — on ne harcèle pas. */
export function avisRecent(code: string): boolean {
  try {
    const v = Number(localStorage.getItem(CLE_AVIS(code)) ?? 0)
    return v > Date.now()
  } catch {
    return false
  }
}
function retenirAvis(code: string, minutes: number) {
  try {
    localStorage.setItem(CLE_AVIS(code), String(Date.now() + minutes * 60_000))
  } catch {
    // Stockage bloqué : on redemandera, tant pis.
  }
}

/**
 * La note, juste après « Appeler le serveur » ou « L'addition » (ou depuis
 * l'accueil). Les étoiles s'allument une à une ; la note est enregistrée
 * tout de suite. Ensuite, POUR TOUTES LES NOTES, le même écran : le bouton
 * d'avis Google (Google interdit de trier selon la note) et un mot privé
 * pour l'équipe.
 */
export default function BlocAvis({
  code,
  langue,
  t,
  demandeId,
  google,
  onFini,
}: {
  code: string
  langue: string
  t: DictionnaireUi
  demandeId: string | null
  /** Le lien d'avis Google de l'établissement (https), s'il en a un. */
  google: string | null
  onFini: () => void
}) {
  const [note, setNote] = useState(0)
  const [survol, setSurvol] = useState(0)
  const [retourId, setRetourId] = useState<string | null>(null)
  const [enregistre, setEnregistre] = useState(false)
  const [mot, setMot] = useState('')
  const [envoiMot, setEnvoiMot] = useState(false)
  const [motEnvoye, setMotEnvoye] = useState(false)
  const libelles = [t.note1, t.note2, t.note3, t.note4, t.note5]
  const affichee = survol || note

  async function choisir(n: number) {
    if (note) return
    setNote(n)
    vibrer(n >= 4 ? [10, 30, 10, 30, 16] : 12)
    retenirAvis(code, 12 * 60)
    try {
      const r = await noter(code, demandeId, n, langue)
      setRetourId(r?.id ?? null)
    } catch {
      setRetourId(null)
    }
    setEnregistre(true)
  }

  async function envoyerMot() {
    const texte = mot.trim()
    if (!texte || envoiMot) return
    setEnvoiMot(true)
    let ok = false
    try {
      ok = retourId ? await commenter(code, retourId, texte) : false
    } catch {
      ok = false
    }
    setEnvoiMot(false)
    if (ok) {
      setMotEnvoye(true)
      toast(t.commentaireEnvoye, { ton: 'succes' })
    } else toast(t.erreur, { ton: 'erreur' })
  }

  return (
    <div className="sv-avis">
      <p className="sv-avis-question">{t.question}</p>
      <div className="sv-etoiles mt-4" role="radiogroup" aria-label={t.question} onPointerLeave={() => setSurvol(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={note === n}
            aria-label={`${n} / 5 — ${libelles[n - 1]}`}
            className="sv-etoile"
            data-allumee={n <= affichee}
            data-vient={note > 0 && n <= note}
            style={{ animationDelay: `${(note ? n - 1 : n) * 70}ms` }}
            disabled={note > 0}
            onPointerEnter={() => !note && setSurvol(n)}
            onFocus={() => !note && setSurvol(n)}
            onClick={() => void choisir(n)}
          >
            <svg viewBox="0 0 24 24" width="38" height="38" aria-hidden>
              <path
                d="M12 2.8l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.87l-5.5 2.88 1.05-6.12L3.1 9.3l6.15-.9L12 2.8z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
      </div>
      <p className="sv-avis-libelle" aria-live="polite">
        {affichee ? libelles[affichee - 1] : ' '}
      </p>

      {note > 0 && (
        <div className="sv-avis-suite">
          <p className="sv-sous-titre text-center">{t.merci}</p>
          {google && (
            <>
              <p className="sv-doux mt-1 text-center text-[0.92rem]">{t.googleInvite}</p>
              <a
                href={google}
                target="_blank"
                rel="noopener noreferrer"
                className="sv-bouton sv-bouton-plein sv-bouton-google mt-4"
                onClick={() => void versGoogle(code, retourId, langue)}
              >
                <LogoGoogle />
                {t.laisserGoogle}
              </a>
            </>
          )}
          {motEnvoye ? (
            <p className="sv-mot-envoye mt-4">{t.commentaireEnvoye}</p>
          ) : (
            <div className="mt-4">
              <label className="sv-etiquette" htmlFor={`mot-${demandeId ?? 'accueil'}`}>
                {note <= 3 ? t.ameliorer : t.motEquipe}
              </label>
              <textarea
                id={`mot-${demandeId ?? 'accueil'}`}
                className="sv-champ mt-2"
                rows={3}
                maxLength={1000}
                value={mot}
                onChange={(e) => setMot(e.target.value)}
                disabled={!enregistre}
              />
              {mot.trim() && (
                <button type="button" className="sv-bouton sv-bouton-2 sv-bouton-plein mt-3" onClick={() => void envoyerMot()} disabled={envoiMot || !enregistre}>
                  {envoiMot ? <span className="sv-rond" aria-hidden /> : null}
                  {envoiMot ? t.envoi : t.envoyerEquipe}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <div className="mt-3 text-center">
        <button
          type="button"
          className="sv-bouton sv-bouton-texte"
          onClick={() => {
            if (!note) retenirAvis(code, 30)
            onFini()
          }}
        >
          {note ? t.fermer : t.plusTard}
        </button>
      </div>
    </div>
  )
}

function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
