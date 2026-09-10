-- ============================================================================
-- Tapora S.E.N.C. — 01 · Extensions et types énumérés
-- ============================================================================
create extension if not exists pgcrypto;

-- Sens d'une écriture. Les taxes ne sont JAMAIS un revenu : elles vivent dans
-- des colonnes distinctes (tps, tvq) et n'entrent dans aucun calcul de profit.
create type type_transaction as enum ('revenu', 'depense');

-- Coût variable = proportionnel au nombre de cartes vendues.
-- Coût fixe = engagé même à zéro vente (sert au seuil de rentabilité).
create type nature_cout as enum ('variable', 'fixe');

-- Provenance de la donnée (traçabilité, pas moyen de paiement).
create type source_transaction as enum ('stripe', 'banque', 'manuel');

-- Moyen de paiement : indispensable depuis l'ajout de la vente comptant.
create type mode_paiement as enum (
  'stripe', 'comptant', 'interac', 'carte_debit', 'carte_credit',
  'cheque', 'virement', 'autre'
);

-- Plan comptable simplifié.
--   * Les 9 valeurs demandées au devis sont présentes à l'identique.
--   * Ajouts justifiés :
--       ventes_cartes / ventes_accessoires / ventes_services -> sans catégories
--         de revenu, l'état des résultats classait tout dans « autre ».
--       frais_bancaires -> devient nécessaire avec l'encaissement comptant
--         (frais de dépôt, frais de compte).
--       emballage -> coût variable distinct de l'expédition.
--       deplacement / repas_representation -> le repas a une règle fiscale
--         propre (CTI/RTI limités à 50 %), il ne peut pas vivre dans « autre ».
create type categorie_transaction as enum (
  'ventes_cartes', 'ventes_accessoires', 'ventes_services',
  'cartes_achat', 'impression', 'expedition', 'emballage',
  'frais_stripe', 'frais_bancaires',
  'hebergement', 'logiciels', 'publicite', 'honoraires',
  'deplacement', 'repas_representation',
  'autre'
);

-- Canal de vente : sépare la marge Stripe (amputée des frais) de la marge
-- comptant (aucun frais de transaction).
create type canal_vente as enum ('stripe', 'comptant', 'en_ligne', 'autre');

create type statut_vente as enum (
  'payee', 'partiellement_remboursee', 'remboursee', 'annulee'
);

-- Mouvements des comptes d'associés.
create type type_mouvement_associe as enum (
  'apport', 'prelevement', 'part_profit',
  'avance', 'remboursement_avance', 'ajustement'
);
