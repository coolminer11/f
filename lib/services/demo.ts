import 'server-only'
import { requete } from '@/lib/db'
import type { Texte } from '@/lib/services/langues'
import { optionsParDefaut, type TypeEtablissement, type Variante } from '@/lib/services/types'
import {
  creerAnnonce,
  creerEmplacements,
  creerEtablissement,
  creerMenu,
  creerPlat,
  creerRubrique,
  creerSection,
  modifierCoordonnees,
  modifierAccueil,
  modifierFormule,
  modifierMenu,
  modifierOptions,
} from '@/lib/services/admin'

/**
 * Les établissements de démonstration : un vrai menu (ou un vrai concierge),
 * traduit en français, anglais et espagnol, et trente jours d'activité
 * inventée — pour montrer le produit fini à un client en deux minutes.
 */

type P = { n: Texte; d?: Texte; prix?: number; v?: Variante[]; a?: string[]; t?: string[]; off?: boolean }
type S = { n: Texte; plats: P[] }

const RESTO_CARTE: S[] = [
  {
    n: { fr: 'Entrées', en: 'Starters', es: 'Entrantes' },
    plats: [
      { n: { fr: 'Soupe à l’oignon gratinée', en: 'French onion soup', es: 'Sopa de cebolla gratinada' }, d: { fr: 'Bouillon de bœuf, oignons caramélisés, croûton et cheddar de l’Île-aux-Grues.', en: 'Beef broth, caramelized onions, crouton and Île-aux-Grues cheddar.', es: 'Caldo de res, cebolla caramelizada, crutón y cheddar de Île-aux-Grues.' }, prix: 11, a: ['gluten', 'lait'], t: ['maison', 'populaire'] },
      { n: { fr: 'Tartare de saumon', en: 'Salmon tartare', es: 'Tartar de salmón' }, d: { fr: 'Saumon frais, câpres, échalotes, croûtons à l’huile d’olive.', en: 'Fresh salmon, capers, shallots, olive oil croutons.', es: 'Salmón fresco, alcaparras, chalotas y picatostes al aceite de oliva.' }, prix: 16, a: ['poisson', 'gluten', 'moutarde'], t: ['chef'] },
      { n: { fr: 'Salade de betteraves et chèvre', en: 'Beet and goat cheese salad', es: 'Ensalada de remolacha y queso de cabra' }, d: { fr: 'Betteraves rôties, chèvre des Cantons, noix de Grenoble, vinaigrette à l’érable.', en: 'Roasted beets, Eastern Townships goat cheese, walnuts, maple dressing.', es: 'Remolacha asada, queso de cabra, nueces y vinagreta de arce.' }, prix: 13, a: ['lait', 'noix'], t: ['vegetarien', 'local'] },
      { n: { fr: 'Ailes de poulet BBQ', en: 'BBQ chicken wings', es: 'Alitas de pollo BBQ' }, d: { fr: 'Sauce maison fumée, crudités, trempette au bleu.', en: 'Smoky house sauce, crudités, blue cheese dip.', es: 'Salsa ahumada de la casa, verduras y salsa de queso azul.' }, prix: 14, v: [{ nom: { fr: '8 ailes', en: '8 wings', es: '8 alitas' }, prix: 14 }, { nom: { fr: '16 ailes', en: '16 wings', es: '16 alitas' }, prix: 24 }], a: ['lait', 'moutarde'], t: ['epice'] },
      { n: { fr: 'Croquettes de fromage en grains', en: 'Cheese curd croquettes', es: 'Croquetas de queso en grano' }, d: { fr: 'Fromage en grains frais, panure dorée, sauce marinara.', en: 'Fresh cheese curds, golden breading, marinara sauce.', es: 'Queso en grano fresco, empanizado dorado y salsa marinara.' }, prix: 12, a: ['lait', 'gluten', 'oeufs'], t: ['vegetarien', 'local'] },
    ],
  },
  {
    n: { fr: 'Plats principaux', en: 'Main courses', es: 'Platos principales' },
    plats: [
      { n: { fr: 'Poutine classique', en: 'Classic poutine', es: 'Poutine clásica' }, d: { fr: 'Frites maison, fromage en grains qui fait « squick », sauce brune.', en: 'Hand-cut fries, squeaky cheese curds, brown gravy.', es: 'Papas fritas caseras, queso en grano y salsa marrón.' }, prix: 16, v: [{ nom: { fr: 'Régulière', en: 'Regular', es: 'Normal' }, prix: 16 }, { nom: { fr: 'Grande', en: 'Large', es: 'Grande' }, prix: 21 }], a: ['lait', 'gluten'], t: ['populaire', 'local'] },
      { n: { fr: 'Pâté chinois revisité', en: 'Shepherd’s pie, our way', es: 'Pastel de carne a nuestra manera' }, d: { fr: 'Bœuf braisé, maïs crémeux, purée au beurre noisette.', en: 'Braised beef, creamed corn, brown-butter mash.', es: 'Res estofada, maíz cremoso y puré con mantequilla avellana.' }, prix: 22, a: ['lait'], t: ['maison'] },
      { n: { fr: 'Tourtière du Lac-Saint-Jean', en: 'Lac-Saint-Jean meat pie', es: 'Tourtière de Lac-Saint-Jean' }, d: { fr: 'Gibier et porc en croûte, ketchup aux fruits, salade verte.', en: 'Game and pork in pastry, fruit ketchup, green salad.', es: 'Carne de caza y cerdo en masa, kétchup de frutas y ensalada.' }, prix: 24, a: ['gluten', 'oeufs', 'lait'], t: ['local', 'maison'] },
      { n: { fr: 'Saumon laqué à l’érable', en: 'Maple-glazed salmon', es: 'Salmón glaseado con arce' }, d: { fr: 'Riz au jasmin, légumes de saison, sésame grillé.', en: 'Jasmine rice, seasonal vegetables, toasted sesame.', es: 'Arroz jazmín, verduras de temporada y sésamo tostado.' }, prix: 28, a: ['poisson', 'sesame', 'soja'], t: ['chef'] },
      { n: { fr: 'Bavette de bœuf', en: 'Flank steak', es: 'Bavette de res' }, d: { fr: 'Échalotes confites, frites maison, mayo au poivre.', en: 'Confit shallots, hand-cut fries, pepper mayo.', es: 'Chalotas confitadas, papas caseras y mayonesa a la pimienta.' }, prix: 32, a: ['oeufs', 'moutarde'], t: ['populaire'] },
      { n: { fr: 'Risotto aux champignons sauvages', en: 'Wild mushroom risotto', es: 'Risotto de setas silvestres' }, d: { fr: 'Champignons du Québec, parmesan, huile de truffe.', en: 'Québec mushrooms, parmesan, truffle oil.', es: 'Setas de Quebec, parmesano y aceite de trufa.' }, prix: 24, a: ['lait'], t: ['vegetarien'] },
      { n: { fr: 'Bol végane du jardin', en: 'Garden vegan bowl', es: 'Bol vegano de la huerta' }, d: { fr: 'Quinoa, pois chiches rôtis, avocat, légumes croquants, tahini.', en: 'Quinoa, roasted chickpeas, avocado, crunchy vegetables, tahini.', es: 'Quinoa, garbanzos asados, aguacate, verduras crujientes y tahini.' }, prix: 19, a: ['sesame'], t: ['vegan', 'sans_gluten', 'nouveau'] },
      { n: { fr: 'Moules et frites', en: 'Mussels and fries', es: 'Mejillones con papas' }, d: { fr: 'Moules des Îles-de-la-Madeleine, vin blanc, ail, persil.', en: 'Magdalen Islands mussels, white wine, garlic, parsley.', es: 'Mejillones de las Islas de la Magdalena, vino blanco, ajo y perejil.' }, prix: 26, a: ['crustaces', 'sulfites', 'lait'], off: true },
    ],
  },
  {
    n: { fr: 'Burgers et sandwichs', en: 'Burgers and sandwiches', es: 'Hamburguesas y sándwiches' },
    plats: [
      { n: { fr: 'Le Saint-Laurent', en: 'The Saint-Laurent', es: 'El Saint-Laurent' }, d: { fr: 'Bœuf local, cheddar fort, bacon, oignons caramélisés, pain brioché.', en: 'Local beef, old cheddar, bacon, caramelized onions, brioche bun.', es: 'Res local, cheddar fuerte, tocino, cebolla caramelizada y pan brioche.' }, prix: 21, a: ['gluten', 'lait', 'oeufs', 'sesame'], t: ['populaire', 'chef'] },
      { n: { fr: 'Smoked meat', en: 'Smoked meat sandwich', es: 'Sándwich de carne ahumada' }, d: { fr: 'Pain de seigle, moutarde jaune, cornichon.', en: 'Rye bread, yellow mustard, pickle.', es: 'Pan de centeno, mostaza y pepinillo.' }, prix: 18, a: ['gluten', 'moutarde'], t: ['local'] },
      { n: { fr: 'Burger végé', en: 'Veggie burger', es: 'Hamburguesa vegetariana' }, d: { fr: 'Galette de lentilles et betteraves, laitue, tomate, mayo végane.', en: 'Lentil and beet patty, lettuce, tomato, vegan mayo.', es: 'Medallón de lentejas y remolacha, lechuga, tomate y mayonesa vegana.' }, prix: 18, a: ['gluten', 'soja'], t: ['vegan'] },
      { n: { fr: 'Club sandwich', en: 'Club sandwich', es: 'Sándwich club' }, d: { fr: 'Poulet rôti, bacon, laitue, tomate, mayo, pain grillé.', en: 'Roast chicken, bacon, lettuce, tomato, mayo, toasted bread.', es: 'Pollo asado, tocino, lechuga, tomate y mayonesa en pan tostado.' }, prix: 19, a: ['gluten', 'oeufs'] },
    ],
  },
  {
    n: { fr: 'Desserts', en: 'Desserts', es: 'Postres' },
    plats: [
      { n: { fr: 'Pouding chômeur', en: 'Pouding chômeur', es: 'Pudin chômeur' }, d: { fr: 'Gâteau chaud, sirop d’érable, crème glacée vanille.', en: 'Warm cake, maple syrup, vanilla ice cream.', es: 'Pastel caliente, jarabe de arce y helado de vainilla.' }, prix: 10, a: ['gluten', 'lait', 'oeufs'], t: ['maison', 'local', 'populaire'] },
      { n: { fr: 'Tarte au sucre', en: 'Sugar pie', es: 'Tarta de azúcar' }, d: { fr: 'La recette de grand-maman, crème fouettée.', en: 'Grandma’s recipe, whipped cream.', es: 'La receta de la abuela, con nata montada.' }, prix: 9, a: ['gluten', 'lait', 'oeufs'], t: ['maison'] },
      { n: { fr: 'Gâteau au fromage aux bleuets', en: 'Blueberry cheesecake', es: 'Tarta de queso con arándanos' }, d: { fr: 'Bleuets sauvages du Lac-Saint-Jean.', en: 'Wild Lac-Saint-Jean blueberries.', es: 'Arándanos silvestres de Lac-Saint-Jean.' }, prix: 11, a: ['gluten', 'lait', 'oeufs'], t: ['local'] },
      { n: { fr: 'Sorbet du moment', en: 'Sorbet of the day', es: 'Sorbete del día' }, d: { fr: 'Demandez la saveur à votre serveur.', en: 'Ask your server for today’s flavour.', es: 'Pregunte el sabor del día.' }, prix: 7, t: ['vegan', 'sans_gluten'] },
    ],
  },
]

