'use client'

export default function BoutonImprimer({ petit = false }: { petit?: boolean }) {
  return (
    <button type="button" className={petit ? 'bouton bouton-secondaire text-xs print:hidden' : 'bouton'} onClick={() => window.print()}>
      {petit ? 'Imprimer / PDF' : 'Imprimer ou enregistrer en PDF'}
    </button>
  )
}
