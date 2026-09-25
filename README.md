# Tapora S.E.N.C. — Back-office

Gestion des dépenses, des profits et des comptes d'associés pour Tapora S.E.N.C.
(société en nom collectif québécoise, 2 associés à parts égales).

**État : complet.**

| Écran | Route |
|---|---|
| 1. Transactions et saisie d'une dépense | `/transactions` |
| 2. État des résultats mensuel | `/resultats` |
| 3. Remise de taxes, ventilée par juridiction | `/taxes` |
| 4. Associés : capital, prélèvements, décisions | `/associes` |
| 5. Import CSV bancaire et rapprochement | `/import` |
| 6. Marge unitaire et seuil de rentabilité | `/marge` |
| Documents de vente (7 types) | `/ventes` |
| Export comptable | `/export` |
| Comptes | `/compte` |

## Facturation

Sept types de documents, numérotés séparément et sans trou par des compteurs
annuels. Ce que chacun **fait** est décrit une seule fois, dans la table
`types_document` : les déclencheurs SQL et l'interface la lisent tous les deux,
personne ne recopie la règle.

| Document | Préfixe | Revenu | Stock | Prix affichés | Paiement attendu |
|---|---|---|---|---|---|
| Facture | `F` | oui | sortie | oui | oui |
| Reçu de vente | `R` | oui | sortie | oui | oui |
| Facture d'acompte | `A` | oui | non | oui | oui |
| Note de crédit | `NC` | négatif | retour | oui | non |
| Devis | `D` | non | non | oui | non |
| Facture proforma | `P` | non | non | oui | non |
| Bon de livraison | `BL` | non | non | **non** | non |

Ajouter un type, c'est ajouter une ligne à ce registre — pas retrouver cinq
conditions éparpillées dans des déclencheurs.

### Régimes de taxe

Toutes les ventes ne portent pas de taxe. Le régime se choisit sur le document
et **exige un motif**, qui s'imprime dessus :

| Régime | Taxes | Motif | Certificat |
|---|---|---|---|
| Taxable | selon la province | — | — |
| Détaxée (0 %) | aucune | obligatoire | facultatif |
| Exonérée | aucune | obligatoire | obligatoire |
| Hors du champ | aucune | obligatoire | facultatif |

Ce n'est pas un interrupteur « pas de taxes » : sans motif, la base refuse
l'écriture. C'est exactement ce qu'une vérification demandera.

### Prix taxes incluses

Pour la vente au comptoir, une case fait basculer les prix des lignes en TTC :
on saisit 45 $ tout rond, le hors-taxes est déduit du prix payé. Quatre cartes
à 45 $ donnent 180,00 $ pile — 156,56 $ HT plus 23,44 $ de taxes.

### Le reste

- Une facture peut recevoir **plusieurs paiements** (`paiements_vente`) : le
  revenu et l'encaissement sont deux moments distincts et le restent. Un
  paiement comptant entre en caisse à ce moment-là, pas à l'émission.
- Une **note de crédit** s'applique à la facture qu'elle corrige : le solde dû
  diminue sans qu'un sou n'ait été encaissé. La ligne porte `note_credit_id`,
  pour ne jamais confondre un crédit accordé avec de l'argent reçu.
- Le **fichier client se construit tout seul** : facturer un nom inconnu crée sa
  fiche, refacturer le même nom la retrouve et la met à jour.
- **Dupliquer**, créer une **note de crédit** ou un **bon de livraison** passent
  tous par le même mécanisme : le nouveau document est prérempli depuis
  l'ancien et reste modifiable avant enregistrement.
- Le document imprimable sort sur feuille Lettre via la fonction d'impression du
  navigateur, qui enregistre aussi en PDF. Il porte les numéros d'inscription
  TPS et TVQ dès 30 $, comme l'exige Revenu Québec, et le bon de livraison
  réserve un espace de signature à la réception.

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
| Documents de vente | `v_documents_vente`, `paiements_vente` |
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

## Essayer sur votre machine

Sur un Mac neuf, **`DEMARRAGE-MAC.md`** donne les commandes d'installation
exactes (Homebrew, Node.js, PostgreSQL) ; ensuite tout se lance en
double-cliquant `Demarrer-Tapora.command`. Si la machine est déjà équipée :

```bash
npm install
npm run local     # trouve ou démarre une base, applique les migrations
npm run db:demo   # facultatif : un trimestre de données d'essai
npm run dev       # http://localhost:3000
```

`npm run local` cherche une base de données dans cet ordre : le `DATABASE_URL`
de votre `.env.local` s'il existe, sinon un PostgreSQL déjà lancé sur le port
5432 (Postgres.app, Homebrew), sinon la CLI Supabase, sinon un conteneur
Docker. La base `tapora` est créée si elle n'existe pas. Il applique les migrations en attente,
écrit un `.env.local` avec un `SESSION_SECRET` tiré au hasard, et vous rend la
main. Le relancer ne rejoue rien : les migrations déjà passées sont notées dans
`schema_migrations`.