const RESTO_BRUNCH: S[] = [
  {
    n: { fr: 'Œufs', en: 'Eggs', es: 'Huevos' },
    plats: [
      { n: { fr: 'Œufs bénédictine', en: 'Eggs Benedict', es: 'Huevos Benedictinos' }, d: { fr: 'Muffin anglais, jambon fumé, hollandaise, patates rôties.', en: 'English muffin, smoked ham, hollandaise, roasted potatoes.', es: 'Muffin inglés, jamón ahumado, salsa holandesa y papas asadas.' }, prix: 18, v: [{ nom: { fr: 'Jambon', en: 'Ham', es: 'Jamón' }, prix: 18 }, { nom: { fr: 'Saumon fumé', en: 'Smoked salmon', es: 'Salmón ahumado' }, prix: 21 }], a: ['gluten', 'oeufs', 'lait'], t: ['populaire'] },
      { n: { fr: 'Déjeuner du bûcheron', en: 'Lumberjack breakfast', es: 'Desayuno del leñador' }, d: { fr: 'Deux œufs, bacon, saucisses, fèves au lard, cretons, rôties.', en: 'Two eggs, bacon, sausages, baked beans, cretons, toast.', es: 'Dos huevos, tocino, salchichas, frijoles, cretons y tostadas.' }, prix: 19, a: ['gluten', 'oeufs'], t: ['local'] },
      { n: { fr: 'Omelette du jardin', en: 'Garden omelette', es: 'Tortilla de la huerta' }, d: { fr: 'Épinards, champignons, poivrons, fromage de chèvre.', en: 'Spinach, mushrooms, peppers, goat cheese.', es: 'Espinacas, setas, pimientos y queso de cabra.' }, prix: 16, a: ['oeufs', 'lait'], t: ['vegetarien', 'sans_gluten'] },
    ],
  },
  {
    n: { fr: 'Douceurs', en: 'Sweet', es: 'Dulces' },
    plats: [
      { n: { fr: 'Crêpes à l’érable', en: 'Maple pancakes', es: 'Crepas con arce' }, d: { fr: 'Trois crêpes épaisses, sirop d’érable, petits fruits.', en: 'Three fluffy pancakes, maple syrup, berries.', es: 'Tres crepas esponjosas, jarabe de arce y frutos rojos.' }, prix: 15, a: ['gluten', 'lait', 'oeufs'], t: ['vegetarien', 'populaire'] },
      { n: { fr: 'Pain doré brioché', en: 'Brioche French toast', es: 'Torrija de brioche' }, d: { fr: 'Crème anglaise, caramel salé, pommes caramélisées.', en: 'Custard, salted caramel, caramelized apples.', es: 'Crema inglesa, caramelo salado y manzanas caramelizadas.' }, prix: 16, a: ['gluten', 'lait', 'oeufs'], t: ['maison'] },
    ],
  },
]

