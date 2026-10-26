#!/usr/bin/env python3
# Génère site/src/entreprise.html (fr-CA) et site/src/en/business.html (en-CA)
# à partir d'une seule source : mêmes sections, mêmes fonctions, mêmes états.
import json, html as H

import os
SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src')
NB = '&nbsp;'

def esc(s):
    return s  # les chaînes contiennent déjà leurs entités

# ---------------------------------------------------------------- fonctions
# (catégorie, état, titre fr, description fr, titre en, description en, ajout Tapora)
D, B = 'disponible', 'bientot'
FONCTIONS = [
  # A. Expérience client et communication
  ('client', D, 'Avis Google', 'Ouvre la page pour laisser un avis, sans application.', 'Google reviews', 'Opens the page to leave a review, no app needed.', False),
  ('client', B, 'Formulaire de satisfaction', 'Recueille les commentaires privés de vos clients.', 'Satisfaction form', 'Collects private feedback from your customers.', False),
  ('client', B, 'Sondage client', 'Mesure la satisfaction et les préférences.', 'Customer survey', 'Measures satisfaction and preferences.', False),
  ('client', B, 'Formulaire de plainte', 'Permet de signaler un problème.', 'Complaint form', 'Lets customers report a problem.', False),
  ('client', B, 'Suggestions', 'Recueille les idées de vos clients.', 'Suggestions', 'Collects your customers’ ideas.', False),
  ('client', D, 'Contact direct', 'Ouvre votre page de contact.', 'Direct contact', 'Opens your contact page.', False),
  ('client', D, 'Messagerie', 'Ouvre WhatsApp ou un autre canal.', 'Messaging', 'Opens WhatsApp or another channel.', False),
  ('client', D, 'Assistance', 'Donne accès à votre soutien à la clientèle.', 'Support', 'Gives access to your customer support.', False),
  ('client', D, 'Questions fréquentes', 'Ouvre votre page de questions fréquentes.', 'FAQ', 'Opens your frequently asked questions.', False),
  ('client', D, 'Réseaux sociaux', 'Dirige vers Instagram, TikTok, Facebook…', 'Social media', 'Sends customers to Instagram, TikTok, Facebook…', False),
  ('client', D, 'Témoignages', 'Ouvre la page de vos témoignages.', 'Testimonials', 'Opens your testimonials page.', False),
  ('client', D, 'Inscription à l’infolettre', 'Ouvre votre formulaire d’abonnement.', 'Newsletter sign-up', 'Opens your subscription form.', False),
  ('client', D, 'L’avis, juste après la demande', 'Après «' + NB + 'Appeler le serveur' + NB + '» ou une demande&nbsp;: la note, le lien Google offert à tous, et un mot privé possible.', 'The review, right after the request', 'After “Call the server” or a request: the rating, the Google link offered to everyone, and an optional private note.', True),
  # B. Restaurants, cafés et bars
  ('resto', D, 'Menu numérique', 'Affiche le menu complet, toujours à jour.', 'Digital menu', 'Shows the full menu, always up to date.', False),
  ('resto', D, 'Menu multilingue', 'Français, anglais, espagnol… 10 langues.', 'Multilingual menu', 'French, English, Spanish… 10 languages.', False),
  ('resto', D, 'Menu du jour', 'Les plats du moment, changés en 10 secondes.', 'Daily specials', 'Today’s dishes, changed in 10 seconds.', False),
  ('resto', D, 'Menu des boissons', 'La carte des cocktails et des boissons.', 'Drinks menu', 'Cocktails and drinks.', False),
  ('resto', D, 'Allergènes', 'Les informations alimentaires, plat par plat.', 'Allergens', 'Food information, dish by dish.', False),
  ('resto', B, 'Réservation', 'Réserver une table avec Tapora. En attendant, la carte ouvre votre outil actuel.', 'Reservations', 'Book a table through Tapora. Meanwhile, the card opens your current tool.', False),
  ('resto', B, 'Liste d’attente', 'S’inscrire à une file d’attente.', 'Waitlist', 'Join a waiting list.', False),
  ('resto', D, 'Commande à table', 'Commander depuis son téléphone, payer à l’addition.', 'Ordering at the table', 'Order from the phone, pay with the bill.', False),
  ('resto', B, 'Paiement', 'Un paiement sécurisé par Stripe, sur votre compte.', 'Payment', 'Secure payment through Stripe, on your account.', False),
  ('resto', B, 'Pourboire', 'Une interface de pourboire, avec le paiement.', 'Tips', 'A tipping screen, with the payment.', False),
  ('resto', B, 'Programme de fidélité', 'Accumuler des points ou des tampons.', 'Loyalty program', 'Collect points or stamps.', False),
  ('resto', D, 'Promotions', 'Voir les offres du moment.', 'Promotions', 'See the current offers.', False),
  ('resto', D, 'Événements', 'Les soirées spéciales et les spectacles.', 'Events', 'Special nights and shows.', False),
  ('resto', B, 'Commandes à emporter', 'Commandées et payées en ligne.', 'Takeout orders', 'Ordered and paid online.', False),
  ('resto', D, 'Commentaires', 'Évaluer l’expérience.', 'Feedback', 'Rate the experience.', False),
  ('resto', D, 'Appeler le serveur et l’addition', 'En un tap, avec le numéro de la table&nbsp;; le client voit «' + NB + 'J’arrive' + NB + '».', 'Call the server and ask for the bill', 'One tap, with the table number; the guest sees “On my way”.', True),
  # C. Hôtels et hébergements
  ('hotel', B, 'Enregistrement', 'Le check-in en ligne, avant d’arriver.', 'Check-in', 'Online check-in, before arriving.', False),
  ('hotel', B, 'Départ', 'Le départ (check-out) numérique.', 'Check-out', 'Digital check-out.', False),
  ('hotel', D, 'Services de chambre', 'Consulter ou demander des services.', 'Room services', 'Browse or request services.', False),
  ('hotel', D, 'Service aux chambres', 'Commander à manger, porté à la chambre.', 'Room service', 'Order food, brought to the room.', False),
  ('hotel', D, 'Wi-Fi', 'Les instructions de connexion, le mot de passe à copier.', 'Wi-Fi', 'Connection instructions, the password ready to copy.', False),
  ('hotel', D, 'Guide de la chambre', 'Le fonctionnement des équipements.', 'Room guide', 'How the equipment works.', False),
  ('hotel', D, 'Conciergerie', 'Demander de l’assistance.', 'Concierge', 'Ask for assistance.', False),
  ('hotel', D, 'Entretien ménager', 'Demander un nettoyage.', 'Housekeeping', 'Ask for cleaning.', False),
  ('hotel', D, 'Signalement de problème', 'Signaler un équipement défectueux.', 'Report a problem', 'Report faulty equipment.', False),
  ('hotel', B, 'Spa', 'Réserver un soin.', 'Spa', 'Book a treatment.', False),
  ('hotel', D, 'Restaurant', 'Accéder au menu, dans la langue du client.', 'Restaurant', 'Open the menu, in the guest’s language.', False),
  ('hotel', D, 'Gym', 'Consulter les heures et les règles.', 'Gym', 'See the hours and rules.', False),
  ('hotel', D, 'Piscine', 'Voir les horaires.', 'Pool', 'See the hours.', False),
  ('hotel', D, 'Attractions locales', 'Découvrir les activités du coin.', 'Local attractions', 'Discover things to do nearby.', False),
  ('hotel', D, 'Transport', 'Les informations de transport.', 'Transportation', 'Transportation information.', False),
  ('hotel', D, 'Départ tardif', 'Demander un départ tardif en un tap.', 'Late check-out', 'Request a late check-out in one tap.', False),
  ('hotel', B, 'Surclassement', 'Consulter les options offertes.', 'Upgrades', 'See the available options.', False),
  ('hotel', D, 'Évaluation du séjour', 'Partager son expérience&nbsp;; le lien Google est offert à tous.', 'Stay rating', 'Share the experience; the Google link is offered to everyone.', False),
  ('hotel', B, 'Programme de fidélité', 'S’inscrire aux avantages.', 'Loyalty program', 'Join the rewards.', False),
  ('hotel', D, 'Événements', 'Découvrir les activités de l’hôtel.', 'Events', 'Discover the hotel’s activities.', False),
  ('hotel', D, 'La commande au service aux chambres', 'Le panier, le mot pour la cuisine, et l’équipe la voit en direct.', 'Room service ordering', 'The cart, a note for the kitchen, and the team sees it live.', True),
  # Cartes et suivi
  ('cartes', D, 'Puce permanente', 'Le code écrit sur la puce ne change jamais&nbsp;: la carte dure des années.', 'Permanent chip', 'The code on the chip never changes: the card lasts for years.', False),
  ('cartes', D, 'Destination modifiable', 'Changez la page ouverte en tout temps, sans remplacer la carte.', 'Changeable destination', 'Change the page it opens anytime, without replacing the card.', False),
  ('cartes', D, 'Le nom de chaque carte', '«' + NB + 'Chambre 214' + NB + '», «' + NB + 'Terrasse 3' + NB + '»&nbsp;: chaque carte a le sien.', 'A name for every card', '“Room 214”, “Patio 3”: every card has its own.', False),
  ('cartes', D, 'Groupes de cartes', '«' + NB + 'Chambres' + NB + '», «' + NB + 'Bar' + NB + '», «' + NB + 'Réception' + NB + '»&nbsp;: comparez vos zones.', 'Card groups', '“Rooms”, “Bar”, “Front desk”: compare your areas.', False),
  ('cartes', D, 'Statistiques par carte et par groupe', 'Chaque tap, par jour, par heure, par type de téléphone.', 'Stats per card and group', 'Every tap, by day, by hour, by phone type.', False),
  ('cartes', D, 'Page de statistiques protégée', 'Un mot de passe, et vous la partagez avec votre équipe.', 'Password-protected stats page', 'A password, and you share it with your team.', False),
  ('cartes', D, 'Export pour Excel', 'Une ligne par carte et par jour, pour vos rapports.', 'Excel export', 'One row per card per day, for your reports.', False),
  ('cartes', D, 'Rapport mensuel', 'Le résumé du mois, par courriel, le 1<sup>er</sup>.', 'Monthly report', 'The month’s summary, by email, on the 1st.', False),
  ('cartes', D, 'Design sur mesure', 'Votre logo, vos couleurs, vos textes.', 'Custom design', 'Your logo, your colours, your words.', False),
  ('cartes', D, 'Maquette à approuver', 'Vous voyez vos cartes avant leur fabrication.', 'Mockup to approve', 'You see your cards before they’re made.', False),
  ('cartes', D, 'Suivi de commande', 'De la maquette à la pose, étape par étape.', 'Order tracking', 'From mockup to installation, step by step.', False),
  ('cartes', D, 'Espace client', 'Vos commandes, vos messages et vos documents.', 'Client area', 'Your orders, messages and documents.', False),
  ('cartes', B, 'Zones dans une même commande', 'Chambres, restaurant, spa&nbsp;: un design et une destination par zone, gérés pour vous.', 'Zones in one order', 'Rooms, restaurant, spa: one design and destination per zone, managed for you.', False),
  ('cartes', B, 'Changements en lot', 'Toutes les cartes d’un groupe changent de destination d’un coup.', 'Batch changes', 'Every card in a group changes destination at once.', False),
  ('cartes', B, 'Destinations programmées', 'Le menu des fêtes du 1<sup>er</sup> au 31' + NB + 'décembre, puis retour automatique.', 'Scheduled destinations', 'The holiday menu from December 1 to 31, then back automatically.', False),
]

CATS = {
  'client': ('Expérience client', 'Customer experience', 'i-client'),
  'resto': ('Restaurants, cafés et bars', 'Restaurants, cafés and bars', 'i-resto'),
  'hotel': ('Hôtels et hébergements', 'Hotels and lodging', 'i-hotel'),
  'cartes': ('Cartes et suivi', 'Cards and tracking', 'i-cartes'),
}

# ---------------------------------------------------------------- plateforme
PLATEFORME = [
  (D, 'Gestion des destinations', 'Changer les liens sans remplacer les cartes — par Tapora, sur demande.', 'Destination management', 'Change the links without replacing the cards — by Tapora, on request.'),
  (D, 'Tableau de bord', 'Les interactions par carte, par groupe et par période.', 'Dashboard', 'Interactions by card, by group and by period.'),
  (B, 'Formulaires intégrés', 'Créer des sondages, des demandes et des questionnaires.', 'Built-in forms', 'Create surveys, requests and questionnaires.'),
  (B, 'Pages personnalisées', 'Couleurs, logo et boutons pour chaque entreprise — déjà en place pour les restaurants et les hôtels.', 'Custom pages', 'Colours, logo and buttons for every business — already live for restaurants and hotels.'),
  (B, 'Plusieurs succursales', 'Administrer plusieurs établissements dans un même compte.', 'Multiple locations', 'Manage several locations in one account.'),
  (B, 'Rôles et permissions', 'Un accès pour les gestionnaires de chaque succursale.', 'Roles and permissions', 'Access for each location’s managers.'),
  (D, 'Pages multilingues', 'Français et anglais sur les cartes&nbsp;; 10 langues pour les menus et les services.', 'Multilingual pages', 'French and English on the cards; 10 languages for menus and services.'),
  (D, 'Campagnes temporaires', 'Une promotion ou un menu, avec ses dates et ses heures, dans les pages de services.', 'Temporary campaigns', 'A promotion or a menu, with its dates and hours, in the service pages.'),
  (D, 'Statistiques par redirection', 'Chaque ouverture passe par notre redirection. Honnêtement&nbsp;: on ne prétend pas mesurer chaque lecture NFC indépendamment.', 'Stats through redirection', 'Every opening goes through our redirect. Honestly: we don’t claim to measure each NFC read on its own.'),
  (B, 'Intégrations', 'Relier vos formulaires et vos pages aux logiciels que vous utilisez déjà.', 'Integrations', 'Connect your forms and pages to the software you already use.'),
]

