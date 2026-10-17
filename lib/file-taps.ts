import 'server-only'
import { requete } from '@/lib/db'

/**
 * File d'écriture des taps : on les regroupe au lieu de les écrire un à un.
 *
 * Mesuré en test de charge : une écriture par tap, c'est 5 000 requêtes qui
 * s'empilent en mémoire en attendant une des dix connexions à la base, et un
 * serveur gratuit (512 Mo) qui frôle la mort en pleine rafale. Regroupés, les
 * taps partent par paquets — une requête toutes les secondes au plus, ou dès
 * que 500 attendent.
 *
 * Le prix : un tap peut rester une seconde en mémoire avant d'être écrit. Un
 * plantage ou un redéploiement à ce moment-là le perd. C'est un compteur, pas
 * une écriture comptable : l'échange vaut la peine.
 *
 * La file est plafonnée. Si la base ne répond plus du tout, au-delà de
 * PLAFOND taps en attente les nouveaux sont comptés comme perdus plutôt que de
 * faire grossir la mémoire jusqu'au plantage — qui les perdrait tous.
 */
type Tap = { carteId: string; le: Date; canal: 'nfc' | 'qr'; appareil: 'ios' | 'android' | 'autre'; dureeMs: number }

const PAQUET = 500
const DELAI_MS = 1_000
const PLAFOND = 20_000

type Etat = {
  file: Tap[]
  minuterie: ReturnType<typeof setTimeout> | null
  ecriture: Promise<void> | null
  ecrits: number
  perdus: number
}

const globale = globalThis as typeof globalThis & { __fileTaps?: Etat }
const etat = (globale.__fileTaps ??= { file: [], minuterie: null, ecriture: null, ecrits: 0, perdus: 0 })

export function noterTap(tap: Omit<Tap, 'le'>): void {
  if (etat.file.length >= PLAFOND) {
    etat.perdus++
    return
  }
  etat.file.push({ ...tap, le: new Date() })
  if (etat.file.length >= PAQUET) void vider()
  else etat.minuterie ??= setTimeout(() => void vider(), DELAI_MS)
}

async function vider(): Promise<void> {
  if (etat.minuterie) {
    clearTimeout(etat.minuterie)
    etat.minuterie = null
  }
  // Une seule écriture à la fois : la suivante reprendra ce qui reste.
  if (etat.ecriture) return
  const paquet = etat.file.splice(0, PAQUET)
  if (!paquet.length) return

  etat.ecriture = (async () => {
    try {
      // unnest : un seul aller-retour pour tout le paquet. La jointure écarte
      // les taps d'une carte supprimée entre-temps — sans elle, un seul de
      // ces taps ferait échouer le paquet entier, encore et encore.
      await requete(
        `insert into taps (carte_id, tape_le, canal, appareil, duree_ms)
         select u.carte_id, u.tape_le, u.canal, u.appareil, u.duree_ms
           from unnest($1::uuid[], $2::timestamptz[], $3::text[], $4::text[], $5::int[])
                  as u (carte_id, tape_le, canal, appareil, duree_ms)
           join cartes_nfc c on c.id = u.carte_id`,
        [
          paquet.map((t) => t.carteId),
          paquet.map((t) => t.le.toISOString()),
          paquet.map((t) => t.canal),
          paquet.map((t) => t.appareil),
          paquet.map((t) => Math.round(t.dureeMs)),
        ],
      )
      etat.ecrits += paquet.length
    } catch {
      // La base a refusé : on remet le paquet en tête pour le prochain essai,
      // dans la limite du plafond.
      const place = Math.max(0, PLAFOND - etat.file.length)
      etat.file.unshift(...paquet.slice(0, place))
      etat.perdus += paquet.length - Math.min(place, paquet.length)
    } finally {
      etat.ecriture = null
      if (etat.file.length) etat.minuterie ??= setTimeout(() => void vider(), etat.file.length >= PAQUET ? 0 : DELAI_MS)
    }
  })()
}

export function etatFile(): { enAttente: number; ecrits: number; perdus: number } {
  return { enAttente: etat.file.length, ecrits: etat.ecrits, perdus: etat.perdus }
}