const RESTO_BOISSONS: S[] = [
  {
    n: { fr: 'Bières de microbrasseries', en: 'Craft beers', es: 'Cervezas artesanales' },
    plats: [
      { n: { fr: 'Blonde de la maison', en: 'House blonde ale', es: 'Rubia de la casa' }, d: { fr: 'Brassée à Québec, légère et florale.', en: 'Brewed in Québec City, light and floral.', es: 'Elaborada en Quebec, ligera y floral.' }, v: [{ nom: { fr: '12 oz', en: '12 oz', es: '12 oz' }, prix: 7 }, { nom: { fr: '20 oz', en: '20 oz', es: '20 oz' }, prix: 9.5 }], a: ['gluten'], t: ['local'] },
      { n: { fr: 'IPA du Nord', en: 'Northern IPA', es: 'IPA del Norte' }, d: { fr: 'Houblonnée, notes d’agrumes et de pin.', en: 'Hoppy, citrus and pine notes.', es: 'Lupulada, notas cítricas y de pino.' }, v: [{ nom: { fr: '12 oz', en: '12 oz', es: '12 oz' }, prix: 8 }, { nom: { fr: '20 oz', en: '20 oz', es: '20 oz' }, prix: 10.5 }], a: ['gluten'], t: ['local', 'populaire'] },
      { n: { fr: 'Rousse à l’érable', en: 'Maple red ale', es: 'Roja de arce' }, d: { fr: 'Ronde, caramel et érable.', en: 'Smooth, caramel and maple.', es: 'Redonda, caramelo y arce.' }, v: [{ nom: { fr: '12 oz', en: '12 oz', es: '12 oz' }, prix: 7.5 }, { nom: { fr: '20 oz', en: '20 oz', es: '20 oz' }, prix: 10 }], a: ['gluten'], t: ['local'] },
    ],
  },
  {
    n: { fr: 'Vins', en: 'Wines', es: 'Vinos' },
    plats: [
      { n: { fr: 'Vin rouge de la maison', en: 'House red wine', es: 'Vino tinto de la casa' }, d: { fr: 'Fruité et souple.', en: 'Fruity and supple.', es: 'Afrutado y suave.' }, v: [{ nom: { fr: 'Verre', en: 'Glass', es: 'Copa' }, prix: 10 }, { nom: { fr: 'Bouteille', en: 'Bottle', es: 'Botella' }, prix: 42 }], a: ['sulfites'] },
      { n: { fr: 'Vin blanc du Québec', en: 'Québec white wine', es: 'Vino blanco de Quebec' }, d: { fr: 'Vignoble de l’Île d’Orléans, frais et minéral.', en: 'Île d’Orléans vineyard, crisp and mineral.', es: 'Viñedo de la Isla de Orleans, fresco y mineral.' }, v: [{ nom: { fr: 'Verre', en: 'Glass', es: 'Copa' }, prix: 11 }, { nom: { fr: 'Bouteille', en: 'Bottle', es: 'Botella' }, prix: 46 }], a: ['sulfites'], t: ['local'] },
      { n: { fr: 'Cidre de glace', en: 'Ice cider', es: 'Sidra de hielo' }, d: { fr: 'Le dessert en verre, 2 oz.', en: 'Dessert in a glass, 2 oz.', es: 'El postre en copa, 2 oz.' }, prix: 9, a: ['sulfites'], t: ['local', 'chef'] },
    ],
  },
  {
    n: { fr: 'Sans alcool', en: 'Non-alcoholic', es: 'Sin alcohol' },
    plats: [
      { n: { fr: 'Limonade maison', en: 'House lemonade', es: 'Limonada de la casa' }, d: { fr: 'Citron, menthe et érable.', en: 'Lemon, mint and maple.', es: 'Limón, menta y arce.' }, prix: 5, t: ['maison', 'vegan'] },
      { n: { fr: 'Boissons gazeuses', en: 'Soft drinks', es: 'Refrescos' }, prix: 3.5, t: ['vegan'] },
      { n: { fr: 'Café filtre', en: 'Drip coffee', es: 'Café de filtro' }, d: { fr: 'Torréfié à Québec, remplissage à volonté.', en: 'Roasted in Québec City, free refills.', es: 'Tostado en Quebec, recarga gratis.' }, prix: 3, t: ['local'] },
      { n: { fr: 'Latté', en: 'Latte', es: 'Café con leche' }, prix: 5.5, v: [{ nom: { fr: 'Lait de vache', en: 'Cow’s milk', es: 'Leche de vaca' }, prix: 5.5 }, { nom: { fr: 'Boisson d’avoine', en: 'Oat milk', es: 'Bebida de avena' }, prix: 6.25 }], a: ['lait'] },
    ],
  },
]

