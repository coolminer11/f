import 'server-only'
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Double authentification : codes à 6 chiffres qui changent toutes les 30 s
 * (TOTP, RFC 6238), compatibles avec Google Authenticator, 1Password, Authy…
 *
 * Le secret est chiffré en base (AES-256-GCM, clé tirée de SESSION_SECRET) :
 * une copie de la base seule ne permet pas de générer les codes. Changer
 * SESSION_SECRET oblige donc chacun à réactiver la double authentification.
 */

const PAS = 30
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32(octets: Buffer): string {
  let bits = 0
  let valeur = 0
  let sortie = ''
  for (const o of octets) {
    valeur = (valeur << 8) | o
    bits += 8
    while (bits >= 5) {
      sortie += ALPHABET[(valeur >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) sortie += ALPHABET[(valeur << (5 - bits)) & 31]
  return sortie
}

function deBase32(texte: string): Buffer {
  const propre = texte.replace(/[\s=-]/g, '').toUpperCase()
  let bits = 0
  let valeur = 0
  const octets: number[] = []
  for (const c of propre) {
    const i = ALPHABET.indexOf(c)
    if (i < 0) throw new Error('Secret TOTP invalide.')
    valeur = (valeur << 5) | i
    bits += 5
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(octets)
}

export function nouveauSecret(): string {
  return base32(randomBytes(20))
}

function code(secret: string, compteur: number): string {
  const tampon = Buffer.alloc(8)
  tampon.writeBigUInt64BE(BigInt(compteur))
  const h = createHmac('sha1', deBase32(secret)).update(tampon).digest()
  const decalage = h[h.length - 1] & 15
  const n = (h.readUInt32BE(decalage) & 0x7fffffff) % 1_000_000
  return n.toString().padStart(6, '0')
}

/**
 * Vérifie un code, en tolérant 30 s d'écart d'horloge dans chaque sens.
 * Renvoie le pas accepté, ou null. Un pas déjà utilisé (`dernier`) est
 * refusé : un code intercepté ne peut pas être rejoué.
 */
export function verifierCode(secret: string, saisi: string, dernier: number | null): number | null {
  const propre = saisi.replace(/\D/g, '')
  if (propre.length !== 6) return null
  const maintenant = Math.floor(Date.now() / 1000 / PAS)
  for (const ecart of [0, -1, 1]) {
    const pas = maintenant + ecart
    if (dernier !== null && pas <= dernier) continue
    const attendu = Buffer.from(code(secret, pas))
    if (timingSafeEqual(attendu, Buffer.from(propre))) return pas
  }
  return null
}

export function lienApplication(secret: string, courriel: string): string {
  const etiquette = encodeURIComponent(`Tapora:${courriel}`)
  return `otpauth://totp/${etiquette}?secret=${secret}&issuer=Tapora&algorithm=SHA1&digits=6&period=${PAS}`
}

// ---- Chiffrement du secret en base -----------------------------------------

function cleChiffrement(): Buffer {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 16) throw new Error('SESSION_SECRET est requis.')
  return createHash('sha256').update(`totp:${secret}`).digest()
}

export function chiffrerSecret(secret: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', cleChiffrement(), iv)
  const chiffre = Buffer.concat([c.update(secret, 'utf8'), c.final()])
  return `v1.${iv.toString('base64url')}.${chiffre.toString('base64url')}.${c.getAuthTag().toString('base64url')}`
}

export function dechiffrerSecret(stocke: string): string | null {
  const [version, iv, chiffre, etiquette] = stocke.split('.')
  if (version !== 'v1' || !iv || !chiffre || !etiquette) return null
  try {
    const d = createDecipheriv('aes-256-gcm', cleChiffrement(), Buffer.from(iv, 'base64url'))
    d.setAuthTag(Buffer.from(etiquette, 'base64url'))
    return Buffer.concat([d.update(Buffer.from(chiffre, 'base64url')), d.final()]).toString('utf8')
  } catch {
    return null
  }
}

// ---- Codes de secours ------------------------------------------------------

const LETTRES = 'abcdefghjkmnpqrstuvwxyz23456789'

/** 10 codes « xxxx-xxxx » à usage unique, pour le jour où le téléphone est perdu. */
export function nouveauxCodesSecours(): string[] {
  return Array.from({ length: 10 }, () => {
    const o = randomBytes(8)
    const c = Array.from(o, (x) => LETTRES[x % LETTRES.length]).join('')
    return `${c.slice(0, 4)}-${c.slice(4)}`
  })
}

export function empreinteCodeSecours(codeSaisi: string): string {
  const propre = codeSaisi.toLowerCase().replace(/[^a-z0-9]/g, '')
  return createHmac('sha256', cleChiffrement()).update(`secours:${propre}`).digest('hex')
}

export function ressembleCodeSecours(saisi: string): boolean {
  return /^[a-z0-9]{4}-?[a-z0-9]{4}$/i.test(saisi.trim())
}