# ---------------------------------------------------------------- secteurs
SECTEURS = [
  dict(id='hotel', fr='Hôtels', en='Hotels', titre_fr='Hôtels et hébergements', titre_en='Hotels and lodging',
       intro_fr='Une carte dans chaque chambre, et la réception n’a plus à répondre dix fois à «' + NB + 'c’est quoi, le Wi-Fi' + NB + '?' + NB + '».',
       intro_en='A card in every room, and the front desk stops answering “what’s the Wi-Fi?” ten times a day.',
       lieux=[('Chambres', 'Rooms', 100), ('Restaurant', 'Restaurant', 12), ('Réception', 'Front desk', 5), ('Spa', 'Spa', 4), ('Ascenseurs et espaces communs', 'Elevators and common areas', 4)],
       f=[(D, 'Services de chambre et service aux chambres', 'Room services and room service'), (D, 'Entretien ménager, départ tardif, problème', 'Housekeeping, late check-out, problems'), (D, 'Wi-Fi, guide de la chambre, piscine et gym', 'Wi-Fi, room guide, pool and gym'), (D, 'Conciergerie, attractions et transport', 'Concierge, attractions and transportation'), (D, 'Restaurant de l’hôtel et événements', 'Hotel restaurant and events'), (D, 'Évaluation du séjour', 'Stay rating'), (B, 'Enregistrement et départ en ligne', 'Online check-in and check-out'), (B, 'Spa, surclassement, fidélité', 'Spa, upgrades, loyalty')]),
  dict(id='resto', fr='Restaurants et bars', en='Restaurants and bars', titre_fr='Restaurants, cafés et bars', titre_en='Restaurants, cafés and bars',
       intro_fr='Le menu dans la langue du client, le serveur appelé au bon moment, l’addition sans attendre — et l’avis juste après.',
       intro_en='The menu in the guest’s language, the server called at the right time, the bill without waiting — and the review right after.',
       lieux=[('Tables de la salle', 'Dining-room tables', 30), ('Terrasse', 'Patio', 8), ('Bar', 'Bar', 2)],
       f=[(D, 'Menu en 10 langues, avec les allergènes', 'Menu in 10 languages, with allergens'), (D, 'Menu du jour et menu des boissons', 'Daily specials and drinks menu'), (D, 'Appeler le serveur et l’addition', 'Call the server and the bill'), (D, 'Commande à table', 'Ordering at the table'), (D, 'Promotions, événements, commentaires', 'Promotions, events, feedback'), (B, 'Réservation et liste d’attente', 'Reservations and waitlist'), (B, 'Paiement et pourboire', 'Payment and tips'), (B, 'Commandes à emporter et fidélité', 'Takeout and loyalty')]),
  dict(id='spa', fr='Salons et spas', en='Salons and spas', titre_fr='Salons de coiffure, spas et beauté', titre_en='Hair salons, spas and beauty',
       intro_fr='Une carte à chaque poste et dans chaque salle de soins&nbsp;: le prochain rendez-vous, les produits, l’avis — pendant que le client est encore là.',
       intro_en='A card at every station and in every treatment room: the next appointment, the products, the review — while the client is still there.',
       lieux=[('Postes de coiffure', 'Styling stations', 10), ('Salles de soins', 'Treatment rooms', 6), ('Salle d’attente', 'Waiting area', 5), ('Réception', 'Front desk', 4)],
       f=[(D, 'Avis Google, offert à tous', 'Google reviews, offered to everyone'), (D, 'Votre outil de rendez-vous actuel, en un tap', 'Your current booking tool, in one tap'), (B, 'Réservation de rendez-vous avec Tapora', 'Appointment booking through Tapora'), (B, 'Catalogue des services et tarifs', 'Service catalogue and prices'), (B, 'Consultation de styles', 'Style lookbook'), (B, 'Produits recommandés', 'Recommended products'), (B, 'Cartes-cadeaux', 'Gift cards'), (B, 'Programme de fidélité', 'Loyalty program'), (B, 'Formulaire de satisfaction', 'Satisfaction form'), (B, 'Conseils après le traitement', 'Aftercare advice')]),
  dict(id='clinique', fr='Cliniques', en='Clinics', titre_fr='Cliniques dentaires et professionnelles', titre_en='Dental and professional clinics',
       intro_fr='Dans la salle d’attente et dans chaque salle d’examen&nbsp;: les consignes, les formulaires, le prochain rendez-vous.',
       intro_en='In the waiting room and every exam room: instructions, forms, the next appointment.',
       lieux=[('Salles d’examen', 'Exam rooms', 12), ('Salle d’attente', 'Waiting room', 10), ('Réception', 'Front desk', 3)],
       f=[(D, 'Votre portail patient sécurisé, en un tap', 'Your secure patient portal, in one tap'), (D, 'Vos coordonnées et votre documentation en ligne', 'Your contact details and online documents'), (D, 'Avis Google, offert à tous', 'Google reviews, offered to everyone'), (B, 'Prise de rendez-vous avec Tapora', 'Appointment booking through Tapora'), (B, 'Formulaires administratifs', 'Administrative forms'), (B, 'Instructions avant et après la consultation', 'Before- and after-visit instructions'), (B, 'Questionnaires de satisfaction', 'Satisfaction questionnaires')]),
  dict(id='immo', fr='Immobilier', en='Real estate', titre_fr='Agences immobilières', titre_en='Real-estate agencies',
       intro_fr='Sur la pancarte, dans la vitrine, au bureau&nbsp;: la fiche et la visite virtuelle, au passant qui s’arrête.',
       intro_en='On the sign, in the window, at the office: the listing and the virtual tour, for anyone who stops.',
       lieux=[('Pancartes «' + NB + 'À vendre' + NB + '»', '“For sale” signs', 20), ('Vitrine', 'Window', 3), ('Bureau', 'Office', 2)],
       f=[(D, 'Fiches des propriétés', 'Property listings'), (D, 'Visites virtuelles', 'Virtual tours'), (D, 'Brochures et nouvelles inscriptions', 'Brochures and new listings'), (D, 'Coordonnées des courtiers', 'Broker contact details'), (B, 'Prise de rendez-vous pour une visite', 'Booking a visit'), (B, 'Formulaires d’intérêt', 'Interest forms'), (B, 'Estimation immobilière', 'Property valuation')]),
  dict(id='auto', fr='Concessionnaires', en='Dealerships', titre_fr='Concessionnaires automobiles', titre_en='Car dealerships',
       intro_fr='Une carte sur chaque véhicule de la salle d’exposition&nbsp;: la fiche technique, le financement, l’essai routier.',
       intro_en='A card on every showroom vehicle: the spec sheet, financing, the test drive.',
       lieux=[('Véhicules en salle', 'Showroom vehicles', 18), ('Service après-vente', 'Service department', 4), ('Réception', 'Front desk', 3)],
       f=[(D, 'Fiches techniques des véhicules', 'Vehicle spec sheets'), (D, 'Offres de financement', 'Financing offers'), (D, 'Catalogues', 'Catalogues'), (D, 'Informations de garantie', 'Warranty information'), (B, 'Demandes d’essai routier', 'Test-drive requests'), (B, 'Rendez-vous d’entretien', 'Service appointments'), (B, 'Enquêtes de satisfaction', 'Satisfaction surveys')]),
  dict(id='gym', fr='Gyms', en='Gyms', titre_fr='Gyms et centres sportifs', titre_en='Gyms and sports centres',
       intro_fr='Une carte sur chaque appareil&nbsp;: la vidéo qui montre comment s’en servir, l’horaire des cours, l’inscription.',
       intro_en='A card on every machine: the video showing how to use it, the class schedule, sign-up.',
       lieux=[('Appareils', 'Machines', 18), ('Vestiaires', 'Locker rooms', 4), ('Accueil', 'Front desk', 3)],
       f=[(D, 'Horaires des cours', 'Class schedules'), (D, 'Guides d’utilisation des équipements', 'Equipment guides'), (D, 'Programmes d’entraînement', 'Training programs'), (D, 'Informations d’abonnement', 'Membership information'), (B, 'Inscriptions', 'Sign-ups'), (B, 'Réservation de séances', 'Session booking'), (B, 'Formulaires d’évaluation', 'Evaluation forms')]),
  dict(id='evenement', fr='Événements', en='Events', titre_fr='Événements et conférences', titre_en='Events and conferences',
       intro_fr='Sur chaque table et à l’entrée de chaque salle&nbsp;: le programme, le plan, les intervenants et la rétroaction.',
       intro_en='On every table and at every room’s door: the program, the map, the speakers and feedback.',
       lieux=[('Tables', 'Tables', 20), ('Entrées des salles', 'Room entrances', 4), ('Accueil', 'Welcome desk', 1)],
       f=[(D, 'Programme de l’événement', 'Event program'), (D, 'Plan des salles', 'Room map'), (D, 'Biographies des intervenants', 'Speaker bios'), (D, 'Présentations', 'Presentations'), (D, 'Coordonnées des organisateurs', 'Organizer contacts'), (B, 'Inscription', 'Registration'), (B, 'Formulaires de rétroaction', 'Feedback forms'), (B, 'Sondages en direct', 'Live polls')]),
]

# ---------------------------------------------------------------- exemples de commande
SCENARIOS = [
  dict(id='hotel100', fr='Hôtel de 100 chambres', en='100-room hotel', seg=[
    ('Chambres', 'Rooms', 'service aux chambres', 'room service', 100, '#c2552f'),
    ('Restaurant', 'Restaurant', 'menu', 'menu', 12, '#2f5c47'),
    ('Réception', 'Front desk', 'avis Google', 'Google reviews', 5, '#e4a53a'),
    ('Spa', 'Spa', 'votre outil de rendez-vous', 'your booking tool', 4, '#2a211a'),
    ('Autres espaces', 'Other areas', 'conciergerie', 'concierge', 4, '#d89a83')]),
  dict(id='hotel120', fr='Hôtel de 120 chambres', en='120-room hotel', seg=[
    ('Chambres', 'Rooms', 'services de l’hôtel', 'hotel services', 120, '#c2552f'),
    ('Espaces communs', 'Common areas', 'guide et conciergerie', 'guide and concierge', 15, '#2f5c47')]),
  dict(id='resto40', fr='Restaurant de 40 tables', en='40-table restaurant', seg=[
    ('Tables', 'Tables', 'menu et appel du serveur', 'menu and call the server', 40, '#c2552f')]),
  dict(id='resto50', fr='«' + NB + '50 cartes pour nos tables' + NB + '»', en='“50 cards for our tables”', seg=[
    ('Tables', 'Tables', 'menu, à votre logo et à vos couleurs', 'menu, with your logo and colours', 50, '#2f5c47')]),
]

FEUILLE = [
  ('Phase 1', 'Phase 1', 'La page multi-actions pour tous les secteurs, les formulaires et sondages, les destinations programmées et les changements en lot.', 'The multi-action page for every sector, forms and surveys, scheduled destinations and batch changes.'),
  ('Phase 2', 'Phase 2', 'Les réservations et rendez-vous, la liste d’attente, l’enregistrement et le départ en ligne.', 'Reservations and appointments, the waitlist, online check-in and check-out.'),
  ('Phase 3', 'Phase 3', 'Les comptes à plusieurs succursales, les rôles et permissions, le libre-service.', 'Multi-location accounts, roles and permissions, self-service.'),
  ('Phase 4', 'Phase 4', 'Les paiements, les pourboires et les cartes-cadeaux par le compte Stripe de votre entreprise, et le programme de fidélité.', 'Payments, tips and gift cards through your business’s own Stripe account, and the loyalty program.'),
  ('Phase 5', 'Phase 5', 'Les intégrations&nbsp;: webhooks et export CSV d’abord, puis le système de l’hôtel et la caisse.', 'Integrations: webhooks and CSV export first, then the hotel system and the point of sale.'),
]

FAQ = [
  ('Le minimum de 25 cartes, c’est par commande ou par zone&nbsp;?', 'Par commande. Une même commande peut se répartir entre vos chambres, votre restaurant et votre réception, tant que le total atteint 25 cartes. Pour quelques cartes seulement, les cartes à l’unité sont à 35&nbsp;$, sans minimum.',
   'Is the 25-card minimum per order or per area?', 'Per order. One order can be split across your rooms, your restaurant and your front desk, as long as the total reaches 25 cards. For just a few cards, individual cards are $35 each, with no minimum.'),
  ('Peut-on avoir plusieurs designs dans une même commande&nbsp;?', 'Oui&nbsp;: un design pour les chambres et un autre pour le restaurant, par exemple. On en discute ensemble au moment de la maquette, que vous approuvez avant la fabrication.',
   'Can one order have several designs?', 'Yes: one design for the rooms and another for the restaurant, for example. We work it out together at the mockup stage, which you approve before production.'),
  ('Comment change-t-on la destination d’une carte&nbsp;?', 'Vous nous écrivez, et c’est fait, sans toucher à la carte&nbsp;: la puce mène à une adresse Tapora, et c’est nous qui redirigeons. Les changements en lot, les destinations programmées et le libre-service arrivent bientôt.',
   'How do you change where a card leads?', 'You write to us and it’s done, without touching the card: the chip points to a Tapora address and we handle the redirect. Batch changes, scheduled destinations and self-service are coming soon.'),
  ('Que veut dire «&nbsp;Bientôt&nbsp;»&nbsp;?', 'Ces fonctions sont en construction chez Tapora. Elles ne sont pas encore vendues&nbsp;: elles passeront à «&nbsp;Disponible&nbsp;» sur cette page le jour où elles fonctionneront pour de vrai. Seules les fonctions «&nbsp;Disponible&nbsp;» font partie d’une commande.',
   'What does “Coming soon” mean?', 'These features are being built at Tapora. They aren’t sold yet: they’ll switch to “Available” on this page the day they really work. Only “Available” features are part of an order.'),
  ('NFC ou code QR&nbsp;?', 'Les deux, sur la même carte. Le client approche son téléphone — tous les iPhone depuis le XR et la grande majorité des Android — ou scanne le code avec l’appareil photo. Aucune application à installer.',
   'NFC or QR code?', 'Both, on the same card. Guests tap their phone — every iPhone since the XR and the vast majority of Android phones — or scan the code with the camera. No app to install.'),
  ('Quelles données gardez-vous sur mes clients&nbsp;?', 'Pour les statistiques des cartes, aucune adresse IP et aucun identifiant&nbsp;: seulement l’heure du tap, le canal (NFC ou code QR) et le type d’appareil. Conformément à la Loi&nbsp;25, rien n’est vendu ni partagé.',
   'What data do you keep about my customers?', 'For card statistics, no IP address and no identifier: only the time of the tap, the channel (NFC or QR code) and the device type. In line with Québec’s Law 25, nothing is sold or shared.'),
  ('Dans quelles langues&nbsp;?', 'Les cartes&nbsp;: le français d’abord au Québec, l’anglais d’abord ailleurs. Le menu et les pages de services s’affichent dans 10 langues, au choix du client.',
   'In which languages?', 'Cards: French first in Québec, English first elsewhere. Menus and service pages are shown in 10 languages, chosen by the guest.'),
  ('Quels sont les délais&nbsp;?', 'Plus longs qu’une carte standard&nbsp;: la maquette à approuver, puis la fabrication sur mesure. La date exacte vous est confirmée avec la maquette.',
   'How long does it take?', 'Longer than a standard card: the mockup to approve, then custom production. The exact date is confirmed with the mockup.'),
  ('Comment fonctionneront les paiements&nbsp;?', 'Par Stripe, sur le compte de votre entreprise&nbsp;: l’argent va directement chez vous, Stripe prélève ses frais par transaction, et Tapora ne voit jamais les numéros de carte. Les paiements sont en construction («&nbsp;Bientôt&nbsp;»).',
   'How will payments work?', 'Through Stripe, on your business’s own account: the money goes straight to you, Stripe takes its per-transaction fee, and Tapora never sees card numbers. Payments are being built (“Coming soon”).'),
]