Au premier écran, l'application vous propose de créer votre compte.

| Commande | Ce qu'elle fait |
|---|---|
| `npm run local` | Prépare la base et l'environnement |
| `npm run db:migrer` | Applique seulement les migrations en attente |
| `npm run db:demo` | Charge un jeu d'essai (refuse si la base contient déjà des écritures) |
| `npm run dev` | Démarre l'application |
| `npm run port` | Tire un port libre au hasard et le retient dans `.env.local` |
| `npm run partage` | Démarre en rendant l'application visible sur le réseau local |

Sans clé de messagerie, les envois de documents sont **simulés** : le courriel
est écrit dans `./courriels-locaux` et l'écran le dit franchement.

## Documents en PDF

`/ventes/<id>/pdf` renvoie un vrai fichier, en pièce jointe : le navigateur le
télécharge au lieu de l'afficher. La page publique du client a le même bouton.

Le PDF est **dessiné** (pdfkit) plutôt qu'imprimé depuis le HTML. Un navigateur
sans tête donnerait un rendu identique à l'écran, mais coûterait 300 Mo de
Chromium et autant de mémoire vive — le forfait gratuit de l'hébergeur en offre
512 en tout. Les montants n'y passent pas par `Intl` : le français y insère des
espaces fines insécables (U+202F) que l'encodage WinAnsi des polices standard
ne connaît pas, et le client verrait des caractères de remplacement à la place
de son prix.

## Supprimer

`supprimer_vente` et `supprimer_transaction` effacent pour de bon — le
document, son revenu, son coût des marchandises, ses taxes, son stock, ses
paiements — et déposent la ligne complète dans `suppressions` avec l'auteur et
le motif.

C'est un écart assumé : en comptabilité on annule, on n'efface pas, et
« Annuler » reste le geste normal. Mais une facture d'essai n'a rien à faire
dans un registre qu'on présentera un jour à Revenu Québec. Trois garde-fous :
le numéro doit être retapé, un document dont un autre dépend est refusé (note
de crédit, crédit appliqué, litige Stripe), et un exercice clos l'est aussi —
le déclencheur `t_exercice` couvre déjà la suppression. Le numéro effacé n'est
jamais réattribué.

## Aide en vidéo

`/aide` tient les vidéos d'explication : un lien (YouTube, Loom, Vimeo, Drive —
converti en adresse d'intégration, puisque personne ne colle jamais la bonne)
ou un fichier dans le seau privé `tutoriels`.

Le fichier ne transite pas par l'application : le serveur signe une adresse de
dépôt, et le navigateur téléverse directement chez Supabase. Cent mégaoctets en
mémoire tueraient l'instance gratuite, et la barre de progression vient de XHR
— `fetch` ne sait toujours pas rendre compte de l'avancement d'un envoi.

## Savoir ce qui est branché

`/etat` répond à « est-ce que tout est bien connecté ? » sans avoir à ouvrir
trois tableaux de bord. Chaque ligne fait le vrai geste plutôt que de
constater qu'une variable existe : elle interroge la base, demande le seau
« recus » à Supabase, lit la table `parametres`. Une clé peut exister et être
fausse — et le repli sur disque est silencieux par construction, donc
invisible jusqu'au redéploiement qui efface les reçus.

## Temps réel

Les écrans se mettent à jour tout seuls : un battement toutes les douze
secondes (`/api/pouls`) suivi d'un `router.refresh()`, qui redemande au serveur
exactement ce que les composants affichent. Une saisie de l'un apparaît chez
l'autre sans que personne ne recharge.

Le choix d'un sondage plutôt que d'une liaison permanente est délibéré : les
écrans sont des composants serveur, et tout le calcul comptable vit dans
PostgreSQL. Une connexion WebSocket obligerait à refaire ces calculs côté
navigateur pour un gain nul à deux utilisateurs — et à les maintenir en double.

Trois précautions dans `components/rafraichissement-auto.tsx` :

- onglet en arrière-plan : pas de sondage, rattrapage au retour ;
- champ en cours de saisie : le tour est sauté, l'écran ne bouge pas sous les
  doigts de celui qui tape un montant ;
- serveur injoignable ou session expirée : l'en-tête le dit (« Hors ligne »,
  « Session expirée ») au lieu de laisser des chiffres périmés passer pour des
  chiffres à jour. C'est pourquoi le middleware répond **401** sur `/api/…` au
  lieu de rediriger : un `fetch` qui suit une redirection reçoit la page de
  connexion avec un code 200 et conclut que tout va bien.

