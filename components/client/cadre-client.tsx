import { cookies } from 'next/headers'
import { fraunces, inter } from '@/app/stats/polices'

export type Mode = 'clair' | 'sombre'

/** Le choix du client (bouton soleil/lune), retenu dans un cookie ; sinon, rien : on suit le téléphone. */
export async function modeClient(): Promise<Mode | undefined> {
  const v = (await cookies()).get('tapora_mode')?.value
  return v === 'clair' || v === 'sombre' ? v : undefined
}

// Sans choix enregistré, le mode du téléphone est posé AVANT le premier
// affichage (le script s'exécute pendant la lecture de la page) : aucun
// éclair blanc la nuit.
const RESOUDRE = `(function(){try{var e=document.currentScript.parentElement;if(!e.getAttribute('data-mode')){e.setAttribute('data-mode',matchMedia('(prefers-color-scheme: dark)').matches?'sombre':'clair');e.setAttribute('data-auto','1')}}catch(_){}})()`

/**
 * Le cadre de toutes les pages du client (statistiques, mot de passe,
 * espace client) : polices, thème, et mode clair ou sombre. `force` fige un
 * mode (les écrans « Votre année » et comptoir ont leur propre décor).
 */
export default async function CadreClient({ children, lang, force }: { children: React.ReactNode; lang: string; force?: Mode }) {
  const mode = force ?? (await modeClient())
  return (
    <div className={`${fraunces.variable} ${inter.variable} theme-client`} lang={lang} data-mode={mode} suppressHydrationWarning>
      {!mode && <script dangerouslySetInnerHTML={{ __html: RESOUDRE }} />}
      {children}
    </div>
  )
}
