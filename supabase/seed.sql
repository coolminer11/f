-- ============================================================================
-- Tapora S.E.N.C. — Données initiales
-- ============================================================================

insert into parametres (id, nom_entreprise, province_etablissement)
values (true, 'Tapora S.E.N.C.', 'QC')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Référentiel des taxes.
-- La TVP (PST/RST de la C.-B., de la Saskatchewan et du Manitoba) n'ouvre
-- droit à AUCUN crédit sur intrants : payée, elle est un coût définitif.
-- ---------------------------------------------------------------------------
insert into taxes (code, nom, recuperable_pct_defaut, ordre) values
  ('TPS', 'Taxe sur les produits et services',        1, 1),
  ('TVH', 'Taxe de vente harmonisée',                 1, 1),
  ('TVQ', 'Taxe de vente du Québec',                  1, 2),
  ('TVP', 'Taxe de vente provinciale (PST / RST)',    0, 3)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Règles par province de destination, en vigueur depuis la constitution de la
-- société (août 2026). Les taux antérieurs ne sont pas amorcés : le mécanisme
-- d'historisation existe, il servira au prochain changement de taux.
-- ---------------------------------------------------------------------------
insert into regles_taxes_province (province, code_taxe, taux, autorite, date_debut, note) values
  ('QC', 'TPS', 0.05000,  'ARC', '2026-08-01', null),
  ('QC', 'TVQ', 0.09975,  'RQ',  '2026-08-01', 'Calculée sur le HT seul'),
  ('ON', 'TVH', 0.13000,  'ARC', '2026-08-01', null),
  ('NB', 'TVH', 0.15000,  'ARC', '2026-08-01', null),
  ('NL', 'TVH', 0.15000,  'ARC', '2026-08-01', null),
  ('PE', 'TVH', 0.15000,  'ARC', '2026-08-01', null),
  ('NS', 'TVH', 0.14000,  'ARC', '2026-08-01', 'Taux réduit à 14 % le 1er avril 2025'),
  ('AB', 'TPS', 0.05000,  'ARC', '2026-08-01', null),
  ('NT', 'TPS', 0.05000,  'ARC', '2026-08-01', null),
  ('NU', 'TPS', 0.05000,  'ARC', '2026-08-01', null),
  ('YT', 'TPS', 0.05000,  'ARC', '2026-08-01', null),
  ('BC', 'TPS', 0.05000,  'ARC', '2026-08-01', null),
  ('BC', 'TVP', 0.07000,  'BC',  '2026-08-01', 'Non récupérable'),
  ('SK', 'TPS', 0.05000,  'ARC', '2026-08-01', null),
  ('SK', 'TVP', 0.06000,  'SK',  '2026-08-01', 'Non récupérable'),
  ('MB', 'TPS', 0.05000,  'ARC', '2026-08-01', null),
  ('MB', 'TVP', 0.07000,  'MB',  '2026-08-01', 'Non récupérable')
on conflict do nothing;

insert into exercices (annee, date_debut, date_fin) values
  (2026, '2026-01-01', '2026-12-31'),
  (2027, '2027-01-01', '2027-12-31')
on conflict (annee) do nothing;

insert into associes (nom, part, ordre) values
  ('Julien Boutet',   0.5, 1),
  ('Arthur Popovici', 0.5, 2)
on conflict (nom) do nothing;

-- ---------------------------------------------------------------------------
-- Catégories. `pct_recuperable` s'applique à toutes les taxes de l'écriture.
-- `saisie_manuelle = false` : catégories produites par le système.
-- ---------------------------------------------------------------------------
insert into categories_defauts
  (categorie, libelle, type_defaut, nature_defaut, pct_recuperable, saisie_manuelle, ordre) values
  ('ventes_cartes',            'Ventes de cartes NFC',           'revenu',  null,       1,   true,  10),
  ('ventes_accessoires',       'Ventes d''accessoires',          'revenu',  null,       1,   true,  20),
  ('ventes_services',          'Services et configuration',      'revenu',  null,       1,   true,  30),
  ('cartes_achat',             'Achat de cartes vierges',        'depense', 'variable', 1,   true,  40),
  ('cout_marchandises_vendues','Coût des cartes vendues',        'depense', 'variable', 1,   false, 45),
  ('perte_inventaire',         'Écarts et pertes d''inventaire', 'depense', 'variable', 1,   false, 47),
  ('impression',               'Impression et personnalisation', 'depense', 'variable', 1,   true,  50),
  ('expedition',               'Expédition et livraison',        'depense', 'variable', 1,   true,  60),
  ('emballage',                'Emballage',                      'depense', 'variable', 1,   true,  70),
  ('frais_stripe',             'Frais Stripe',                   'depense', 'variable', 1,   true,  80),
  ('frais_litige',             'Frais de rétrofacturation',      'depense', 'variable', 1,   true,  85),
  ('frais_bancaires',          'Frais bancaires et dépôts',      'depense', 'fixe',     1,   true,  90),
  ('hebergement',              'Hébergement et domaines',        'depense', 'fixe',     1,   true, 100),
  ('logiciels',                'Logiciels et abonnements',       'depense', 'fixe',     1,   true, 110),
  ('publicite',                'Publicité et marketing',         'depense', 'fixe',     1,   true, 120),
  ('honoraires',               'Honoraires professionnels',      'depense', 'fixe',     1,   true, 130),
  ('deplacement',              'Déplacements',                   'depense', 'variable', 1,   true, 140),
  ('repas_representation',     'Repas et représentation',        'depense', 'fixe',     0.5, true, 150),
  ('autre',                    'Autre',                          'depense', 'fixe',     1,   true, 900)
on conflict (categorie) do nothing;

insert into produits (sku, nom, description, prix_vente_ht, est_carte) values
  ('CARTE-NFC-STD', 'Carte NFC avis Google — standard',
   'Carte NFC personnalisée redirigeant vers la fiche Google de l''entreprise', 39.00, true)
on conflict (sku) do nothing;

-- Coûts unitaires de référence (à ajuster avec vos vrais chiffres).
insert into couts_unitaires (produit_id, composante, montant_ht, date_effet, note)
select null, c.composante, c.montant, '2026-08-01', 'Valeur de départ à ajuster'
from (values ('carte_vierge', 2.5000), ('impression', 1.2000),
             ('expedition', 2.0000), ('emballage', 0.4000)) as c(composante, montant)
on conflict do nothing;

insert into regles_categorisation (motif, type, categorie, nature, priorite) values
  ('STRIPE',        'depense', 'frais_stripe',    'variable', 10),
  ('VERCEL',        'depense', 'hebergement',     'fixe',     20),
  ('SUPABASE',      'depense', 'hebergement',     'fixe',     20),
  ('CANVA',         'depense', 'logiciels',       'fixe',     30),
  ('GOOGLE ADS',    'depense', 'publicite',       'fixe',     30),
  ('META PLATFORMS','depense', 'publicite',       'fixe',     30),
  ('POSTES CANADA', 'depense', 'expedition',      'variable', 40),
  ('CANADA POST',   'depense', 'expedition',      'variable', 40),
  ('PUROLATOR',     'depense', 'expedition',      'variable', 40),
  ('FRAIS MENSUEL', 'depense', 'frais_bancaires', 'fixe',     50)
on conflict do nothing;
