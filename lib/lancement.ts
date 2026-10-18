/** Les étapes de la liste de lancement (clés stockées dans dossiers_cartes.lancement). */
export const ETAPES_LANCEMENT = ['tester', 'visible', 'equipe', 'phrase', 'demande', 'ecran', 'notifs'] as const
export type EtapeLancement = (typeof ETAPES_LANCEMENT)[number]
