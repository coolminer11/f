'use client'

import { useRef } from 'react'
import { useLieu } from './contexte'
import { balise } from './outils'

export type RubriqueVivante = { id: string; icone: string; titre: string; texte: string; lien: string | null; domaine: string | null; tel: string | null; telAffiche: string | null }
export type GroupeConcierge = { type: string; icone: string; nom: string; rubriques: RubriqueVivante[] }

/**
 * Le concierge : les rubriques rangées par genre (horaires, services, bonnes
 * adresses…). Chaque rubrique s'ouvre en accordéon — comptée une fois par
 * affichage —, avec son numéro (tel:) et son lien (https seulement).
 */
export default function ListeConcierge({ groupes }: { groupes: GroupeConcierge[] }) {
  const { code, langue, t } = useLieu()
  const vues = useRef(new Set<string>())
  return (
    <div className="space-y-8">
      {groupes.map((g) => (
        <section key={g.type} aria-labelledby={`groupe-${g.type}`}>
          <h2 id={`groupe-${g.type}`} className="sv-groupe-titre">
            <span aria-hidden>{g.icone}</span>
            {g.nom}
          </h2>
          <div className="mt-3 space-y-2.5 cascade">
            {g.rubriques.map((r) => (
              <details
                key={r.id}
                className="sv-rubrique"
                onToggle={(e) => {
                  if (!(e.currentTarget as HTMLDetailsElement).open || vues.current.has(r.id)) return
                  vues.current.add(r.id)
                  balise(code, 'rubrique', r.id, langue)
                }}
              >
                <summary>
                  <span className="sv-rubrique-icone" aria-hidden>
                    {r.icone}
                  </span>
                  <span className="min-w-0 flex-1 font-semibold leading-snug">{r.titre}</span>
                </summary>
                <div className="sv-rubrique-corps">
                  {r.texte && <p className="whitespace-pre-line leading-relaxed text-[0.95rem]">{r.texte}</p>}
                  {(r.tel || r.lien) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {r.tel && (
                        <a href={`tel:${r.tel}`} className="sv-bouton sv-bouton-mini">
                          <span aria-hidden>📞</span>
                          {r.telAffiche ?? t.appeler}
                        </a>
                      )}
                      {r.lien && (
                        <a href={r.lien} target="_blank" rel="noopener noreferrer" className="sv-bouton sv-bouton-2 sv-bouton-mini">
                          <span aria-hidden>↗</span>
                          {r.domaine ?? t.ouvrir}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
