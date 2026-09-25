import Link from 'next/link'
import { exigerSession } from '@/lib/auth'
import { etatSysteme, type Verdict } from '@/lib/requetes/etat'

export const dynamic = 'force-dynamic'

const PASTILLE: Record<Verdict, string> = {
  ok: 'bg-emerald-500',
  attention: 'bg-amber-500',
  panne: 'bg-red-500',
}

const MOT: Record<Verdict, string> = {
  ok: 'Branché',
  attention: 'À finir',
  panne: 'Cassé',
}

export default async function Etat() {
  await exigerSession()
  const controles = await etatSysteme()
  const parfait = controles.every((c) => c.verdict === 'ok')

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight">État du système</h1>
        <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">
          Chaque ligne fait le vrai geste — interroger la base, demander le seau à Supabase —
          plutôt que de constater qu’une variable existe. Une clé peut exister et être fausse.
        </p>
      </div>

      <p
        className={`carte px-4 py-3 text-sm font-medium ${
          parfait
            ? 'border-[var(--color-positif)] bg-green-50 text-[var(--color-positif)]'
            : 'border-amber-300 bg-amber-50 text-amber-800'
        }`}
      >
        {parfait
          ? 'Tout est branché. Rien à faire.'
          : 'Ça fonctionne, mais tout n’est pas branché — voyez les lignes en orange.'}
      </p>

      <div className="carte divide-y divide-[var(--color-ligne)]">
        {controles.map((c) => (
          <div key={c.nom} className="flex gap-3 p-4">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${PASTILLE[c.verdict]}`} aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {c.nom}{' '}
                <span className="font-normal text-[var(--color-encre-doux)]">· {MOT[c.verdict]}</span>
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-encre-doux)]">{c.detail}</p>
              {c.remede && (
                <p className="mt-1.5 text-sm font-medium text-amber-800">À faire : {c.remede}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-[var(--color-encre-doux)]">
        Cette page ne modifie rien. Rechargez-la après un changement chez l’hébergeur — le temps
        qu’il redéploie.{' '}
        <Link href="/compte" className="underline">
          Comptes
        </Link>
      </p>
    </div>
  )
}
