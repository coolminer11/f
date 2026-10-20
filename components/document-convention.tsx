import { Fragment, type ReactNode } from 'react'

/** Les [crochets] ressortent : ce sont des propositions à discuter. */
function enLigne(texte: string): ReactNode[] {
  return texte.split(/(\[[^\]\n]{1,80}\])/g).map((bout, i) =>
    /^\[[^\]\n]{1,80}\]$/.test(bout) ? (
      <mark key={i} className="rounded bg-[#fdf0d2] px-1 font-semibold text-[#8a5a00] print:bg-transparent print:px-0 print:text-inherit" title="À confirmer">
        {bout.slice(1, -1)}
      </mark>
    ) : (
      <Fragment key={i}>{bout}</Fragment>
    ),
  )
}

/**
 * La convention mise en page : « # » titre, « ## » article, « - »
 * énumération, le reste en paragraphes.
 */
export default function DocumentConvention({ texte }: { texte: string }) {
  const blocs: ReactNode[] = []
  let liste: string[] = []
  const fermerListe = () => {
    if (!liste.length) return
    blocs.push(
      <ul key={`l${blocs.length}`} className="my-2 space-y-1 pl-5 [list-style:'–__']">
        {liste.map((l, i) => (
          <li key={i} className="pl-1">{enLigne(l)}</li>
        ))}
      </ul>,
    )
    liste = []
  }
  for (const brute of texte.split('\n')) {
    const ligne = brute.trim()
    if (ligne.startsWith('- ')) {
      liste.push(ligne.slice(2))
      continue
    }
    fermerListe()
    if (!ligne) continue
    if (ligne.startsWith('## ')) {
      blocs.push(
        <h2 key={blocs.length} className="mt-7 break-after-avoid font-[family-name:var(--police-fraunces)] text-lg font-semibold">
          {enLigne(ligne.slice(3))}
        </h2>,
      )
    } else if (ligne.startsWith('# ')) {
      blocs.push(
        <h1 key={blocs.length} className="font-[family-name:var(--police-fraunces)] text-2xl font-semibold leading-tight sm:text-3xl">
          {enLigne(ligne.slice(2))}
        </h1>,
      )
    } else {
      blocs.push(
        <p key={blocs.length} className="my-2">
          {enLigne(ligne)}
        </p>,
      )
    }
  }
  fermerListe()
  return <div className="text-[15px] leading-relaxed">{blocs}</div>
}