const HOTEL_ROOM_SERVICE: S[] = [
  {
    n: { fr: 'Petit-déjeuner', en: 'Breakfast', es: 'Desayuno' },
    plats: [
      { n: { fr: 'Continental', en: 'Continental', es: 'Continental' }, d: { fr: 'Croissant, confitures, fruits frais, jus d’orange, café ou thé.', en: 'Croissant, jams, fresh fruit, orange juice, coffee or tea.', es: 'Cruasán, mermeladas, fruta fresca, zumo de naranja, café o té.' }, prix: 18, a: ['gluten', 'lait'], t: ['populaire'] },
      { n: { fr: 'Québécois', en: 'Québécois', es: 'Quebequense' }, d: { fr: 'Deux œufs, bacon, fèves au lard, cretons, rôties.', en: 'Two eggs, bacon, baked beans, cretons, toast.', es: 'Dos huevos, tocino, frijoles, cretons y tostadas.' }, prix: 24, a: ['gluten', 'oeufs'], t: ['local'] },
      { n: { fr: 'Bol santé', en: 'Wellness bowl', es: 'Bol saludable' }, d: { fr: 'Yogourt grec, granola maison, petits fruits, miel.', en: 'Greek yogurt, house granola, berries, honey.', es: 'Yogur griego, granola casera, frutos rojos y miel.' }, prix: 15, a: ['lait', 'noix'], t: ['vegetarien'] },
    ],
  },
  {
    n: { fr: 'En tout temps', en: 'All day', es: 'Todo el día' },
    plats: [
      { n: { fr: 'Club sandwich de l’hôtel', en: 'Hotel club sandwich', es: 'Sándwich club del hotel' }, d: { fr: 'Poulet, bacon, laitue, tomate, frites.', en: 'Chicken, bacon, lettuce, tomato, fries.', es: 'Pollo, tocino, lechuga, tomate y papas.' }, prix: 24, a: ['gluten', 'oeufs'], t: ['populaire'] },
      { n: { fr: 'Burger Vieux-Port', en: 'Vieux-Port burger', es: 'Hamburguesa Vieux-Port' }, d: { fr: 'Bœuf du Québec, cheddar, frites.', en: 'Québec beef, cheddar, fries.', es: 'Res de Quebec, cheddar y papas.' }, prix: 26, a: ['gluten', 'lait', 'sesame'], t: ['local'] },
      { n: { fr: 'Salade César', en: 'Caesar salad', es: 'Ensalada César' }, d: { fr: 'Romaine, parmesan, croûtons, bacon.', en: 'Romaine, parmesan, croutons, bacon.', es: 'Lechuga romana, parmesano, picatostes y tocino.' }, prix: 18, v: [{ nom: { fr: 'Nature', en: 'Plain', es: 'Sola' }, prix: 18 }, { nom: { fr: 'Avec poulet', en: 'With chicken', es: 'Con pollo' }, prix: 23 }], a: ['gluten', 'lait', 'oeufs', 'poisson'] },
      { n: { fr: 'Pâtes aux tomates et basilic', en: 'Tomato basil pasta', es: 'Pasta con tomate y albahaca' }, prix: 21, a: ['gluten'], t: ['vegan'] },
      { n: { fr: 'Plateau de fromages du Québec', en: 'Québec cheese board', es: 'Tabla de quesos de Quebec' }, d: { fr: 'Trois fromages, noix, fruits, pain aux raisins.', en: 'Three cheeses, nuts, fruit, raisin bread.', es: 'Tres quesos, frutos secos, fruta y pan de pasas.' }, prix: 26, a: ['lait', 'noix', 'gluten'], t: ['local', 'chef'] },
    ],
  },
  {
    n: { fr: 'Boissons', en: 'Drinks', es: 'Bebidas' },
    plats: [
      { n: { fr: 'Bouteille de vin rouge', en: 'Bottle of red wine', es: 'Botella de vino tinto' }, prix: 48, a: ['sulfites'] },
      { n: { fr: 'Mousseux du Québec', en: 'Québec sparkling wine', es: 'Espumoso de Quebec' }, prix: 62, a: ['sulfites'], t: ['local'] },
      { n: { fr: 'Café ou thé', en: 'Coffee or tea', es: 'Café o té' }, prix: 4.5 },
      { n: { fr: 'Jus frais pressé', en: 'Freshly squeezed juice', es: 'Zumo recién exprimido' }, prix: 7, t: ['vegan'] },
    ],
  },
]

