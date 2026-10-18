#!/usr/bin/env node
/**
 * IndexNow : prévient Bing (et Yandex, Seznam, Naver) que le site a changé,
 * pour qu'ils le relisent en quelques minutes au lieu de quelques semaines.
 * Bing alimente aussi la recherche de ChatGPT et de Copilot.
 *
 *   npm run indexnow        (lancé tout seul après « npm run deployer »)
 *
 * La clé n'est pas un secret : elle est publiée à la racine du site
 * (public/<clé>.txt), c'est ce qui prouve que le site est bien à nous.
 * Un échec ne bloque jamais le déploiement.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const ICI = path.dirname(new URL(import.meta.url).pathname)
const CLE = 'eebdc1806e3368c7f99d1d3917fa67d3'
const HOTE = 'taporacards.com'

try {
  const sitemap = await readFile(path.join(ICI, 'public', 'sitemap.xml'), 'utf8')
  const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOTE, key: CLE, keyLocation: `https://${HOTE}/${CLE}.txt`, urlList }),
    signal: AbortSignal.timeout(15_000),
  })
  // 200 : reçu ; 202 : reçu, clé en cours de vérification (normal la 1re fois).
  console.log(`IndexNow : ${urlList.length} adresses envoyées → HTTP ${r.status}`)
} catch (e) {
  console.log('IndexNow : envoi impossible pour l’instant (' + (e instanceof Error ? e.message : e) + '). Le site, lui, est bien déployé.')
}
