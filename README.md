# Tapora S.E.N.C. — Back-office

Gestion des dépenses, des profits et des comptes d'associés pour Tapora S.E.N.C.
(société en nom collectif québécoise, 2 associés à parts égales).

**État : schéma de base de données + écrans 1 et 2.**

| Écran | Route | État |
|---|---|---|
| 1. Transactions et saisie d'une dépense | `/transactions` | ✅ |
| 2. État des résultats mensuel | `/resultats` | ✅ |
| 3. Rapport de remise de taxes | — | à venir |
| 4. Tableau des associés | — | à venir |
| 5. Import CSV bancaire | — | à venir |
| 6. Marge unitaire et seuil de rentabilité | — | à venir |

## Contenu

```
supabase/
  migrations/
    ..._types_et_extensions.sql   Types énumérés
    ..._referentiel.sql           Paramètres, référentiel de taxes, exercices, produits
    ..._ventes.sql                Ventes et lignes de vente (Stripe et comptant)
    ..._transactions.sql          Journal central et lignes de taxe
    ..._caisse_et_inventaire.sql  Petite caisse, stock, dénombrement
    ..._stripe_et_imports.sql     Événements, versements, litiges, import CSV
    ..._associes.sql              Capital, compte courant, registre des décisions
    ..._declarations_taxes.sql    Déclarations figées, par autorité fiscale
    ..._fonctions.sql             Calculs de taxes et déclencheurs
    ..._rpc_metier.sql            Webhooks, rapport de taxes, clôture d'exercice
    ..._vues_rapports.sql         Vues alimentant les 5 écrans
    ..._securite.sql              RLS et entreposage des reçus
  seed.sql                        Taux de taxes, catégories, associés, produit
```

## Règles fiscales inscrites dans le schéma

| Règle | Où elle est appliquée |
|---|---|
| TPS 5 %, TVQ 9,975 % du HT (jamais sur HT + TPS) | `regles_taxes_province`, `calculer_taxes()` |
| TVH sur une seule ligne hors Québec (13 % ON, 15 % NB/NL/PE, 14 % NS) | `regles_taxes_province` |
| TVP (C.-B., Sask., Manitoba) jamais récupérable | `taxes.recuperable_pct_defaut = 0` |
| Taxe déterminée par la province de DESTINATION | `ventes.province`, `transactions.province` |
| Les taxes perçues ne sont pas du revenu | Table `lignes_taxe` séparée ; les vues de résultat ne somment que `montant_ht` |
| Taxes payées récupérables (CTI/RTI) | `lignes_taxe.montant_recuperable` |
| Récupération limitée à 50 % sur les repas | `categories_defauts` + déclencheur `trg_defauts_transaction` |
| Taxe non récupérable = charge réelle | Colonne générée `transactions.cout_reel` |
| Stock non vendu = actif, pas une charge | `transactions.est_stock` + `cout_marchandises_vendues` |
| Exercice du 1er janvier au 31 décembre | Table `exercices` + contrainte `chk_exercice_bornes` |
| Écritures gelées après la clôture | Déclencheur `trg_verifier_exercice` |

### Arrondi

Chaque taxe est calculée sur le montant HT de l'écriture entière (jamais unité
par unité), puis arrondie au cent le plus proche, **les demis s'éloignant de
zéro** — c'est `round(numeric, 2)` de PostgreSQL, et la règle admise par l'ARC
et Revenu Québec. Exemple : 39,00 $ × 9,975 % = 3,89025 $ → 3,89 $.

Quand le montant encaissé vient de l'extérieur (Stripe), le résidu d'arrondi est
porté sur la dernière ligne de taxe : la somme reconcilie au cent près avec ce
que le client a réellement payé.

Aucune colonne monétaire stockée n'est en virgule flottante : `numeric(12,2)`
pour les montants, `numeric(12,4)` pour les coûts unitaires, `numeric(7,5)` pour
les taux.

## Écrans prévus et vues correspondantes

| Écran | Source |
|---|---|
| 1. État des résultats mensuel | `v_resultats_mensuels` (comparaison avec le mois précédent incluse) |
| 2. Marge unitaire | `v_marge_unitaire_reelle` (fenêtre 90 jours), `v_marge_unitaire_reference` |
| 3. Seuil de rentabilité | `v_seuil_rentabilite` (les deux marges côte à côte) |
| 4. Rapport de taxes, par juridiction | `rapport_taxes()`, `rapport_taxes_par_autorite()`, `declarations_taxes` |
| 5. Saisie d'une dépense + reçu | `transactions`, bucket privé `recus` |
| Associés | `v_capital_associes`, `v_prelevements_exercice` |
| Registre des décisions | `v_decisions` |
| Dénombrement d'inventaire | `denombrements`, `preparer_denombrement()`, `appliquer_denombrement()` |
| Rétrofacturations | `v_litiges` |

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
cp .env.example .env.local   # puis remplir BACKOFFICE_PASSWORD, SESSION_SECRET, DATABASE_URL
supabase start               # applique migrations/ puis seed.sql
supabase db reset            # repart d'une base vierge
npm install
npm run dev                  # http://localhost:3000
```

## Architecture de l'interface

- **Next.js App Router**, composants serveur par défaut. Les rares composants
  clients (filtres, formulaire de dépense, graphique) ne touchent jamais la
  base : ils passent par des server actions ou des route handlers.
- **`pg` pour les données, `@supabase/supabase-js` pour les reçus.** Toute
  l'intelligence du modèle vit dans des vues et des fonctions SQL ; les
  interroger en SQL direct est plus lisible qu'à travers PostgREST et permet
  d'enchaîner plusieurs écritures dans une transaction. Le raisonnement complet
  est en tête de `lib/db.ts`.
- **Aucun calcul monétaire en JavaScript.** Les montants arrivent déjà calculés
  par PostgreSQL ; le client ne fait que les mettre en forme.
- Les reçus vivent dans un bucket privé, servis par `/api/recus/...` qui vérifie
  la session et redirige vers une URL signée à durée limitée.

Le schéma est validé sur PostgreSQL 16 : les 12 migrations et le seed
s'appliquent sur une base vierge, et un scénario complet passe — ventes au
Québec, en Ontario et en Colombie-Britannique avec les taxes correspondantes,
vente comptant, achat porté au stock, coût des marchandises vendues,
rétrofacturation, dénombrement de fin d'exercice, remise ventilée par
juridiction et clôture d'exercice.

## Idempotence

Deux protections, parce que les deux sources de données réessaient :

- **Webhooks Stripe** : `reserver_evenement_stripe()` insère d'abord dans
  `evenements_stripe` (contrainte unique sur `stripe_event_id`) et ne renvoie
  `true` qu'à l'appel qui a gagné l'insertion. Un réessai de Stripe obtient
  `false` et ne fait rien.
- **Import CSV** : empreinte unique sur le fichier (`imports_bancaires`) *et*
  sur chaque ligne (`lignes_import_bancaire`), pour couvrir aussi les relevés
  qui se chevauchent.

## Sécurité

Pas d'authentification : un mot de passe unique en variable d'environnement
(`BACKOFFICE_PASSWORD`). En conséquence, le RLS est activé sur les 28 tables
**sans aucune politique**, et les 16 vues sont en `security_invoker`.

**Aucun appel Supabase ne part du navigateur.** Tout passe par des route
handlers ou des server actions, avec la clé `service_role`. Il n'y a
volontairement pas de clé `anon` dans ce projet : une requête depuis le
navigateur ne remonterait que des tableaux vides, sans message d'erreur. Le
détail est documenté en tête de `lib/supabase/server.ts` et de la migration
`..._securite.sql`.