const HOTEL_RUBRIQUES: { type: string; icone: string; titre: Texte; texte: Texte; lien?: string; telephone?: string }[] = [
  { type: 'horaires', icone: '🕐', titre: { fr: 'Arrivée et départ', en: 'Check-in and check-out', es: 'Entrada y salida' }, texte: { fr: 'Arrivée dès 15 h · départ avant 11 h. Un départ tardif ? Demandez-le en un tap ci-dessous.', en: 'Check-in from 3 p.m. · check-out by 11 a.m. Need a late check-out? Request it with one tap below.', es: 'Entrada desde las 15 h · salida antes de las 11 h. ¿Salida tardía? Pídala con un toque abajo.' } },
  { type: 'restauration', icone: '🍳', titre: { fr: 'Petit-déjeuner', en: 'Breakfast', es: 'Desayuno' }, texte: { fr: 'Servi au restaurant Le Quai de 7 h à 10 h 30 (11 h la fin de semaine). En chambre : voir le menu du service aux chambres.', en: 'Served at Le Quai restaurant from 7 to 10:30 a.m. (11 a.m. on weekends). In your room: see the room service menu.', es: 'Se sirve en el restaurante Le Quai de 7 a 10:30 h (11 h los fines de semana). En la habitación: vea el menú del servicio a la habitación.' } },
  { type: 'service', icone: '🛎️', titre: { fr: 'Réception 24 h', en: '24-hour front desk', es: 'Recepción 24 h' }, texte: { fr: 'Nous sommes là jour et nuit : consigne à bagages, réservations, taxis, recommandations.', en: 'We’re here day and night: luggage storage, reservations, taxis, recommendations.', es: 'Estamos día y noche: consigna, reservas, taxis y recomendaciones.' }, telephone: '418 555-0100' },
  { type: 'service', icone: '🅿️', titre: { fr: 'Stationnement', en: 'Parking', es: 'Estacionamiento' }, texte: { fr: 'Stationnement intérieur, 28 $ par nuit, entrées et sorties illimitées. Bornes de recharge au niveau P1.', en: 'Indoor parking, $28 per night, unlimited in and out. EV chargers on level P1.', es: 'Estacionamiento cubierto, 28 $ por noche, entradas y salidas ilimitadas. Cargadores eléctricos en el nivel P1.' } },
  { type: 'activite', icone: '🏊', titre: { fr: 'Piscine, spa et gym', en: 'Pool, spa and gym', es: 'Piscina, spa y gimnasio' }, texte: { fr: 'Au 4e étage, de 6 h à 22 h. Serviettes sur place. Massages sur réservation à la réception.', en: 'On the 4th floor, 6 a.m. to 10 p.m. Towels provided. Massages by reservation at the front desk.', es: 'En el 4.º piso, de 6 a 22 h. Toallas disponibles. Masajes con reserva en recepción.' } },
  { type: 'recommandation', icone: '🏰', titre: { fr: 'Château Frontenac et terrasse Dufferin', en: 'Château Frontenac and Dufferin Terrace', es: 'Château Frontenac y terraza Dufferin' }, texte: { fr: 'À 10 minutes à pied. La plus belle vue sur le fleuve, surtout au coucher du soleil.', en: 'A 10-minute walk. The best view of the river, especially at sunset.', es: 'A 10 minutos a pie. La mejor vista del río, sobre todo al atardecer.' }, lien: 'https://maps.google.com/?q=Terrasse+Dufferin+Quebec' },
  { type: 'recommandation', icone: '🛍️', titre: { fr: 'Quartier Petit-Champlain', en: 'Petit-Champlain district', es: 'Barrio Petit-Champlain' }, texte: { fr: 'Rues piétonnes, boutiques d’artisans et le funiculaire. Prenez l’escalier Casse-Cou !', en: 'Pedestrian streets, artisan shops and the funicular. Try the Breakneck Stairs!', es: 'Calles peatonales, tiendas de artesanos y el funicular. ¡Pruebe la escalera Casse-Cou!' }, lien: 'https://maps.google.com/?q=Petit-Champlain+Quebec' },
  { type: 'recommandation', icone: '💧', titre: { fr: 'Chute Montmorency', en: 'Montmorency Falls', es: 'Cataratas Montmorency' }, texte: { fr: '30 mètres plus haute que Niagara, à 15 minutes en voiture. Téléphérique et pont suspendu.', en: '30 metres higher than Niagara, 15 minutes by car. Cable car and suspension bridge.', es: '30 metros más alta que el Niágara, a 15 minutos en auto. Teleférico y puente colgante.' }, lien: 'https://maps.google.com/?q=Chute+Montmorency' },
  { type: 'recommandation', icone: '🏛️', titre: { fr: 'Musée de la civilisation', en: 'Musée de la civilisation', es: 'Museo de la Civilización' }, texte: { fr: 'À 5 minutes à pied. Parfait un jour de pluie.', en: 'A 5-minute walk. Perfect on a rainy day.', es: 'A 5 minutos a pie. Perfecto para un día de lluvia.' } },
  { type: 'transport', icone: '✈️', titre: { fr: 'Aéroport et taxis', en: 'Airport and taxis', es: 'Aeropuerto y taxis' }, texte: { fr: 'Aéroport Jean-Lesage à 20 minutes. Taxi environ 40 $ ; la réception vous en appelle un en tout temps.', en: 'Jean-Lesage airport is 20 minutes away. A taxi is about $40; the front desk can call one anytime.', es: 'El aeropuerto Jean-Lesage está a 20 minutos. Un taxi cuesta unos 40 $; la recepción puede pedirlo en cualquier momento.' } },
  { type: 'urgence', icone: '🚨', titre: { fr: 'Urgences', en: 'Emergencies', es: 'Emergencias' }, texte: { fr: 'Composez le 911. Pharmacie ouverte jusqu’à 23 h à 400 m. Réception : le 0 depuis le téléphone de la chambre.', en: 'Dial 911. Pharmacy open until 11 p.m., 400 m away. Front desk: dial 0 from the room phone.', es: 'Marque el 911. Farmacia abierta hasta las 23 h a 400 m. Recepción: marque 0 desde el teléfono de la habitación.' }, telephone: '911' },
  { type: 'regle', icone: '📋', titre: { fr: 'À savoir', en: 'Good to know', es: 'Información útil' }, texte: { fr: 'Établissement non-fumeur. Animaux bienvenus sur demande. Silence après 22 h.', en: 'Non-smoking property. Pets welcome on request. Quiet hours after 10 p.m.', es: 'Establecimiento libre de humo. Mascotas bienvenidas bajo petición. Silencio después de las 22 h.' } },
]