DEMO = [
  ('services', D, 'Services de l’hôtel', 'Ménage, serviettes, départ tardif&nbsp;: un tap, et la demande arrive à la réception avec le numéro de la chambre.', 'Hotel services', 'Housekeeping, towels, late check-out: one tap, and the request reaches the front desk with the room number.', '🛎️'),
  ('restaurant', D, 'Restaurant et menus', 'Le menu du restaurant et du service aux chambres, dans la langue du client, avec les allergènes.', 'Restaurant and menus', 'The restaurant and room-service menus, in the guest’s language, with allergens.', '🍽️'),
  ('soin', B, 'Réserver un soin', 'Le client choisit son soin et son heure au spa, sans appeler la réception.', 'Book a treatment', 'The guest picks a spa treatment and a time, without calling the front desk.', '💆'),
  ('guide', D, 'Guide touristique', 'Les attractions, les restaurants et le transport du coin, choisis par l’hôtel.', 'Local guide', 'Attractions, restaurants and transportation nearby, picked by the hotel.', '🗺️'),
  ('experience', D, 'Partager mon expérience', 'La note, puis le lien Google offert à tous — et un mot privé pour l’équipe, si le client le veut.', 'Share my experience', 'The rating, then the Google link offered to everyone — and a private note for the team, if the guest wants.', '★'),
]

def argent(n, l):
    if l == 'fr':
        s = f'{n:,}'.replace(',', NB)
        return f'{s}{NB}$'
    return f'${n:,}'

