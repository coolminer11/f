import type { Profil, CarteTotale } from '@/lib/requetes/profil'
import { JOURS, heure, locale, type Langue } from '@/lib/langue'

/**
 * La surprise du jour : un fait vrai, tiré des données du commerce, différent
 * chaque jour. Chaque modèle vérifie qu'il a assez de données pour dire
 * quelque chose de juste — sinon il se retire. Aucun chiffre inventé : les
 * « équivalences » ne font que de l'arithmétique sur les vrais totaux.
 *
 * L'ordre est mélangé une fois par commerce (graine = son id) : deux clients
 * n'ont pas la même surprise le même jour, et un client voit défiler tous les
 * modèles avant d'en revoir un.
 */
export type Surprise = { id: string; emoji: string; titre: string; texte: string }

export type DonneesSurprise = {
  profil: Profil
  cartes: CarteTotale[]
  /** Case jour × heure la plus chargée (jour ISO 1–7). */
  caseForte: { jour: number; heure: number; taps: number } | null
  avisGagnesDepuisPose: number | null
  note: number | null
  avisParSemaine: number | null
  /** Aujourd'hui, jour ISO (1 = lundi). */
  jourIso: number
  aujourdhui: string
}

type Modele = (d: DonneesSurprise, l: Langue) => Omit<Surprise, 'id'> | null

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

