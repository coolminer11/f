import type { Langue } from '@/lib/langue'
import BienvenueAnime from '@/components/client/bienvenue-anime'

/**
 * L'arrivée dans l'espace du client : un écran plein « Bienvenue,
 * <nom de l'entreprise> » — le sceau se dessine, le nom se lève lettre par
 * lettre, puis le rideau monte sur ses statistiques.
 *
 * Il joue quand le client arrive par le lien de l'espace client
 * (?bienvenue=1) et la toute première fois sur un appareil — jamais à
 * chaque visite. Le script en ligne décide AVANT le premier affichage :
 * aucun éclair de la page en dessous.
 */
const T = {
  fr: { bienvenue: 'Bienvenue', sous: 'Votre espace Tapora', passer: 'Passer' },
  en: { bienvenue: 'Welcome', sous: 'Your Tapora area', passer: 'Skip' },
}

export default function Bienvenue({ nom, langue, cle }: { nom: string; langue: Langue; cle: string }) {
  const X = T[langue]
  // La clé : le début de l'identifiant du dossier, jamais le lien lui-même.
  const k = `tapora_bienvenue_${cle.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`
  const decider = `(function(){try{var d=document.documentElement,q=/[?&]bienvenue=1/.test(location.search),k=${JSON.stringify(k)};if(q||!localStorage.getItem(k)){d.setAttribute('data-bienvenue','1');localStorage.setItem(k,'1')}}catch(e){}})()`
  const mots = nom.trim().split(/\s+/)
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: decider }} />
      <div className="bienvenue" aria-hidden="true">
        <div className="bienvenue-fond" />
        <div className="bienvenue-particules">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ '--x': `${(i * 37) % 100}%`, '--d': `${(i % 6) * 0.35}s`, '--t': `${5 + (i % 5)}s`, '--s': `${3 + (i % 4)}px` } as React.CSSProperties} />
          ))}
        </div>
        <div className="bienvenue-centre">
          <svg viewBox="0 0 100 100" className="bienvenue-sceau">
            <circle className="bienvenue-disque" cx="50" cy="50" r="49" fill="#c2552f" />
            <g transform="translate(50 50) scale(.92) translate(-50 -54)">
              <g fill="none" strokeWidth="6" strokeLinecap="round">
                <path className="bienvenue-arc" pathLength={1} d="M30.5 64A19.5 19.5 0 0 1 69.5 64" stroke="#f2d3c4" />
                <path className="bienvenue-arc" pathLength={1} d="M21.5 64A28.5 28.5 0 0 1 78.5 64" stroke="#e4a53a" />
                <path className="bienvenue-arc" pathLength={1} d="M12.5 64A37.5 37.5 0 0 1 87.5 64" stroke="#fffaf2" />
              </g>
              <polygon
                className="bienvenue-etoile"
                points="50,51.9 52.48,58.08 59.13,58.53 54.02,62.81 55.64,69.27 50,65.72 44.36,69.27 45.98,62.81 40.87,58.53 47.52,58.08"
                fill="#fffaf2"
                stroke="#fffaf2"
                strokeWidth="3"
                strokeLinejoin="round"
              />
            </g>
          </svg>
          <p className="bienvenue-sur">{X.bienvenue}</p>
          <p className="bienvenue-nom">
            {/* Mot par mot (un long nom passe à la ligne entre deux mots), lettre par lettre. */}
            {mots.map((mot, i) => (
              <span key={i}>
                {i > 0 && ' '}
                <span className="bienvenue-mot">
                  {Array.from(mot).map((c, j) => (
                    <span key={j} className="bienvenue-lettre">
                      {c}
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </p>
          <svg viewBox="0 0 220 16" preserveAspectRatio="none" className="bienvenue-trait">
            <path pathLength={1} d="M3 11 C 55 3, 120 3, 165 7 S 205 12, 217 5" fill="none" stroke="#e4a53a" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <p className="bienvenue-sous">{X.sous}</p>
        </div>
        <button type="button" className="bienvenue-passer" tabIndex={-1}>
          {X.passer}
        </button>
      </div>
      <BienvenueAnime nom={nom} langue={langue} />
    </>
  )
}
