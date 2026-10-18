/** Le logo Tapora (carré terre cuite, ondes NFC). */
export default function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="18" fill="#c2552f" />
      <g fill="none" stroke="#fffaf2" strokeWidth="5" strokeLinecap="round">
        <path d="M25 22a14 14 0 0 1 0 20" />
        <path d="M33 15a23 23 0 0 1 0 34" />
        <path d="M41 9a31 31 0 0 1 0 46" opacity=".55" />
      </g>
      <circle cx="17.5" cy="32" r="4.2" fill="#fffaf2" />
    </svg>
  )
}
