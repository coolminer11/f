# Revenus mensuels et paiements — le plan

*Recherche faite en octobre 2026. Les frais changent : revérifier les pages citées avant de signer quoi que ce soit.*

---

## 1. Verdict

**Stripe, pour tout.** Les paiements en ligne, les abonnements, les factures, et même les ventes de Julien sur le terrain (Tap to Pay dans l'app Stripe sur iPhone, sans matériel ni code).
- **Une seule source de vérité** : chaque paiement arrive au back-office par webhook (revenu inscrit tout seul, frais Stripe en dépense). Avec deux processeurs, ça fait deux rapprochements.
- **0 $ par mois**, aucun contrat : on paie seulement par transaction.
- **L'API la plus solide** : mode test complet, CLI, portail client prêt à l'emploi.
- **Square n'est moins cher qu'en personne**, d'environ 0,20 $ à 0,30 $ par carte vendue. Ça ne vaut pas un deuxième système.

---

## 2. Comparatif (Canada)

| | **Stripe** | **Square** |
|---|---|---|
| **Carte en ligne** | 2,9 % + 0,30 $ ; +0,8 % carte étrangère ; +0,5 % carte saisie à la main ([stripe.com/en-ca/pricing](https://stripe.com/en-ca/pricing)) | 2,8 % + 0,30 $ ; +1,5 % carte étrangère ([squareup.com/ca/en/pricing](https://squareup.com/ca/en/pricing)) |
| **Abonnements** | Stripe Billing : **0,7 %** du volume facturé, en paiement à l'usage (aucun forfait mensuel) | Square Subscriptions existe au Canada ([squareup.com/ca/en/subscriptions](https://squareup.com/ca/en/subscriptions)), au taux en ligne 2,8 % + 0,30 $ |
| **Factures** | 0,4 % par facture payée (forfait Starter), en plus des frais de carte | Factures gratuites (0 $/mois) ; frais de carte en ligne |
| **Prélèvement bancaire** | Débit préautorisé (PAD) : 1 % + 0,40 $, plafonné à **5 $** ; +1 $ par vérification instantanée ; 5 $ par échec | Pas d'équivalent clair trouvé |
| **En personne** | Tap to Pay sur iPhone et Android dans l'app **Stripe Dashboard**, sans code ni matériel ([docs.stripe.com/no-code/tap-to-pay](https://docs.stripe.com/no-code/tap-to-pay)) : 2,7 % + 0,05 $, **+0,15 $ par autorisation Tap to Pay** ; Interac 0,15 $ | App Point de vente gratuite, Tap to Pay sur iPhone au Canada depuis mai 2024 ([BusinessWire](https://www.businesswire.com/news/home/20240523642122/en/Square-Launches-Tap-to-Pay-on-iPhone-in-Canada)) : **2,5 %** crédit, **0,75 % + 0,07 $** débit ([squareup.com/ca/en/payments/tap-to-pay](https://squareup.com/ca/en/payments/tap-to-pay)) |
| **Interac** | En personne : oui, Tap to Pay sur iPhone et Android compris ([liste des moyens de paiement Terminal](https://docs.stripe.com/terminal/payments/collect-card-payment/supported-card-brands)). En ligne : par portefeuilles numériques depuis février 2026 selon Interac (⚠️ à confirmer dans le Dashboard). Virement Interac : non | En personne : oui (Interac sans contact) |
| **API et webhooks** | Excellents : mode test, Stripe CLI, signatures, portail client prêt à l'emploi ([docs.stripe.com/customer-management](https://docs.stripe.com/customer-management)) | Corrects : webhooks `subscription.created` et `subscription.updated`, échecs à déduire de `payment.updated` ([developer.squareup.com](https://developer.squareup.com/docs/subscriptions-api/overview)) |
| **Ce qui coûte 0 $ par mois** | Paiements, Payment Links, Checkout, portail client, versements standards | Forfait Gratuit, app Point de vente, Factures |
| **À éviter (coûte par mois)** | Billing en forfait (770 $/mois), Stripe Tax Complete (120 $/mois), domaine personnalisé pour Checkout (10 $ US/mois), Sigma | Forfait Plus (35 $/mois et plus), Marketing (20 $/mois), Fidélité (60 $/mois) |
| **Versements** | Premier versement en 7 à 14 jours, puis environ 3 jours ouvrables ([docs.stripe.com/payouts](https://docs.stripe.com/payouts)). Instantané : 1 % (minimum 0,60 $) | 1 à 2 jours ouvrables (non vérifié ici) |

**Exemple : une Carte Québec à 35 $ vendue en personne**

| | Crédit | Interac |
|---|---|---|
| **Square** | ≈ 0,88 $ | ≈ 0,33 $ |
| **Stripe** (Tap to Pay) | ≈ 1,15 $ | ≈ 0,15 $ à 0,30 $ |

L'écart est minime.

**Abonnement de 15 $/mois chez Stripe** : carte 0,74 $ + Billing 0,11 $ = **≈ 0,85 $**, soit 5,6 %. Payé à l'année par prélèvement bancaire (150 $), ça donne 1,90 $ + 1,05 $ ≈ **2 %**.

---

## 3. Des revenus mensuels — légitimes

### La règle d'or
Le site promet « **tout inclus, sans abonnement, aucuns frais mensuels** ». Cette promesse est **tenue pour toujours** envers chaque client qui a acheté une carte.
- **Restent gratuits, pour tous, toujours** : page privée de statistiques, statistiques détaillées par carte et par groupe, export CSV, mot de passe de la page, messages à Tapora, « Ding ! », mode comptoir, rapport mensuel, « Votre année Tapora », destination modifiable.
- **Un abonnement n'ajoute que du NOUVEAU** : des services qui coûtent du temps ou de l'argent à Tapora. Il est facultatif, annulable en tout temps, sans engagement. On ne retire jamais une fonction pour la revendre.
- **Avant de lancer** : mettre à jour les Conditions et le site (« l'achat de cartes reste sans abonnement ; Tapora Pro est une option »).
- **Règles Google** : aucune offre ne doit filtrer les avis (envoyer seulement les clients contents) ni récompenser un avis. C'est interdit par Google et c'est ce qui rend Tapora crédible.

### Les offres

| Offre | Prix suggéré | Pour qui | Ce que Tapora fournit | Ce qu'il faut construire |
|---|---|---|---|---|
| **Tapora Pro** | **19 $/mois** par établissement, ou **190 $/an** (2 mois offerts) | Hôtels, restos, cliniques Entreprise | Réponse aux messages en 1 jour ouvrable ; bilan trimestriel des avis (PDF à leurs couleurs, recommandations) ; défis d'équipe (classement du personnel par carte, objectifs du mois) ; aide pour changer les destinations selon la saison | Abonnement Stripe, drapeau « Pro » sur le dossier, PDF trimestriel, défis |
| **Garantie Remplacement** | **4 $/mois** par établissement, ou **40 $/an** | Tous, surtout les lieux à fort passage | Carte perdue, brisée ou volée remplacée en 5 jours ouvrables, envoi compris (environ 1 $ à 7 $ de coût réel par carte) | Abonnement, bouton « Ma carte est brisée » dans le portail, qui crée une commande |
| **Réponses aux avis** | **39 $/mois** (jusqu'à 30 avis) | Commerces sans le temps de répondre | Tapora rédige les réponses (FR/EN) ; le client les approuve dans son portail, ou donne à Tapora un accès « gestionnaire » à sa fiche Google | File d'attente d'avis à répondre dans le back-office, approbation dans le portail. ⚠️ Prend du temps humain : plafonner le nombre d'avis |
| **Multi-succursales** | **+9 $/mois** par succursale au-delà de la première | Chaînes, groupes hôteliers | Tableau de bord qui regroupe toutes les succursales, comparaison, export commun | Regrouper plusieurs dossiers sous un même compte client |
| **Partenaire / agence** | **49 $/mois**, plus les cartes au prix partenaire (par ex. 22 $) | Agences web et marketing qui revendent | Leur logo sur le portail, leur liste de clients, cartes à prix réduit | Notion de « partenaire » propriétaire de dossiers (le programme de parrainage existant est une base) |
| **Design saisonnier** *(pas mensuel)* | 99 $ par refonte | Clients Entreprise | Nouveau visuel (Noël, été, événement) ; les cartes sont refacturées 30 $ chacune | Rien : c'est une commande Entreprise |

### Modèle de revenus mensuels récurrents
Hypothèses : 60 % Pro seul, 30 % Pro + Garantie, 10 % Réponses aux avis.
- Panier moyen ≈ 0,6 × 19 + 0,3 × 23 + 0,1 × 58 ≈ **24 $/mois**.
- Frais Stripe ≈ 5 %, déjà retirés dans les montants nets.

| Clients abonnés | Revenu par mois | Net par mois | Net par an (divisé à deux) |
|---|---|---|---|
| 10 | 240 $ | ≈ 228 $ | ≈ 2 740 $ (1 370 $ chacun) |
| 25 | 600 $ | ≈ 570 $ | ≈ 6 840 $ (3 420 $ chacun) |
| 50 | 1 200 $ | ≈ 1 140 $ | ≈ 13 680 $ (6 840 $ chacun) |

Le temps humain (réponses aux avis, bilans) se compte à part. **Vérifier le seuil des taxes** (section 4, étape 7) : 50 abonnés plus la vente de cartes peuvent approcher 30 000 $ par année.

---

## 4. Plan d'intégration Stripe

Ordre de grandeur : **6 séances**. Rien ne coûte par mois.

### Étape 0 — Compte Stripe (Arthur, ≈ 1 h)
- Créer le compte au nom de **Tapora S.E.N.C.** : société de personnes, NEQ, adresse, compte bancaire de la société.
- Vérifier l'identité des associés.
- **Activer la double authentification** sur Stripe, pour les deux associés.
- Inviter Julien avec un rôle limité, par exemple « Support » ou « Analyste » ; il n'a pas besoin des clés.
- Clés : créer une **clé restreinte**, limitée aux permissions nécessaires (Checkout, Customers, Subscriptions, Billing Portal, Invoices et Balance transactions en lecture).
  - Elle va **uniquement dans Render**, comme variables d'environnement `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET`.
  - **Jamais dans le clavardage, jamais dans git.** D'abord les clés de test, puis celles de production.

### Étape 1 — Produits et prix (≈ ½ séance)
- Dans le Dashboard (test) :
  - Produit « Tapora Pro » : prix mensuel 19 $ CAD et prix annuel 190 $ CAD.
  - Produit « Garantie Remplacement » : 4 $/mois et 40 $/an.
- Moyens de paiement : cartes, et prélèvement bancaire préautorisé pour le paiement à l'année.
- Les identifiants de prix (`price_…`) se rangent dans la table `parametres` du back-office, **pas dans le code**. Le serveur choisit toujours le prix lui-même : on ne fait jamais confiance au montant envoyé par le navigateur.

### Étape 2 — Base de données et webhook (≈ 1 séance)
- **Migration** :
  - `abonnements` : `id`, `dossier_id`, `stripe_customer_id`, `stripe_subscription_id` (unique), `offre`, `statut` (`active`, `past_due`, `canceled`…), `periode_fin`, `annule_a_la_fin`, `cree_le`, `maj_le`.
  - `evenements_stripe` : `id` = identifiant de l'événement Stripe (clé primaire), `type`, `recu_le`, `traite_le`, `erreur`.
  - Sécurité des tables (RLS) activée, droits retirés à `anon` et `authenticated`, comme pour toutes les tables.
- **Route `/api/stripe/webhook`** :
  - Lire le corps brut (`await req.text()`).
  - `stripe.webhooks.constructEvent(corps, signature, secret)` : refus si la signature est fausse ou trop vieille.
  - **Idempotence** : insérer l'id de l'événement avec `on conflict do nothing`. S'il existe déjà, répondre 200 sans rien refaire.
  - Ajouter `/api/stripe/` aux routes publiques du middleware. Le webhook est public, mais signé.
- **Événements traités** :
  - `checkout.session.completed` : relier le client Stripe au dossier, grâce à `client_reference_id` = id du dossier.
  - `customer.subscription.created`, `customer.subscription.updated` et `customer.subscription.deleted` : statut et fin de période.
  - `invoice.paid` : inscription comptable (étape 4).
  - `invoice.payment_failed` : relance (étape 5).
  - `charge.dispute.created` : alerte immédiate.

### Étape 3 — Le portail client (`/stats/[jeton]`) (≈ 1 séance)
- **Bouton « Passer à Pro »** : une action serveur revérifie le jeton (`dossierDuJeton`), donc personne ne peut s'abonner au nom d'un autre. Elle crée ensuite une **Checkout Session** :
  - `mode: 'subscription'`, `client_reference_id` = id du dossier ;
  - `customer_email` prérempli, `locale: 'fr-CA'` (ou `'en'`) ;
  - retour vers le portail.
- **Bouton « Gérer mon abonnement »** : une session du **portail client Stripe** (carte, factures, annulation). Inclus sans frais, en français canadien, et non intégrable en iframe : c'est une redirection.
- Le formulaire de carte est **hébergé par Stripe** : aucune donnée de carte ne touche nos serveurs, la conformité PCI reste au niveau le plus simple (SAQ A). La politique de sécurité du site n'a pas à changer.

### Étape 4 — Comptabilité automatique (≈ 1 séance)
- **`invoice.paid`** :
  - Créer dans le back-office un **reçu payé** (« Tapora Pro — octobre 2026 ») avec le client du dossier.
  - Régime de taxe : celui de la société (`hors_champ` + « Petit fournisseur » tant que la société n'est pas inscrite).
  - Le revenu tombe tout seul dans « Vos profits » et le partage 50/50.
- **Frais Stripe** :
  - Lire la `balance_transaction` du paiement, puis inscrire les frais comme dépense (catégorie frais bancaires), liée au reçu.
  - **Rapprochement** : le total des versements Stripe vers la banque = revenus − frais. Vérification mensuelle automatique dans le compte rendu.
- Paiements de Julien en personne (Tap to Pay) : même webhook (`charge.succeeded` sans abonnement). Le reçu de la Carte Québec se crée tout seul et sort la carte du stock.

### Étape 5 — Échecs de paiement et annulation (≈ ½ séance)
- Dans le Dashboard Stripe, activer les **relances automatiques** (Smart Retries) et les **courriels d'échec de paiement** : gratuit.
- Côté back-office, `invoice.payment_failed` produit une ligne dans le compte rendu des messages et un courriel à Tapora.
- Après 14 jours de retard, les options Pro s'éteignent. **Jamais les fonctions de base.**
- Annulation possible en tout temps (portail Stripe), effective à la fin de la période payée. Aucun engagement.

### Étape 6 — Tests puis production (≈ 1 séance)
- `stripe listen --forward-to localhost:3100/api/stripe/webhook`, puis `stripe trigger checkout.session.completed`, `invoice.paid` et `invoice.payment_failed`.
- Tests navigateur : abonnement, portail, annulation, double livraison d'un même événement (idempotence), signature falsifiée (refus).
- En production : passer aux clés live dans Render, créer le webhook de production dans le Dashboard, faire un premier paiement réel à 1 $ puis le rembourser.

### Étape 7 — Taxes
- **Seuil** : tant que les fournitures taxables ne dépassent pas **30 000 $** dans un trimestre civil ou sur les 4 trimestres civils précédents, la société est **petit fournisseur** : aucune inscription obligatoire, aucune TPS/TVQ à percevoir ([Revenu Québec — petit fournisseur](https://www.revenuquebec.ca/fr/entreprises/taxes/tpstvh-et-tvq/inscription-aux-fichiers-de-la-tps-et-de-la-tvq/petit-fournisseur/)). Le total compte les fournitures des associés.
- **Une fois dépassé** : s'inscrire (TPS et TVQ), entrer les numéros dans le back-office (le régime suit tout seul), créer dans Stripe deux **taux de taxe manuels** (TPS 5 %, TVQ 9,975 %). C'est gratuit : **pas besoin de Stripe Tax** (0,5 % par transaction ou 120 $/mois) pour une clientèle presque toute au Québec.
- À ajouter au back-office : une **alerte automatique à 25 000 $** sur 4 trimestres glissants.

### Liste de sécurité
- [ ] Clé restreinte, clés test et live séparées, uniquement dans Render.
- [ ] Signature du webhook vérifiée, tolérance par défaut (5 min), corps brut.
- [ ] Idempotence par id d'événement ; traitement en transaction.
- [ ] Prix choisis par le serveur ; dossier identifié par le jeton signé, jamais par un champ du formulaire.
- [ ] Aucune donnée de carte chez nous (Checkout et portail hébergés par Stripe).
- [ ] Double authentification sur Stripe pour les deux associés ; Julien sans accès aux clés.
- [ ] Alerte sur les litiges (`charge.dispute.created`) et sur les échecs de paiement.
- [ ] Journaux : seulement les identifiants Stripe, jamais les adresses complètes ni les cartes.

---

## 5. Prochaines étapes pour Arthur

1. [ ] Décider des prix (Pro à 19 $/mois ? Garantie à 4 $ ?) et faire valider le texte des Conditions par un juriste ou le comptable (clientèle d'affaires : la Loi sur la protection du consommateur ne s'applique en principe pas, ⚠️ à confirmer).
2. [ ] Créer le compte Stripe de Tapora S.E.N.C. (NEQ, identité des deux associés, compte bancaire de la société).
3. [ ] Activer la double authentification sur Stripe ; inviter Julien avec un rôle limité.
4. [ ] Créer la clé restreinte de **test** et la mettre dans Render (jamais dans le clavardage).
5. [ ] Julien installe l'app **Stripe Dashboard** sur son iPhone (XS ou plus récent, code de verrouillage, iCloud) et fait un essai Tap to Pay à 1 $ en mode test.
6. [ ] Me demander les étapes 2 à 6 : la construction, puis les tests.
7. [ ] Après un mois de test réel, passer en production et annoncer « Tapora Pro » aux clients Entreprise, d'abord par message dans leur portail.

**Points incertains, à revérifier** :
- Interac en ligne chez Stripe (annonce de février 2026, disponibilité réelle à confirmer dans le Dashboard).
- Délai de versement de Square au Canada.
- Tap to Pay sur Android chez Square au Canada.
- Cumul exact des frais Interac et Tap to Pay chez Stripe.