async function remplirMenu(etabId: string, menuId: string, sections: S[]): Promise<string[]> {
  const ids: string[] = []
  for (const s of sections) {
    const sectionId = await creerSection(etabId, menuId, s.n)
    for (const p of s.plats) {
      ids.push(
        await creerPlat(etabId, sectionId, {
          nom: p.n,
          description: p.d ?? {},
          prix: p.prix ?? null,
          variantes: p.v ?? [],
          allergenes: p.a ?? [],
          etiquettes: p.t ?? [],
          disponible: !p.off,
        }),
      )
    }
  }
  return ids
}

// ---------------------------------------------------------------------------
// Trente jours d'activité inventée
// ---------------------------------------------------------------------------

const hasard = (n: number) => Math.floor(Math.random() * n)
const choisir = <T,>(l: readonly T[]) => l[hasard(l.length)]
function pondere<T>(l: readonly [T, number][]): T {
  const total = l.reduce((s, [, p]) => s + p, 0)
  let r = Math.random() * total
  for (const [v, p] of l) if ((r -= p) <= 0) return v
  return l[0][0]
}

/** L'instant UTC d'une heure murale (aaaa-mm-jj, h:m:s) dans le fuseau de l'établissement. */
function instant(ymd: string, h: number, m: number, s: number, fuseau = 'America/Toronto'): Date {
  const devine = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10), h, m, s)
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: fuseau, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(devine))
      .map((x) => [x.type, Number(x.value)]),
  )
  const vu = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return new Date(devine - (vu - devine))
}