function dateLisible(iso: string, l: Langue, avecJour = true): string {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j)).toLocaleDateString(locale(l), {
    ...(avecJour ? { weekday: 'long' } : {}),
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

function moisLisible(ym: string, l: Langue): string {
  const [a, m] = ym.split('-').map(Number)
  const nom = new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString(locale(l), { month: 'long', timeZone: 'UTC' })
  return nom.charAt(0).toUpperCase() + nom.slice(1)
}

/** Combien de fois ce jour de semaine est revenu entre deux dates (incluses). */
function occurrences(debut: string, fin: string, jourIso: number): number {
  const a = new Date(debut + 'T00:00:00Z').getTime()
  const b = new Date(fin + 'T00:00:00Z').getTime()
  let n = 0
  for (let t = a; t <= b; t += 86_400_000) {
    const j = new Date(t).getUTCDay() || 7
    if (j === jourIso) n++
  }
  return n
}

const MODELES: Record<string, Modele> = {
  heureMagique: ({ profil: p }, l) => {
    if (p.total < 20) return null
    const h = p.heures.indexOf(Math.max(...p.heures))
    return l === 'fr'
      ? { emoji: '⏰', titre: `Votre heure magique : ${heure(h, l)}`, texte: `C’est entre ${heure(h, l)} et ${heure((h + 1) % 24, l)} que vos clients tapent le plus : ${pct(p.heures[h], p.total)} % de tous vos taps.` }
      : { emoji: '⏰', titre: `Your magic hour: ${heure(h, l)}`, texte: `Between ${heure(h, l)} and ${heure((h + 1) % 24, l)} is when customers tap most: ${pct(p.heures[h], p.total)}% of all your taps.` }
  },
  jourFort: ({ profil: p }, l) => {
    if (p.total < 30) return null
    const j = p.semaine.indexOf(Math.max(...p.semaine))
    const nom = JOURS[l][j]
    return l === 'fr'
      ? { emoji: '📅', titre: `Le ${nom}, c’est votre jour`, texte: `${pct(p.semaine[j], p.total)} % de tous vos taps tombent un ${nom}. Un jour sur sept… pour bien plus d’un septième du travail.` }
      : { emoji: '📅', titre: `${nom} is your day`, texte: `${pct(p.semaine[j], p.total)}% of all your taps happen on a ${nom}. One day out of seven… doing way more than a seventh of the work.` }
  },
  rapportJours: ({ profil: p }, l) => {
    if (p.total < 50) return null
    const max = Math.max(...p.semaine)
    const min = Math.min(...p.semaine)
    if (min < 5) return null
    const r = max / min
    if (r < 1.5) return null
    const fort = JOURS[l][p.semaine.indexOf(max)]
    const faible = JOURS[l][p.semaine.indexOf(min)]
    const x = r.toLocaleString(locale(l), { maximumFractionDigits: 1 })
    return l === 'fr'
      ? { emoji: '⚖️', titre: `Un ${fort} vaut ${x} ${faible}s`, texte: `Chez vous, le ${fort} fait ${x} fois plus de taps que le ${faible}. Même équipe, même carte — pas la même énergie !` }
      : { emoji: '⚖️', titre: `One ${fort} is worth ${x} ${faible}s`, texte: `Your ${fort}s get ${x}× more taps than your ${faible}s. Same team, same card — different energy!` }
  },
  iphone: ({ profil: p }, l) => {
    const n = p.ios + p.android
    if (n < 20 || p.ios < p.android) return null
    return l === 'fr'
      ? { emoji: '📱', titre: `${pct(p.ios, n)} % d’iPhone`, texte: `La majorité de vos clients tapent avec un iPhone. Petit truc à leur montrer : c’est le HAUT du téléphone qui lit la carte.` }
      : { emoji: '📱', titre: `${pct(p.ios, n)}% iPhone`, texte: `Most of your customers tap with an iPhone. Handy tip to show them: it’s the TOP of the phone that reads the card.` }
  },
  android: ({ profil: p }, l) => {
    const n = p.ios + p.android
    if (n < 20 || p.android <= p.ios) return null
    return l === 'fr'
      ? { emoji: '🤖', titre: `Team Android : ${pct(p.android, n)} %`, texte: `Chez vous, Android l’emporte. Sur ces téléphones, la puce se trouve au milieu du dos : il suffit de poser le téléphone à plat sur la carte.` }
      : { emoji: '🤖', titre: `Team Android: ${pct(p.android, n)}%`, texte: `Android wins at your place. On these phones the reader sits in the middle of the back: just lay the phone flat on the card.` }
  },
  finDeSemaine: ({ profil: p }, l) => {
    if (p.total < 40) return null
    const s = pct(p.fin_de_semaine, p.total)
    if (s >= 35)
      return l === 'fr'
        ? { emoji: '🎉', titre: `${s} % en fin de semaine`, texte: `Samedi et dimanche, c’est 2 jours sur 7 (29 %)… mais chez vous, ils font ${s} % des taps. Vos fins de semaine sont en feu.` }
        : { emoji: '🎉', titre: `${s}% on weekends`, texte: `Saturday and Sunday are 2 days out of 7 (29%)… yet they bring ${s}% of your taps. Your weekends are on fire.` }
    if (s <= 18)
      return l === 'fr'
        ? { emoji: '💼', titre: `${100 - s} % en semaine`, texte: `Votre carte travaille surtout du lundi au vendredi. Une vraie collègue de bureau !` }
        : { emoji: '💼', titre: `${100 - s}% on weekdays`, texte: `Your card works mostly Monday to Friday. A true office colleague!` }
    return null
  },
  rushMidi: ({ profil: p }, l) => {
    if (p.total < 30) return null
    const s = pct(p.midi, p.total)
    if (s < 25) return null
    return l === 'fr'
      ? { emoji: '🥪', titre: `Le rush du midi : ${s} %`, texte: `Entre 11 h et 14 h, vous recevez ${s} % de tous vos taps. Trois heures qui comptent double.` }
      : { emoji: '🥪', titre: `The lunch rush: ${s}%`, texte: `Between 11 am and 2 pm you get ${s}% of all your taps. Three hours that count double.` }
  },
  soiree: ({ profil: p }, l) => {
    if (p.total < 30) return null
    const s = pct(p.soir, p.total)
    if (s < 25) return null
    return l === 'fr'
      ? { emoji: '🌆', titre: `Vos clients du soir : ${s} %`, texte: `${s} % des taps arrivent entre 17 h et 22 h. La journée finit, la carte continue.` }
      : { emoji: '🌆', titre: `Your evening crowd: ${s}%`, texte: `${s}% of taps come between 5 pm and 10 pm. The day winds down, the card keeps going.` }
  },
  matinal: ({ profil: p }, l) => {
    if (p.total < 30) return null
    const s = pct(p.matin, p.total)
    if (s < 20) return null
    return l === 'fr'
      ? { emoji: '🌅', titre: `Des lève-tôt : ${s} %`, texte: `${s} % de vos taps arrivent avant 11 h. Vos clients du matin savent ce qu’ils veulent !` }
      : { emoji: '🌅', titre: `Early birds: ${s}%`, texte: `${s}% of your taps come before 11 am. Your morning crowd means business!` }
  },
  plusTot: ({ profil: p }, l) => {
    if (!p.plus_tot || p.total < 10) return null
    const [h, m] = p.plus_tot.split(':')
    const t = l === 'fr' ? `${Number(h)} h ${m}` : `${Number(h) % 12 || 12}:${m} ${Number(h) < 12 ? 'am' : 'pm'}`
    return l === 'fr'
      ? { emoji: '☕', titre: `Le tap le plus matinal : ${t}`, texte: `Quelqu’un a tapé votre carte à ${t}. Avant même le premier café ?` }
      : { emoji: '☕', titre: `Earliest tap ever: ${t}`, texte: `Someone tapped your card at ${t}. Before their first coffee, even?` }
  },
  plusTard: ({ profil: p }, l) => {
    if (!p.plus_tard || p.plus_tard < '21:00') return null
    const [h, m] = p.plus_tard.split(':')
    const t = l === 'fr' ? `${Number(h)} h ${m}` : `${Number(h) % 12 || 12}:${m} ${Number(h) < 12 ? 'am' : 'pm'}`
    return l === 'fr'
      ? { emoji: '🌙', titre: `Le tap le plus tardif : ${t}`, texte: `Votre carte ne dort jamais vraiment : un client l’a tapée à ${t}.` }
      : { emoji: '🌙', titre: `Latest tap ever: ${t}`, texte: `Your card never really sleeps: someone tapped it at ${t}.` }
  },
  nuit: ({ profil: p }, l) => {
    if (p.nuit < 3) return null
    return l === 'fr'
      ? { emoji: '🦉', titre: `${p.nuit} taps entre 22 h et 5 h`, texte: `Il y a des oiseaux de nuit parmi vos clients. Et ils laissent des avis eux aussi !` }
      : { emoji: '🦉', titre: `${p.nuit} taps between 10 pm and 5 am`, texte: `There are night owls among your customers. And they leave reviews too!` }
  },
  meilleurJour: ({ profil: p }, l) => {
    if (!p.meilleur_jour || p.meilleur_jour_taps < 5) return null
    return l === 'fr'
      ? { emoji: '🏆', titre: `Votre plus grosse journée`, texte: `Le ${dateLisible(p.meilleur_jour, l)} : ${p.meilleur_jour_taps} taps. Vous vous souvenez de ce qui s’est passé ce jour-là ?` }
      : { emoji: '🏆', titre: `Your biggest day`, texte: `${dateLisible(p.meilleur_jour, l)}: ${p.meilleur_jour_taps} taps. Remember what happened that day?` }
  },
  moisFort: ({ profil: p }, l) => {
    if (!p.mois_fort || p.jours_couverts < 40 || p.mois_fort_taps < 10) return null
    const nf = new Intl.NumberFormat(locale(l))
    return l === 'fr'
      ? { emoji: '🗓️', titre: `${moisLisible(p.mois_fort, l)}, votre mois en or`, texte: `${nf.format(p.mois_fort_taps)} taps en un seul mois : votre meilleur à date. Le prochain peut faire mieux.` }
      : { emoji: '🗓️', titre: `${moisLisible(p.mois_fort, l)}, your golden month`, texte: `${nf.format(p.mois_fort_taps)} taps in a single month: your best so far. The next one can beat it.` }
  },
  semaineForte: ({ profil: p }, l) => {
    if (!p.semaine_forte_debut || p.jours_couverts < 14 || p.semaine_forte_taps < 10) return null
    return l === 'fr'
      ? { emoji: '📈', titre: `Votre semaine record`, texte: `La semaine du ${dateLisible(p.semaine_forte_debut, l, false)} : ${p.semaine_forte_taps} taps. C’est la barre à battre.` }
      : { emoji: '📈', titre: `Your record week`, texte: `The week of ${dateLisible(p.semaine_forte_debut, l, false)}: ${p.semaine_forte_taps} taps. That’s the bar to beat.` }
  },
  longueSerie: ({ profil: p }, l) => {
    if (p.plus_longue_serie < 3) return null
    return l === 'fr'
      ? { emoji: '🔥', titre: `${p.plus_longue_serie} jours d’affilée`, texte: `Votre plus longue série : ${p.plus_longue_serie} jours de suite avec au moins un tap. Une vraie machine.` }
      : { emoji: '🔥', titre: `${p.plus_longue_serie} days in a row`, texte: `Your longest streak: ${p.plus_longue_serie} straight days with at least one tap. A real machine.` }
  },
  presqueTousLesJours: ({ profil: p }, l) => {
    if (p.jours_couverts < 10) return null
    const r = p.jours_actifs / p.jours_couverts
    if (r < 0.8) return null
    return l === 'fr'
      ? { emoji: '💪', titre: `${p.jours_actifs} jours sur ${p.jours_couverts}`, texte: `Depuis son premier tap, votre carte a travaillé ${pct(p.jours_actifs, p.jours_couverts)} % des jours. Elle ne prend jamais de pause café.` }
      : { emoji: '💪', titre: `${p.jours_actifs} days out of ${p.jours_couverts}`, texte: `Since its first tap, your card has worked ${pct(p.jours_actifs, p.jours_couverts)}% of days. It never takes a coffee break.` }
  },
  moyenneJourActif: ({ profil: p }, l) => {
    if (p.jours_actifs < 5) return null
    const m = Math.round((p.total / p.jours_actifs) * 10) / 10
    return l === 'fr'
      ? { emoji: '🧮', titre: `${m.toLocaleString('fr-CA')} taps par jour`, texte: `C’est votre moyenne les jours où la carte travaille. Chaque tap, c’est un client qui a pensé à vous.` }
      : { emoji: '🧮', titre: `${m.toLocaleString('en-CA')} taps a day`, texte: `That’s your average on days the card is working. Every tap is a customer thinking of you.` }
  },
  rythmePointe: ({ profil: p }, l) => {
    if (p.jours_actifs < 7) return null
    const h = p.heures.indexOf(Math.max(...p.heures))
    const parJour = p.heures[h] / p.jours_actifs
    if (parJour < 1) return null
    const min = Math.max(1, Math.round(60 / parJour))
    return l === 'fr'
      ? { emoji: '⚡', titre: `Un tap toutes les ${min} minutes`, texte: `C’est le rythme moyen de votre carte entre ${heure(h, l)} et ${heure((h + 1) % 24, l)}, votre heure la plus chargée.` }
      : { emoji: '⚡', titre: `One tap every ${min} minutes`, texte: `That’s your card’s average pace between ${heure(h, l)} and ${heure((h + 1) % 24, l)}, your busiest hour.` }
  },
  boutABout: ({ profil: p }, l) => {
    if (p.total < 120) return null
    const minutes = Math.round(p.total / 60)
    const nf = new Intl.NumberFormat(locale(l))
    return l === 'fr'
      ? { emoji: '⏱️', titre: `${nf.format(minutes)} minutes de taps`, texte: `À une seconde par tap, vos ${nf.format(p.total)} taps mis bout à bout font ${nf.format(minutes)} minutes de taps sans arrêt.` }
      : { emoji: '⏱️', titre: `${nf.format(minutes)} minutes of taps`, texte: `At one second per tap, your ${nf.format(p.total)} taps back to back add up to ${nf.format(minutes)} minutes of non-stop tapping.` }
  },
  escalier: ({ profil: p }, l) => {
    if (p.total < 200) return null
    // Une marche = un tap ; un étage = 16 marches. Pure arithmétique, pour le plaisir.
    const etages = Math.floor(p.total / 16)
    const nf = new Intl.NumberFormat(locale(l))
    return l === 'fr'
      ? { emoji: '🪜', titre: `${nf.format(etages)} étages`, texte: `Si chaque tap était une marche, vos clients auraient monté ${nf.format(etages)} étages (à 16 marches l’étage). Bon cardio !` }
      : { emoji: '🪜', titre: `${nf.format(etages)} floors`, texte: `If every tap were a step, your customers would have climbed ${nf.format(etages)} floors (16 steps a floor). Great cardio!` }
  },
  hausseSemaine: ({ profil: p }, l) => {
    if (p.sept_precedents < 10 || p.sept_jours <= p.sept_precedents) return null
    const e = Math.round(((p.sept_jours - p.sept_precedents) / p.sept_precedents) * 100)
    if (e < 5) return null
    return l === 'fr'
      ? { emoji: '🚀', titre: `+${e} % sur 7 jours`, texte: `${p.sept_jours} taps ces 7 derniers jours, contre ${p.sept_precedents} les 7 d’avant. Ce que vous faites marche !` }
      : { emoji: '🚀', titre: `+${e}% over 7 days`, texte: `${p.sept_jours} taps in the last 7 days, vs ${p.sept_precedents} the 7 before. Whatever you’re doing works!` }
  },
  premierTap: ({ profil: p }, l) => {
    if (!p.premier_tap || p.jours_couverts < 3) return null
    const nf = new Intl.NumberFormat(locale(l))
    return l === 'fr'
      ? { emoji: '🌱', titre: `Il y a ${p.jours_couverts} jours…`, texte: `Le ${dateLisible(p.premier_tap, l, false)}, quelqu’un tapait votre carte pour la toute première fois. Depuis : ${nf.format(p.total)} taps.` }
      : { emoji: '🌱', titre: `${p.jours_couverts} days ago…`, texte: `On ${dateLisible(p.premier_tap, l, false)}, someone tapped your card for the very first time. Since then: ${nf.format(p.total)} taps.` }
  },
  carteStar: ({ profil: p, cartes }, l) => {
    if (cartes.length < 2 || p.total < 30) return null
    const star = cartes.reduce((a, b) => (b.total > a.total ? b : a))
    return l === 'fr'
      ? { emoji: '⭐', titre: `« ${star.libelle} », la star`, texte: `Cette carte fait à elle seule ${pct(star.total, p.total)} % de tout le travail. Elle mérite une augmentation.` }
      : { emoji: '⭐', titre: `“${star.libelle}”, the star`, texte: `This card alone does ${pct(star.total, p.total)}% of all the work. It deserves a raise.` }
  },
  petiteVaillante: ({ cartes }, l) => {
    if (cartes.length < 2) return null
    const actives = cartes.filter((c) => c.total > 0)
    if (actives.length < 2) return null
    const petite = actives.reduce((a, b) => (b.total < a.total ? b : a))
    return l === 'fr'
      ? { emoji: '🐜', titre: `Petite mais vaillante`, texte: `« ${petite.libelle} » est votre carte la plus discrète… et elle a quand même ${petite.total} taps au compteur.` }
      : { emoji: '🐜', titre: `Small but mighty`, texte: `“${petite.libelle}” is your quietest card… and it still has ${petite.total} taps on the clock.` }
  },
  momentSemaine: ({ caseForte }, l) => {
    if (!caseForte || caseForte.taps < 5) return null
    const j = JOURS[l][caseForte.jour - 1]
    return l === 'fr'
      ? { emoji: '🎯', titre: `Le moment le plus chaud`, texte: `De toute la semaine, c’est le ${j} vers ${heure(caseForte.heure, l)} que votre carte est la plus sollicitée.` }
      : { emoji: '🎯', titre: `The hottest moment`, texte: `Of the whole week, ${j} around ${heure(caseForte.heure, l)} is when your card is busiest.` }
  },
  jourMemeNom: ({ profil: p, jourIso, aujourdhui }, l) => {
    if (!p.premier_tap || p.jours_couverts < 21) return null
    const n = occurrences(p.premier_tap, aujourdhui, jourIso)
    if (n < 3) return null
    const moy = Math.round(p.semaine[jourIso - 1] / n)
    if (moy < 2) return null
    const j = JOURS[l][jourIso - 1]
    return l === 'fr'
      ? { emoji: '🎲', titre: `Les ${j}s : ${moy} taps`, texte: `En moyenne, vos ${j}s donnent ${moy} taps. Le défi d’aujourd’hui : faire mieux !` }
      : { emoji: '🎲', titre: `${j}s: ${moy} taps`, texte: `On average, your ${j}s bring ${moy} taps. Today’s challenge: beat it!` }
  },
  avisDepuisPose: ({ avisGagnesDepuisPose: g }, l) => {
    if (!g || g < 1) return null
    return l === 'fr'
      ? { emoji: '💬', titre: `+${g} avis depuis Tapora`, texte: `Chacun de ces ${g} avis est lu par vos futurs clients avant même qu’ils passent la porte.` }
      : { emoji: '💬', titre: `+${g} reviews since Tapora`, texte: `Each of these ${g} reviews is read by future customers before they even walk in.` }
  },
  belleNote: ({ note }, l) => {
    if (note === null || note < 4.5) return null
    const n = note.toLocaleString(locale(l), { minimumFractionDigits: 1 })
    return l === 'fr'
      ? { emoji: '🌟', titre: `${n} ★, rien de moins`, texte: `Avec une note pareille, vos clients font votre publicité à votre place. Il ne reste qu’à leur tendre la carte.` }
      : { emoji: '🌟', titre: `${n} ★, nothing less`, texte: `With a rating like that, your customers do your marketing for you. All that’s left is handing them the card.` }
  },
  avisSemaine: ({ avisParSemaine: a }, l) => {
    if (!a || a < 0.5) return null
    const n = a.toLocaleString(locale(l), { maximumFractionDigits: 1 })
    return l === 'fr'
      ? { emoji: '📬', titre: `≈ ${n} avis par semaine`, texte: `C’est votre rythme actuel sur Google. Chaque semaine, votre fiche devient un peu plus convaincante.` }
      : { emoji: '📬', titre: `≈ ${n} reviews a week`, texte: `That’s your current pace on Google. Every week your profile gets a little more convincing.` }
  },
  sansContact: ({ profil: p }, l) => {
    if (p.total < 20) return null
    const s = pct(p.nfc, p.total)
    if (s < 80) return null
    return l === 'fr'
      ? { emoji: '✨', titre: `${s} % sans contact`, texte: `${s === 100 ? 'Tous vos clients ont' : `${s} % de vos clients ont`} simplement approché leur téléphone : pas d’application, pas d’appareil photo, juste un geste.` }
      : { emoji: '✨', titre: `${s}% contactless`, texte: `${s === 100 ? 'All your customers' : `${s}% of your customers`} simply held their phone close: no app, no camera, just a gesture.` }
  },
  viePrivee: (_, l) =>
    l === 'fr'
      ? { emoji: '🔒', titre: `Zéro donnée personnelle`, texte: `Tapora compte chaque tap sans jamais savoir qui a tapé : ni nom, ni numéro, ni position. Vos clients sont tranquilles.` }
      : { emoji: '🔒', titre: `Zero personal data`, texte: `Tapora counts every tap without ever knowing who tapped: no name, no number, no location. Your customers can relax.` },
  carteVitesse: (_, l) =>
    l === 'fr'
      ? { emoji: '💨', titre: `Une affaire de millisecondes`, texte: `Quand un client tape, la carte répond depuis le centre de données Cloudflare le plus proche : la redirection part en quelques millisecondes.` }
      : { emoji: '💨', titre: `A matter of milliseconds`, texte: `When a customer taps, the card answers from the nearest Cloudflare data centre: the redirect leaves in a few milliseconds.` },
  phraseMagique: (_, l) =>
    l === 'fr'
      ? { emoji: '🗣️', titre: `La phrase qui marche`, texte: `« Si vous avez aimé, un petit tap ici nous aide énormément — ça prend 10 secondes ! » Court, sincère, et ça donne le temps exact.` }
      : { emoji: '🗣️', titre: `The line that works`, texte: `“If you enjoyed it, a quick tap here helps us a ton — it takes 10 seconds!” Short, sincere, and it gives an exact time.` },
}

// ---------------------------------------------------------------------------
// Familles : un modèle qui donne plusieurs surprises (une par jour de la
// semaine, par heure, par carte, par mois…). C'est ce qui permet de tenir
// des mois sans se répéter.
// ---------------------------------------------------------------------------
type Famille = (d: DonneesSurprise, l: Langue) => Surprise[]

const PALIERS_CAP = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000]

const FAMILLES: Famille[] = [
  // Chaque jour de la semaine qui a assez de taps.
  ({ profil: p }, l) =>
    p.total < 50
      ? []
      : p.semaine.flatMap((n, i) => {
          if (n < 10) return []
          const j = JOURS[l][i]
          return [
            l === 'fr'
              ? { id: `jour-${i}`, emoji: '🗓️', titre: `Vos ${j}s en chiffres`, texte: `Depuis le début, vos ${j}s ont donné ${n} taps, soit ${pct(n, p.total)} % de votre semaine.` }
              : { id: `jour-${i}`, emoji: '🗓️', titre: `Your ${j}s in numbers`, texte: `Since the start, your ${j}s brought ${n} taps — ${pct(n, p.total)}% of your week.` },
          ]
        }),
  // Chaque heure qui pèse au moins 4 % des taps.
  ({ profil: p }, l) =>
    p.total < 50
      ? []
      : p.heures.flatMap((n, h) => {
          if (pct(n, p.total) < 4) return []
          return [
            l === 'fr'
              ? { id: `heure-${h}`, emoji: '🕐', titre: `${heure(h, l)} : ${n} taps`, texte: `Entre ${heure(h, l)} et ${heure((h + 1) % 24, l)}, votre carte a déjà été tapée ${n} fois (${pct(n, p.total)} % du total).` }
              : { id: `heure-${h}`, emoji: '🕐', titre: `${heure(h, l)}: ${n} taps`, texte: `Between ${heure(h, l)} and ${heure((h + 1) % 24, l)}, your card has been tapped ${n} times (${pct(n, p.total)}% of the total).` },
          ]
        }),
  // Chaque carte.
  ({ cartes }, l) =>
    cartes.length < 2
      ? []
      : cartes.flatMap((c, i) =>
          c.total < 5
            ? []
            : [
                l === 'fr'
                  ? { id: `carte-${i}`, emoji: '🏷️', titre: `Zoom sur « ${c.libelle} »`, texte: `${c.total} taps depuis sa pose${c.jours_silence === 0 ? ', dont au moins un aujourd’hui' : ''}. Chaque carte a sa personnalité !` }
                  : { id: `carte-${i}`, emoji: '🏷️', titre: `Spotlight on “${c.libelle}”`, texte: `${c.total} taps since it was placed${c.jours_silence === 0 ? ', including at least one today' : ''}. Every card has its own personality!` },
              ],
        ),
  // Prochain cap de taps, et quand on l'atteindra au rythme actuel.
  ({ profil: p, aujourdhui }, l) => {
    const cap = PALIERS_CAP.find((c) => c > p.total)
    if (!cap || p.sept_jours < 3) return []
    const reste = cap - p.total
    const jours = Math.ceil(reste / (p.sept_jours / 7))
    if (jours > 365) return []
    const d = new Date(new Date(aujourdhui + 'T12:00:00Z').getTime() + jours * 86_400_000)
    const date = d.toLocaleDateString(locale(l), { day: 'numeric', month: 'long', timeZone: 'UTC' })
    const nf = new Intl.NumberFormat(locale(l))
    return [
      l === 'fr'
        ? { id: 'cap', emoji: '🎯', titre: `Cap des ${nf.format(cap)} taps`, texte: `Plus que ${nf.format(reste)} taps. Au rythme des 7 derniers jours, vous y serez vers le ${date}.` }
        : { id: 'cap', emoji: '🎯', titre: `${nf.format(cap)}-tap mark`, texte: `Only ${nf.format(reste)} taps to go. At your last-7-days pace, you’ll get there around ${date}.` },
    ]
  },
  // Le saviez-vous : des faits vrais sur la carte et sur les avis.
  (_, l) =>
    (l === 'fr'
      ? [
          ['🔋', 'Pas de pile, jamais', 'Une puce NFC n’a ni pile ni batterie : c’est le téléphone du client qui l’alimente, le temps du tap. Elle ne s’use pas.'],
          ['💳', 'Comme payer sans contact', 'La carte utilise la même technologie que le paiement sans contact. Vos clients font déjà ce geste dix fois par semaine.'],
          ['📶', 'Pas besoin de Wi-Fi', 'Rien à brancher au comptoir : c’est le téléphone du client qui fait tout le travail.'],
          ['📲', 'Aucune application', 'Les iPhone récents et la grande majorité des Android lisent la carte sans rien installer.'],
          ['🛡️', 'À travers l’étui', 'La carte se lit à travers la plupart des étuis de téléphone minces. Pas besoin de l’enlever.'],
          ['🔁', 'Toujours la bonne page', 'La destination de la carte se change à distance, sans la reprogrammer : nouvelle fiche, promo, menu… la carte suit.'],
          ['💬', 'Répondez, ça se voit', 'Répondre aux avis — même en une ligne — montre que vous lisez. Les clients qui le voient sont plus enclins à laisser le leur.'],
          ['😊', 'Le bon moment', 'Demandez un avis à la fin de chaque visite, au moment de payer ou de dire au revoir : le client a encore son expérience en tête. Et demandez-le à tout le monde, c’est la règle de Google.'],
          ['✍️', 'Une phrase suffit', 'Rappelez à vos clients qu’un avis peut tenir en une phrase. Ce qui bloque, c’est souvent la peur d’écrire un roman.'],
          ['👀', 'À hauteur de main', 'Une carte posée là où la main se trouve déjà — caisse, terminal de paiement, table — se fait taper beaucoup plus.'],
          ['🙏', 'Dites merci', 'Un « merci, ça nous aide vraiment ! » après le tap transforme un geste en souvenir. Et un souvenir en client fidèle.'],
          ['👥', 'Toute l’équipe', 'Une carte que toute l’équipe mentionne travaille bien plus qu’une carte qu’on laisse attendre seule sur le comptoir.'],
        ]
      : [
          ['🔋', 'No battery, ever', 'An NFC chip has no battery: the customer’s phone powers it for the moment of the tap. It doesn’t wear out.'],
          ['💳', 'Just like tap to pay', 'The card uses the same technology as contactless payment. Your customers already make this gesture ten times a week.'],
          ['📶', 'No Wi-Fi needed', 'Nothing to plug in at the counter: the customer’s phone does all the work.'],
          ['📲', 'No app', 'Recent iPhones and the vast majority of Android phones read the card without installing anything.'],
          ['🛡️', 'Through the case', 'The card reads through most slim phone cases. No need to take it off.'],
          ['🔁', 'Always the right page', 'The card’s destination can be changed remotely without reprogramming: new profile, promo, menu… the card follows.'],
          ['💬', 'Reply, it shows', 'Replying to reviews — even in one line — shows you read them. Customers who see that are more inclined to leave their own.'],
          ['😊', 'The right moment', 'Ask for a review at the end of every visit, while paying or saying goodbye: the experience is still fresh. And ask everyone — that’s Google’s rule.'],
          ['✍️', 'One sentence is enough', 'Remind customers a review can be one sentence. What holds people back is often the fear of writing an essay.'],
          ['👀', 'Within reach', 'A card placed where hands already are — register, payment terminal, table — gets tapped a lot more.'],
          ['🙏', 'Say thank you', 'A “thanks, that really helps!” after the tap turns a gesture into a memory. And a memory into a loyal customer.'],
          ['👥', 'The whole team', 'A card the whole team mentions works far harder than one left waiting alone on the counter.'],
        ]
    ).map(([emoji, titre, texte], i) => ({ id: `savoir-${i}`, emoji, titre, texte })),
]

function hachage(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Toutes les surprises possibles aujourd'hui, dans l'ordre propre à ce commerce. */
export function surprisesPossibles(d: DonneesSurprise, l: Langue, graine: string): Surprise[] {
  return Object.entries(MODELES)
    .map(([id, m]) => {
      const s = m(d, l)
      return s ? { id, ...s } : null
    })
    .filter((s): s is Surprise => s !== null)
    .concat(FAMILLES.flatMap((f) => f(d, l)))
    .sort((a, b) => hachage(graine + a.id) - hachage(graine + b.id))
}

/** La surprise du jour : une différente chaque jour, toutes avant de revoir la première. */
export function surpriseDuJour(d: DonneesSurprise, l: Langue, graine: string): Surprise | null {
  const liste = surprisesPossibles(d, l, graine)
  if (!liste.length) return null
  const jour = Math.floor(new Date(d.aujourdhui + 'T00:00:00Z').getTime() / 86_400_000)
  return liste[jour % liste.length]
}

export const NB_MODELES = Object.keys(MODELES).length
