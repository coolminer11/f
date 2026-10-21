import { MODE_PORTAIL } from '@/components/services/portail/cadre-portail'

/** Le squelette du portail pendant le chargement d'un onglet : mêmes proportions que la file, sans saut à l'arrivée. */
export default function ChargementPortail() {
  return (
    <div className="theme-portail -mx-4 -my-6 min-h-screen px-4 py-5 sm:px-6" aria-busy="true" aria-live="polite" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: MODE_PORTAIL }} />
      <div className="mx-auto max-w-6xl">
        <div className="pt-hero px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-center gap-3.5">
            <span className="pt-squelette size-12 rounded-2xl" />
            <div className="space-y-2">
              <span className="pt-squelette block h-3 w-32 rounded-full" />
              <span className="pt-squelette block h-5 w-48 rounded-full" />
            </div>
          </div>
          <span className="pt-squelette mt-5 block h-11 w-full max-w-md rounded-full" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="pt-squelette block h-[5.5rem] rounded-[1.1rem]" />
          ))}
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {[0, 1].map((c) => (
            <div key={c} className="space-y-3">
              <span className="pt-squelette block h-4 w-28 rounded-full" />
              {[0, 1].map((i) => (
                <span key={i} className="pt-squelette block h-48 rounded-[1.4rem]" />
              ))}
            </div>
          ))}
        </div>
        <span className="sr-only">Chargement…</span>
      </div>
    </div>
  )
}
