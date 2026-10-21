import type { Metadata, Viewport } from 'next'
import Toasts from '@/components/effets/toasts'
import './services.css'

/**
 * Les pages des clients de Tapora Services : ce qu'on voit en tapant la carte
 * d'une table ou d'une chambre. Jamais indexées ; aucune adresse transmise
 * aux sites vers lesquels elles pointent.
 */
export const metadata: Metadata = {
  title: 'Tapora',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
  formatDetection: { telephone: false, address: false, email: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f3ee' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0b' },
  ],
}

export default function LayoutServices({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toasts />
    </>
  )
}