## Rester en local

Pour deux personnes qui démarrent, faire tourner l'application sur une seule
machine est un choix défendable : c'est gratuit, personne d'autre n'y touche, et
il n'y a rien à administrer. Deux conditions, quand même.

**Une machine fait foi.** Si chacun lance l'application chez soi, vous obtenez
deux comptabilités différentes qui divergent en silence. Décidez laquelle est la
vraie et n'en démordez pas.

**Sauvegardez.** Un portable qui meurt emporte l'exercice au complet, sans
version antérieure à aller rechercher.

```bash
npm run sauvegarde     # écrit sauvegardes/tapora-<date>.sql
```

Deux secondes. Faites-le à chaque fin de semaine et **copiez le fichier
ailleurs** — disque externe, nuage, clé USB. Une sauvegarde rangée à côté de
l'original ne protège de rien.

```bash
npm run restaurer -- sauvegardes/tapora-2026-09-10-18-04-56.sql
```

La restauration vide la base avant de recharger, pour obtenir l'état exact de
la sauvegarde plutôt qu'un mélange des deux. Le script le dit et demande
confirmation.

### Travailler à deux, au même endroit

```bash
npm run partage
```

L'application devient visible sur votre réseau local. Votre associé ouvre
l'adresse affichée depuis son portable ou son téléphone, sur le même Wi-Fi, et
se connecte avec son propre compte.

La liaison est en clair : sans conséquence sur un réseau que vous contrôlez,
mais n'ouvrez pas ce port sur votre routeur. Pour un accès depuis l'extérieur,
il faut un hébergeur — voir `DEPLOIEMENT.md`.

### Quand le local ne suffira plus

- Julien a besoin d'entrer des dépenses de chez lui.
- Vous voulez photographier un reçu avec le téléphone, sur place.
- Vous branchez le webhook Stripe : il lui faut une adresse publique.
- Vous en avez assez de penser aux sauvegardes.

Le premier de ces quatre points qui vous agace est le signal.

## Où ça tourne

Deux choses distinctes, souvent confondues :

- **Supabase héberge la base de données** (PostgreSQL) et l'entreposage des
  reçus. C'est là que vivent les données.
- **L'application est un serveur Next.js.** Elle exécute du code à chaque
  requête — c'est ce qui permet qu'aucun secret ni aucune requête ne parte du
  navigateur. Supabase n'héberge pas de serveur Node : il faut donc un
  hébergeur pour l'application elle-même (Vercel, Railway, Render, un VPS…),
  ou la faire tourner sur une machine à vous.

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
- **Le relevé bancaire est analysé dans le navigateur** (`lib/csv.ts`) : rien
  n'est envoyé tant que la correspondance des colonnes n'est pas confirmée. Les
  montants d'un relevé sont traités comme **taxes incluses** — c'est ce qui a
  réellement quitté le compte.

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

## Envoi des documents

Un document se transmet au client par courriel, avec un **lien vers ce document
seul** : le client l'ouvre, l'imprime ou l'enregistre en PDF sans avoir de
compte. Le jeton est tiré au hasard sur 24 octets, n'ouvre aucun autre écran, et
se révoque d'un clic.

Le courriel part par l'API HTTP de Resend — aucune dépendance à installer. Sans
clé configurée, l'envoi est **simulé** : le message est écrit dans
`./courriels-locaux` et le journal des envois le dit franchement, en orange.

## Export comptable

Cinq fichiers par période : grand livre, balance de vérification, sommaire des
taxes par autorité, documents de vente, mouvements des associés. CSV séparé par
des points-virgules, décimales à la virgule, UTF-8 avec marque d'ordre — Excel
en français les ouvre d'un double-clic, sans assistant ni accents cassés.

L'écran affiche aussi le sommaire de la période : revenus, coûts, profit,
valeur du stock et net de taxes par autorité.

## Sécurité

**Un compte par associé.** Mot de passe haché en scrypt avec un sel par
utilisateur, sessions en base (fermer une session la révoque vraiment), rôle
« accès complet » ou « lecture seule ». Au premier démarrage, l'écran de
connexion propose de créer le premier compte.

Deux barrières, et les deux comptent :

- le **middleware** vérifie la signature du cookie et écarte un cookie forgé
  sans toucher la base ;
- **`exigerSession()`** est appelée en tête de chaque page, de chaque route et
  de chaque action serveur : c'est elle qui tranche contre la base, car une
  session fermée ou expirée garde une signature valide.

Le RLS est activé sur toutes les tables **sans aucune politique**, et toutes les
vues sont en `security_invoker`. **Aucun accès à la base ne part du
navigateur** : tout passe par des composants serveur, des server actions ou des
route handlers. Le raisonnement complet est en tête de `lib/db.ts`.
