-- ============================================================================
-- Quatre cartes : deux à l'unité (Québec, hors Québec), deux Entreprise
-- ============================================================================
-- À l'unité (prêtes à poser, sans personnalisation, 35 $) :
--   - Québec : « Votre avis compte ! » d'abord — la Charte de la langue
--     française exige le français nettement prédominant ;
--   - Hors Québec : « Your review matters! » d'abord. Stock à part : ce sont
--     deux cartes imprimées différemment.
-- Entreprise (30 $, 25 au minimum, design sur mesure) : inchangées.
--
-- « Carte Québec » devient « Carte à l'unité — Québec » : un acheteur hors
-- Québec lisait « Québec » comme « pas pour moi ».

alter table produits drop constraint if exists produits_modele_check;
alter table produits add constraint produits_modele_check
  check (modele is null or modele in ('quebec', 'hors_quebec', 'entreprise_qc', 'entreprise_intl'));

update produits set nom = 'Carte à l’unité — Québec' where modele = 'quebec' and nom = 'Carte Québec';

insert into produits (sku, nom, description, prix_vente_ht, taxable, suivi_stock, est_carte, actif,
                      modele, langue, personnalisable, quantite_min, seuil_stock, ordre)
select 'CARTE-HORS-QC', 'Carte à l’unité — Hors Québec',
       'Carte NFC d’avis Google prête à poser, anglais d’abord, français après. Pour les commerces hors Québec.',
       35, true, true, true, true, 'hors_quebec', 'en_fr', false, 1, null, 2
 where not exists (select 1 from produits where modele = 'hors_quebec');

update produits
   set ordre = case modele when 'quebec' then 1 when 'hors_quebec' then 2 when 'entreprise_qc' then 3 when 'entreprise_intl' then 4 end
 where modele is not null;
