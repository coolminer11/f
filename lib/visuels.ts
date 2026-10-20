/**
 * Les visuels des deux cartes à l'unité (public/visuels, servis aux seules
 * sessions du back-office). Français d'abord pour le Québec — la Charte de la
 * langue française l'exige —, anglais d'abord partout ailleurs. Les cartes
 * Entreprise n'en ont pas : leur visuel est la maquette de chaque client.
 */
export type Visuel = { titre: string; langue: string; pour: string; apercu: string; fichier: string; nomFichier: string }

export const VISUELS: Record<'quebec' | 'hors_quebec', Visuel> = {
  quebec: {
    titre: 'Carte à l’unité — Québec',
    langue: 'Français d’abord, anglais ensuite',
    pour: 'Tout commerce au Québec : « Votre avis compte ! » en vedette.',
    apercu: '/visuels/carte-quebec-apercu.webp',
    fichier: '/visuels/carte-quebec.png',
    nomFichier: 'Tapora-carte-a-l-unite-Quebec.png',
  },
  hors_quebec: {
    titre: 'Carte à l’unité — Hors Québec',
    langue: 'Anglais d’abord, français ensuite',
    pour: 'Reste du Canada, États-Unis, ailleurs : « Your review matters! » en vedette. Jamais posée au Québec.',
    apercu: '/visuels/carte-hors-quebec-apercu.webp',
    fichier: '/visuels/carte-hors-quebec.png',
    nomFichier: 'Tapora-carte-a-l-unite-hors-Quebec.png',
  },
}
