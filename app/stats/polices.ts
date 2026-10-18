import localFont from 'next/font/local'

// Les polices du site taporacards.com, servies par l'application elle-même.
export const fraunces = localFont({
  src: [
    { path: '../polices/fraunces.woff2', style: 'normal', weight: '100 900' },
    { path: '../polices/fraunces-italique.woff2', style: 'italic', weight: '100 900' },
  ],
  variable: '--police-fraunces',
  display: 'swap',
})
export const inter = localFont({ src: '../polices/inter.woff2', weight: '100 900', variable: '--police-inter', display: 'swap' })
