/** Le temps d'un aller-retour : la silhouette de la page, qui miroite. */
export default function Chargement() {
  return (
    <div className="theme-services" aria-busy="true">
      <div className="sv-racine">
        <div className="sv-hero sv-hero-sans-image">
          <div className="sv-colonne sv-hero-contenu">
            <div className="sv-barre">
              <div className="sv-squelette h-[3.25rem] w-[3.25rem] rounded-2xl" />
              <div className="sv-squelette h-10 w-20 rounded-full" />
            </div>
            <div className="sv-hero-texte">
              <div className="sv-squelette h-7 w-28 rounded-full" />
              <div className="sv-squelette mt-4 h-11 w-3/4" />
              <div className="sv-squelette mt-3 h-5 w-2/3" />
            </div>
          </div>
        </div>
        <div className="sv-colonne sv-pile">
          <div className="sv-squelette h-24" />
          <div className="sv-grille">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="sv-squelette h-[7.25rem]" style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
          <div className="sv-squelette h-20" />
        </div>
      </div>
    </div>
  )
}
