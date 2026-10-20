/**
 * Les visuels de base des cartes (public/visuels, servis aux seules sessions
 * du back-office). Français d'abord pour le Québec — la Charte de la langue
 * française l'exige —, anglais d'abord partout ailleurs.
 */
export type Visuel = { titre: string; langue: string; pour: string; apercu: string; fichier: string; nomFichier: string }

export const VISUELS: Record<'fr_en' | 'en_fr', Visuel> = {
  fr_en: {
    titre: 'Carte de base — Québec',
    langue: 'Français d’abord, anglais ensuite',
    pour: 'Tout commerce au Québec : « Votre avis compte ! » en vedette.',
    apercu: '/visuels/carte-quebec-apercu.webp',
    fichier: '/visuels/carte-quebec.png',
    nomFichier: 'Tapora-carte-Quebec-francais-d-abord.png',
  },
  en_fr: {
    titre: 'Carte de base — Hors Québec',
    langue: 'Anglais d’abord, français ensuite',
    pour: 'Reste du Canada, États-Unis, ailleurs : « Your review matters! » en vedette. Jamais posée au Québec.',
    apercu: '/visuels/carte-hors-quebec-apercu.webp',
    fichier: '/visuels/carte-hors-quebec.png',
    nomFichier: 'Tapora-carte-hors-Quebec-anglais-d-abord.png',
  },
}
