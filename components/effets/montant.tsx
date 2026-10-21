'use client'

import Compteur from '@/components/effets/compteur'

const CAD = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' })

/** Un montant en dollars qui roule jusqu'à sa valeur (pour les pages serveur, qui ne passent pas de fonction). */
export default function MontantAnime({ valeur, className = '' }: { valeur: number; className?: string }) {
  return <Compteur valeur={valeur} format={(v) => CAD.format(v).replace('-', '−')} className={className} />
}
