/**
 * Petits outils des pages des clients, sans dépendance serveur : les
 * composants du navigateur et les pages les partagent.
 */

export type TypeBalise = 'plat' | 'rubrique' | 'wifi' | 'pdf' | 'langue'

/** Ce que le client regarde (un plat, une rubrique, le Wi-Fi) : envoyé sans attendre, même si la page se ferme. */
export function balise(code: string, type: TypeBalise, cible: string | null, langue: string): void {
  try {
    const corps = JSON.stringify({ type, cible, langue })
    const url = `/api/s/${code}/evenement`
    if (typeof navigator !== 'undefined' && navigator.sendBeacon?.(url, new Blob([corps], { type: 'text/plain' }))) return
    void fetch(url, { method: 'POST', body: corps, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {})
  } catch {
    // Une statistique perdue ne doit jamais gêner le client.
  }
}

/** Un lien vers l'extérieur : seulement en https (ni javascript:, ni http:). */
export function httpsSeulement(lien: string | null | undefined): string | null {
  if (!lien) return null
  try {
    const u = new URL(lien.trim())
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/** Le nom de domaine à afficher (« lebistro.ca »). */
export function domaine(lien: string): string {
  try {
    return new URL(lien).hostname.replace(/^www\./, '')
  } catch {
    return lien
  }
}

/** Un numéro composable pour tel: (chiffres et + seulement). */
export function numeroTel(t: string | null | undefined): string | null {
  if (!t) return null
  const n = t.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
  return n.replace(/\D/g, '').length >= 3 && n.length <= 20 ? n : null
}

/** Pour chercher « creme brulee » et trouver « Crème brûlée ». */
export const sansAccents = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export const remplir = (t: string, vars: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

/** Un témoin posé par le navigateur (langue choisie, pages déjà vues). */
export function poserTemoin(nom: string, valeur: string, chemin: string, secondes: number): void {
  try {
    const securise = location.protocol === 'https:' ? '; secure' : ''
    document.cookie = `${nom}=${encodeURIComponent(valeur)}; path=${chemin}; max-age=${secondes}; samesite=lax${securise}`
  } catch {
    // Témoins bloqués : la page marche quand même.
  }
}

export function lireTemoin(nom: string): string | null {
  try {
    const m = document.cookie.split('; ').find((c) => c.startsWith(`${nom}=`))
    return m ? decodeURIComponent(m.slice(nom.length + 1)) : null
  } catch {
    return null
  }
}

export const NOM_TEMOIN_LANGUE = 'tapora_langue'
export const NOM_TEMOIN_VU = 'tapora_vu'

/** Moins de mouvement si le téléphone le demande. */
export const mouvementReduit = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** La tuile rebondit, comme un bouton physique qu'on relâche. */
export function rebond(el: HTMLElement | null): void {
  if (!el || mouvementReduit()) return
  el.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(0.93)', offset: 0.18 }, { transform: 'scale(1.045)', offset: 0.55 }, { transform: 'scale(0.995)', offset: 0.8 }, { transform: 'scale(1)' }],
    { duration: 720, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  )
}

/**
 * L'éclat de réussite : un anneau et des étincelles aux couleurs de
 * l'établissement qui jaillissent du centre de l'élément, puis s'éteignent.
 */
export function eclat(el: HTMLElement | null): void {
  if (!el || mouvementReduit()) return
  const b = el.getBoundingClientRect()
  const cx = b.left + b.width / 2
  const cy = b.top + b.height / 2
  const s = getComputedStyle(el)
  const accent = s.getPropertyValue('--sv-accent').trim() || '#c2552f'
  const calque = document.createElement('div')
  calque.setAttribute('aria-hidden', 'true')
  calque.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:96;overflow:hidden'
  document.body.append(calque)
  const anneau = document.createElement('span')
  const r = Math.max(b.width, b.height) / 2
  anneau.style.cssText = `position:absolute;left:${cx - r}px;top:${cy - r}px;width:${2 * r}px;height:${2 * r}px;border-radius:999px;border:2px solid ${accent}`
  calque.append(anneau)
  anneau.animate([{ transform: 'scale(0.4)', opacity: 0.9 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' })
  const couleurs = [accent, '#f2b632', '#ffffff']
  const n = 18
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span')
    const taille = 4 + Math.random() * 5
    const angle = (i / n) * Math.PI * 2 + Math.random() * 0.3
    const distance = r * 0.6 + 28 + Math.random() * 46
    const etoile = i % 3 === 0
    p.style.cssText = `position:absolute;left:${cx - taille / 2}px;top:${cy - taille / 2}px;width:${taille}px;height:${taille}px;border-radius:${etoile ? '2px' : '999px'};background:${couleurs[i % couleurs.length]};box-shadow:0 0 8px ${accent}`
    calque.append(p)
    p.animate(
      [
        { transform: 'translate(0, 0) scale(0.4) rotate(0deg)', opacity: 1 },
        { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(1) rotate(${etoile ? 180 : 0}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${Math.cos(angle) * distance * 1.15}px, ${Math.sin(angle) * distance * 1.15 + 14}px) scale(0) rotate(${etoile ? 270 : 0}deg)`, opacity: 0 },
      ],
      { duration: 760 + Math.random() * 300, easing: 'cubic-bezier(0.15, 0.8, 0.3, 1)', fill: 'forwards' },
    )
  }
  setTimeout(() => calque.remove(), 1200)
}
