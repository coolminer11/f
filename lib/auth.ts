import 'server-only'
import { cookies } from 'next/headers'

const NOM_COOKIE = 'tapora_session'
const DUREE_SECONDES = 60 * 60 * 12 // 12 heures

function encodeur() {
  return new TextEncoder()
}

async function cle(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET est requis (au moins 16 caractères). Voir .env.example.')
  }
  return crypto.subtle.importKey(
    'raw',
    encodeur().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function signer(charge: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await cle(), encodeur().encode(charge))
  return Buffer.from(signature).toString('base64url')
}

/** Comparaison à temps constant : ne renseigne pas sur le préfixe correct. */
function memeChaine(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return difference === 0
}

export async function creerJeton(): Promise<string> {
  const expiration = Date.now() + DUREE_SECONDES * 1000
  const charge = String(expiration)
  return `${charge}.${await signer(charge)}`
}

export async function jetonValide(jeton: string | undefined): Promise<boolean> {
  if (!jeton) return false
  const [charge, signature] = jeton.split('.')
  if (!charge || !signature) return false
  if (!memeChaine(signature, await signer(charge))) return false
  return Number(charge) > Date.now()
}

export async function motDePasseValide(saisie: string): Promise<boolean> {
  const attendu = process.env.BACKOFFICE_PASSWORD
  if (!attendu) {
    throw new Error('BACKOFFICE_PASSWORD est requis. Voir .env.example.')
  }
  return memeChaine(saisie, attendu)
}

export async function ouvrirSession(): Promise<void> {
  const magasin = await cookies()
  magasin.set(NOM_COOKIE, await creerJeton(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DUREE_SECONDES,
  })
}

export async function fermerSession(): Promise<void> {
  const magasin = await cookies()
  magasin.delete(NOM_COOKIE)
}

export async function sessionOuverte(): Promise<boolean> {
  const magasin = await cookies()
  return jetonValide(magasin.get(NOM_COOKIE)?.value)
}

export { NOM_COOKIE }
