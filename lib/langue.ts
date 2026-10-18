/**
 * Les textes de la page client, en français et en anglais.
 *
 * Le back-office reste en français : seuls la page /stats/<jeton> et les
 * composants qu'elle affiche (graphiques, avis, paliers…) passent par ici.
 * Fichier sans dépendance serveur : les composants client l'importent aussi.
 */
export type Langue = 'fr' | 'en'

export function langueValide(v: string | null | undefined): Langue | null {
  return v === 'fr' || v === 'en' ? v : null
}

export const locale = (l: Langue) => (l === 'en' ? 'en-CA' : 'fr-CA')

/** « 14 h » en français, « 2 pm » en anglais. */
export function heure(h: number, l: Langue): string {
  if (l === 'fr') return `${h} h`
  return `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`
}

/** Une plage horaire : « de 14 h à 15 h » / « 2 pm to 3 pm ». */
export function plage(h: number, l: Langue): string {
  return l === 'fr' ? `de ${h} h à ${(h + 1) % 24} h` : `${heure(h, l)} to ${heure((h + 1) % 24, l)}`
}

export const JOURS: Record<Langue, string[]> = {
  fr: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
}
export const JOURS_COURTS: Record<Langue, string[]> = {
  fr: ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
}

function dateDe(iso: string): Date {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j))
}
export function dateCourte(iso: string, l: Langue): string {
  return dateDe(iso).toLocaleDateString(locale(l), { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
export function dateLongue(iso: string, l: Langue): string {
  return dateDe(iso).toLocaleDateString(locale(l), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

/** « il y a 3 min » / « 3 min ago ». */
export function depuisL(iso: string | null, l: Langue): string {
  const fr = l === 'fr'
  if (!iso) return fr ? 'jamais' : 'never'
  const secondes = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (secondes < 60) return fr ? 'à l’instant' : 'just now'
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return fr ? `il y a ${minutes} min` : `${minutes} min ago`
  const heures = Math.round(minutes / 60)
  if (heures < 24) return fr ? `il y a ${heures} h` : `${heures} h ago`
  const jours = Math.round(heures / 24)
  if (jours === 1) return fr ? 'hier' : 'yesterday'
  if (jours < 30) return fr ? `il y a ${jours} jours` : `${jours} days ago`
  return new Date(iso).toLocaleDateString(locale(l), { day: 'numeric', month: 'long', timeZone: 'America/Toronto' })
}

const s = (n: number) => (n > 1 ? 's' : '')

const fr = {
  titre: 'Vos statistiques — Tapora Cards',
  periode: (p: number) => `${p} jours`,
  etiquette: 'Vos statistiques, en direct',
  sousTitre: (n: number) => `${n} carte${s(n)} sur place · chaque tap compte, dès la seconde où il arrive.`,
  desabonne: 'C’est noté : vous ne recevrez plus le rapport mensuel. Cette page reste accessible.',
  tapsPeriode: (j: number) => `Taps, ${j} derniers jours`,
  premiersTaps: '▲ vos premiers taps',
  bientot: 'Les premiers taps arrivent bientôt',
  stable: '= stable par rapport à la période précédente',
  ecart: (e: number, j: number) => `${e > 0 ? '▲ +' : '▼ −'}${Math.abs(e)} % par rapport aux ${j} jours précédents`,
  parJour: 'Par jour, en moyenne',
  dernierTap: 'dernier tap',
  parQr: 'Par code QR',
  resteNfc: 'le reste par la puce NFC',
  vosCartes: 'Vos cartes',
  vosCartesSous: (j: number) => `Taps sur ${j} jours, et depuis la pose`,
  auTotal: 'au total',
  faitPar: 'Fait avec soin par',
  viePrivee: 'aucune donnée personnelle de vos clients n’est conservée',
  desabonner: 'Ne plus recevoir le rapport mensuel',
  langueAutre: 'English',
  // En direct
  direct: 'En direct',
  reconnexion: 'Reconnexion…',
  aujourdhui: 'Aujourd’hui',
  tapsAujourdhui: (n: number) => `tap${s(n)} aujourd’hui`,
  hierMemeHeure: (n: number) => `${n} hier à la même heure`,
  devantHier: 'Déjà plus qu’hier à la même heure',
  serie: 'Série',
  serieJours: (n: number) => `${n} jour${s(n)} de suite`,
  serieUnite: (n: number) => `jour${s(n)} de suite`,
  serieAide: 'jours d’affilée avec au moins un tap',
  record: 'Record',
  recordJour: (n: number, jour: string) => `${n} taps · ${jour}`,
  nouveauRecord: 'Nouveau record aujourd’hui !',
  recordEgal: 'Record égalé aujourd’hui',
  // Paliers
  prochainPalier: 'Prochain palier',
  objectif: 'Votre objectif',
  avisGoogle: 'avis Google',
  plusQue: (n: number) => `Plus que ${n} avis`,
  rythme: (date: string) => `À ce rythme, vous y serez vers le ${date}`,
  depart: (n: number) => `depuis ${n}`,
  objectifAtteint: 'Objectif atteint, bravo !',
  paliersAvis: 'Paliers d’avis',
  trophees: 'Trophées de taps',
  atteint: 'atteint',
  aVenir: 'à venir',
  paliersSous: 'Chaque palier débloqué reste ici. Le prochain est déjà en vue.',
  bravoAvis: (n: string) => `${n} avis Google !`,
  bravoTaps: (n: string) => `${n} taps au compteur !`,
  bravo: 'Bravo',
  bravoSous: 'Un nouveau palier débloqué. Vos clients vous adorent — et ça se voit.',
  fermer: 'Fermer',
  // Avis
  avisGagnes: (j: number) => `Avis gagnés, ${j} derniers jours`,
  surFiche: 'sur la fiche Google',
  avisTotal: 'Avis au total',
  fiches: (n: number) => `${n} fiches`,
  noteGoogle: 'Note Google',
  voirCartes: 'voir chaque carte',
  moyenneFiche: '★ moyenne de la fiche',
  avisPour100: 'Avis pour 100 taps',
  surPeriode: 'sur la période',
  nbAvis: 'Nombre d’avis Google',
  nbAvisSous: (j: number, d: string) => `${j} derniers jours · dernier relevé ${d}`,
  nbAvisResume: (j: number, a: number, b: number) => `Nombre d’avis Google sur ${j} jours : de ${a} à ${b}.`,
  unAvis: 'avis',
  // Graphiques des taps
  tapsParJour: 'Taps par jour',
  tapsParJourSous: (j: number) => `${j} derniers jours, heure du Québec`,
  tapsParJourResume: (j: number, n: number) => `Taps par jour sur ${j} jours, ${n} au total.`,
  quand: 'Quand les clients tapent',
  momentFort: (jour: string, p: string) => `Moment le plus fort : le ${jour} ${p}`,
  pasAssezGrille: 'Jour × heure, sur la période — pas encore assez de taps pour dégager une tendance',
  grilleResume: (j: number) => `Taps par jour de la semaine et par heure, sur ${j} jours.`,
  affluence: 'Heures d’affluence',
  pointe: (p: string) => `Pointe ${p}`,
  pasAssez: 'Pas encore assez de taps pour dégager une tendance',
  heureResume: 'Répartition des taps selon l’heure de la journée.',
  joursSemaine: 'Jours de la semaine',
  jourFort: (jour: string) => `Le ${jour} est le jour le plus actif`,
  semaineResume: 'Répartition des taps selon le jour de la semaine.',
  puceQr: 'Puce ou code QR',
  puceQrSous: 'Le QR rattrape les téléphones dont le NFC est éteint ou absent.',
  puce: 'Puce NFC',
  qr: 'Code QR',
  puceQrResume: (a: number, b: number) => `${a} taps par la puce, ${b} par le code QR.`,
  telephones: 'Téléphones',
  telephonesSous: 'Type d’appareil, sans rien qui identifie la personne.',
  autre: 'Autre',
  telephonesResume: (a: number, b: number, c: number) => `${a} iPhone, ${b} Android, ${c} autres.`,
  cumul: 'Taps cumulés depuis la pose',
  cumulSous: (n: string, d: string) => `${n} taps depuis le ${d}`,
  cumulSerie: 'Taps cumulés',
  cumulResume: (n: number) => `Taps cumulés depuis la pose : ${n} au total.`,
  // Graphiques (composants)
  aucunTap: 'Aucun tap sur la période',
  voirDonnees: 'Voir les données',
  moins: 'Moins',
  plus: 'Plus',
  caseForte: (n: string) => `case la plus foncée : ${n} taps`,
  taps: 'taps',
  // Commander
  commanderTitre: 'Envie d’en ajouter ?',
  commanderSous: 'Une carte de plus à la caisse, sur chaque table, en terrasse… Plus il y a de cartes, plus il y a d’avis.',
  combien: 'Combien de cartes ?',
  autreQte: 'Autre',
  motPourNous: 'Un mot pour nous (facultatif)',
  motExemple: 'Ex. : une pour la terrasse, deux pour les tables…',
  envoyerDemande: 'Envoyer la demande',
  envoi: 'Envoi…',
  sansPaiement: 'Aucun paiement maintenant : on vous confirme le prix avant.',
  merci: 'Merci, c’est reçu !',
  merciSous: 'On vous écrit très vite pour confirmer.',
  erreurQte: 'Choisissez entre 1 et 500 cartes.',
  erreurTrop: 'Plusieurs demandes déjà reçues aujourd’hui : on vous revient très vite.',
  erreurLien: 'Ce lien n’est plus valide.',
  // Écran d'accueil
  installTitre: 'Vos stats, à un tap',
  installSous: 'Ajoutez cette page à votre écran d’accueil : elle s’ouvre comme une app.',
  installer: 'Ajouter',
  plusTard: 'Plus tard',
  iosEtape1: 'Touchez',
  iosPartager: 'Partager',
  iosEtape2: 'puis « Sur l’écran d’accueil »',
  iosEtape3: 'et « Ajouter ». C’est tout !',
}

export type Textes = typeof fr

const en: Textes = {
  titre: 'Your stats — Tapora Cards',
  periode: (p) => `${p} days`,
  etiquette: 'Your stats, live',
  sousTitre: (n) => `${n} card${s(n)} in place · every tap counts, the second it happens.`,
  desabonne: 'Done: you won’t receive the monthly report anymore. This page stays available.',
  tapsPeriode: (j) => `Taps, last ${j} days`,
  premiersTaps: '▲ your first taps',
  bientot: 'Your first taps are on their way',
  stable: '= steady compared to the previous period',
  ecart: (e, j) => `${e > 0 ? '▲ +' : '▼ −'}${Math.abs(e)}% vs the previous ${j} days`,
  parJour: 'Per day, on average',
  dernierTap: 'last tap',
  parQr: 'By QR code',
  resteNfc: 'the rest by NFC chip',
  vosCartes: 'Your cards',
  vosCartesSous: (j) => `Taps over ${j} days, and since installation`,
  auTotal: 'all time',
  faitPar: 'Made with care by',
  viePrivee: 'no personal data about your customers is ever stored',
  desabonner: 'Stop the monthly report',
  langueAutre: 'Français',
  direct: 'Live',
  reconnexion: 'Reconnecting…',
  aujourdhui: 'Today',
  tapsAujourdhui: (n) => `tap${s(n)} today`,
  hierMemeHeure: (n) => `${n} yesterday by this time`,
  devantHier: 'Already ahead of yesterday',
  serie: 'Streak',
  serieJours: (n) => `${n} day${s(n)} in a row`,
  serieUnite: (n) => `day${s(n)} in a row`,
  serieAide: 'days in a row with at least one tap',
  record: 'Best day',
  recordJour: (n, jour) => `${n} taps · ${jour}`,
  nouveauRecord: 'New record today!',
  recordEgal: 'Record tied today',
  prochainPalier: 'Next milestone',
  objectif: 'Your goal',
  avisGoogle: 'Google reviews',
  plusQue: (n) => `Only ${n} review${s(n)} to go`,
  rythme: (date) => `At this pace, you’ll get there around ${date}`,
  depart: (n) => `from ${n}`,
  objectifAtteint: 'Goal reached, well done!',
  paliersAvis: 'Review milestones',
  trophees: 'Tap trophies',
  atteint: 'reached',
  aVenir: 'coming up',
  paliersSous: 'Every milestone you unlock stays here. The next one is already in sight.',
  bravoAvis: (n) => `${n} Google reviews!`,
  bravoTaps: (n) => `${n} taps and counting!`,
  bravo: 'Congrats',
  bravoSous: 'A new milestone unlocked. Your customers love you — and it shows.',
  fermer: 'Close',
  avisGagnes: (j) => `Reviews gained, last ${j} days`,
  surFiche: 'on your Google profile',
  avisTotal: 'Total reviews',
  fiches: (n) => `${n} profiles`,
  noteGoogle: 'Google rating',
  voirCartes: 'see each card',
  moyenneFiche: '★ profile average',
  avisPour100: 'Reviews per 100 taps',
  surPeriode: 'over the period',
  nbAvis: 'Google reviews over time',
  nbAvisSous: (j, d) => `Last ${j} days · last updated ${d}`,
  nbAvisResume: (j, a, b) => `Google reviews over ${j} days: from ${a} to ${b}.`,
  unAvis: 'reviews',
  tapsParJour: 'Taps per day',
  tapsParJourSous: (j) => `Last ${j} days, Québec time`,
  tapsParJourResume: (j, n) => `Taps per day over ${j} days, ${n} in total.`,
  quand: 'When customers tap',
  momentFort: (jour, p) => `Busiest moment: ${jour}, ${p}`,
  pasAssezGrille: 'Day × hour over the period — not enough taps yet to see a pattern',
  grilleResume: (j) => `Taps by weekday and hour, over ${j} days.`,
  affluence: 'Busy hours',
  pointe: (p) => `Peak: ${p}`,
  pasAssez: 'Not enough taps yet to see a pattern',
  heureResume: 'Taps by hour of the day.',
  joursSemaine: 'Days of the week',
  jourFort: (jour) => `${jour} is your busiest day`,
  semaineResume: 'Taps by day of the week.',
  puceQr: 'NFC chip or QR code',
  puceQrSous: 'The QR code catches phones with NFC turned off or missing.',
  puce: 'NFC chip',
  qr: 'QR code',
  puceQrResume: (a, b) => `${a} taps by chip, ${b} by QR code.`,
  telephones: 'Phones',
  telephonesSous: 'Device type only — nothing that identifies the person.',
  autre: 'Other',
  telephonesResume: (a, b, c) => `${a} iPhone, ${b} Android, ${c} other.`,
  cumul: 'Total taps since installation',
  cumulSous: (n, d) => `${n} taps since ${d}`,
  cumulSerie: 'Total taps',
  cumulResume: (n) => `Total taps since installation: ${n}.`,
  aucunTap: 'No taps in this period',
  voirDonnees: 'See the data',
  moins: 'Less',
  plus: 'More',
  caseForte: (n) => `darkest cell: ${n} taps`,
  taps: 'taps',
  commanderTitre: 'Want more cards?',
  commanderSous: 'One more at the counter, on every table, on the patio… More cards, more reviews.',
  combien: 'How many cards?',
  autreQte: 'Other',
  motPourNous: 'A note for us (optional)',
  motExemple: 'E.g. one for the patio, two for the tables…',
  envoyerDemande: 'Send request',
  envoi: 'Sending…',
  sansPaiement: 'No payment now: we’ll confirm the price with you first.',
  merci: 'Thanks, got it!',
  merciSous: 'We’ll get back to you very soon to confirm.',
  erreurQte: 'Pick between 1 and 500 cards.',
  erreurTrop: 'We already got a few requests today: we’ll get back to you very soon.',
  erreurLien: 'This link is no longer valid.',
  installTitre: 'Your stats, one tap away',
  installSous: 'Add this page to your home screen: it opens just like an app.',
  installer: 'Add',
  plusTard: 'Later',
  iosEtape1: 'Tap',
  iosPartager: 'Share',
  iosEtape2: 'then “Add to Home Screen”',
  iosEtape3: 'and “Add”. That’s it!',
}

export const TEXTES: Record<Langue, Textes> = { fr, en }
export const textes = (l: Langue): Textes => TEXTES[l]
