import type { Etablissement } from '@/lib/services/types'

/**
 * Les petites pièces de la console Tapora Services : blocs, pastilles,
 * barres, interrupteurs. Rendues côté serveur, sans interaction.
 */

export function Bloc({
  id,
  titre,
  sous,
  actions,
  children,
  className = '',
}: {
  id?: string
  titre: React.ReactNode
  sous?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} className={`carte scroll-mt-24 p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{titre}</h2>
          {sous && <p className="mt-0.5 text-xs text-[var(--color-encre-doux)]">{sous}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

type Ton = 'neutre' | 'positif' | 'attention' | 'negatif' | 'accent'
const TONS: Record<Ton, string> = {
  neutre: 'bg-[var(--color-fond)] text-[var(--color-encre-doux)] border-[var(--color-ligne)]',
  positif: 'bg-green-50 text-[var(--color-positif)] border-[color-mix(in_srgb,var(--color-positif)_25%,transparent)]',
  attention: 'bg-amber-50 text-[var(--color-attention)] border-[color-mix(in_srgb,var(--color-attention)_25%,transparent)]',
  negatif: 'bg-red-50 text-[var(--color-negatif)] border-[color-mix(in_srgb,var(--color-negatif)_25%,transparent)]',
  accent: 'bg-[var(--color-accent-doux)] text-[var(--color-accent)] border-[color-mix(in_srgb,var(--color-accent)_25%,transparent)]',
}

export function Pastille({ ton = 'neutre', children, titre }: { ton?: Ton; children: React.ReactNode; titre?: string }) {
  return (
    <span title={titre} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONS[ton]}`}>
      {children}
    </span>
  )
}

/** Un classement en barres horizontales (demandes par type, langues, plats…). */
export function ListeBarres({
  lignes,
  unite = '',
  vide = 'Rien pour cette période.',
}: {
  lignes: { cle: string; libelle: React.ReactNode; valeur: number; detail?: string }[]
  unite?: string
  vide?: string
}) {
  if (!lignes.length) return <p className="text-sm text-[var(--color-encre-doux)]">{vide}</p>
  const max = Math.max(1, ...lignes.map((l) => l.valeur))
  const total = lignes.reduce((s, l) => s + l.valeur, 0)
  return (
    <ul className="space-y-2">
      {lignes.map((l) => (
        <li key={l.cle}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{l.libelle}</span>
            <span className="shrink-0 tabular-nums text-[var(--color-encre-doux)]">
              <span className="font-semibold text-[var(--color-encre)]">{l.valeur.toLocaleString('fr-CA')}</span>
              {unite && ` ${unite}`}
              {l.detail ? ` · ${l.detail}` : total > 0 ? ` · ${Math.round((l.valeur / total) * 100)} %` : ''}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-grille)]">
            <div className="h-full rounded-full bg-[var(--color-serie-1)]" style={{ width: `${Math.max(2, (l.valeur / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Une case à cocher présentée comme un interrupteur, avec son explication. */
export function Interrupteur({ name, coche, libelle, aide }: { name: string; coche: boolean; libelle: string; aide?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-ligne)] p-3 transition hover:bg-[var(--color-fond)] has-[:checked]:border-[color-mix(in_srgb,var(--color-accent)_40%,transparent)]">
      <input type="checkbox" name={name} defaultChecked={coche} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-[var(--color-ligne)] transition after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-[var(--color-accent)] peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{libelle}</span>
        {aide && <span className="block text-xs text-[var(--color-encre-doux)]">{aide}</span>}
      </span>
    </label>
  )
}

/** 45 s · 2 min 05 · 1 h 12 */
export function duree(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '—'
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
}

export const ICONE_TYPE: Record<Etablissement['type'], string> = { restaurant: '🍽️', hotel: '🏨' }
export const NOM_TYPE: Record<Etablissement['type'], string> = { restaurant: 'Restaurant', hotel: 'Hôtel' }

/** Jours restants d'essai (négatif : essai échu), ou null hors essai. */
export function joursEssai(e: Pick<Etablissement, 'formule' | 'essai_jusqua'>): number | null {
  if (e.formule !== 'essai' || !e.essai_jusqua) return null
  const fin = Date.UTC(+e.essai_jusqua.slice(0, 4), +e.essai_jusqua.slice(5, 7) - 1, +e.essai_jusqua.slice(8, 10))
  const t = new Date()
  return Math.ceil((fin - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 86_400_000)
}

export function PastilleFormule({ e }: { e: Pick<Etablissement, 'formule' | 'essai_jusqua' | 'prix_mensuel' | 'actif'> }) {
  if (!e.actif) return <Pastille>Désactivé</Pastille>
  if (e.formule === 'suspendu') return <Pastille ton="negatif">Suspendu</Pastille>
  if (e.formule === 'actif') return <Pastille ton="positif">Actif{e.prix_mensuel != null ? ` · ${e.prix_mensuel.toLocaleString('fr-CA')} $/mois` : ''}</Pastille>
  const j = joursEssai(e)
  if (j === null) return <Pastille ton="accent">Essai</Pastille>
  if (j < 0) return <Pastille ton="negatif">Essai échu depuis {-j} j</Pastille>
  return <Pastille ton={j <= 5 ? 'attention' : 'accent'}>Essai · {j} j restants</Pastille>
}

/** Une tuile chiffrée dont la valeur peut être un compteur animé. */
export function TuileChiffre({ libelle, valeur, sous, icone }: { libelle: string; valeur: React.ReactNode; sous?: React.ReactNode; icone?: string }) {
  return (
    <div className="carte p-4">
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--color-encre-doux)]">
        {libelle}
        {icone && <span aria-hidden className="text-sm opacity-70">{icone}</span>}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{valeur}</div>
      {sous && <div className="mt-1">{sous}</div>}
    </div>
  )
}

/** Une couleur #rrggbb mélangée à du noir (f = 0 : inchangée, 1 : noir). */
export function assombrir(hex: string, f: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
  const c = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f)))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Une courbe en aire, pour le haut de page : trait clair, dégradé dessous, dernier point marqué. */
export function Courbe({ serie, hauteur = 64, couleur = '#e4a53a', libelle }: { serie: number[]; hauteur?: number; couleur?: string; libelle: string }) {
  const largeur = 320
  if (serie.length < 2) return null
  const max = Math.max(1, ...serie)
  const pas = largeur / (serie.length - 1)
  const pts = serie.map((v, i) => [i * pas, hauteur - 4 - (v / max) * (hauteur - 10)] as const)
  const ligne = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const id = `courbe-${couleur.replace('#', '')}`
  const [dx, dy] = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${largeur} ${hauteur}`} preserveAspectRatio="none" className="h-16 w-full overflow-visible" role="img" aria-label={libelle}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={couleur} stopOpacity="0.45" />
          <stop offset="100%" stopColor={couleur} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${ligne} L${largeur},${hauteur} L0,${hauteur} Z`} fill={`url(#${id})`} />
      <path d={ligne} fill="none" stroke={couleur} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={dx} cy={dy} r="3.5" fill={couleur} stroke="#1c1611" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
