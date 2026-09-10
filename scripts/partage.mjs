#!/usr/bin/env node
/**
 * Démarre l'application en la rendant visible sur le réseau local, pour que
 * l'autre associé puisse s'en servir depuis son portable quand vous êtes au
 * même endroit.
 *
 *   npm run partage
 *
 * Cela n'ouvre rien sur Internet : seul votre réseau (le Wi-Fi du bureau, par
 * exemple) y a accès, et il faut toujours un compte pour entrer.
 */
import { networkInterfaces } from 'node:os'
import { spawn } from 'node:child_process'

const adresses = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address)

const port = process.env.PORT || '3000'

console.log(
  [
    '',
    '  Application accessible sur ce réseau :',
    '',
    ...adresses.map((a) => `    http://${a}:${port}`),
    adresses.length === 0 ? '    (aucune adresse réseau détectée)' : '',
    '',
    '  Votre associé ouvre cette adresse depuis son portable ou son téléphone,',
    '  sur le même Wi-Fi. Il lui faut un compte : créez-le dans « Comptes ».',
    '',
    '  Rien n’est exposé sur Internet. La liaison est en clair : c’est sans',
    '  conséquence sur un réseau que vous contrôlez, mais n’ouvrez pas ce port',
    '  sur votre routeur — pour un accès de l’extérieur, il faut un hébergeur.',
    '',
  ]
    .filter((l) => l !== '')
    .join('\n'),
)

spawn('npx', ['next', 'start', '-H', '0.0.0.0', '-p', port], { stdio: 'inherit', shell: true })
