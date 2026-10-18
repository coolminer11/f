import Logo from '@/components/client/logo'

/**
 * Le décor des écrans d'entrée (connexion, code, « ce n'était pas moi ») :
 * à gauche le soleil Tapora qui se lève, à droite la carte du formulaire.
 */
export default function EcranConnexion({ titre, sousTitre, children }: { titre: string; sousTitre: string; children: React.ReactNode }) {
  return (
    <div className="connexion-fond fixed inset-0 z-10 overflow-y-auto">
      <div className="mx-auto grid min-h-full max-w-5xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.05fr_1fr]">
        <div className="hidden lg:block" aria-hidden>
          <div className="relative">
          <svg viewBox="0 0 400 300" className="connexion-arcs w-full overflow-visible">
            <g fill="none" strokeWidth="34" strokeLinecap="round">
              <path pathLength={1} d="M70 280a130 130 0 0 1 260 0" stroke="#f2d3c4" />
              <path pathLength={1} d="M30 280a170 170 0 0 1 340 0" stroke="#e4a53a" />
              <path pathLength={1} d="M-10 280a210 210 0 0 1 420 0" stroke="#c2552f" />
            </g>
          </svg>
          <div className="connexion-sceau absolute bottom-0 left-1/2 -ml-[78px] w-[156px]">
            <Logo className="size-[156px] drop-shadow-[0_22px_30px_rgba(110,45,15,0.35)]" />
          </div>
          </div>
          <p className="mt-10 text-center font-[family-name:var(--police-fraunces)] text-3xl font-semibold tracking-tight text-[#2a211a]">
            Un tap. Un avis <em className="font-medium text-[#c2552f]">Google</em>.
          </p>
          <p className="mt-2 text-center text-sm text-[#6b5d50]">Back-office de Tapora S.E.N.C. · accès réservé aux associés</p>
        </div>

        <div className="connexion-carte mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <Logo className="size-9" />
            <span className="font-[family-name:var(--police-fraunces)] text-2xl font-semibold">Tapora</span>
          </div>
          <div className="carte p-7 sm:p-8">
            <h1 className="font-[family-name:var(--police-fraunces)] text-[1.9rem] font-semibold leading-tight tracking-tight">{titre}</h1>
            <p className="mt-1.5 text-sm text-[var(--color-encre-doux)]">{sousTitre}</p>
            <div className="mt-6">{children}</div>
          </div>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[#6b5d50]">
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Connexion chiffrée · essais limités · double authentification
          </p>
        </div>
      </div>
    </div>
  )
}