def page(l):
    fr = l == 'fr'
    t = lambda a, b: a if fr else b
    base = 'https://taporacards.com'
    url = f'{base}/entreprise' if fr else f'{base}/en/business'
    accueil = '/' if fr else '/en/'
    form = '/#demande-entreprise' if fr else '/en/#demande-entreprise'
    prix_unite = '/#prix' if fr else '/en/#prix'
    autre = '/en/business' if fr else '/entreprise'

    def badge():
        return '<span class="ep-badge"></span>'

    def ligne(etat, txt):
        return f'<li class="ep-ligne" data-etat="{etat}"><span>{txt}</span>{badge()}</li>'

    # ---- catalogue
    cat_html = []
    for cat, etat, tf, df, te, de, extra in FONCTIONS:
        icone = CATS[cat][2]
        nom_cat = CATS[cat][0] if fr else CATS[cat][1]
        ajout = f'<span class="ep-ajout">✦ {t("Ajout Tapora", "Tapora extra")}</span>' if extra else ''
        cat_html.append(
            f'<li class="ep-fonction" data-cat="{cat}" data-etat="{etat}"><span class="ep-icone"><svg aria-hidden="true"><use href="#{icone}"/></svg></span>{badge()}'
            f'<span class="ep-texte"><span class="ep-cat">{nom_cat}</span><strong>{t(tf, te)}</strong>{t(df, de)}{ajout}</span></li>')
    nb_d = sum(1 for f in FONCTIONS if f[1] == D)
    nb_b = sum(1 for f in FONCTIONS if f[1] == B)

    # ---- secteurs
    onglets, panneaux = [], []
    for i, s in enumerate(SECTEURS):
        sel = i == 0
        tab = '' if sel else ' tabindex="-1"'
        onglets.append(f'<button type="button" role="tab" id="onglet-{s["id"]}" aria-controls="panneau-{s["id"]}" aria-selected="{"true" if sel else "false"}"{tab} class="ep-onglet" data-onglet="{s["id"]}">{t(s["fr"], s["en"])}</button>')
        total = sum(n for _, _, n in s['lieux'])
        lieux = ''.join(f'<li><span>{t(a, b)}</span><strong>{n}</strong></li>' for a, b, n in s['lieux'])
        fonctions = ''.join(ligne(e, t(a, b)) for e, a, b in s['f'])
        panneaux.append(f'''
          <div role="tabpanel" id="panneau-{s["id"]}" aria-labelledby="onglet-{s["id"]}" class="ep-panneau" data-panneau="{s["id"]}">
            <div class="ep-panneau-fond carte-papier grid gap-8 rounded-[2rem] p-7 sm:p-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <h3 class="titre text-3xl font-medium">{t(s["titre_fr"], s["titre_en"])}</h3>
                <p class="mt-3 leading-relaxed text-encre-doux">{t(s["intro_fr"], s["intro_en"])}</p>
                <p class="mt-6 text-[12px] font-semibold uppercase tracking-[0.16em] text-encre-doux">{t("Exemple de commande", "Sample order")}</p>
                <ul class="ep-emplacements mt-2">{lieux}</ul>
                <p class="ep-exemple"><span>{total} {t("cartes", "cards")} × {argent(30, l)}</span><strong>{argent(total * 30, l)}</strong></p>
              </div>
              <div>
                <p class="text-[12px] font-semibold uppercase tracking-[0.16em] text-encre-doux">{t("Ce que les cartes ouvrent", "What the cards open")}</p>
                <ul class="ep-liste mt-2">{fonctions}</ul>
              </div>
            </div>
          </div>''')

    # ---- scénarios
    sc_json = json.dumps([dict(id=s['id'], nom=t(s['fr'], s['en']), seg=[dict(nom=t(a, b), dest=t(c, d), n=n, couleur=col) for a, b, c, d, n, col in s['seg']]) for s in SCENARIOS], ensure_ascii=False)
    s0 = SCENARIOS[0]
    sc_boutons = ''.join(f'<button type="button" class="ep-puce" data-scenario="{s["id"]}" aria-pressed="{"true" if i == 0 else "false"}">{t(s["fr"], s["en"])}</button>' for i, s in enumerate(SCENARIOS))
    seg0 = ''.join(f'<span class="ep-segment" style="flex-grow:{n};background:{col}"></span>' for *_, n, col in s0['seg'])
    leg0 = ''.join(f'<li class="flex items-center justify-between gap-3"><span class="flex min-w-0 items-center gap-2.5"><span class="size-3 shrink-0 rounded-full" style="background:{col}"></span><span>{t(a, b)} <span class="text-encre-doux">· {t(c, d)}</span></span></span><strong>{n}</strong></li>' for a, b, c, d, n, col in s0['seg'])
    tot0 = sum(x[4] for x in s0['seg'])

    # ---- plateforme
    plat = ''.join(f'<li class="ep-plateforme" data-etat="{e}">{badge()}<strong>{t(a, c)}</strong><span>{t(b, d)}</span></li>' for e, a, b, c, d in PLATEFORME)

    # ---- démo
    demo_boutons = ''.join(f'<button type="button" class="ep-option" data-option="{k}" aria-pressed="{"true" if i == 0 else "false"}"><span class="ep-option-icone" aria-hidden="true">{ic}</span><span>{t(a, c)}</span><span aria-hidden="true">→</span></button>' for i, (k, e, a, b, c, d, ic) in enumerate(DEMO))
    demo_panneaux = ''.join(f'<div class="ep-option-panneau" data-option-panneau="{k}" data-etat="{e}"><p class="flex items-center gap-2 text-2xl" aria-hidden="true">{ic}</p><h3 class="mt-3 text-xl font-semibold">{t(a, c)}</h3>{badge()}<p class="mt-2 leading-relaxed text-encre-doux">{t(b, d)}</p></div>' for k, e, a, b, c, d, ic in DEMO)

    # ---- feuille de route
    route = ''.join(f'<li class="ep-phase" data-etat="bientot"><span class="ep-phase-point" aria-hidden="true"></span><p class="text-sm font-semibold uppercase tracking-[0.16em] text-brique">{t(a, b)}</p>{badge()}<p class="mt-1.5 leading-relaxed">{t(c, d)}</p></li>' for a, b, c, d in FEUILLE)

    # ---- FAQ
    faq_html = ''.join(f'''
        <details class="group py-5" data-apparait>
          <summary class="flex items-center justify-between gap-6 text-lg font-medium">{t(qf, qe)}<span class="plus grid size-8 shrink-0 place-items-center rounded-full bg-sable text-xl leading-none">+</span></summary>
          <div class="reponse"><p class="pt-3 leading-relaxed text-encre-doux">{t(rf, re)}</p></div>
        </details>''' for qf, rf, qe, re in FAQ)

    def brut(s):
        # Texte des données structurées : sans entités ni balises.
        return H.unescape(s.replace('<sup>er</sup>', 'er')).replace(' ', ' ')
    ld = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Service',
          '@id': f'{url}#service',
          'name': 'Tapora Entreprise' if fr else 'Tapora Business',
          'serviceType': t('Cartes NFC et QR personnalisées pour entreprises', 'Custom NFC and QR cards for businesses'),
          'url': url,
          'inLanguage': 'fr-CA' if fr else 'en-CA',
          'provider': {'@type': 'Organization', '@id': f'{base}/#organisation', 'name': 'Tapora Cards', 'legalName': 'Tapora S.E.N.C.', 'url': f'{base}/'},
          'areaServed': [{'@type': 'AdministrativeArea', 'name': 'Québec'}, {'@type': 'Country', 'name': 'Canada'}],
          'audience': {'@type': 'BusinessAudience', 'audienceType': t('Hôtels, restaurants, cafés, bars, spas, salons, cliniques, agences immobilières, concessionnaires, gyms, événements', 'Hotels, restaurants, cafés, bars, spas, salons, clinics, real-estate agencies, car dealerships, gyms, events')},
          'description': t('Des cartes NFC et QR à vos couleurs, sur chaque table, dans chaque chambre, à chaque comptoir. Chaque carte ouvre la destination de votre choix — menu, services, demandes, avis Google — avec des statistiques par carte et par groupe. Destination modifiable sans remplacer la carte.', 'NFC and QR cards in your colours, on every table, in every room, at every counter. Each card opens the destination you choose — menu, services, requests, Google reviews — with stats per card and per group. The destination can change without replacing the card.'),
          'offers': {
            '@type': 'Offer',
            'name': t('Tapora Entreprise — prix par carte, design sur mesure inclus', 'Tapora Business — price per card, custom design included'),
            'price': '30.00', 'priceCurrency': 'CAD',
            'eligibleQuantity': {'@type': 'QuantitativeValue', 'minValue': 25, 'unitText': t('cartes', 'cards')},
            'availability': 'https://schema.org/InStock',
            'url': url,
          },
        },
        {
          '@type': 'FAQPage',
          '@id': f'{url}#faq',
          'mainEntity': [{'@type': 'Question', 'name': brut(t(qf, qe)), 'acceptedAnswer': {'@type': 'Answer', 'text': brut(t(rf, re))}} for qf, rf, qe, re in FAQ],
        },
      ],
    }
    ld_json = json.dumps(ld, ensure_ascii=False, indent=2)

    titre = t('Tapora Entreprise — cartes NFC et QR sur mesure pour hôtels, restaurants et entreprises', 'Tapora Business — custom NFC and QR cards for hotels, restaurants and businesses')
    desc = t('Des cartes NFC et QR à vos couleurs, sur chaque table et dans chaque chambre : menu, services, demandes, avis Google, réservations. 30 $ la carte, dès 25 cartes. Entreprise québécoise.',
             'NFC and QR cards in your colours, on every table and in every room: menus, services, requests, Google reviews, bookings. $30 per card, from 25 cards. A Québec business.')
    og_titre = t('Tapora Entreprise — plus que des avis, plus qu’une carte', 'Tapora Business — connect your customers to more')
    og_desc = t('Chaque carte ouvre ce que vous voulez y mettre : menu, services de l’hôtel, demandes, avis Google. 30 $ la carte, dès 25.', 'Each card opens whatever you choose: menus, hotel services, requests, Google reviews. $30 per card, from 25.')
    og_image = f'{base}/og.png' if fr else f'{base}/og-en.png'

    return f'''<!doctype html>
<html lang="{t("fr-CA", "en-CA")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{titre}</title>
  <meta name="description" content="{desc}">
  <link rel="canonical" href="{url}">
  <link rel="alternate" hreflang="fr-CA" href="{base}/entreprise">
  <link rel="alternate" hreflang="en-CA" href="{base}/en/business">
  <link rel="alternate" hreflang="x-default" href="{base}/entreprise">
  <meta name="theme-color" content="#f7f1e7">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/fraunces-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/styles.css">
  <script src="/js/pret.js"></script>

  <meta property="og:type" content="website">
  <meta property="og:locale" content="{t("fr_CA", "en_CA")}">
  <meta property="og:locale:alternate" content="{t("en_CA", "fr_CA")}">
  <meta property="og:site_name" content="Tapora Cards">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{og_titre}">
  <meta property="og:description" content="{og_desc}">
  <meta property="og:image" content="{og_image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{og_titre}">
  <meta name="twitter:description" content="{og_desc}">
  <meta name="twitter:image" content="{og_image}">

  <script type="application/ld+json">
{ld_json}
  </script>
</head>
<body class="papier overflow-x-hidden">
  <div id="progression" class="fixed inset-x-0 top-0 z-50 h-[3px] origin-left scale-x-0 bg-brique" aria-hidden="true"></div>
  <a href="#contenu" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-encre focus:px-4 focus:py-2 focus:text-creme">{t("Aller au contenu", "Skip to content")}</a>

  <!-- {t("Les icônes de la page, dessinées une fois.", "The page’s icons, drawn once.")} -->
  <svg width="0" height="0" class="absolute" aria-hidden="true" focusable="false">
    <defs>
      <symbol id="i-cartes" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><rect x="6" y="9" width="4.2" height="3.4" rx=".8"/><path d="M13.5 15h4"/></symbol>
      <symbol id="i-client" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-7l-4.2 3.2V17H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/><path d="M8 9.5h8M8 12.5h5"/></symbol>
      <symbol id="i-resto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v7.5M5 3v4.5a2 2 0 0 0 4 0V3M7 10.5V21M16.5 3c-1.8 1.6-2.7 4.2-2.7 7.3h2.7V21"/></symbol>
      <symbol id="i-hotel" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5V19M3 15h18v4M21 15v-2.5a3 3 0 0 0-3-3h-7V15"/><circle cx="7" cy="11.7" r="1.9"/></symbol>
      <symbol id="i-plateforme" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3.5 9 4.8-9 4.8-9-4.8 9-4.8z"/><path d="m3 12.6 9 4.8 9-4.8"/><path d="m3 16.6 9 4.8 9-4.8" opacity=".55"/></symbol>
      <symbol id="i-coche" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 10.5 4 4 8-9"/></symbol>
      <symbol id="i-nfc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7.5 8.5a5 5 0 0 1 0 7M11 6a8.5 8.5 0 0 1 0 12M14.5 3.5a12 12 0 0 1 0 17"/></symbol>
    </defs>
  </svg>

  <!-- Navigation -->
  <header id="entete" class="fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300">
    <nav class="mx-auto flex max-w-6xl items-center justify-between px-5 py-4" aria-label="{t("Principale", "Main")}">
      <a href="{accueil}" class="flex items-center gap-2.5" aria-label="{t("Tapora Cards, accueil", "Tapora Cards, home")}">
        <img src="/favicon.svg" alt="" width="30" height="30" class="size-[30px]">
        <span class="titre text-xl font-semibold">Tapora <span class="font-normal italic text-brique">{t("Entreprise", "Business")}</span></span>
      </a>
      <div class="hidden items-center gap-6 text-[15px] text-encre-doux lg:flex xl:gap-8">
        <a href="#niveaux" class="lien-nav transition hover:text-encre">{t("Comment ça marche", "How it works")}</a>
        <a href="#catalogue" class="lien-nav transition hover:text-encre">{t("Fonctions", "Features")}</a>
        <a href="#secteurs" class="lien-nav transition hover:text-encre">{t("Secteurs", "Industries")}</a>
        <a href="#prix" class="lien-nav transition hover:text-encre">{t("Prix", "Pricing")}</a>
        <a href="#faq" class="lien-nav transition hover:text-encre max-xl:hidden">{t("Questions", "FAQ")}</a>
      </div>
      <div class="flex items-center gap-4">
        <a href="{accueil}" class="lien-nav hidden text-sm font-medium text-encre-doux transition hover:text-encre sm:inline">{t("Cartes d’avis", "Review cards")}</a>
        <a href="{autre}" hreflang="{t("en", "fr")}" lang="{t("en", "fr")}" class="lien-nav text-sm font-medium text-encre-doux transition hover:text-encre" title="{t("English version", "Version française")}">{t("EN", "FR")}</a>
        <a href="{form}" class="rounded-full bg-encre px-5 py-2.5 text-sm font-medium text-creme transition hover:bg-brique"><span class="sm:hidden">{t("Projet", "Project")}</span><span class="max-sm:hidden">{t("Parler de mon projet", "Talk about my project")}</span></a>
      </div>
    </nav>
  </header>

  <main id="contenu">
    <!-- ============================== HÉROS ============================== -->
    <section class="relative overflow-hidden pt-32 pb-24 sm:pt-40">
      <div class="ep-halo pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full" aria-hidden="true"></div>
      <div class="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[1.05fr_1fr]">
        <div class="relative">
          <div class="flex flex-wrap items-center gap-2" data-apparait>
            <p class="inline-flex items-center gap-2 rounded-full bg-sable px-3.5 py-1.5 text-[13px] font-medium text-encre-doux">
              <span class="text-brique">✦</span> {t("Tapora Entreprise · dès 25 cartes", "Tapora Business · from 25 cards")}
            </p>
          </div>
          <h1 class="titre mt-6 text-[2.75rem] leading-[1.04] font-medium sm:text-6xl lg:text-[3.7rem]">
            <span class="titre-ligne block">{t("Plus que des avis.", "More than reviews.")}</span>
            <span class="titre-ligne block">{t("Plus qu’une", "More than a")}
              <span class="souligne italic text-brique">{t("carte", "card")}<svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><path class="trait" d="M3 14 C 40 4, 90 3, 120 9 S 175 16, 197 6" fill="none" stroke="#e4a53a" stroke-width="5" stroke-linecap="round"/></svg></span>.</span>
          </h1>
          <p class="titre mt-5 text-2xl italic text-sapin sm:text-[1.7rem]" data-apparait>{t("Reliez vos clients à tout ce que vous offrez.", "Connect your customers to more.")}</p>
          <p class="mt-5 max-w-xl text-lg leading-relaxed text-encre-doux" data-apparait>
            {t("Tapora Entreprise transforme vos cartes NFC et QR en points de contact entièrement personnalisables. Sur chaque table, dans chaque chambre, à chaque comptoir&nbsp;: chacune ouvre ce que vous voulez y mettre — votre menu, vos services, vos réservations, votre page d’avis Google — et vous voyez laquelle travaille le plus.",
               "Tapora Business turns NFC and QR cards into fully customizable digital touchpoints. On every table, in every room, at every counter: each one opens whatever you choose — your menu, your services, your bookings, your Google review page — and you see which one works hardest.")}
          </p>
          <div class="mt-9 flex flex-wrap items-center gap-4" data-apparait>
            <a href="{form}" data-aimant class="bouton-fleche group inline-flex items-center gap-2 rounded-full bg-brique px-7 py-4 text-[15px] font-semibold text-creme shadow-[0_10px_24px_-10px_rgb(158_65_34_/_0.7)] transition-colors hover:bg-brique-fonce">{t("Parler de mon projet", "Talk about my project")} <span class="fleche" aria-hidden="true">→</span></a>
            <a href="#catalogue" class="group inline-flex items-center gap-2 px-2 py-4 text-[15px] font-medium underline decoration-ligne decoration-2 underline-offset-[6px] transition hover:decoration-brique">{t("Tout ce qu’une carte peut ouvrir", "Everything a card can open")}</a>
          </div>
          <ul class="mt-10 flex flex-wrap gap-x-7 gap-y-2 text-[15px] text-encre-doux" data-apparait>
            <li class="flex items-center gap-2"><svg class="size-4 text-sapin" aria-hidden="true"><use href="#i-coche"/></svg>{t("30&nbsp;$ la carte, dès 25", "$30 per card, from 25")}</li>
            <li class="flex items-center gap-2"><svg class="size-4 text-sapin" aria-hidden="true"><use href="#i-coche"/></svg>{t("Destination modifiable, sans changer la carte", "Change the destination, keep the card")}</li>
            <li class="flex items-center gap-2"><svg class="size-4 text-sapin" aria-hidden="true"><use href="#i-coche"/></svg>{t("Fait au Québec", "Made in Québec")}</li>
          </ul>
        </div>

        <!-- {t("La scène : une carte, un téléphone qui la touche, et la destination qui change", "The scene: a card, a phone tapping it, and the destination changing")} -->
        <div id="scene-entreprise" class="relative mx-auto h-[28rem] w-full max-w-[32rem] sm:h-[32rem]" aria-hidden="true">
          <div id="ep-plan" class="absolute inset-x-0 bottom-4 top-12 rounded-[2.5rem] bg-sable"></div>
          <div class="absolute inset-x-6 bottom-4 h-24 rounded-b-[2.5rem] bg-gradient-to-t from-[#e2d3bd] to-transparent"></div>

          <div id="ep-carte" data-incline class="ep-carte-hero absolute left-1 top-16 z-10 aspect-[1.586] w-[76%] -rotate-6 overflow-hidden rounded-[1.4rem] p-4 text-creme sm:left-3 sm:p-5">
            <div class="ep-reflet"></div>
            <div id="ep-lueur" class="pointer-events-none absolute inset-0 rounded-[1.4rem] opacity-0 ring-4 ring-miel/80"></div>
            <div class="relative flex h-full flex-col justify-between">
              <div class="flex items-start justify-between">
                <div>
                  <p class="titre text-[1.15rem] leading-none font-semibold sm:text-[1.35rem]">Maison Royale</p>
                  <p class="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-creme/70 sm:text-[10px]">{t("Hôtel · Québec", "Hotel · Québec")}</p>
                </div>
                <div class="relative grid size-11 place-items-center sm:size-12">
                  <span class="ep-onde absolute inset-0 rounded-full border-2 border-miel/80"></span>
                  <span class="ep-onde absolute inset-0 rounded-full border-2 border-miel/80"></span>
                  <span class="ep-onde absolute inset-0 rounded-full border-2 border-miel/80"></span>
                  <svg class="size-7 text-creme"><use href="#i-nfc"/></svg>
                </div>
              </div>
              <div class="flex items-end justify-between gap-3">
                <div>
                  <p class="text-[10px] uppercase tracking-[0.18em] text-creme/65">{t("Chambre", "Room")}</p>
                  <p class="titre text-3xl leading-none sm:text-4xl">214</p>
                  <p class="mt-2 text-[9px] text-creme/75 sm:text-[10px]">{t("Touchez ici · ou scannez", "Tap here · or scan")}</p>
                </div>
                <svg viewBox="0 0 21 21" class="size-14 shrink-0 rounded-md bg-creme p-1 sm:size-16">
                  <g fill="#2a211a">
                    <path d="M0 0h7v7H0zM1 1v5h5V1zM2 2h3v3H2zM14 0h7v7h-7zM15 1v5h5V1zM16 2h3v3h-3zM0 14h7v7H0zM1 15v5h5v-5zM2 16h3v3H2z" fill-rule="evenodd"/>
                    <path d="M8 0h2v2H8zM11 1h2v3h-2zM8 3h2v2H8zM9 6h3v2H9zM8 9h2v3H8zM11 9h3v2h-3zM15 8h2v2h-2zM18 9h3v2h-3zM0 8h2v2H0zM3 9h3v2H3zM12 12h3v2h-3zM16 12h2v3h-2zM19 13h2v2h-2zM8 13h3v2H8zM9 16h2v3H9zM12 16h2v2h-2zM15 17h3v2h-3zM19 17h2v4h-2zM12 19h3v2h-3z"/>
                  </g>
                </svg>
              </div>
            </div>
          </div>

          <div id="ep-telephone" class="absolute bottom-3 right-0 z-20 h-[19.5rem] w-[9.25rem] rotate-3 rounded-[1.9rem] bg-encre p-1.5 shadow-[0_30px_50px_-20px_rgb(40_25_15_/_0.6)] sm:right-2 sm:h-[22.5rem] sm:w-[10.5rem]">
            <div class="relative h-full overflow-hidden rounded-[1.5rem] bg-creme">
              <div class="absolute left-1/2 top-1.5 z-10 h-4 w-14 -translate-x-1/2 rounded-full bg-encre"></div>
              <div class="ep-ecran absolute inset-0 px-2.5 pt-7" data-libelle="{t("Menu du restaurant", "Restaurant menu")}">
                <p class="flex items-center justify-between text-[7.5px] font-semibold uppercase tracking-[0.16em] text-brique"><span>{t("Restaurant", "Restaurant")}</span><span class="rounded-full bg-sable px-1.5 py-0.5 tracking-normal text-encre-doux">{t("FR", "EN")} ▾</span></p>
                <p class="titre mt-1 text-[14px] font-semibold leading-tight">{t("La table royale", "The Royal Table")}</p>
                <p class="reflet-or mt-2 rounded-lg px-2 py-1 text-[8px] font-semibold text-encre"><span>{t("Menu du jour · Saumon de l’Atlantique", "Daily special · Atlantic salmon")}</span></p>
                <ul class="mt-2 space-y-1.5 text-[8.5px]">
                  <li class="flex justify-between gap-1 border-b border-ligne pb-1"><span><strong class="font-semibold">{t("Soupe à l’oignon", "French onion soup")}</strong><br><span class="text-encre-doux">🌾 🥛</span></span><span class="font-semibold">{argent(11, l)}</span></li>
                  <li class="flex justify-between gap-1 border-b border-ligne pb-1"><span><strong class="font-semibold">{t("Tartare de bœuf", "Beef tartare")}</strong><br><span class="text-encre-doux">🥚</span></span><span class="font-semibold">{argent(19, l)}</span></li>
                  <li class="flex justify-between gap-1 pb-1"><span><strong class="font-semibold">{t("Pouding chômeur", "Pouding chômeur")}</strong><br><span class="text-encre-doux">🌾 🥛 🥚</span></span><span class="font-semibold">{argent(9, l)}</span></li>
                </ul>
                <p class="mt-1.5 flex items-center justify-between rounded-xl bg-brique px-2 py-1.5 text-[8.5px] font-semibold text-creme">{t("Appeler le serveur", "Call the server")} <span>→</span></p>
              </div>
              <div class="ep-ecran absolute inset-0 px-2.5 pt-7" data-libelle="{t("Service aux chambres", "Room service")}">
                <p class="text-[7.5px] font-semibold uppercase tracking-[0.16em] text-brique">{t("Chambre 214", "Room 214")}</p>
                <p class="titre mt-1 text-[14px] font-semibold leading-tight">{t("Service aux chambres", "Room service")}</p>
                <p class="text-[8px] text-encre-doux">{t("Livré en 30 minutes environ", "Delivered in about 30 minutes")}</p>
                <ul class="mt-2 space-y-1.5 text-[8.5px]">
                  <li class="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 ring-1 ring-ligne"><span><strong class="font-semibold">{t("Club sandwich", "Club sandwich")}</strong><br>{argent(24, l)}</span><span class="grid size-4 place-items-center rounded-full bg-encre text-[9px] text-creme">2</span></li>
                  <li class="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 ring-1 ring-ligne"><span><strong class="font-semibold">{t("Déjeuner continental", "Continental breakfast")}</strong><br>{argent(18, l)}</span><span class="grid size-4 place-items-center rounded-full bg-sable text-[9px]">+</span></li>
                </ul>
                <p class="mt-2.5 flex items-center justify-between rounded-xl bg-sapin px-2 py-1.5 text-[8.5px] font-semibold text-creme"><span>{t("Envoyer la commande", "Send the order")}</span><span>{argent(48, l)}</span></p>
                <p class="mt-1 text-center text-[7px] text-encre-doux">{t("Porté à votre chambre, réglé au départ.", "Brought to your room, settled at check-out.")}</p>
              </div>
              <div class="ep-ecran absolute inset-0 px-2.5 pt-7" data-libelle="{t("Demandes en un tap", "One-tap requests")}">
                <p class="text-[7.5px] font-semibold uppercase tracking-[0.16em] text-brique">{t("Chambre 214", "Room 214")}</p>
                <p class="titre mt-1 text-[14px] font-semibold leading-tight">{t("Que pouvons-nous faire&nbsp;?", "What can we do for you?")}</p>
                <div class="mt-2 grid grid-cols-2 gap-1.5 text-[8px] font-semibold">
                  <span class="rounded-lg bg-sable px-1.5 py-2 text-center">🧺<br>{t("Serviettes", "Towels")}</span>
                  <span class="rounded-lg bg-encre px-1.5 py-2 text-center text-creme">🧹<br>{t("Ménage", "Housekeeping")}</span>
                  <span class="rounded-lg bg-sable px-1.5 py-2 text-center">🛏️<br>{t("Oreillers", "Pillows")}</span>
                  <span class="rounded-lg bg-sable px-1.5 py-2 text-center">🕐<br>{t("Départ tardif", "Late check-out")}</span>
                </div>
                <p class="mt-2 rounded-xl bg-white px-2 py-1.5 text-[8px] ring-1 ring-ligne"><strong class="font-semibold text-sapin">{t("Demande envoyée", "Request sent")}</strong><br><span class="text-encre-doux">{t("La réception est prévenue.", "The front desk has been told.")}</span></p>
              </div>
              <div class="ep-ecran absolute inset-0 px-2.5 pt-7" data-libelle="{t("Avis Google", "Google reviews")}">
                <p class="text-[7.5px] font-semibold uppercase tracking-[0.16em] text-brique">Maison Royale</p>
                <p class="titre mt-1 text-[14px] font-semibold leading-tight">{t("Comment s’est passé votre séjour&nbsp;?", "How was your stay?")}</p>
                <p class="mt-2 flex gap-0.5 text-[17px] leading-none text-miel">★★★★★</p>
                <p class="mt-2.5 rounded-full bg-[#1a73e8] px-2 py-1 text-center text-[8px] font-medium text-white">{t("Laisser un avis sur Google", "Leave a Google review")}</p>
                <p class="mt-1.5 rounded-full bg-sable px-2 py-1 text-center text-[8px] font-medium">{t("Un mot privé pour l’équipe", "A private note for the team")}</p>
                <p class="mt-2 text-center text-[7px] text-encre-doux">{t("Les deux choix, pour tout le monde.", "Both choices, for everyone.")}</p>
              </div>
              <div class="ep-ecran absolute inset-0 px-2.5 pt-7" data-libelle="{t("Votre lien de réservation", "Your booking link")}">
                <p class="rounded-full bg-sable px-2 py-1 text-[7.5px] text-encre-doux">🔒 reservations.maisonroyale.ca</p>
                <p class="titre mt-2 text-[14px] font-semibold leading-tight">{t("Réserver une table", "Book a table")}</p>
                <div class="mt-2 grid grid-cols-3 gap-1 text-center text-[8px]">
                  <span class="rounded-md bg-white py-1 ring-1 ring-ligne">{t("18 h", "6 pm")}</span>
                  <span class="rounded-md bg-encre py-1 text-creme">{t("19 h", "7 pm")}</span>
                  <span class="rounded-md bg-white py-1 ring-1 ring-ligne">{t("20 h", "8 pm")}</span>
                </div>
                <p class="mt-2 text-[8px] text-encre-doux">{t("Votre outil de réservation, tel quel&nbsp;: la carte y mène directement.", "Your booking tool, as is: the card leads straight to it.")}</p>
              </div>
            </div>
          </div>

          <p class="ep-destination absolute left-2 top-0 z-20 flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-full bg-encre px-3.5 py-1.5 text-[12px] font-medium text-creme shadow-[0_10px_24px_-14px_rgb(40_25_15_/_0.8)] sm:left-4">
            <span class="relative size-2 shrink-0 rounded-full bg-miel"><span class="point-vivant absolute inset-0 rounded-full"></span></span>
            <span class="shrink-0">{t("Cette carte ouvre&nbsp;:", "This card opens:")}</span> <strong id="ep-destination" class="truncate font-semibold text-miel">{t("Menu du restaurant", "Restaurant menu")}</strong>
          </p>
          <div id="ep-note" class="pointer-events-none absolute bottom-0 left-2 z-20 max-sm:hidden">
            <p class="titre -rotate-3 text-lg italic text-encre-doux">{t("une carte, la destination de votre choix.", "one card, the destination you choose.")}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================== BANDEAU ============================== -->
    <section class="bandeau border-y border-ligne bg-creme/60 py-5" aria-label="{t("Pour qui", "Who it’s for")}">
      <div class="overflow-hidden">
        <ul class="defile titre flex w-max gap-10 whitespace-nowrap text-2xl italic text-encre-doux">
          {bandeau(l)}
        </ul>
      </div>
    </section>

    <!-- ============================== TROIS NIVEAUX ============================== -->
    <section id="niveaux" class="mx-auto max-w-6xl scroll-mt-20 px-5 py-28">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brique" data-apparait>{t("Comment ça marche", "How it works")}</p>
        <h2 data-mots class="titre mt-3 text-4xl font-medium leading-tight sm:text-5xl">{t("Tapora ne vend pas seulement des cartes.", "Tapora doesn’t just sell cards.")}</h2>
        <p class="mt-5 text-lg leading-relaxed text-encre-doux" data-apparait>{t("Tapora vend des points de connexion, physiques et numériques, entièrement personnalisables. La puce ne change jamais&nbsp;; ce qu’elle ouvre, oui&nbsp;: un lien aujourd’hui, une page complète demain.", "Tapora sells physical and digital connection points, fully customizable. The chip never changes; what it opens can: a link today, a full page tomorrow.")}</p>
      </div>
      <div class="mt-16 grid gap-6 md:grid-cols-3">
        <article data-incline data-etat="disponible" class="ep-niveau carte-papier relative overflow-hidden rounded-[2rem] p-7">
          <div class="ep-reflet" aria-hidden="true"></div>
          {badge()}
          <span class="titre text-5xl text-brique">1</span>
          <h3 class="mt-4 text-xl font-semibold">{t("Une carte, un lien", "One card, one link")}</h3>
          <p class="mt-2 leading-relaxed text-encre-doux">{t("La carte ouvre l’adresse de votre choix&nbsp;: votre page d’avis Google, votre menu, votre outil de réservation, votre formulaire, votre WhatsApp. Modifiable en tout temps.", "The card opens the address you choose: your Google review page, your menu, your booking tool, your form, your WhatsApp. Change it anytime.")}</p>
          <div class="mt-6 flex items-center gap-2 text-[12px]" aria-hidden="true">
            <span class="grid h-9 w-14 shrink-0 place-items-center rounded-lg bg-brique text-creme"><svg class="size-4"><use href="#i-nfc"/></svg></span>
            <span class="ep-tirets h-px flex-1"></span>
            <span class="truncate rounded-full bg-sable px-3 py-1.5 font-medium">{t("votresite.com/menu", "yoursite.com/menu")}</span>
          </div>
        </article>
        <article data-incline data-etat="bientot" class="ep-niveau carte-papier relative overflow-hidden rounded-[2rem] p-7 md:translate-y-6">
          <div class="ep-reflet" aria-hidden="true"></div>
          {badge()}
          <span class="titre text-5xl text-sapin">2</span>
          <h3 class="mt-4 text-xl font-semibold">{t("Une carte, une page", "One card, one page")}</h3>
          <p class="mt-2 leading-relaxed text-encre-doux">{t("Une mini-page à votre image, avec plusieurs boutons&nbsp;: le menu, les services, l’avis, le contact. Pour tous les secteurs — c’est déjà le cas pour les restaurants et les hôtels.", "A mini-page in your branding, with several buttons: the menu, services, reviews, contact. For every industry — already live for restaurants and hotels.")}</p>
          <div class="mx-auto mt-6 w-40 rounded-2xl bg-encre p-1.5" aria-hidden="true">
            <div class="space-y-1 rounded-xl bg-creme p-2 text-[9px] font-semibold">
              <p class="titre text-[12px]">Spa Lumière</p>
              <p class="rounded-md bg-brique px-2 py-1 text-creme">{t("Réserver un soin", "Book a treatment")}</p>
              <p class="rounded-md bg-sable px-2 py-1">{t("Nos services et tarifs", "Services and prices")}</p>
              <p class="rounded-md bg-sable px-2 py-1">{t("Cartes-cadeaux", "Gift cards")}</p>
              <p class="rounded-md bg-sable px-2 py-1">{t("Laisser un avis", "Leave a review")}</p>
            </div>
          </div>
        </article>
        <article data-incline class="ep-niveau carte-papier relative overflow-hidden rounded-[2rem] p-7">
          <div class="ep-reflet" aria-hidden="true"></div>
          <span class="titre text-5xl text-miel">3</span>
          <h3 class="mt-4 text-xl font-semibold">{t("Une carte, des services", "One card, real services")}</h3>
          <p class="mt-2 leading-relaxed text-encre-doux">{t("Les modules Tapora, branchés sur votre équipe&nbsp;: le client demande, commande ou réserve, et votre équipe le voit en direct.", "Tapora modules, connected to your team: guests ask, order or book, and your team sees it live.")}</p>
          <ul class="mt-5 space-y-2 text-[14px]">
            {ligne(D, t("Menu vivant, en 10 langues", "Live menu, in 10 languages"))}
            {ligne(D, t("Appeler le serveur, l’addition", "Call the server, the bill"))}
            {ligne(D, t("Service aux chambres", "Room service"))}
            {ligne(D, t("Demandes en un tap", "One-tap requests"))}
            {ligne(B, t("Réservations", "Reservations"))}
            {ligne(B, t("Paiements", "Payments"))}
          </ul>
        </article>
      </div>
    </section>

    <!-- ============================== DÉMO : UNE CARTE, PLUSIEURS ACTIONS ============================== -->
    <section id="demo" class="scroll-mt-20 bg-sable/70 py-28">
      <div class="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brique" data-apparait>{t("Une carte, plusieurs actions", "One card, several actions")}</p>
          <h2 data-mots class="titre mt-3 text-4xl font-medium leading-tight sm:text-5xl">{t("Bienvenue dans votre espace client.", "Welcome to your guest space.")}</h2>
          <p class="mt-5 text-lg leading-relaxed text-encre-doux" data-apparait>{t("Au lieu d’un seul lien, la carte ouvre une mini-page à l’image de l’établissement. Touchez une option pour voir ce qu’elle fait.", "Instead of a single link, the card opens a mini-page in the venue’s branding. Tap an option to see what it does.")}</p>
          <div id="ep-option-detail" class="mt-8 min-h-[12rem]" aria-live="polite" data-apparait>
            {demo_panneaux}
          </div>
          <ul class="mt-6 space-y-2 text-[14px]" data-apparait>
            {ligne(D, t("Pour les hôtels et les restaurants, avec Tapora Services", "For hotels and restaurants, with Tapora Services"))}
            {ligne(B, t("Pour tous les autres secteurs", "For every other industry"))}
          </ul>
        </div>
        <div class="relative" data-apparait>
          <div id="ep-portail" data-incline class="relative mx-auto w-full max-w-[22rem] overflow-hidden rounded-[2.6rem] bg-encre p-2.5 shadow-[0_40px_70px_-30px_rgb(40_25_15_/_0.7)]">
            <div class="ep-reflet" aria-hidden="true"></div>
            <div class="relative overflow-hidden rounded-[2.1rem] bg-creme px-5 pb-6 pt-10">
              <div class="absolute left-1/2 top-2.5 h-5 w-20 -translate-x-1/2 rounded-full bg-encre"></div>
              <div class="ep-maison rounded-2xl px-5 py-6 text-creme">
                <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-miel">{t("Hôtel", "Hotel")}</p>
                <p class="titre mt-1 text-2xl font-semibold leading-tight">Maison Royale</p>
                <p class="mt-1 text-[13px] text-creme/75">{t("Bienvenue dans votre espace client", "Welcome to your guest space")}</p>
              </div>
              <div class="mt-4 grid gap-2" role="group" aria-label="{t("Options de la démonstration", "Demo options")}">
                {demo_boutons}
              </div>
              <p class="mt-5 text-center text-[11px] text-encre-doux">{t("Propulsé par Tapora Cards", "Powered by Tapora Cards")}</p>
            </div>
          </div>
          <p class="mt-5 text-center text-sm italic text-encre-doux">{t("Maquette illustrative&nbsp;: touchez une option pour voir son utilisation.", "Illustrative mockup: tap an option to see how it’s used.")}</p>
        </div>
      </div>
    </section>

    <!-- ============================== CATALOGUE ============================== -->
    <section id="catalogue" class="scroll-mt-20 py-28">
      <div class="mx-auto max-w-6xl px-5">
        <div class="flex flex-wrap items-end justify-between gap-6">
          <div class="max-w-2xl">
            <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brique" data-apparait>{t("Ce qu’une carte peut ouvrir", "What a card can open")}</p>
            <h2 data-mots class="titre mt-3 text-4xl font-medium leading-tight sm:text-5xl">{t("Une carte. Des possibilités infinies.", "One card. Endless possibilities.")}</h2>
            <p class="mt-5 text-lg leading-relaxed text-encre-doux" data-apparait>{t("«&nbsp;Disponible&nbsp;»&nbsp;: ça fonctionne aujourd’hui — la carte ouvre votre page existante, ou un module Tapora déjà en place. «&nbsp;Bientôt&nbsp;»&nbsp;: en construction chez Tapora, pas encore vendu.", "“Available”: it works today — the card opens your existing page, or a Tapora module that’s already live. “Coming soon”: being built at Tapora, not sold yet.")}</p>
          </div>
          <p class="flex gap-5 text-sm text-encre-doux" data-apparait>
            <span><strong id="ep-total-disponible" class="titre inline-block min-w-[2ch] text-3xl text-sapin">{nb_d}</strong> {t("disponibles", "available")}</span>
            <span><strong id="ep-total-bientot" class="titre inline-block min-w-[2ch] text-3xl text-brique">{nb_b}</strong> {t("bientôt", "coming soon")}</span>
          </p>
        </div>

        <div class="mt-10 space-y-3" data-apparait>
          <div class="flex flex-wrap gap-2" role="group" aria-label="{t("Filtrer par état", "Filter by status")}">
            <button type="button" class="ep-puce" data-filtre-etat="tous" aria-pressed="true">{t("Tout", "All")} <span class="ep-nombre" data-nombre-etat="tous"></span></button>
            <button type="button" class="ep-puce" data-filtre-etat="disponible" aria-pressed="false"><span class="size-2 rounded-full bg-sapin"></span>{t("Disponible", "Available")} <span class="ep-nombre" data-nombre-etat="disponible"></span></button>
            <button type="button" class="ep-puce" data-filtre-etat="bientot" aria-pressed="false"><span class="size-2 rounded-full bg-miel"></span>{t("Bientôt", "Coming soon")} <span class="ep-nombre" data-nombre-etat="bientot"></span></button>
          </div>
          <div class="flex flex-wrap gap-2" role="group" aria-label="{t("Filtrer par secteur", "Filter by industry")}">
            <button type="button" class="ep-puce ep-puce-cat" data-filtre-cat="tous" aria-pressed="true">{t("Tous les secteurs", "All industries")}</button>
            <button type="button" class="ep-puce ep-puce-cat" data-filtre-cat="client" aria-pressed="false"><svg class="size-4" aria-hidden="true"><use href="#i-client"/></svg>{t("Expérience client", "Customer experience")}</button>
            <button type="button" class="ep-puce ep-puce-cat" data-filtre-cat="resto" aria-pressed="false"><svg class="size-4" aria-hidden="true"><use href="#i-resto"/></svg>{t("Restaurants et bars", "Restaurants and bars")}</button>
            <button type="button" class="ep-puce ep-puce-cat" data-filtre-cat="hotel" aria-pressed="false"><svg class="size-4" aria-hidden="true"><use href="#i-hotel"/></svg>{t("Hôtels", "Hotels")}</button>
            <button type="button" class="ep-puce ep-puce-cat" data-filtre-cat="cartes" aria-pressed="false"><svg class="size-4" aria-hidden="true"><use href="#i-cartes"/></svg>{t("Cartes et suivi", "Cards and tracking")}</button>
          </div>
        </div>

        <ul id="ep-fonctions" class="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {"".join(chr(10) + "          " + x for x in cat_html)}
        </ul>
        <p id="ep-vide" class="mt-8 hidden rounded-2xl bg-creme px-5 py-4 text-center text-encre-doux">{t("Aucune fonction ne correspond à ce filtre pour l’instant.", "No feature matches this filter yet.")}</p>
      </div>
    </section>

    <!-- ============================== SECTEURS ============================== -->
    <section id="secteurs" class="scroll-mt-20 bg-sable/70 py-28">
      <div class="mx-auto max-w-6xl px-5">
        <div class="max-w-2xl">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brique" data-apparait>{t("Par secteur", "By industry")}</p>
          <h2 data-mots class="titre mt-3 text-4xl font-medium leading-tight sm:text-5xl">{t("Où vont les cartes, et ce qu’elles ouvrent.", "Where the cards go, and what they open.")}</h2>
          <p class="mt-5 text-lg leading-relaxed text-encre-doux" data-apparait>{t("Le marché est bien plus vaste que les commerces qui veulent des avis Google. «&nbsp;Disponible&nbsp;»&nbsp;: la carte ouvre votre page, votre vidéo ou votre PDF existants. «&nbsp;Bientôt&nbsp;»&nbsp;: Tapora bâtit l’outil.", "The market is far bigger than businesses that want Google reviews. “Available”: the card opens your existing page, video or PDF. “Coming soon”: Tapora is building the tool.")}</p>
        </div>

        <div class="relative mt-12" data-apparait>
          <div class="ep-onglets relative -mx-5 overflow-x-auto px-5 pb-2" data-lenis-prevent>
            <div role="tablist" aria-label="{t("Secteurs", "Industries")}" class="relative flex w-max gap-1 rounded-full bg-creme p-1.5 shadow-[inset_0_0_0_1px_#e2d6c3]">
              <span id="ep-indicateur" class="ep-indicateur absolute inset-y-1.5 left-1.5 rounded-full bg-encre" aria-hidden="true"></span>
              {"".join(onglets)}
            </div>
          </div>
          <div class="mt-6">{"".join(panneaux)}
          </div>
          <p class="mt-6 text-encre-doux">{t("Et aussi&nbsp;: les musées, les commerces de détail, les centres commerciaux, les écoles privées, les résidences touristiques, les entreprises de services et les espaces de coworking.", "And also: museums, retail stores, shopping malls, private schools, tourist residences, service businesses and coworking spaces.")}</p>
        </div>
      </div>
    </section>

    <!-- ============================== EMPLACEMENTS ============================== -->
    <section id="emplacements" class="mx-auto max-w-6xl scroll-mt-20 px-5 py-28">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brique" data-apparait>{t("Une commande", "One order")}</p>
        <h2 data-mots class="titre mt-3 text-4xl font-medium leading-tight sm:text-5xl">{t("Des cartes différentes selon les emplacements.", "Different cards for different places.")}</h2>
        <p class="mt-5 text-lg leading-relaxed text-encre-doux" data-apparait>{t("Chaque zone de l’établissement a son design, son message et sa destination. Le minimum de 25 cartes compte pour la commande entière.", "Each area of the venue gets its own design, message and destination. The 25-card minimum counts for the whole order.")}</p>
      </div>

      <div class="mt-12 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div id="ep-repartition" class="carte-papier rounded-[2rem] p-7 sm:p-9" data-apparait data-scenarios='{H.escape(sc_json, quote=True)}'>
          <div class="flex flex-wrap gap-2" role="group" aria-label="{t("Exemples", "Examples")}">{sc_boutons}</div>
          <div class="mt-8 flex flex-wrap items-end justify-between gap-4">
            <p><span id="ep-repartition-cartes" class="titre text-5xl font-medium">{tot0}</span> <span class="text-encre-doux">{t("cartes", "cards")}</span></p>
            <p class="text-right"><span class="block text-sm text-encre-doux">{t("à 30&nbsp;$ la carte", "at $30 per card")}</span><span id="ep-repartition-total" class="titre text-4xl font-medium text-brique">{argent(tot0 * 30, l)}</span></p>
          </div>
          <div id="ep-barre" class="mt-6 flex h-14 w-full overflow-hidden rounded-2xl bg-sable" aria-hidden="true">{seg0}</div>
          <ul id="ep-legende" class="mt-6 grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">{leg0}</ul>
        </div>

        <div id="ep-calcul" class="relative overflow-hidden rounded-[2rem] bg-encre p-7 text-creme sm:p-9" data-apparait>
          <div class="ep-halo-sombre pointer-events-none absolute -right-24 -top-24 size-72 rounded-full" aria-hidden="true"></div>
          <h3 class="relative titre text-2xl font-medium">{t("Votre commande", "Your order")}</h3>
          <label for="ep-nb" class="relative mt-6 block text-sm text-creme/70">{t("Nombre de cartes", "Number of cards")}</label>
          <div class="relative mt-2 flex items-center gap-2">
            <button type="button" data-ep-moins class="grid size-12 shrink-0 place-items-center rounded-full bg-creme/10 text-2xl transition hover:bg-creme/20" aria-label="{t("Une carte de moins", "One card fewer")}">−</button>
            <input id="ep-nb" type="number" inputmode="numeric" min="1" max="5000" value="25" class="ep-nombre-champ h-12 w-full min-w-0 rounded-2xl bg-creme/10 text-center text-2xl font-semibold text-creme">
            <button type="button" data-ep-plus class="grid size-12 shrink-0 place-items-center rounded-full bg-creme/10 text-2xl transition hover:bg-creme/20" aria-label="{t("Une carte de plus", "One more card")}">+</button>
          </div>
          <div class="relative mt-4 flex flex-wrap gap-2">
            <button type="button" class="ep-puce-sombre" data-ep-nb="25">25</button>
            <button type="button" class="ep-puce-sombre" data-ep-nb="50">50</button>
            <button type="button" class="ep-puce-sombre" data-ep-nb="125">125</button>
            <button type="button" class="ep-puce-sombre" data-ep-nb="135">135</button>
          </div>
          <div class="relative mt-7 min-h-[7rem] border-t border-creme/15 pt-6" aria-live="polite">
            <div id="ep-resultat">
              <p class="text-sm text-creme/70" id="ep-detail">{t("25 cartes × 30&nbsp;$", "25 cards × $30")}</p>
              <p id="ep-total" class="titre mt-1 text-5xl font-medium text-miel">{argent(750, l)}</p>
            </div>
            <p id="ep-minimum" class="hidden rounded-2xl bg-creme/10 px-4 py-3 text-[15px] leading-relaxed">{t("Minimum 25 cartes par commande — à l’unité&nbsp;: 35&nbsp;$, sans minimum.", "Minimum 25 cards per order — individual cards: $35, no minimum.")} <a href="{prix_unite}" class="font-semibold text-miel underline underline-offset-4">{t("Voir les cartes à l’unité", "See individual cards")}</a></p>
          </div>
          <p class="relative mt-4 text-xs text-creme/55">{t("Prix des cartes, design sur mesure inclus. Les modules logiciels se chiffrent selon vos besoins.", "Card pricing, custom design included. Software modules are quoted to your needs.")}</p>
        </div>
      </div>
    </section>

    <!-- ============================== DESTINATION ============================== -->
    <section id="destination" class="scroll-mt-20 bg-sable/70 py-28">
      <div class="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brique" data-apparait>{t("Toujours à jour", "Always up to date")}</p>
          <h2 data-mots class="titre mt-3 text-4xl font-medium leading-tight sm:text-5xl">{t("Changez la destination, pas la carte.", "Change the destination, not the card.")}</h2>
          <p class="mt-5 text-lg leading-relaxed text-encre-doux" data-apparait>{t("Une carte peut rester en place pendant des années. Son lien mène à une page modifiable&nbsp;: le menu change, la promotion finit, le site déménage, et la carte suit — sans remplacement physique.", "A card can stay in place for years. Its link leads to an editable page: the menu changes, the promotion ends, the website moves, and the card follows — no physical replacement.")}</p>
          <ul class="mt-8 space-y-2.5 text-[15px]" data-apparait>
            {ligne(D, t("Changement fait par Tapora, sur demande", "Change made by Tapora, on request"))}
            {ligne(B, t("Changement en lot, pour tout un groupe", "Batch change, for a whole group"))}
            {ligne(B, t("Destination programmée, retour automatique", "Scheduled destination, automatic switch-back"))}
          </ul>
        </div>
        <div id="ep-frise" class="carte-papier relative rounded-[2rem] p-7 sm:p-9" data-apparait aria-hidden="true">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="grid h-10 w-16 shrink-0 place-items-center rounded-lg bg-brique text-creme shadow-[0_10px_20px_-12px_rgb(110_40_15_/_0.8)]"><svg class="size-5"><use href="#i-nfc"/></svg></span>
              <div><p class="font-semibold">{t("Table 7", "Table 7")}</p><p class="text-sm text-encre-doux">{t("La même carte, toute l’année", "The same card, all year")}</p></div>
            </div>
            <p class="shrink-0 rounded-full bg-sable px-3 py-1.5 text-[13px]">→ <strong id="ep-frise-cible" class="font-semibold">{t("Le menu", "The menu")}</strong></p>
          </div>
          <div class="relative mt-10 px-2">
            <div class="h-1.5 rounded-full bg-sable"></div>
            <div id="ep-frise-plein" class="absolute left-2 top-0 h-1.5 w-0 rounded-full bg-brique"></div>
            <div class="absolute inset-x-2 -top-[7px] flex justify-between">
              <span class="ep-jalon" data-jalon="0"></span><span class="ep-jalon" data-jalon="1"></span><span class="ep-jalon" data-jalon="2"></span>
            </div>
          </div>
          <div class="mt-5 grid grid-cols-3 gap-3 text-[13px]">
            <div class="ep-etape-frise" data-jalon="0"><p class="font-semibold">{t("Septembre", "September")}</p><p class="text-encre-doux">{t("Le menu", "The menu")}</p></div>
            <div class="ep-etape-frise text-center" data-jalon="1"><p class="font-semibold">{t("Décembre", "December")}</p><p class="text-encre-doux">{t("Le menu des fêtes", "The holiday menu")}</p></div>
            <div class="ep-etape-frise text-right" data-jalon="2"><p class="font-semibold">{t("Janvier", "January")}</p><p class="text-encre-doux">{t("Retour au menu", "Back to the menu")}</p></div>
          </div>
          <div class="relative mx-auto mt-8 h-44 w-40 rounded-[1.6rem] bg-encre p-1.5">
            <div class="relative h-full overflow-hidden rounded-[1.25rem] bg-creme">
              <div class="ep-frise-ecran absolute inset-0 p-3" data-cible="{t("Le menu", "The menu")}">
                <p class="text-[8px] font-semibold uppercase tracking-[0.16em] text-brique">{t("Table 7", "Table 7")}</p>
                <p class="titre mt-1 text-[15px] font-semibold">{t("Le menu", "The menu")}</p>
                <ul class="mt-2 space-y-1 text-[9px]"><li class="flex justify-between"><span>{t("Bavette", "Flank steak")}</span><span>{argent(29, l)}</span></li><li class="flex justify-between"><span>Risotto</span><span>{argent(24, l)}</span></li><li class="flex justify-between"><span>{t("Tarte au sucre", "Sugar pie")}</span><span>{argent(9, l)}</span></li></ul>
              </div>
              <div class="ep-frise-ecran absolute inset-0 bg-[#2f5c47] p-3 text-creme opacity-0" data-cible="{t("Le menu des fêtes", "The holiday menu")}">
                <p class="text-[8px] font-semibold uppercase tracking-[0.16em] text-miel">{t("Table 7", "Table 7")} · ✦</p>
                <p class="titre mt-1 text-[15px] font-semibold">{t("Menu des fêtes", "Holiday menu")}</p>
                <ul class="mt-2 space-y-1 text-[9px]"><li class="flex justify-between"><span>{t("Tourtière", "Tourtière")}</span><span>{argent(26, l)}</span></li><li class="flex justify-between"><span>{t("Dinde farcie", "Stuffed turkey")}</span><span>{argent(32, l)}</span></li><li class="flex justify-between"><span>{t("Bûche de Noël", "Yule log")}</span><span>{argent(11, l)}</span></li></ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================== PLATEFORME ============================== -->
    <section id="plateforme" class="mx-auto max-w-6xl scroll-mt-20 px-5 py-28">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brique" data-apparait>{t("La plateforme", "The platform")}</p>
        <h2 data-mots class="titre mt-3 text-4xl font-medium leading-tight sm:text-5xl">{t("Au-delà de la carte&nbsp;: la plateforme Tapora Entreprise.", "Beyond the card: the Tapora Business platform.")}</h2>
        <p class="mt-5 text-lg leading-relaxed text-encre-doux" data-apparait>{t("La carte peut simplement contenir une adresse. Les menus, les formulaires, les statistiques et les réservations demandent des outils logiciels&nbsp;: les voici, et où ils en sont.", "A card can simply hold an address. Menus, forms, stats and bookings need software: here it is, and where each piece stands.")}</p>
      </div>
      <div class="mt-14 grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div id="ep-tableau" class="relative overflow-hidden rounded-[2rem] bg-encre p-6 text-creme shadow-[0_40px_70px_-30px_rgb(40_25_15_/_0.7)] sm:p-8" data-apparait aria-hidden="true">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm font-semibold">Maison Royale <span class="font-normal text-creme/55">· {t("30 derniers jours", "last 30 days")}</span></p>
            <span class="rounded-full bg-creme/10 px-2.5 py-1 text-[11px] text-creme/70">{t("exemple, chiffres inventés", "example, made-up figures")}</span>
          </div>
          <div class="mt-6 grid grid-cols-3 gap-3">
            <div class="rounded-2xl bg-creme/[0.06] p-3.5"><p class="text-[11px] text-creme/55">{t("Taps", "Taps")}</p><p class="titre mt-1 text-2xl sm:text-3xl"><span class="compteur" data-valeur="4812">{t("4&nbsp;812", "4,812")}</span></p></div>
            <div class="rounded-2xl bg-creme/[0.06] p-3.5"><p class="text-[11px] text-creme/55">{t("Carte en tête", "Top card")}</p><p class="mt-1 text-[15px] font-semibold leading-tight">{t("Chambre 214", "Room 214")}</p><p class="text-[11px] text-miel">96 taps</p></div>
            <div class="rounded-2xl bg-creme/[0.06] p-3.5"><p class="text-[11px] text-creme/55">{t("Avis Google", "Google reviews")}</p><p class="titre mt-1 text-2xl sm:text-3xl">+<span class="compteur" data-valeur="61">61</span></p></div>
          </div>
          <p class="mt-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-creme/45">{t("Par groupe", "By group")}</p>
          <ul class="mt-3 space-y-3 text-[13px]">
            <li><div class="flex justify-between"><span>{t("Chambres", "Rooms")}</span><span class="text-creme/70">{t("2&nbsp;140", "2,140")}</span></div><div class="mt-1.5 h-2.5 rounded-full bg-creme/10"><div class="ep-jauge h-full rounded-full bg-brique" style="width:100%"></div></div></li>
            <li><div class="flex justify-between"><span>{t("Restaurant", "Restaurant")}</span><span class="text-creme/70">{t("1&nbsp;390", "1,390")}</span></div><div class="mt-1.5 h-2.5 rounded-full bg-creme/10"><div class="ep-jauge h-full rounded-full bg-miel" style="width:65%"></div></div></li>
            <li><div class="flex justify-between"><span>{t("Réception", "Front desk")}</span><span class="text-creme/70">760</span></div><div class="mt-1.5 h-2.5 rounded-full bg-creme/10"><div class="ep-jauge h-full rounded-full bg-[#7fae95]" style="width:35.5%"></div></div></li>
            <li><div class="flex justify-between"><span>Spa</span><span class="text-creme/70">312</span></div><div class="mt-1.5 h-2.5 rounded-full bg-creme/10"><div class="ep-jauge h-full rounded-full bg-[#d89a83]" style="width:14.6%"></div></div></li>
            <li><div class="flex justify-between"><span>{t("Espaces communs", "Common areas")}</span><span class="text-creme/70">210</span></div><div class="mt-1.5 h-2.5 rounded-full bg-creme/10"><div class="ep-jauge h-full rounded-full bg-creme/60" style="width:9.8%"></div></div></li>
          </ul>
          <div class="mt-7 flex flex-wrap gap-2 text-[11px]">
            <span class="rounded-full bg-creme/10 px-3 py-1.5">⬇ {t("Export pour Excel", "Excel export")}</span>
            <span class="rounded-full bg-creme/10 px-3 py-1.5">✉ {t("Rapport du 1<sup>er</sup> du mois", "Report on the 1st")}</span>
            <span class="rounded-full bg-creme/10 px-3 py-1.5">🔒 {t("Page protégée", "Protected page")}</span>
          </div>
        </div>
        <ul class="grid gap-3 sm:grid-cols-2">{plat}</ul>
      </div>
    </section>

    <!-- ============================== COMPARAISON ============================== -->
    <section id="comparaison" class="scroll-mt-20 bg-sable/70 py-28">
      <div class="mx-auto max-w-5xl px-5">
        <div class="max-w-2xl">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brique" data-apparait>{t("Deux offres", "Two offers")}</p>
          <h2 data-mots class="titre mt-3 text-4xl font-medium leading-tight sm:text-5xl">{t("Les avis comme porte d’entrée. L’Entreprise pour tout le reste.", "Reviews as the way in. Business for everything else.")}</h2>
        </div>
        <div class="ep-tableau-comparaison carte-papier mt-12 overflow-x-auto rounded-[2rem] p-2 sm:p-4" data-apparait>
          <table class="w-full min-w-[34rem] border-collapse text-left text-[15px]">
            <thead>
              <tr>
                <th scope="col" class="w-[28%] p-4"><span class="sr-only">{t("Critère", "Criterion")}</span></th>
                <th scope="col" class="p-4 align-bottom"><span class="block text-sm font-semibold uppercase tracking-[0.14em] text-encre-doux">{t("Cartes à l’unité", "Individual cards")}</span><span class="titre text-xl font-medium">{t("Avis Google", "Google reviews")}</span></th>
                <th scope="col" class="ep-colonne-vedette rounded-t-2xl p-4 align-bottom"><span class="block text-sm font-semibold uppercase tracking-[0.14em] text-miel">Tapora</span><span class="titre text-xl font-medium">{t("Entreprise", "Business")}</span></th>
              </tr>
            </thead>
            <tbody id="ep-lignes-comparaison">
              {comparaison(l)}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ============================== VISION ============================== -->
    <section id="vision" class="mx-auto max-w-5xl scroll-mt-20 px-5 py-32 text-center">
      <p id="ep-vision" class="titre text-[2.4rem] font-medium leading-[1.12] sm:text-6xl">{t("Conçu pour votre entreprise. À votre image. Fait pour connecter.", "Designed for your business. Customized to your brand. Built to connect.")}</p>
      <p class="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-encre-doux" data-apparait>{t("Tapora ne devrait pas être connue seulement pour les cartes d’avis&nbsp;: c’est la marque qu’on appelle pour relier ses espaces physiques à ses services numériques.", "Tapora shouldn’t be known only for review cards: it’s the brand you call to connect your physical spaces to your digital services.")}</p>
      <p class="mt-6 font-semibold text-brique" data-apparait>{t("Tapora Cards — Connectez-vous à vos clients.", "Tapora Cards — Connect with your customers.")}</p>
    </section>

    <!-- ============================== TAPORA S'OCCUPE DE TOUT ============================== -->
    <section id="tout" class="scroll-mt-20 bg-sable/70 py-28">
      <div class="mx-auto max-w-6xl px-5">
        <div class="grid items-end gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brique" data-apparait>{t("Prêt à utiliser", "Ready to use")}</p>
            <h2 data-mots class="titre mt-3 text-4xl font-medium leading-tight sm:text-5xl">{t("Tapora s’occupe de tout.", "Tapora takes care of everything.")}</h2>
            <p class="mt-5 text-lg leading-relaxed text-encre-doux" data-apparait>{t("Pas besoin de savoir quelle puce NFC acheter, comment programmer vos cartes ni comment les dessiner. Vous nous dites ce que vous voulez&nbsp;; on vous livre une solution prête à utiliser.", "No need to know which NFC chip to buy, how to program your cards or how to design them. You tell us what you want; we deliver a ready-to-use solution.")}</p>
          </div>
          <figure id="ep-citation" class="carte-papier relative rounded-[2rem] p-7 sm:p-9" data-apparait>
            <span class="titre absolute -top-6 left-6 text-7xl leading-none text-brique" aria-hidden="true">«</span>
            <blockquote class="titre text-2xl font-medium leading-snug">{t("Nous voulons 50 cartes pour nos tables, avec notre logo, nos couleurs et un accès à notre menu.", "We want 50 cards for our tables, with our logo, our colours and access to our menu.")}</blockquote>
            <figcaption class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ligne pt-4 text-[15px]">
              <span class="text-encre-doux">{t("Et Tapora livre tout, prêt à poser.", "And Tapora delivers it all, ready to install.")}</span>
              <span class="rounded-full bg-encre px-4 py-2 font-semibold text-creme">{t("50 × 30&nbsp;$ =", "50 × $30 =")} <span class="text-miel">{argent(1500, l)}</span></span>
            </figcaption>
          </figure>
        </div>
        <ol class="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <li class="etape soulevable carte-papier rounded-3xl p-7 lg:-rotate-1 [--penche:-1deg]">
            <span class="titre text-5xl text-brique">1</span>
            <h3 class="mt-4 text-xl font-semibold">{t("Votre projet", "Your project")}</h3>
            <p class="mt-2 leading-relaxed text-encre-doux">{t("Le nombre d’emplacements, ce que chacun doit ouvrir, vos couleurs. Le formulaire suffit.", "How many spots, what each should open, your colours. The form is enough.")}</p>
          </li>
          <li class="etape soulevable carte-papier rounded-3xl p-7 lg:translate-y-6 lg:rotate-1 [--penche:1deg]">
            <span class="titre text-5xl text-sapin">2</span>
            <h3 class="mt-4 text-xl font-semibold">{t("La maquette", "The mockup")}</h3>
            <p class="mt-2 leading-relaxed text-encre-doux">{t("Le design de chaque zone, le nom de chaque carte, la destination de chacune&nbsp;: vous approuvez.", "The design for each area, the name on each card, where each one leads: you approve.")}</p>
          </li>
          <li class="etape soulevable carte-papier rounded-3xl p-7 lg:-rotate-1 [--penche:-1deg]">
            <span class="titre text-5xl text-miel">3</span>
            <h3 class="mt-4 text-xl font-semibold">{t("La fabrication", "Production")}</h3>
            <p class="mt-2 leading-relaxed text-encre-doux">{t("Chaque carte est écrite, testée et prête à poser. Ses statistiques commencent au premier tap.", "Every card is written, tested and ready to install. Its stats start with the first tap.")}</p>
          </li>
          <li class="etape soulevable carte-papier rounded-3xl p-7 lg:translate-y-6 lg:rotate-1 [--penche:1deg]">
            <span class="titre text-5xl text-encre">4</span>
            <h3 class="mt-4 text-xl font-semibold">{t("On reste là", "We stay close")}</h3>
            <p class="mt-2 leading-relaxed text-encre-doux">{t("Une destination à changer, une zone à ajouter, une question sur vos chiffres&nbsp;: on s’en occupe.", "A destination to change, an area to add, a question about your numbers: we handle it.")}</p>
          </li>
        </ol>
        <h3 class="titre mt-24 text-3xl font-medium" data-apparait>{t("Inclus dans chaque commande", "Included in every order")}</h3>
        <ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {inclus(l)}
        </ul>
      </div>
    </section>

    <!-- ============================== FEUILLE DE ROUTE ============================== -->
    <section id="feuille-de-route" class="mx-auto max-w-4xl scroll-mt-20 px-5 py-28">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brique" data-apparait>{t("Ce qui arrive", "What’s coming")}</p>
        <h2 data-mots class="titre mt-3 text-4xl font-medium leading-tight sm:text-5xl">{t("La carte reste. Les services s’ajoutent.", "The card stays. The services keep coming.")}</h2>
        <p class="mt-5 text-lg leading-relaxed text-encre-doux" data-apparait>{t("Ce que Tapora construit, dans l’ordre. Pas de date promise&nbsp;: chaque fonction passe à «&nbsp;Disponible&nbsp;» le jour où elle marche.", "What Tapora is building, in order. No promised dates: each feature becomes “Available” the day it works.")}</p>
      </div>
      <ol id="ep-route" class="relative mt-14 space-y-10 pl-10">
        <span id="ep-route-ligne" class="absolute bottom-2 left-[11px] top-2 w-0.5 origin-top rounded-full bg-brique/70" aria-hidden="true"></span>
        {route}
      </ol>
    </section>

    <!-- ============================== PRIX ============================== -->
    <section id="prix" class="scroll-mt-20 bg-sable/70 py-28">
      <div class="mx-auto max-w-6xl px-5">
        <div class="max-w-2xl">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brique" data-apparait>{t("Prix", "Pricing")}</p>
          <h2 data-mots class="titre mt-3 text-4xl font-medium leading-tight sm:text-5xl">{t("Un prix par carte. Les logiciels, selon vos besoins.", "One price per card. Software, to your needs.")}</h2>
          <p class="mt-5 text-lg leading-relaxed text-encre-doux" data-apparait>{t("Le prix Entreprise commence à 30&nbsp;$ la carte, avec une commande minimale de 25 cartes. Chaque carte est à votre image et mène à la destination numérique de votre choix.", "Enterprise pricing starts at $30 per card, with a minimum order of 25 cards. Every card can be customized to reflect your brand and connect your customers to the digital destination of your choice.")}</p>
        </div>
        <div class="mt-14 grid gap-6 lg:grid-cols-[1.15fr_1fr_1fr]">
          <article data-incline class="relative overflow-hidden rounded-[2rem] bg-encre p-8 text-creme shadow-[0_40px_70px_-30px_rgb(40_25_15_/_0.75)]" data-apparait>
            <div class="ep-reflet" aria-hidden="true"></div>
            <div class="ep-halo-sombre pointer-events-none absolute -right-24 -top-24 size-72 rounded-full" aria-hidden="true"></div>
            <p class="relative text-sm font-semibold uppercase tracking-[0.18em] text-miel">{t("Entreprise", "Business")}</p>
            <p class="relative mt-4"><span class="titre text-6xl font-medium">{argent(30, l)}</span> <span class="text-creme/70">/ {t("carte", "card")}</span></p>
            <p class="relative mt-1 text-creme/70">{t("dès 25 cartes · design sur mesure inclus", "from 25 cards · custom design included")}</p>
            <ul class="relative mt-6 space-y-2 text-[15px]">
              <li class="flex justify-between border-b border-creme/10 pb-2"><span>25 {t("cartes", "cards")}</span><strong>{argent(750, l)}</strong></li>
              <li class="flex justify-between border-b border-creme/10 pb-2"><span>40 {t("cartes", "cards")}</span><strong>{argent(1200, l)}</strong></li>
              <li class="flex justify-between border-b border-creme/10 pb-2"><span>50 {t("cartes", "cards")}</span><strong>{argent(1500, l)}</strong></li>
              <li class="flex justify-between border-b border-creme/10 pb-2"><span>125 {t("cartes", "cards")}</span><strong>{argent(3750, l)}</strong></li>
              <li class="flex justify-between border-b border-creme/10 pb-2"><span>135 {t("cartes", "cards")}</span><strong>{argent(4050, l)}</strong></li>
            </ul>
            <a href="{form}" data-aimant class="bouton-fleche relative mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-creme px-6 py-3.5 text-[15px] font-semibold text-encre transition-colors hover:bg-white">{t("Parler de mon projet", "Talk about my project")} <span class="fleche" aria-hidden="true">→</span></a>
          </article>
          <article data-incline class="carte-papier relative overflow-hidden rounded-[2rem] p-8" data-apparait>
            <div class="ep-reflet" aria-hidden="true"></div>
            <p class="text-sm font-semibold uppercase tracking-[0.18em] text-sapin">{t("Modules logiciels", "Software modules")}</p>
            <p class="titre mt-4 text-3xl font-medium leading-tight">{t("Selon vos besoins — sur soumission", "To your needs — on quote")}</p>
            <p class="mt-3 leading-relaxed text-encre-doux">{t("Menu vivant, demandes, service aux chambres, portail de l’équipe, et les modules qui arrivent&nbsp;: on chiffre ensemble ce dont votre établissement a besoin. Un formulaire simple et une intégration au système d’un hôtel n’ont pas du tout le même coût.", "Live menu, requests, room service, staff portal, and the modules on the way: we price together what your venue needs. A simple form and a hotel-system integration don’t cost the same at all.")}</p>
          </article>
          <article data-incline class="carte-papier relative overflow-hidden rounded-[2rem] p-8" data-apparait>
            <div class="ep-reflet" aria-hidden="true"></div>
            <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brique">{t("À l’unité", "Individual cards")}</p>
            <p class="mt-4"><span class="titre text-5xl font-medium">{argent(35, l)}</span> <span class="text-encre-doux">/ {t("carte", "card")}</span></p>
            <p class="mt-1 text-encre-doux">{t("sans minimum · prête à poser", "no minimum · ready to install")}</p>
            <p class="mt-4 leading-relaxed text-encre-doux">{t("Pour quelques cartes seulement&nbsp;: le design standard Tapora, bilingue, avec les statistiques incluses.", "For just a few cards: the standard bilingual Tapora design, with stats included.")}</p>
            <a href="{prix_unite}" class="bouton-fleche group mt-6 inline-flex items-center gap-2 font-semibold text-brique">{t("Voir les cartes à l’unité", "See individual cards")} <span class="fleche" aria-hidden="true">→</span></a>
          </article>
        </div>
      </div>
    </section>

    <!-- ============================== FAQ ============================== -->
    <section id="faq" class="mx-auto max-w-3xl scroll-mt-20 px-5 py-28">
      <h2 data-mots class="titre text-4xl font-medium leading-tight sm:text-5xl">{t("Questions fréquentes", "Frequently asked questions")}</h2>
      <div class="mt-10 divide-y divide-ligne border-y border-ligne">{faq_html}
      </div>
    </section>

    <!-- ============================== CONTACT ============================== -->
    <section id="contact" class="mx-auto max-w-6xl scroll-mt-20 px-5 pb-24">
      <div class="relative overflow-hidden rounded-[2.5rem] bg-sapin px-7 py-16 text-creme sm:px-14" data-apparait>
        <svg id="ep-ondes" viewBox="0 0 110 80" class="pointer-events-none absolute -right-6 -top-4 w-64 text-creme/15 sm:w-80" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
          <rect class="ep-carte-cta" x="10" y="30" width="48" height="32" rx="6" fill="currentColor" stroke="none"/>
          <path class="ep-arc" d="M68 34a10 10 0 0 1 0 14"/><path class="ep-arc" d="M76 28a19 19 0 0 1 0 26"/><path class="ep-arc" d="M84 22a28 28 0 0 1 0 38"/>
        </svg>
        <div class="relative max-w-2xl">
          <h2 data-mots class="titre text-4xl font-medium leading-tight sm:text-5xl">{t("Dites-nous ce que vos cartes doivent ouvrir.", "Tell us what your cards should open.")}</h2>
          <p class="mt-5 text-lg leading-relaxed text-creme/80">{t("Le nombre d’emplacements, ce que chacun doit ouvrir, vos couleurs&nbsp;: on vous revient avec une maquette et un prix — en français, et vite.", "How many spots, what each one should open, your colours: we come back with a mockup and a price — fast.")}</p>
          <div class="mt-9 flex flex-wrap gap-3">
            <a href="{form}" data-aimant class="bouton-fleche group inline-flex items-center gap-2 rounded-full bg-creme px-7 py-4 text-[15px] font-semibold text-sapin transition-colors hover:bg-white">{t("Parler de mon projet", "Talk about my project")} <span class="fleche" aria-hidden="true">→</span></a>
            <a href="{courriel(l)}" class="rounded-full border border-creme/30 px-7 py-4 text-[15px] font-medium transition hover:bg-creme/10">contact@taporacards.com</a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="border-t border-ligne">
    <div class="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-10 text-sm text-encre-doux sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-2.5">
        <img src="/marque/sceau-{t("fr", "en")}.svg" alt="" width="56" height="56" class="sceau-pied size-14">
        <span><strong class="font-semibold text-encre">Tapora S.E.N.C.</strong> · NEQ 3382462367 · {t("entreprise québécoise", "a Québec business")}</span>
      </div>
      <nav class="flex flex-wrap gap-6" aria-label="{t("Pied de page", "Footer")}">
        {pied(l)}
        <span>© <span id="annee">2026</span> Tapora</span>
      </nav>
    </div>
  </footer>

  <script src="/js/gsap.min.js" defer></script>
  <script src="/js/ScrollTrigger.min.js" defer></script>
  <script src="/js/lenis.min.js" defer></script>
  <script src="/js/main.js" defer></script>
</body>
</html>
'''

