import type { Metadata, Viewport } from 'next'
import './portail.css'
import ToastsPortail from '@/components/services/portail/toasts-portail'

export const metadata: Metadata = {
  title: 'Portail du personnel — Tapora',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f2ed' },
    { media: '(prefers-color-scheme: dark)', color: '#07070a' },
  ],
}

/** Le portail du personnel de chaque établissement (Tapora Services). */
export default function GabaritPortail({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastsPortail />
    </>
  )
}
