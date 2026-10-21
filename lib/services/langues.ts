/**
 * Les langues de Tapora Services. Les textes des établissements (menus,
 * concierge, demandes) sont des objets { fr: …, en: … } ; `texte()` choisit
 * la bonne langue, sinon la langue par défaut, sinon la première venue.
 *
 * Au Québec, le français est la langue par défaut et passe en premier
 * (Charte de la langue française) : l'éditeur l'exige.
 */
export const LANGUES = [
  { code: 'fr', nom: 'Français', drapeau: '🇫🇷' },
  { code: 'en', nom: 'English', drapeau: '🇬🇧' },
  { code: 'es', nom: 'Español', drapeau: '🇪🇸' },
  { code: 'de', nom: 'Deutsch', drapeau: '🇩🇪' },
  { code: 'it', nom: 'Italiano', drapeau: '🇮🇹' },
  { code: 'pt', nom: 'Português', drapeau: '🇵🇹' },
  { code: 'zh', nom: '中文', drapeau: '🇨🇳' },
  { code: 'ja', nom: '日本語', drapeau: '🇯🇵' },
  { code: 'ko', nom: '한국어', drapeau: '🇰🇷' },
  { code: 'ar', nom: 'العربية', drapeau: '🇸🇦' },
] as const

export type Langue = (typeof LANGUES)[number]['code']
export type Texte = Partial<Record<Langue, string>>

export const estLangue = (v: unknown): v is Langue => typeof v === 'string' && LANGUES.some((l) => l.code === v)
export const nomLangue = (c: string) => LANGUES.find((l) => l.code === c)?.nom ?? c
export const drapeau = (c: string) => LANGUES.find((l) => l.code === c)?.drapeau ?? '🌐'
/** L'arabe se lit de droite à gauche. */
export const sens = (c: string): 'ltr' | 'rtl' => (c === 'ar' ? 'rtl' : 'ltr')

/** Le texte dans la langue voulue, sinon la langue par défaut, sinon le premier non vide. */
export function texte(t: Texte | null | undefined, langue: string, defaut = 'fr'): string {
  if (!t) return ''
  const v = t as Record<string, string | undefined>
  return v[langue]?.trim() || v[defaut]?.trim() || Object.values(v).find((x) => x?.trim())?.trim() || ''
}

/** Les langues qu'un texte n'a pas encore (pour l'éditeur : « à traduire »). */
export function manquantes(t: Texte | null | undefined, langues: readonly string[]): string[] {
  const v = (t ?? {}) as Record<string, string | undefined>
  return langues.filter((l) => !v[l]?.trim())
}