def bandeau(l):
    fr = ['les hôtels', 'les restaurants', 'les cafés', 'les bars', 'les spas', 'les salons', 'les cliniques', 'les agences immobilières', 'les concessionnaires', 'les gyms', 'les congrès', 'les musées', 'les boutiques', 'les coworkings']
    en = ['hotels', 'restaurants', 'cafés', 'bars', 'spas', 'salons', 'clinics', 'real-estate agencies', 'dealerships', 'gyms', 'conferences', 'museums', 'shops', 'coworking spaces']
    mots = fr if l == 'fr' else en
    un = ''.join(f'<li>{m}</li><li class="text-brique" aria-hidden="true">•</li>' for m in mots)
    deux = ''.join(f'<li aria-hidden="true">{m}</li><li class="text-brique" aria-hidden="true">•</li>' for m in mots)
    return un + '\n          ' + deux

def comparaison(l):
    fr = l == 'fr'
    lignes = [
        ('Objectif', 'Purpose', 'Simplifier l’accès aux avis', 'Make reviews easy', 'Connecter vos clients à vos services', 'Connect your customers to your services'),
        ('Destination', 'Destination', 'Principalement l’avis Google', 'Mainly Google reviews', 'Menus, formulaires, réservations, portails…', 'Menus, forms, bookings, portals…'),
        ('Personnalisation', 'Customization', 'Design standard Tapora', 'Standard Tapora design', 'Complète&nbsp;: logo, couleurs, nom de chaque carte', 'Full: logo, colours, a name on every card'),
        ('Pour qui', 'Who it’s for', 'Les petits commerces', 'Small businesses', 'Hôtels, groupes, restaurants, entreprises', 'Hotels, groups, restaurants, businesses'),
        ('Quantité', 'Quantity', 'Sans minimum', 'No minimum', 'Minimum 25 cartes', 'Minimum 25 cards'),
        ('Prix', 'Price', '35&nbsp;$ la carte', '$35 per card', '30&nbsp;$ la carte', '$30 per card'),
        ('Évolution', 'What’s next', 'Un produit physique', 'A physical product', 'La carte, plus des services numériques', 'The card, plus digital services'),
    ]
    out = []
    for a, b, c, d, e, f in lignes:
        if fr:
            k, u, v = a, c, e
        else:
            k, u, v = b, d, f
        out.append(f'<tr class="border-t border-ligne"><th scope="row" class="p-4 font-semibold">{k}</th><td class="p-4 text-encre-doux">{u}</td><td class="ep-colonne-vedette p-4 font-medium">{v}</td></tr>')
    return '\n              '.join(out)

