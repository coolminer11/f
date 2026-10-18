/**
 * Le logo Tapora en petit : le sceau soleil sans son texte (l'étoile douce
 * qui se lève dans l'arc-en-ondes). Le sceau complet est dans marque/.
 */
export default function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="50" r="49" fill="#c2552f" />
      <g transform="translate(50 50) scale(.92) translate(-50 -54)">
        <g fill="none" strokeWidth="6" strokeLinecap="round">
          <path d="M30.5 64A19.5 19.5 0 0 1 69.5 64" stroke="#f2d3c4" />
          <path d="M21.5 64A28.5 28.5 0 0 1 78.5 64" stroke="#e4a53a" />
          <path d="M12.5 64A37.5 37.5 0 0 1 87.5 64" stroke="#fffaf2" />
        </g>
        <polygon
          points="50,51.9 52.48,58.08 59.13,58.53 54.02,62.81 55.64,69.27 50,65.72 44.36,69.27 45.98,62.81 40.87,58.53 47.52,58.08"
          fill="#fffaf2"
          stroke="#fffaf2"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
