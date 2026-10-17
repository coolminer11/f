import Link from 'next/link'
import { exigerSession } from '@/lib/auth'
import MoniteurDirect from '@/components/moniteur-direct'

export const dynamic = 'force-dynamic'

export default async function PageDirect() {
  await exigerSession()
  return (
    <div className="space-y-5">
      <div>
        <Link href="/cartes" className="text-sm text-[var(--color-encre-doux)] hover:underline">
          ← Cartes NFC
        </Link>
        <h1 className="mt-1 text-lg font-bold tracking-tight">En direct</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          Les taps à la seconde près, et si le serveur suit. Laissez cette page ouverte pendant un
          test de charge (<code>npm run stress</code>).
        </p>
      </div>
      <MoniteurDirect />
    </div>
  )
}
