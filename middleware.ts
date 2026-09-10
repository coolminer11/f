import { NextResponse, type NextRequest } from 'next/server'

const NOM_COOKIE = 'tapora_session'
const PUBLIC = ['/connexion', '/documents']

/**
 * Première barrière. Elle vérifie la SIGNATURE du cookie, ce qui écarte un
 * cookie forgé sans toucher la base — le middleware tourne sur le runtime edge
 * et n'a pas accès à PostgreSQL.
 *
 * Elle ne suffit pas : une session fermée ou expirée garde une signature
 * valide. C'est `exigerSession()` (lib/auth.ts), appelée en tête de chaque page
 * et de chaque route, qui tranche pour de bon contre la base.
 */
export async function middleware(requete: NextRequest) {
  const chemin = requete.nextUrl.pathname
  if (PUBLIC.some((p) => chemin.startsWith(p))) return NextResponse.next()

  const brut = requete.cookies.get(NOM_COOKIE)?.value
  if (brut && (await signatureValide(brut))) return NextResponse.next()

  const destination = requete.nextUrl.clone()
  destination.pathname = '/connexion'
  destination.search = chemin === '/' ? '' : `?suite=${encodeURIComponent(chemin)}`
  const reponse = NextResponse.redirect(destination)
  if (brut) reponse.cookies.delete(NOM_COOKIE)
  return reponse
}

async function signatureValide(brut: string): Promise<boolean> {
  const [jeton, signature] = brut.split('.')
  if (!jeton || !signature) return false
  const secret = process.env.SESSION_SECRET
  if (!secret) return false

  const cle = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const calculee = Buffer.from(
    await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(jeton)),
  ).toString('base64url')

  if (calculee.length !== signature.length) return false
  let difference = 0
  for (let i = 0; i < calculee.length; i++) {
    difference |= calculee.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return difference === 0
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
