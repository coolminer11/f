import Logo from '@/components/client/logo'

/**
 * La page client en squelette : affichée tout de suite (pendant que le
 * serveur réunit les chiffres), puis gardée en voile jusqu'au début des
 * animations. Mêmes proportions que la vraie page : rien ne saute.
 */
export default function SqueletteClient() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-10" aria-hidden>
      <div className="flex items-center justify-between gap-3 pt-10">
        <span className="flex items-center gap-2.5">
          <Logo />
          <span className="titre-client text-xl font-semibold">Tapora</span>
        </span>
        <span className="squelette h-11 w-64 max-w-[55%] !rounded-full" />
      </div>
      <span className="squelette mt-12 block h-5 w-56" />
      <span className="squelette block h-14 w-4/5 max-w-xl" />
      <span className="squelette block h-5 w-2/3 max-w-lg" />
      <div className="grid grid-cols-2 gap-4 pt-4 lg:grid-cols-4">
        <span className="squelette col-span-2 h-40" />
        <span className="squelette h-40" />
        <span className="squelette h-40" />
      </div>
      <span className="squelette block h-64" />
      <span className="squelette block h-48" />
    </div>
  )
}
