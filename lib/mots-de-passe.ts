/**
 * Ce qui fait un mauvais mot de passe — pour les comptes du back-office comme
 * pour les pages client. Un pirate essaie d'abord les mots de passe courants,
 * le nom du commerce, l'année, les suites de touches : on les refuse.
 *
 * Aucune dépendance serveur : le générateur du navigateur s'en sert aussi
 * pour afficher la force en direct.
 */
const COURANTS = new Set([
  'password', 'motdepasse', 'azerty', 'qwerty', 'bonjour', 'soleil', 'admin', 'tapora', 'taporacards', 'hotel', 'restaurant', 'bienvenue', 'welcome',
  'letmein', 'iloveyou', 'jetaime', 'quebec', 'montreal', 'canada', 'secret', 'changeme', 'client', 'reception', 'chambre', 'avis', 'google',
])

const sansAccents = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Le texte réduit à ses lettres, sans les chiffres d'« année » ou de « compteur » ajoutés au bout. */
function noyau(v: string): string {
  return sansAccents(v).replace(/[^a-z]/g, '')
}

function suite(v: string): boolean {
  const c = sansAccents(v).replace(/[^a-z0-9]/g, '')
  if (c.length < 6) return false
  const rangees = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'azertyuiop', 'qwertyuiop', 'asdfghjkl', 'qsdfghjklm']
  return rangees.some((r) => r.includes(c) || [...r].reverse().join('').includes(c))
}

/**
 * La raison du refus, ou null si le mot de passe tient. `interdits` : des
 * mots propres au contexte (nom du commerce, courriel), qu'on ne veut pas
 * retrouver tels quels.
 */
export function faiblesse(motDePasse: string, interdits: string[] = []): string | null {
  const m = motDePasse.trim()
  if (m.length < 10) return 'Au moins 10 caractères.'
  if (/^(.)\1+$/.test(m)) return 'Un seul caractère répété : trop facile à deviner.'
  if (/^\d+$/.test(m)) return 'Que des chiffres : trop facile à deviner.'
  if (suite(m)) return 'Une suite de touches (abcdef, 123456, azerty…) : trop facile à deviner.'
  const n = noyau(m)
  if (COURANTS.has(n) || COURANTS.has(sansAccents(m))) return 'Un mot de passe parmi les plus courants : trop facile à deviner.'
  // Le nom du commerce (ou le courriel), en entier ou mot par mot : une fois
  // ces mots retirés, il doit rester au moins 4 lettres à deviner.
  const propres = interdits.flatMap((x) => [noyau(x), ...sansAccents(x).split(/[^a-z]+/)]).filter((x) => x.length >= 4)
  if (propres.length) {
    let reste = n
    for (const mot of [...new Set(propres)].sort((a, b) => b.length - a.length)) reste = reste.split(mot).join('')
    if (reste.length < 4) return 'Trop proche du nom du commerce ou du courriel : trop facile à deviner.'
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(m)).length
  const mots = m.split(/[\s\-_.]+/).filter((x) => x.length >= 3).length
  if (classes < 2 && mots < 3) return 'Mélangez lettres et chiffres (ou mettez trois mots, comme « érable-lanterne-soleil »).'
  return null
}

/** Une idée de la solidité, pour l'indicateur : 0 (faible) à 3 (excellent). */
export function force(motDePasse: string, interdits: string[] = []): 0 | 1 | 2 | 3 {
  if (faiblesse(motDePasse, interdits)) return 0
  const m = motDePasse.trim()
  const mots = m.split(/[\s\-_.]+/).filter((x) => x.length >= 3).length
  if (m.length >= 18 || (mots >= 4 && m.length >= 16)) return 3
  if (m.length >= 13 || mots >= 3) return 2
  return 1
}
