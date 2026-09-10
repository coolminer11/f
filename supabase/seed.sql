-- ============================================================================
-- Tapora S.E.N.C. — Données initiales
-- ============================================================================

insert into parametres (id, nom_entreprise) values (true, 'Tapora S.E.N.C.')
on conflict (id) do nothing;

-- Taux de taxes du Québec. TVQ à 9,975 % du HT depuis le 1er janvier 2013.
insert into taux_taxes (date_debut, date_fin, taux_tps, taux_tvq, note) values
  ('2011-01-01', '2013-01-01', 0.05000, 0.09500, 'TVQ calculée sur HT + TPS avant 2013'),
  ('2013-01-01', null,          0.05000, 0.09975, 'TVQ calculée sur le HT seul')
on conflict do nothing;

insert into exercices (annee, date_debut, date_fin) values
  (2025, '2025-01-01', '2025-12-31'),
  (2026, '2026-01-01', '2026-12-31')
on conflict (annee) do nothing;

-- Associés : parts égales, la somme doit valoir 1.
insert into associes (nom, part, ordre) values
  ('Julien Boutet',   0.5, 1),
  ('Arthur Popovici', 0.5, 2)
on conflict (nom) do nothing;

-- Catégories : libellés, sens, nature par défaut et récupération des taxes.
insert into categories_defauts (categorie, libelle, type_defaut, nature_defaut, pct_cti, pct_rti, ordre) values
  ('ventes_cartes',       'Ventes de cartes NFC',        'revenu',  null,       1,   1,   10),
  ('ventes_accessoires',  'Ventes d''accessoires',       'revenu',  null,       1,   1,   20),
  ('ventes_services',     'Services et configuration',   'revenu',  null,       1,   1,   30),
  ('cartes_achat',        'Achat de cartes vierges',     'depense', 'variable', 1,   1,   40),
  ('impression',          'Impression et personnalisation','depense','variable',1,   1,   50),
  ('expedition',          'Expédition et livraison',     'depense', 'variable', 1,   1,   60),
  ('emballage',           'Emballage',                   'depense', 'variable', 1,   1,   70),
  ('frais_stripe',        'Frais Stripe',                'depense', 'variable', 1,   1,   80),
  ('frais_bancaires',     'Frais bancaires et dépôts',   'depense', 'fixe',     1,   1,   90),
  ('hebergement',         'Hébergement et domaines',     'depense', 'fixe',     1,   1,  100),
  ('logiciels',           'Logiciels et abonnements',    'depense', 'fixe',     1,   1,  110),
  ('publicite',           'Publicité et marketing',      'depense', 'fixe',     1,   1,  120),
  ('honoraires',          'Honoraires professionnels',   'depense', 'fixe',     1,   1,  130),
  ('deplacement',         'Déplacements',                'depense', 'variable', 1,   1,  140),
  ('repas_representation','Repas et représentation',     'depense', 'fixe',     0.5, 0.5, 150),
  ('autre',               'Autre',                       'depense', 'fixe',     1,   1,  900)
on conflict (categorie) do nothing;

-- Produit de départ.
insert into produits (sku, nom, description, prix_vente_ht, est_carte) values
  ('CARTE-NFC-STD', 'Carte NFC avis Google — standard',
   'Carte NFC personnalisée redirigeant vers la fiche Google de l''entreprise', 39.00, true)
on conflict (sku) do nothing;

-- Coûts unitaires de référence (à ajuster avec vos vrais chiffres).
insert into couts_unitaires (produit_id, composante, montant_ht, date_effet, note)
select null, c.composante, c.montant, '2026-01-01', 'Valeur de départ à ajuster'
from (values ('carte_vierge', 2.5000), ('impression', 1.2000),
             ('expedition', 2.0000), ('emballage', 0.4000)) as c(composante, montant)
on conflict do nothing;

-- Règles de catégorisation de départ pour l'import bancaire.
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
