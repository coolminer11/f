import { NextResponse, type NextRequest } from 'next/server'

const NOM_COOKIE = 'tapora_session'

/**
 * Garde d'accès. La vérification cryptographique complète du jeton a lieu dans
 * les pages (lib/auth.ts) ; le middleware ne fait qu'éviter d'afficher un
 * écran à quelqu'un qui n'a aucun cookie, et rediriger vers la connexion.
 */
export function middleware(requete: NextRequest) {
  const chemin = requete.nextUrl.pathname
  if (chemin.startsWith('/connexion')) return NextResponse.next()

  if (!requete.cookies.get(NOM_COOKIE)) {
    const destination = requete.nextUrl.clone()
    destination.pathname = '/connexion'
    destination.search = chemin === '/' ? '' : `?suite=${encodeURIComponent(chemin)}`
    return NextResponse.redirect(destination)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
