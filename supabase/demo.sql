-- ============================================================================
-- Tapora S.E.N.C. — Jeu d'essai
-- ============================================================================
-- Un trimestre plausible : ventes Stripe et comptant, expédition hors Québec,
-- achat de stock, dépenses, rétrofacturation, apports et prélèvements.
-- À jouer sur une base de démonstration seulement — jamais en production.
-- ============================================================================

update parametres set
  numero_tps = '123456789 RT0001', numero_tvq = '1234567890 TQ0001',
  neq = '1174829365', adresse = '120, rue Saint-Joseph Est',
  ville = 'Québec (Québec)', code_postal = 'G1K 3A8',
  telephone = '418 555-0142', courriel_contact = 'facturation@tapora.ca',
  site_web = 'tapora.ca',
  conditions_generales_defaut = 'Paiement dû selon les conditions indiquées. Intérêt de 1,5 % par mois (19,56 % par année) sur tout solde en souffrance. Les cartes demeurent la propriété de Tapora S.E.N.C. jusqu''au paiement complet.'
where id;

-- Stock : un lot de 200 cartes, porté à l'actif
select enregistrer_achat_stock(current_date - 40, 'Achat de 200 cartes vierges',
  (select id from produits where sku = 'CARTE-NFC-STD'), 200, 500.00, 'QC', 'carte_credit');

-- Ventes Stripe
select enregistrer_charge_stripe('demo_ch_1', current_date - 35, 39.00 * 1.14975, 1.43, 'QC',
  'Carte NFC', 'Dépanneur Lafleur', 'CARTE-NFC-STD', 1, 'demo_pi_1', null);
select enregistrer_charge_stripe('demo_ch_2', current_date - 12, 78.00 * 1.13, 2.86, 'ON',
  '2 cartes NFC', 'Boutique Toronto', 'CARTE-NFC-STD', 2, 'demo_pi_2', null);
select enregistrer_versement_stripe('demo_po_1', current_date - 10, 88.14, '{}'::jsonb);

-- Facture Net 30, partiellement payée
with v as (
  insert into ventes (date, client_nom, province, canal, mode_paiement, type_document,
    conditions_paiement, adresse_facturation, courriel_facturation, bon_de_commande,
    conditions_generales)
  values (current_date - 14, 'Boulangerie Lévesque', 'QC', 'autre', 'virement', 'facture',
    'Net 30', E'88, rue Racine Est\nChicoutimi (Québec) G7H 1S4',
    'compta@boulangerie-levesque.ca', 'BC-4471',
    (select conditions_generales_defaut from parametres where id))
  returning id)
insert into vente_lignes (vente_id, produit_id, description, quantite, prix_unitaire_ht, ordre)
select v.id, p.id, 'Carte NFC personnalisée — impression du logo', 12, 39.00, 1
from v, produits p where p.sku = 'CARTE-NFC-STD';

insert into paiements_vente (vente_id, date, montant, mode_paiement, reference)
select id, current_date - 5, 300.00, 'virement', 'VIR-88213'
from ventes where client_nom = 'Boulangerie Lévesque';

-- Vente au comptoir, prix taxes incluses
with v as (
  insert into ventes (date, client_nom, province, canal, mode_paiement, type_document, prix_avec_taxes)
  values (current_date - 7, 'Salon Marie', 'QC', 'comptant', 'comptant', 'recu', true)
  returning id)
insert into vente_lignes (vente_id, produit_id, description, quantite, prix_unitaire_ht)
select v.id, p.id, 'Carte NFC', 4, 45.00 from v, produits p where p.sku = 'CARTE-NFC-STD';
insert into paiements_vente (vente_id, date, montant, mode_paiement)
select id, date, montant_ttc, 'comptant' from ventes where type_document = 'recu';

-- Exportation détaxée
with v as (
  insert into ventes (date, client_nom, province, canal, mode_paiement, type_document,
    regime_taxe, motif_exemption, adresse_facturation, transporteur, numero_suivi)
  values (current_date - 4, 'Brooklyn Coffee Lab', 'QC', 'autre', 'virement', 'facture',
    'detaxe', 'Exportation hors du Canada — bien expédié aux États-Unis',
    E'188 Bedford Ave\nBrooklyn, NY 11211, USA', 'Postes Canada', 'LX 4471 8892 CA')
  returning id)