def inclus(l):
    fr = l == 'fr'
    items = [
        ('Le design sur mesure, à vos couleurs', 'Custom design, in your colours'),
        ('La maquette à approuver', 'A mockup to approve'),
        ('Chaque carte programmée et testée', 'Every card programmed and tested'),
        ('Le nom de chaque carte', 'A name on every card'),
        ('Les groupes («&nbsp;Chambres&nbsp;», «&nbsp;Bar&nbsp;»)', 'Groups (“Rooms”, “Bar”)'),
        ('Les statistiques en direct', 'Live stats'),
        ('La destination modifiable', 'A changeable destination'),
        ('La page protégée par mot de passe', 'A password-protected page'),
        ('Le rapport mensuel', 'The monthly report'),
        ('Le suivi de commande et l’espace client', 'Order tracking and the client area'),
        ('Le français d’abord au Québec, l’anglais d’abord ailleurs', 'French first in Québec, English first elsewhere'),
    ]
    return '\n          '.join(f'<li class="ep-inclus" data-etat="disponible" data-apparait><svg class="size-5 shrink-0 text-sapin" aria-hidden="true"><use href="#i-coche"/></svg><span>{a if fr else b}</span><span class="ep-badge"></span></li>' for a, b in items)

def pied(l):
    if l == 'fr':
        liens = [('/guides/', 'Guides'), ('/partenaires', 'Partenaires'), ('https://go.taporacards.com/portail', 'Espace client'), ('/confidentialite', 'Confidentialité'), ('/conditions', 'Conditions')]
        extra = '<a href="/en/business" hreflang="en" lang="en" class="hover:text-encre">English</a>'
    else:
        liens = [('/en/guides/', 'Guides'), ('/en/partners', 'Partners'), ('https://go.taporacards.com/portail', 'Client area'), ('/en/privacy', 'Privacy'), ('/en/terms', 'Terms')]
        extra = '<a href="/entreprise" hreflang="fr" lang="fr" class="hover:text-encre">Français</a>'
    return '\n        '.join([f'<a href="{h}" class="hover:text-encre">{n}</a>' for h, n in liens] + [extra, '<a href="mailto:contact@taporacards.com" class="hover:text-encre">Contact</a>'])

def courriel(l):
    from urllib.parse import quote
    if l == 'fr':
        sujet = 'Projet Tapora Entreprise'
        corps = 'Bonjour,\n\nNom de l’entreprise : \nSecteur : \nNombre d’emplacements : \nCe que les cartes doivent ouvrir : \n\nMerci !'
    else:
        sujet = 'Tapora Business project'
        corps = 'Hi,\n\nBusiness name: \nIndustry: \nNumber of spots: \nWhat the cards should open: \n\nThanks!'
    return f'mailto:contact@taporacards.com?subject={quote(sujet)}&amp;body={quote(corps)}'

open(f'{SITE}/entreprise.html', 'w').write(page('fr'))
open(f'{SITE}/en/business.html', 'w').write(page('en'))
print('ok', sum(1 for f in FONCTIONS if f[1] == D), 'disponibles,', sum(1 for f in FONCTIONS if f[1] == B), 'bientôt')
