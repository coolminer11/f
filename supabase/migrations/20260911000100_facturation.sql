-- ============================================================================
-- Tapora S.E.N.C. — 13 · Facturation
-- ============================================================================
-- Une vente saisie à la main doit pouvoir produire un document que l'on remet
-- au client. Trois besoins que le modèle ne couvrait pas :
--
--   1. Un DEVIS n'est pas une vente. Il ne doit créer ni revenu, ni sortie de
--      stock, ni coût des marchandises vendues — tant qu'il n'est pas accepté.
--   2. Une FACTURE peut être émise avant d'être payée. Le revenu est reconnu à
--      l'émission (comptabilité d'exercice), mais l'argent n'entre qu'au
--      paiement : les deux moments sont distincts et doivent le rester.
--   3. Une facture peut recevoir PLUSIEURS paiements (acompte puis solde).
--
-- Conséquence directe : l'encaissement en caisse ne suit plus le mode de
-- paiement déclaré sur la vente, il suit les paiements réellement reçus.
-- ============================================================================

-- « ferme » : le document engage la vente. Distinct de « payee », qui parlait
-- d'encaissement et prêtait à confusion avec la nouvelle colonne
-- `statut_paiement`. Les deux valeurs coexistent : Stripe encaisse au moment
-- de la vente et continue d'écrire « payee ».
alter type statut_vente add value if not exists 'ferme';
alter type statut_vente add value if not exists 'brouillon';
alter type statut_vente add value if not exists 'envoyee';
alter type statut_vente add value if not exists 'acceptee';
alter type statut_vente add value if not exists 'refusee';