async function semerActivite(etabId: string, type: TypeEtablissement, platIds: string[], rubriqueIds: string[]): Promise<void> {
  const lieux = await requete<{ id: string }>(`select id from emplacements where etablissement_id = $1::uuid`, [etabId])
  const typesD = await requete<{ id: string; cle: string; libelle: Record<string, string>; avis_apres: boolean }>(
    `select id, cle, libelle, avis_apres from types_demandes where etablissement_id = $1::uuid`,
    [etabId],
  )
  if (!lieux.length) return
  const heures: [number, number][] =
    type === 'restaurant'
      ? [[11, 4], [12, 10], [13, 8], [14, 3], [17, 5], [18, 10], [19, 11], [20, 7], [21, 3], [10, 2]]
      : [[7, 7], [8, 9], [9, 5], [12, 3], [15, 3], [17, 4], [18, 6], [19, 6], [20, 7], [21, 6], [22, 5], [23, 2]]
  const langues: [string, number][] = [['fr', 64], ['en', 29], ['es', 7]]
  const ev: { t: string; e: string; type: string; cible: string | null; l: string }[] = []
  const dem: { t: string; e: string; ty: (typeof typesD)[number]; prise: number; faite: number; par: string; l: string }[] = []
  const ret: { t: string; e: string; note: number; com: string | null; google: boolean; l: string }[] = []
  const COMMENTAIRES =
    type === 'restaurant'
      ? ['Service impeccable, merci !', 'Super rapide 👏', 'Un peu d’attente, mais très gentils.', 'La poutine est incroyable.', 'Parfait pour notre souper d’anniversaire.', 'Great food and super friendly staff!']
      : ['Chambre propre et calme, bravo à l’équipe.', 'Serviettes livrées en 5 minutes, wow.', 'Personnel aux petits soins.', 'Fast and friendly, thank you!', 'Le concierge nous a fait découvrir la chute Montmorency 💧']
  const PLAINTES =
    type === 'restaurant'
      ? ['Notre plat était froid.', 'On a attendu longtemps l’addition.', 'Un peu bruyant ce soir.']
      : ['Le ménage est passé tard.', 'La climatisation était bruyante.', 'Le wifi ne marchait pas dans la chambre.']
  const PERSONNEL = ['Marie', 'Alex', 'Samuel', 'Léa', 'Karim']
  for (let jour = 29; jour >= 0; jour--) {
    const ymd = new Date(Date.now() - jour * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
    const finSemaine = [0, 5, 6].includes(new Date(`${ymd}T12:00:00Z`).getUTCDay())
    const visites = (type === 'restaurant' ? 38 : 22) + hasard(type === 'restaurant' ? 30 : 14) + (finSemaine ? (type === 'restaurant' ? 25 : 10) : 0)
    for (let v = 0; v < visites; v++) {
      const h = pondere(heures)
      const t = instant(ymd, h, hasard(60), hasard(60))
      if (t.getTime() > Date.now()) continue
      const iso = t.toISOString()
      const e = choisir(lieux).id
      const l = pondere(langues)
      ev.push({ t: iso, e, type: 'ouverture', cible: null, l })
      if (type === 'restaurant' || Math.random() < 0.35) {
        if (Math.random() < 0.75) {
          ev.push({ t: iso, e, type: 'menu', cible: null, l })
          for (let k = 0; k < 1 + hasard(3); k++) if (platIds.length) ev.push({ t: iso, e, type: 'plat', cible: choisir(platIds), l })
        }
      }
      if (type === 'hotel' && Math.random() < 0.5) {
        ev.push({ t: iso, e, type: 'concierge', cible: null, l })
        if (rubriqueIds.length) ev.push({ t: iso, e, type: 'rubrique', cible: choisir(rubriqueIds), l })
      }
      if (Math.random() < 0.08) ev.push({ t: iso, e, type: 'wifi', cible: null, l })
      // Les demandes : surtout le serveur et l'addition au resto ; un peu de tout à l'hôtel.
      if (typesD.length && Math.random() < (type === 'restaurant' ? 0.32 : 0.18)) {
        const ty =
          type === 'restaurant'
            ? pondere(typesD.map((x) => [x, x.cle === 'serveur' ? 5 : x.cle === 'addition' ? 4 : x.cle === 'eau' ? 2 : 1] as [typeof x, number]))
            : choisir(typesD)
        const prise = 20 + hasard(finSemaine ? 260 : 150)
        dem.push({ t: iso, e, ty, prise, faite: prise + 30 + hasard(400), par: choisir(PERSONNEL), l })
        if (ty.avis_apres && Math.random() < 0.38) {
          const note = pondere([[5, 62], [4, 24], [3, 8], [2, 4], [1, 2]] as [number, number][])
          const com = note <= 3 ? (Math.random() < 0.7 ? choisir(PLAINTES) : null) : Math.random() < 0.3 ? choisir(COMMENTAIRES) : null
          const google = note >= 4 && Math.random() < 0.45
          ret.push({ t: iso, e, note, com, google, l })
          if (google) ev.push({ t: iso, e, type: 'avis_google', cible: null, l })
        }
      }
    }
  }
  for (let i = 0; i < ev.length; i += 2000) {
    const lot = ev.slice(i, i + 2000)
    await requete(
      `insert into evenements_service (etablissement_id, emplacement_id, type, cible, langue, cree_le)
       select $1::uuid, e, ty, c, l, t from unnest($2::uuid[], $3::text[], $4::text[], $5::text[], $6::timestamptz[]) as x(e, ty, c, l, t)`,
      [etabId, lot.map((x) => x.e), lot.map((x) => x.type), lot.map((x) => x.cible), lot.map((x) => x.l), lot.map((x) => x.t)],
    )
  }
  if (dem.length) {
    await requete(
      `insert into demandes_service (etablissement_id, emplacement_id, type_id, cle, libelle, langue, statut, prise_par, cree_le, prise_le, faite_le)
       select $1::uuid, e, ty, c, lib, l, 'faite', par, t, t + make_interval(secs => p), t + make_interval(secs => f)
         from unnest($2::uuid[], $3::uuid[], $4::text[], $5::text[], $6::text[], $7::text[], $8::timestamptz[], $9::int[], $10::int[]) as x(e, ty, c, lib, l, par, t, p, f)`,
      [
        etabId,
        dem.map((x) => x.e),
        dem.map((x) => x.ty.id),
        dem.map((x) => x.ty.cle),
        dem.map((x) => x.ty.libelle.fr ?? x.ty.cle),
        dem.map((x) => x.l),
        dem.map((x) => x.par),
        dem.map((x) => x.t),
        dem.map((x) => x.prise),
        dem.map((x) => x.faite),
      ],
    )
  }
  if (ret.length) {
    await requete(
      `insert into retours_service (etablissement_id, emplacement_id, note, commentaire, google, langue, cree_le)
       select $1::uuid, e, n, c, g, l, t from unnest($2::uuid[], $3::int[], $4::text[], $5::boolean[], $6::text[], $7::timestamptz[]) as x(e, n, c, g, l, t)`,
      [etabId, ret.map((x) => x.e), ret.map((x) => x.note), ret.map((x) => x.com), ret.map((x) => x.google), ret.map((x) => x.l), ret.map((x) => x.t)],
    )
  }
}

// ---------------------------------------------------------------------------

export async function creerDemo(type: TypeEtablissement): Promise<string> {
  if (type === 'restaurant') {
    const id = await creerEtablissement({ type, nom: 'Bistro Le Saint-Laurent (démo)', langues: ['fr', 'en', 'es'], langue_defaut: 'fr' })
    await requete(`update etablissements set couleur = '#b5472b' where id = $1::uuid`, [id])
    await modifierAccueil(id, {
      fr: 'Bienvenue ! Le menu, votre serveur et l’addition sont à un tap. Bon appétit !',
      en: 'Welcome! The menu, your server and the bill are one tap away. Enjoy your meal!',
      es: '¡Bienvenidos! El menú, su camarero y la cuenta están a un toque. ¡Buen provecho!',
    })
    await modifierCoordonnees(id, {
      adresse: '125, rue Saint-Paul, Québec (Québec)',
      telephone: '418 555-0123',
      site_web: 'https://taporacards.com',
      avis_url: 'https://search.google.com/local/writereview?placeid=ChIJ-demo',
      wifi_nom: 'Bistro-Invites',
      wifi_mdp: 'poutine2026',
    })
    await modifierFormule(id, { formule: 'essai', essai_jusqua: new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10), prix_mensuel: 25, contact_nom: 'Démo', contact_courriel: null, notes: 'Établissement de démonstration.' })
    const carte = await creerMenu(id, 'carte', { fr: 'La carte', en: 'Our menu', es: 'La carta' })
    await modifierMenu(id, carte, { type: 'carte', nom: { fr: 'La carte', en: 'Our menu', es: 'La carta' }, description: { fr: 'Cuisine du marché, produits du Québec.', en: 'Market cuisine, Québec products.', es: 'Cocina de mercado con productos de Quebec.' }, heure_debut: '11:00', heure_fin: '23:00', jours: [1, 2, 3, 4, 5, 6, 7], actif: true })
    const brunch = await creerMenu(id, 'dejeuner', { fr: 'Brunch', en: 'Brunch', es: 'Brunch' })
    await modifierMenu(id, brunch, { type: 'dejeuner', nom: { fr: 'Brunch', en: 'Brunch', es: 'Brunch' }, description: { fr: 'Les samedis et dimanches, de 9 h à 14 h.', en: 'Saturdays and Sundays, 9 a.m. to 2 p.m.', es: 'Sábados y domingos, de 9 a 14 h.' }, heure_debut: '09:00', heure_fin: '14:00', jours: [6, 7], actif: true })
    const boissons = await creerMenu(id, 'boissons', { fr: 'Boissons', en: 'Drinks', es: 'Bebidas' })
    const plats = [...(await remplirMenu(id, carte, RESTO_CARTE)), ...(await remplirMenu(id, brunch, RESTO_BRUNCH)), ...(await remplirMenu(id, boissons, RESTO_BOISSONS))]
    const aujourdhui = new Date().toISOString().slice(0, 10)
    await creerAnnonce(id, { type: 'plat_du_jour', titre: { fr: 'Poutine au canard confit', en: 'Duck confit poutine', es: 'Poutine de pato confitado' }, texte: { fr: 'Canard confit effiloché, fromage en grains, sauce au porto.', en: 'Pulled duck confit, cheese curds, port gravy.', es: 'Pato confitado deshilachado, queso en grano y salsa de oporto.' }, prix: 24, debut: aujourdhui, fin: aujourdhui, actif: true })
    await creerAnnonce(id, { type: 'promo', titre: { fr: '5 à 7 : bières à 6 $', en: 'Happy hour: $6 beers', es: 'Happy hour: cervezas a 6 $' }, texte: { fr: 'Du lundi au vendredi, de 17 h à 19 h.', en: 'Monday to Friday, 5 to 7 p.m.', es: 'De lunes a viernes, de 17 a 19 h.' }, prix: null, debut: null, fin: null, actif: true })
    await creerEmplacements(id, { prefixe: 'Table', de: 1, a: 14, type: 'table', groupe: 'Salle' })
    await creerEmplacements(id, { prefixe: 'Terrasse', de: 1, a: 6, type: 'table', groupe: 'Terrasse' })
    await creerEmplacements(id, { prefixe: 'Bar', de: 1, a: 1, type: 'comptoir', groupe: 'Bar' })
    await semerActivite(id, type, plats, [])
    return id
  }

  const id = await creerEtablissement({ type, nom: 'Hôtel Le Vieux-Port (démo)', langues: ['fr', 'en', 'es'], langue_defaut: 'fr' })
  await requete(`update etablissements set couleur = '#1f4e5f' where id = $1::uuid`, [id])
  // L'ossature du concierge (créée avec l'hôtel) cède la place au contenu complet.
  await requete(`delete from rubriques_concierge where etablissement_id = $1::uuid`, [id])
  await modifierAccueil(id, {
    fr: 'Bienvenue à l’Hôtel Le Vieux-Port ! Tout ce qu’il vous faut pendant votre séjour, à portée de main.',
    en: 'Welcome to Hôtel Le Vieux-Port! Everything you need during your stay, right at your fingertips.',
    es: '¡Bienvenidos al Hôtel Le Vieux-Port! Todo lo que necesita durante su estancia, a su alcance.',
  })
  await modifierCoordonnees(id, {
    adresse: '80, rue Dalhousie, Québec (Québec)',
    telephone: '418 555-0100',
    site_web: 'https://taporacards.com',
    avis_url: 'https://search.google.com/local/writereview?placeid=ChIJ-demo-hotel',
    wifi_nom: 'VieuxPort-Invites',
    wifi_mdp: 'fleuve2026',
  })
  await modifierOptions(id, { ...optionsParDefaut('hotel'), concierge: true, menu: true })
  await modifierFormule(id, { formule: 'actif', essai_jusqua: null, prix_mensuel: 60, contact_nom: 'Démo', contact_courriel: null, notes: 'Établissement de démonstration.' })
  const rs = await creerMenu(id, 'room_service', { fr: 'Service aux chambres', en: 'Room service', es: 'Servicio a la habitación' })
  await modifierMenu(id, rs, { type: 'room_service', nom: { fr: 'Service aux chambres', en: 'Room service', es: 'Servicio a la habitación' }, description: { fr: 'Livré à votre porte en 30 minutes environ, de 6 h 30 à 23 h.', en: 'Delivered to your door in about 30 minutes, 6:30 a.m. to 11 p.m.', es: 'Entregado en su puerta en unos 30 minutos, de 6:30 a 23 h.' }, heure_debut: '06:30', heure_fin: '23:00', jours: [1, 2, 3, 4, 5, 6, 7], actif: true })
  const plats = await remplirMenu(id, rs, HOTEL_ROOM_SERVICE)
  for (const r of HOTEL_RUBRIQUES) await creerRubrique(id, { type: r.type, icone: r.icone, titre: r.titre, texte: r.texte, lien: r.lien ?? null, telephone: r.telephone ?? null, actif: true })
  const rubriqueIds = (await requete<{ id: string }>(`select id from rubriques_concierge where etablissement_id = $1::uuid`, [id])).map((x) => x.id)
  // À l'hôtel, l'avis se propose après le ménage et une réparation : de vraies notes dans la démo.
  await requete(`update types_demandes set avis_apres = true where etablissement_id = $1::uuid and cle in ('menage', 'entretien', 'depart_tardif')`, [id])
  await creerAnnonce(id, { type: 'evenement', titre: { fr: 'Ce soir : dégustation de vins du Québec', en: 'Tonight: Québec wine tasting', es: 'Esta noche: cata de vinos de Quebec' }, texte: { fr: 'Au lobby, à 17 h. Offert aux clients de l’hôtel.', en: 'In the lobby at 5 p.m. Complimentary for hotel guests.', es: 'En el vestíbulo a las 17 h. Gratis para los huéspedes.' }, prix: null, debut: null, fin: null, actif: true })
  for (const etage of [1, 2, 3]) await creerEmplacements(id, { prefixe: 'Chambre', de: etage * 100 + 1, a: etage * 100 + 5, type: 'chambre', groupe: `${etage}${etage === 1 ? 'er' : 'e'} étage` })
  await creerEmplacements(id, { prefixe: 'Lobby', de: 1, a: 1, type: 'zone', groupe: 'Rez-de-chaussée' })
  await semerActivite(id, type, plats, rubriqueIds)
  return id
}
