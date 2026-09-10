import { NextResponse } from 'next/server'
import { fermerSession } from '@/lib/auth'

export async function POST(requete: Request) {
  await fermerSession()
  return NextResponse.redirect(new URL('/connexion', requete.url), { status: 303 })
}
