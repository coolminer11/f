/**
 * Les modèles du courriel « votre lien privé », en français et en anglais.
 *
 * Le texte se modifie librement avant l'envoi. Le lien n'y figure pas : il
 * est ajouté automatiquement sous le message, en gros bouton (et en clair
 * dans la version texte) — impossible de l'oublier ou de le casser.
 * Fichier sans dépendance serveur : le formulaire l'utilise aussi.
 */
export type CleModele = 'bienvenue' | 'rappel' | 'nouveau'
export type Modele = { nom: string; objet: (commerce: string) => string; corps: (commerce: string) => string }

export const MODELES: Record<'fr' | 'en', Record<CleModele, Modele>> = {
  fr: {
    bienvenue: {
      nom: 'Bienvenue',
      objet: (c) => `Vos statistiques Tapora — ${c}`,
      corps: (c) => `Bonjour,

Vos cartes Tapora sont en place chez ${c} ! Voici votre page privée : vous y verrez chaque tap en direct, vos heures fortes et les avis Google que vous gagnez.

Deux petits conseils pour bien commencer :
• Ajoutez la page à l'écran d'accueil de votre téléphone : elle s'ouvrira comme une app.
• Activez le « Ding ! » sur la page pour être prévenu à chaque tap.

Ce lien est personnel : partagez-le seulement avec votre équipe.

Au plaisir,
L'équipe Tapora`,
    },
    rappel: {
      nom: 'Rappel',
      objet: (c) => `Votre page de statistiques Tapora — ${c}`,
      corps: (c) => `Bonjour,

Petit rappel : la page de statistiques de ${c} est toujours accessible avec le lien ci-dessous. Vous y trouverez vos taps du jour, votre série, vos paliers d'avis et les conseils de la semaine.

N'hésitez pas à nous écrire si vous avez la moindre question.

Bonne journée,
L'équipe Tapora`,
    },
    nouveau: {
      nom: 'Nouveau lien',
      objet: (c) => `Votre nouveau lien Tapora — ${c}`,
      corps: (c) => `Bonjour,

Nous avons renouvelé le lien de la page de statistiques de ${c}. L'ancien ne fonctionne plus : utilisez dorénavant celui-ci.

Si vous aviez ajouté la page à l'écran d'accueil de votre téléphone, retirez l'ancienne icône et ajoutez la nouvelle page.

Merci,
L'équipe Tapora`,
    },
  },
  en: {
    bienvenue: {
      nom: 'Welcome',
      objet: (c) => `Your Tapora stats — ${c}`,
      corps: (c) => `Hi,

Your Tapora cards are now in place at ${c}! Here's your private page: you'll see every tap live, your busiest hours and the Google reviews you gain.

Two quick tips to get started:
• Add the page to your phone's home screen: it opens just like an app.
• Turn on the “Ding!” on the page to get notified on every tap.

This link is personal: share it only with your team.

Cheers,
The Tapora team`,
    },
    rappel: {
      nom: 'Reminder',
      objet: (c) => `Your Tapora stats page — ${c}`,
      corps: (c) => `Hi,

A quick reminder: the stats page for ${c} is still available at the link below. You'll find today's taps, your streak, your review milestones and this week's tips.

Feel free to write to us with any question.

Have a great day,
The Tapora team`,
    },
    nouveau: {
      nom: 'New link',
      objet: (c) => `Your new Tapora link — ${c}`,
      corps: (c) => `Hi,

We've renewed the link to the stats page for ${c}. The old one no longer works: please use this one from now on.

If you had added the page to your phone's home screen, remove the old icon and add the new page.

Thank you,
The Tapora team`,
    },
  },
}

export const BOUTON = { fr: 'Voir mes statistiques', en: 'See my stats' }
