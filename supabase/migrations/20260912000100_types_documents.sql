-- ============================================================================
-- Tapora S.E.N.C. — 15 · Nouveaux types de documents
-- ============================================================================
-- Fichier isolé : PostgreSQL refuse d'utiliser une valeur d'énumération dans
-- la transaction qui l'ajoute. La suite est en migration 16.
-- ============================================================================

alter type type_document add value if not exists 'facture_acompte';
alter type type_document add value if not exists 'note_credit';
alter type type_document add value if not exists 'bon_livraison';
alter type type_document add value if not exists 'proforma';
