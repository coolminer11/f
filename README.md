# Tapora S.E.N.C. — Back-office

Gestion des dépenses, des profits et des comptes d'associés pour Tapora S.E.N.C.
(société en nom collectif québécoise, 2 associés à parts égales).

**État : schéma de base de données seulement.** L'interface Next.js n'est pas
encore écrite — elle attend votre accord sur la modélisation ci-dessous.

## Contenu

```
supabase/
  migrations/
    ..._types_et_extensions.sql   Types énumérés
    ..._referentiel.sql           Paramètres, taux de taxes, exercices, produits, associés
    ..._ventes.sql                Ventes et lignes de vente (Stripe et comptant)
    ..._transactions.sql          Table centrale du journal
    ..._caisse_et_inventaire.sql  Petite caisse et stock de cartes
    ..._stripe_et_imports.sql     Webhooks Stripe, versements, import CSV bancaire
    ..._associes.sql              Capital, compte courant, registre des décisions
    ..._declarations_taxes.sql    Déclarations TPS/TVQ transmises
    ..._fonctions.sql             Calculs de taxes et déclencheurs
    ..._rpc_metier.sql            Webhooks, rapport de taxes, clôture d'exercice
    ..._vues_rapports.sql         Vues alimentant les 5 écrans
    ..._securite.sql              RLS et entreposage des reçus
  seed.sql                        Taux de taxes, catégories, associés, produit
```

## Règles fiscales inscrites dans le schéma

| Règle | Où elle est appliquée |
|---|---|
| TPS = 5 % du HT | `calculer_taxes()`, table `taux_taxes` |
| TVQ = 9,975 % du HT (jamais sur HT + TPS) | `calculer_taxes()` |
| Les taxes perçues ne sont pas du revenu | Colonnes `tps`/`tvq` séparées de `montant_ht` ; toutes les vues de résultat ne somment que `montant_ht` |
| TPS/TVQ payées récupérables (CTI/RTI) | Colonnes générées `cti`/`rti` sur `transactions` |
| CTI/RTI limités à 50 % sur les repas | `categories_defauts` + déclencheur `trg_defauts_transaction` |
| Exercice du 1er janvier au 31 décembre | Table `exercices` + contrainte `chk_exercice_bornes` |
| Écritures gelées après la clôture | Déclencheur `trg_verifier_exercice` |

## Écrans prévus et vues correspondantes

| Écran | Source |
|---|---|
| 1. État des résultats mensuel | `v_resultats_mensuels` (comparaison avec le mois précédent incluse) |
| 2. Marge unitaire | `v_marge_unitaire_reelle`, `v_marge_unitaire_reference` (par canal) |
| 3. Seuil de rentabilité | `v_seuil_rentabilite` |
| 4. Rapport TPS/TVQ | `rapport_taxes(debut, fin)`, `declarations_taxes` |
| 5. Saisie d'une dépense + reçu | `transactions`, bucket privé `recus` |
| Associés | `v_capital_associes`, `v_prelevements_exercice` |
| Registre des décisions | `v_decisions` |

## Vente comptant

Les cartes peuvent être vendues en argent comptant. Le schéma en tient compte :

- `ventes.canal` / `mode_paiement` distinguent Stripe, comptant, Interac, etc. ;
- `mouvements_caisse` tient le solde de la petite caisse (encaissements, dépenses
  payées comptant, dépôts à la banque) ;
- un dépôt bancaire est un **transfert**, jamais un revenu : la ligne du relevé
  est rapprochée au lieu d'être catégorisée, ce qui évite de compter la vente
  deux fois ;
- la marge unitaire est calculée **par canal** : une vente comptant ne supporte
  aucun frais Stripe.

## Développement local

```bash
supabase start          # applique migrations/ puis seed.sql
supabase db reset       # repart d'une base vierge
```

Le schéma a été validé sur PostgreSQL 16 : les 12 migrations et le seed
s'appliquent sur une base vierge, et un scénario complet (vente Stripe, vente
comptant, remboursement, versement, import bancaire, clôture d'exercice) passe.

## Sécurité

Pas d'authentification pour l'instant : un mot de passe unique en variable
d'environnement (`BACKOFFICE_PASSWORD`). En conséquence, le RLS est activé sur
les 22 tables **sans aucune politique** : les clés publiques Supabase ne lisent
rien, et seul le serveur Next.js accède aux données avec la clé `service_role`.
Les 15 vues sont en `security_invoker` pour ne pas contourner ce verrou.