insert into vente_lignes (vente_id, produit_id, description, quantite, prix_unitaire_ht)
select v.id, p.id, 'Carte NFC personnalisée', 25, 35.00 from v, produits p where p.sku = 'CARTE-NFC-STD';

-- Devis en attente
with v as (
  insert into ventes (date, client_nom, province, canal, mode_paiement, type_document,
    statut, conditions_paiement, notes_facture)
  values (current_date - 6, 'Clinique dentaire Nadeau', 'ON', 'autre', 'virement', 'devis',
    'envoyee', 'Payable à réception',
    'Livraison estimée à 10 jours ouvrables après approbation du visuel.')
  returning id)
insert into vente_lignes (vente_id, produit_id, description, quantite, prix_unitaire_ht)
select v.id, p.id, 'Carte NFC personnalisée', 25, 35.00 from v, produits p where p.sku = 'CARTE-NFC-STD';

-- Dépenses
select enregistrer_depense(current_date - 38, 'Hébergement Vercel', 25.00, 'hebergement', 'QC', 'carte_credit');
select enregistrer_depense(current_date - 8,  'Hébergement Vercel', 25.00, 'hebergement', 'QC', 'carte_credit');
select enregistrer_depense(current_date - 30, 'Publicité Facebook', 95.00, 'publicite', 'QC', 'carte_credit');
select enregistrer_depense(current_date - 9,  'Publicité Google Ads', 180.00, 'publicite', 'QC', 'carte_credit');
select enregistrer_depense(current_date - 25, 'Impression de 20 cartes', 24.00, 'impression', 'QC', 'carte_credit');
select enregistrer_depense(current_date - 6,  'Impression de 60 cartes', 72.00, 'impression', 'QC', 'carte_credit');
select enregistrer_depense(current_date - 5,  'Postes Canada', 33.00, 'expedition', 'QC', 'comptant');
select enregistrer_depense(current_date - 3,  'Repas avec un client', 80.00, 'repas_representation', 'QC', 'carte_credit');
select enregistrer_depense(current_date - 2,  'Présentoirs (achat en Saskatchewan)', 120.00, 'autre', 'SK', 'carte_credit');

-- Rétrofacturation
select enregistrer_charge_stripe('demo_ch_3', current_date - 11, 30.00 * 1.14975, 1.17, 'QC',
  'Carte NFC', 'Client contesté', 'CARTE-NFC-STD', 1, 'demo_pi_3', null);
select enregistrer_litige_stripe('demo_dp_1', 'demo_ch_3', current_date - 3,
  30.00 * 1.14975, null, 'product_not_received');

-- Associés
insert into mouvements_associes (associe_id, date, compte, type, montant, description)
select a.id, current_date - 45, 'capital', 'apport', 2500.00, 'Apport initial à la constitution'
from associes a;
insert into mouvements_associes (associe_id, date, compte, type, montant, description)
select a.id, current_date - 40, 'courant', 'avance', 1200.00, 'Avance pour l''achat du premier lot'
from associes a where a.nom = 'Arthur Popovici';
insert into mouvements_associes (associe_id, date, compte, type, montant, description)
select a.id, current_date - 5, 'capital', 'prelevement', 900.00, 'Prélèvement mensuel'
from associes a where a.nom = 'Julien Boutet';
insert into mouvements_associes (associe_id, date, compte, type, montant, description)
select a.id, current_date - 5, 'capital', 'prelevement', 200.00, 'Prélèvement mensuel'
from associes a where a.nom = 'Arthur Popovici';

-- Décisions
insert into decisions (date, titre, description, decision, categorie, notes)
values (current_date - 44, 'Constitution et parts',
  'Répartition du capital entre les deux associés à la constitution de la société.',
  'Les parts sont fixées à 50 % pour chacun, avec un apport initial de 2 500 $ chacun.',
  'juridique', 'Enregistré au registre des entreprises.');
insert into decisions (date, titre, description, decision, categorie, notes)
values (current_date - 6, 'Prix de la carte standard',
  'Révision du prix courant après analyse de la marge par canal de vente.',
  'Fixer le prix de vente à 39 $ hors taxes, sauf commande de 25 cartes et plus.',
  'finance', 'Marge visée : 30 $ par carte.');
