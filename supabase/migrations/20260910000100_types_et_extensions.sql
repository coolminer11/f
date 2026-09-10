-- ============================================================================
-- Tapora S.E.N.C. — 01 · Extensions et types énumérés
-- ============================================================================
create extension if not exists pgcrypto;
-- btree_gist : contraintes d'exclusion mêlant égalité (province, code de taxe)
-- et chevauchement de périodes.
create extension if not exists btree_gist;

-- Sens d'une écriture. Les taxes ne sont JAMAIS un revenu : elles vivent dans
-- la table `lignes_taxe` et n'entrent dans aucun calcul de profit.
create type type_transaction as enum ('revenu', 'depense');

-- Coût variable = proportionnel au nombre de cartes vendues.
-- Coût fixe = engagé même à zéro vente (sert au seuil de rentabilité).
create type nature_cout as enum ('variable', 'fixe');

-- Provenance de la donnée (traçabilité, pas moyen de paiement).
create type source_transaction as enum ('stripe', 'banque', 'manuel');

-- Moyen de paiement : indispensable pour la vente comptant.
create type mode_paiement as enum (
  'stripe', 'comptant', 'interac', 'carte_debit', 'carte_credit',
  'cheque', 'virement', 'autre'
);

-- Plan comptable.
--   * Les 9 valeurs du devis initial sont présentes à l'identique.
--   * Catégories de revenu : sans elles, tout le chiffre d'affaires tombait
--     dans « autre ».
--   * frais_bancaires : frais de dépôt d'argent comptant et frais de compte.
--   * emballage / deplacement : coûts variables distincts de l'expédition.
--   * repas_representation : règle fiscale propre (récupération à 50 %).
--   * cout_marchandises_vendues : coût des cartes SORTIES du stock lors d'une
--     vente. C'est lui qui charge le résultat, pas l'achat du lot.
--   * perte_inventaire : écarts constatés au dénombrement (bris, encodage raté).
--   * frais_litige : frais de rétrofacturation Stripe.
create type categorie_transaction as enum (
  'ventes_cartes', 'ventes_accessoires', 'ventes_services',
  'cartes_achat', 'cout_marchandises_vendues', 'perte_inventaire',
  'impression', 'expedition', 'emballage',
  'frais_stripe', 'frais_litige', 'frais_bancaires',
  'hebergement', 'logiciels', 'publicite', 'honoraires',
  'deplacement', 'repas_representation',
  'autre'
);

-- Canal de vente : sépare la marge Stripe (amputée des frais) de la marge
-- comptant (aucun frais de transaction).
create type canal_vente as enum ('stripe', 'comptant', 'en_ligne', 'autre');

create type statut_vente as enum (
  'payee', 'partiellement_remboursee', 'remboursee', 'contestee', 'annulee'
);

-- Mouvements des comptes d'associés.
create type type_mouvement_associe as enum (
  'apport', 'prelevement', 'part_profit',
  'avance', 'remboursement_avance', 'ajustement'
);

-- Provinces et territoires : la taxe applicable dépend de la destination.
create type province_canada as enum (
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'
);
