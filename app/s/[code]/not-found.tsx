import Logo from '@/components/client/logo'
import { ui } from '@/lib/services/ui'

/**
 * Un code inconnu, une carte pas encore activée, un établissement suspendu :
 * on ne sait pas quelle langue parle le client, alors on le dit en français
 * et en anglais, poliment, sans jargon.
 */
export default function CarteIntrouvable() {
  return (
    <div className="theme-services" lang="fr">
      <div className="sv-racine">
        <div className="sv-introuvable fond-maillage">
          <div className="sv-introuvable-carte sv-entre">
            <span className="sv-introuvable-sceau" aria-hidden>
              <Logo className="size-14" />
            </span>
            <h1 className="sv-titre mt-6 text-center">{ui('fr', 'introuvableTitre')}</h1>
            <p className="sv-doux mt-3 text-center">{ui('fr', 'introuvableSous')}</p>
            <div className="sv-ligne-fine my-6" aria-hidden />
            <p lang="en" className="text-center text-[1.05rem] font-semibold">
              {ui('en', 'introuvableTitre')}
            </p>
            <p lang="en" className="sv-doux mt-1 text-center text-[0.92rem]">
              {ui('en', 'introuvableSous')}
            </p>
          </div>
        </div>
        <footer className="sv-pied">
          <a href="https://taporacards.com" target="_blank" rel="noopener noreferrer">
            <Logo className="size-4" />
            <span>
              {ui('fr', 'propulse')} <strong>Tapora</strong>
            </span>
          </a>
        </footer>
      </div>
    </div>
  )
}
