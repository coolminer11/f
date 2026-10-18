import type { CarteTotale, Profil } from '@/lib/requetes/profil'
import { JOURS, heure, locale, type Langue } from '@/lib/langue'

/**
 * Les conseils : ce que le commerce peut FAIRE cette semaine pour avoir plus
 * de taps et plus d'avis, déduit de SES chiffres. Chaque règle ne parle que
 * si ses données le justifient ; on en montre trois, les plus urgentes
 * d'abord. Quand il y a peu de données, des conseils généraux prennent le
 * relais, en rotation.
 */
export type Conseil = { id: string; priorite: number; emoji: string; titre: string; texte: string }

export type DonneesConseils = {
  profil: Profil
  cartes: CarteTotale[]
  aujourdhui: number
  serie: number
  /** Heure actuelle au Québec (0–23). */
  heureLocale: number
  avisGagnes14j: number | null
  taps14j: number
  /** Avis 5 ★ estimés pour la prochaine note, si suivie. */
  prochaineNote: { cible: number; estimation: number } | null
  jourAnnee: number
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

export function conseils(d: DonneesConseils, l: Langue, combien = 3): Conseil[] {
  const fr = l === 'fr'
  const p = d.profil
  const liste: Conseil[] = []
  const ajouter = (c: Conseil) => liste.push(c)

  // 1. Une série qui attend son tap du jour.
  if (d.serie >= 3 && d.aujourdhui === 0 && d.heureLocale >= 13) {
    ajouter({
      id: 'serie',
      priorite: 1,
      emoji: '🔥',
      titre: fr ? `Votre série de ${d.serie} jours attend son tap` : `Your ${d.serie}-day streak needs today’s tap`,
      texte: fr
        ? 'Pas encore de tap aujourd’hui. Un petit rappel à l’équipe, et la série continue !'
        : 'No tap yet today. A quick reminder to the team and the streak lives on!',
    })
  }

  // 2. Une carte qui dort.
  const dort = d.cartes
    .filter((c) => c.jours_silence !== null && c.jours_silence >= 5 && c.total > 0)
    .sort((a, b) => (b.jours_silence ?? 0) - (a.jours_silence ?? 0))[0]
  if (dort) {
    ajouter({
      id: 'dort',
      priorite: 2,
      emoji: '😴',
      titre: fr ? `« ${dort.libelle} » se repose depuis ${dort.jours_silence} jours` : `“${dort.libelle}” has been resting for ${dort.jours_silence} days`,
      texte: fr
        ? 'Est-elle encore bien en vue ? Essayez-la près de la caisse ou du terminal de paiement, là où les mains se trouvent déjà.'
        : 'Is it still in plain sight? Try it near the register or payment terminal, where hands already are.',
    })
  }

  // 3. Tendance de la semaine.
  if (p.sept_precedents >= 10) {
    const e = Math.round(((p.sept_jours - p.sept_precedents) / p.sept_precedents) * 100)
    if (e <= -20)
      ajouter({
        id: 'baisse',
        priorite: 2,
        emoji: '📣',
        titre: fr ? `${e} % de taps cette semaine` : `${e}% taps this week`,
        texte: fr
          ? 'Rien d’alarmant : un rappel à l’équipe et un coup d’œil à l’emplacement de la carte suffisent souvent à repartir.'
          : 'Nothing alarming: a reminder to the team and a quick check of where the card sits usually gets things going again.',
      })
    else if (e >= 15)
      ajouter({
        id: 'hausse',
        priorite: 5,
        emoji: '🚀',
        titre: fr ? `+${e} % cette semaine` : `+${e}% this week`,
        texte: fr ? 'Ce que vous faites en ce moment marche. Continuez exactement comme ça !' : 'Whatever you’re doing right now works. Keep it up exactly like that!',
      })
  }

  // 4. Tout près de la note suivante.
  if (d.prochaineNote && d.prochaineNote.estimation <= 15) {
    const n = (d.prochaineNote.cible / 10).toLocaleString(locale(l), { minimumFractionDigits: 1 })
    ajouter({
      id: 'note',
      priorite: 3,
      emoji: '⭐',
      titre: fr ? `≈ ${d.prochaineNote.estimation} avis 5 ★ pour ${n} ★` : `≈ ${d.prochaineNote.estimation} five-star reviews to ${n} ★`,
      texte: fr
        ? 'Vous êtes tout près. C’est la semaine idéale pour rappeler la carte à chaque client, à la fin de chaque visite.'
        : 'You’re very close. This is the perfect week to mention the card to every customer, at the end of every visit.',
    })
  }

  // 5. Des taps, mais plus d'avis.
  if (d.avisGagnes14j === 0 && d.taps14j >= 20) {
    ajouter({
      id: 'avis',
      priorite: 3,
      emoji: '✍️',
      titre: fr ? 'Des taps, mais pas de nouvel avis en 2 semaines' : 'Taps, but no new review in 2 weeks',
      texte: fr
        ? 'Dites « une phrase et 5 étoiles, c’est parfait ! » : ça enlève la pression d’écrire, et le client va jusqu’au bout.'
        : 'Say “one sentence and 5 stars is perfect!”: it takes away the pressure of writing, and customers follow through.',
    })
  }

  // 6. Le bon moment pour demander : la plage de deux heures la plus forte.
  if (p.total >= 30) {
    let meilleure = 0
    for (let h = 1; h < 23; h++) if (p.heures[h] + p.heures[h + 1] > p.heures[meilleure] + p.heures[meilleure + 1]) meilleure = h
    const part = pct(p.heures[meilleure] + p.heures[meilleure + 1], p.total)
    ajouter({
      id: 'moment',
      priorite: 4,
      emoji: '⏰',
      titre: fr ? `Demandez entre ${heure(meilleure, l)} et ${heure((meilleure + 2) % 24, l)}` : `Ask between ${heure(meilleure, l)} and ${heure((meilleure + 2) % 24, l)}`,
      texte: fr
        ? `${part} % de vos taps arrivent dans ces deux heures : c’est là que vos clients sont le plus réceptifs.`
        : `${part}% of your taps happen in those two hours: that’s when customers are most receptive.`,
    })
  }

  // 7. Le jour faible.
  if (p.total >= 70) {
    const moyenne = p.total / 7
    const min = Math.min(...p.semaine)
    const j = p.semaine.indexOf(min)
    const e = Math.round(((min - moyenne) / moyenne) * 100)
    if (e <= -35)
      ajouter({
        id: 'jour',
        priorite: 4,
        emoji: '📅',
        titre: fr ? `Le ${JOURS[l][j]}, votre jour le plus calme` : `${JOURS[l][j]}, your quietest day`,
        texte: fr
          ? `${e} % par rapport à votre moyenne. Glissez un mot à l’équipe de ce jour-là : c’est là qu’il y a le plus à gagner.`
          : `${e}% vs your average. Have a word with that day’s team: that’s where there’s the most to gain.`,
      })
  }

  // 8. Le bon geste selon le téléphone.
  const tel = p.ios + p.android
  if (tel >= 20) {
    const ios = p.ios >= p.android
    ajouter({
      id: 'geste',
      priorite: 6,
      emoji: '📱',
      titre: fr ? `${pct(ios ? p.ios : p.android, tel)} % ${ios ? 'd’iPhone' : 'd’Android'} : montrez le geste` : `${pct(ios ? p.ios : p.android, tel)}% ${ios ? 'iPhone' : 'Android'}: show the gesture`,
      texte: ios
        ? fr
          ? 'Sur iPhone, c’est le HAUT du téléphone qui lit la carte. Une démo de deux secondes et le client ne cherche plus.'
          : 'On iPhone, the TOP of the phone reads the card. A two-second demo and customers stop fumbling.'
        : fr
          ? 'Sur Android, la puce est au milieu du dos : posez le téléphone à plat sur la carte.'
          : 'On Android, the reader is in the middle of the back: lay the phone flat on the card.',
    })
  }

  // 9. Fins de semaine fortes : l'équipe du week-end doit connaître la carte.
  if (p.total >= 40 && pct(p.fin_de_semaine, p.total) >= 38) {
    ajouter({
      id: 'weekend',
      priorite: 5,
      emoji: '🎉',
      titre: fr ? `${pct(p.fin_de_semaine, p.total)} % de vos taps la fin de semaine` : `${pct(p.fin_de_semaine, p.total)}% of your taps on weekends`,
      texte: fr
        ? 'Assurez-vous que l’équipe du samedi et du dimanche connaît bien la carte : c’est elle qui en tire le plus.'
        : 'Make sure your Saturday and Sunday team knows the card well: they get the most out of it.',
    })
  }

  // 10. Conseils généraux, en rotation (toujours disponibles).
  const generaux: [string, string, string][] = fr
    ? [
        ['🗣️', 'La phrase qui marche', '« Si vous avez aimé, un petit tap ici nous aide énormément — ça prend 10 secondes ! »'],
        ['😊', 'Demandez au bon moment', 'À la fin de la visite, au paiement ou au revoir : l’expérience est encore fraîche. Et à tout le monde — Google interdit de ne demander qu’aux clients satisfaits.'],
        ['👀', 'À hauteur de main', 'Posez la carte là où la main est déjà : à côté du terminal de paiement, sur la table, au comptoir.'],
        ['💬', 'Répondez aux avis', 'Une réponse, même courte, montre que vous lisez. Ça encourage les suivants.'],
        ['🙏', 'Remerciez de vive voix', '« Merci, ça nous aide vraiment ! » : le client repart avec un bon souvenir… et revient.'],
        ['👥', 'Toute l’équipe dans le coup', 'Un rappel de 30 secondes à la réunion du matin, et chaque employé devient ambassadeur de la carte.'],
      ]
    : [
        ['🗣️', 'The line that works', '“If you enjoyed it, a quick tap here helps us a ton — it takes 10 seconds!”'],
        ['😊', 'Ask at the right moment', 'At the end of the visit, at checkout or goodbye: the experience is still fresh. And ask everyone — Google forbids asking only happy customers.'],
        ['👀', 'Within reach', 'Put the card where hands already are: next to the payment terminal, on the table, at the counter.'],
        ['💬', 'Reply to reviews', 'A reply, even a short one, shows you read them. It encourages the next ones.'],
        ['🙏', 'Say thanks out loud', '“Thanks, that really helps!”: customers leave with a good memory… and come back.'],
        ['👥', 'Get the whole team in', 'A 30-second reminder at the morning huddle and every employee becomes a card ambassador.'],
      ]
  for (let i = 0; i < generaux.length; i++) {
    const k = (d.jourAnnee + i) % generaux.length
    const [emoji, titre, texte] = generaux[k]
    ajouter({ id: `general-${k}`, priorite: 7 + i, emoji, titre, texte })
  }

  return liste.sort((a, b) => a.priorite - b.priorite).slice(0, combien)
}
