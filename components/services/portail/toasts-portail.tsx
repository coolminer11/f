'use client'

import { useEffect, useState } from 'react'
import Toasts from '@/components/effets/toasts'

/**
 * Les pop-ups du portail. Le gabarit racine en pose déjà un quand le
 * propriétaire est connecté au back-office : dans ce cas on ne monte pas le
 * second (sinon chaque pop-up apparaîtrait deux fois).
 */
export default function ToastsPortail() {
  const [monter, setMonter] = useState(false)
  useEffect(() => {
    if (!document.querySelector('.toasts-tapora')) setMonter(true)
  }, [])
  return monter ? <Toasts depuisAdresse /> : null
}
