-- ============================================================================
-- Date de la pose, quand la carte était posée avant d'être ajoutée ici
-- ============================================================================
-- Vide : la pose est le jour où la première carte du dossier a été créée.
-- ============================================================================

set local lock_timeout = '5s';

alter table dossiers_cartes
  add column if not exists date_pose date
    check (date_pose is null or date_pose >= date '2020-01-01');
