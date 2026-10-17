#!/usr/bin/env node
/**
 * Test de charge des cartes NFC — à lancer depuis votre Mac, pendant que
 * l'écran « En direct » est ouvert.
 *
 *   npm run stress -- https://go.taporacards.com CODE [taps=500] [simultanes=50]
 *
 * Il envoie des taps « iPhone » à une carte, sans suivre la redirection
 * (on ne bombarde pas Google), et mesure combien ont été servis et en
 * combien de temps.
 *
 * ⚠ Ces taps COMPTENT dans les statistiques de la carte visée. Créez une
 * carte « Test de charge » pour l'occasion, et supprimez-la après : ses
 * statistiques partent avec elle.
 */
const [base, codeBrut, totalBrut = '500', simultanesBrut = '50'] = process.argv.slice(2)
const code = (codeBrut ?? '').toUpperCase()
const total = Number(totalBrut)
const simultanes = Number(simultanesBrut)

if (!base || !/^https?:\/\//.test(base) || !/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
  console.error(
    [
      '',
      '  Usage : npm run stress -- https://go.taporacards.com CODE [taps] [simultanés]',
      '',
      '  Exemple : npm run stress -- https://go.taporacards.com K7M2QX 500 50',
      '',
      '  Utilisez le code d’une carte créée pour le test, jamais celle d’un client :',
      '  les taps du test comptent dans les statistiques.',
      '',
    ].join('\n'),
  )
  process.exit(1)
}
if (!Number.isInteger(total) || total < 1 || total > 20_000) {
  console.error('  Le nombre de taps doit être entre 1 et 20 000.')
  process.exit(1)
}
if (!Number.isInteger(simultanes) || simultanes < 1 || simultanes > 1_000) {
  console.error('  Le nombre de taps simultanés doit être entre 1 et 1 000.')
  process.exit(1)
}

const url = `${base.replace(/\/+$/, '')}/t/${code}`
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

// Un premier appel réveille le serveur s'il dort : sinon, le test mesurerait
// surtout le réveil.
process.stdout.write(`\n  Réveil du serveur… `)
const debutReveil = performance.now()
try {
  const r = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'TaporaStress/1.0 bot' } })
  console.log(`répond en ${Math.round(performance.now() - debutReveil)} ms (HTTP ${r.status})`)
  if (r.status === 404) {
    console.error(`\n  Le code ${code} n’existe pas ou la carte est désactivée.\n`)
    process.exit(1)
  }
} catch (e) {
  console.error(`injoignable : ${e.message}\n`)
  process.exit(1)
}

console.log(`  ${total} taps vers ${url}, ${simultanes} à la fois.\n`)

const durees = []
const erreurs = new Map()
let faits = 0
let suivant = 0
const debut = performance.now()

async function travailleur() {
  while (suivant < total) {
    suivant++
    const t0 = performance.now()
    try {
      const r = await fetch(url, {
        redirect: 'manual',
        headers: { 'user-agent': IPHONE },
        signal: AbortSignal.timeout(30_000),
      })
      await r.arrayBuffer().catch(() => {})
      if (r.status === 302) durees.push(performance.now() - t0)
      else erreurs.set(`HTTP ${r.status}`, (erreurs.get(`HTTP ${r.status}`) ?? 0) + 1)
    } catch (e) {
      const cle = e.name === 'TimeoutError' ? 'délai dépassé (30 s)' : e.cause?.code ?? e.message
      erreurs.set(cle, (erreurs.get(cle) ?? 0) + 1)
    }
    faits++
  }
}

const progression = setInterval(() => {
  const s = (performance.now() - debut) / 1000
  const nbErreurs = [...erreurs.values()].reduce((a, b) => a + b, 0)
  process.stdout.write(
    `\r  ${faits}/${total} · ${(faits / s).toFixed(1)} taps/s · ${nbErreurs} erreur(s)      `,
  )
}, 500)

await Promise.all(Array.from({ length: Math.min(simultanes, total) }, travailleur))
clearInterval(progression)

const secondes = (performance.now() - debut) / 1000
durees.sort((a, b) => a - b)
const centile = (p) => (durees.length ? Math.round(durees[Math.min(durees.length - 1, Math.floor((p / 100) * durees.length))]) : null)
const nbErreurs = [...erreurs.values()].reduce((a, b) => a + b, 0)
const p95 = centile(95)

console.log(
  [
    '',
    '',
    `  Servis         ${durees.length} / ${total}  (${((durees.length / total) * 100).toFixed(1)} %)`,
    `  Débit          ${(total / secondes).toFixed(1)} taps/s sur ${secondes.toFixed(1)} s`,
    `  Médiane        ${centile(50) ?? '—'} ms`,
    `  95 % sous      ${p95 ?? '—'} ms`,
    `  99 % sous      ${centile(99) ?? '—'} ms`,
    `  Pire           ${durees.length ? Math.round(durees[durees.length - 1]) : '—'} ms`,
    ...(nbErreurs ? ['', '  Erreurs', ...[...erreurs].map(([k, v]) => `    ${k} : ${v}`)] : []),
    '',
    nbErreurs > total * 0.01 || (p95 ?? 0) > 3000
      ? '  → Le serveur NE SUIT PAS à cette charge. Un client au comptoir aurait attendu ou abandonné.'
      : (p95 ?? 0) > 1000
        ? '  → Ça passe, mais lentement : à cette charge, certains clients attendent plus d’une seconde.'
        : '  → Le serveur suit sans problème à cette charge.',
    '',
    '  Supprimez la carte de test pour retirer ces taps des statistiques.',
    '',
  ].join('\n'),
)
