# Plan Tapora Entreprise

> Le document de référence de l'offre Entreprise : ce qui est promis, ce qui
> existe, ce qui reste à construire, dans quel ordre, et comment tout mettre
> à jour. À relire avant chaque nouvelle étape. Mis à jour le 26 octobre 2026.

---

## 1. L'idée

Tapora ne vend pas seulement des cartes d'avis : Tapora vend des **points de
connexion entre un lieu physique et ses services numériques**. Une carte par
chambre, par table, par comptoir : chacune ouvre ce dont le client a besoin à
cet endroit-là (menu, demande, réservation, avis, formulaire…), à l'image de
l'entreprise, et chacune est mesurée.

- **Les cartes à l'unité** (35 $, sans minimum, design standard) restent la
  porte d'entrée : les avis Google.
- **Tapora Entreprise** (30 $ la carte, **25 cartes au minimum par design**,
  design sur mesure) : une destination par emplacement, puis des pages et des
  modules logiciels. Pour tout le reste, on le construit pour le client : le
  prix dépend de ce qu'il demande.

## 2. Règles fixes (ne jamais les oublier)

| Règle | Détail |
|---|---|
| Minimum 25 cartes | **Par design.** 100 cartes = jusqu'à 4 designs (4 × 25). La destination, elle, se choisit carte par carte, sans minimum : 100 chambres + 25 cartes d'espaces communs = 2 designs, chaque carte avec sa destination. Le formulaire (`app/api/demande-entreprise`) et la base vérifient aujourd'hui 25 **par commande** : à faire passer à 25 par design (phase 1, zones). |
| Prix des cartes | 30 $ la carte en Entreprise ; 35 $ à l'unité, sans minimum. |
| Statistiques | **Toujours incluses gratuitement** : pour toutes les commandes Entreprise et pour **toutes** les cartes à l'unité. |
| Le reste | Tout ce qui n'est pas dans l'offre, on le construit pour le client ; **le prix dépend de ce qu'il demande** (sur soumission). |
| Rien de promis qui n'existe pas | Sur le site, chaque fonction porte « Disponible » ou « Bientôt ». On ne vend pas une fonction « Bientôt » (Loi sur la protection du consommateur : pas de représentation fausse). |
| Avis | Le lien Google est offert à **tous**, quelle que soit la note. Jamais de filtrage des avis (interdit par Google). Un commentaire privé peut être proposé **en plus**, à tout le monde. |
| Langue | Français d'abord au Québec (Charte), anglais en miroir sur `/en/`. Typographie française : espace insécable avant : ; ! ? et dans « ». |
| Site | Pas de photos des cartes, pas d'images d'autres entreprises, jamais « Carte Québec », le sceau soleil reste. |
| Coûts | Tout doit rester gratuit à faire rouler : pas de SMS (payants), courriels par la messagerie déjà configurée (environ 100 par jour), paiements par le compte Stripe **du commerce** (frais par transaction payés par lui, aucun frais fixe pour Tapora, aucun numéro de carte chez Tapora). |
| Statistiques | Une visite = un passage par la redirection : heure, canal (NFC ou QR), type d'appareil. Jamais l'adresse IP. On ne prétend pas mesurer chaque lecture NFC. |

## 3. Ce qui existe déjà (phase 0)

### Cartes (back-office, partagé)
- Code permanent écrit sur la puce, **destination modifiable sans changer la
  carte** (`cartes_nfc.destination`, toute adresse https).
- Nom de chaque carte (« Chambre 101 »), **groupes** (« Chambres », « Bar »).
- Statistiques par carte et par groupe, page protégée par mot de passe, export
  Excel, rapport mensuel, mode comptoir.
- Commandes Entreprise : catalogue, maquette à approuver, visuels, suivi de
  commande en sept étapes, espace client (`/portail`).

### Modules logiciels (Tapora Services, section du propriétaire)
- Restaurants : menu vivant en 10 langues, allergènes, menu du jour,
  boissons, appeler le serveur et l'addition, commande à table, promotions et
  événements.
- Hôtels : service aux chambres, demandes en un tap (ménage, serviettes,
  départ tardif, signaler un problème), concierge (guide de la chambre,
  horaires piscine et gym, attractions, transport), page Wi-Fi.
- Pour tous : avis juste après une demande (lien Google à tous + commentaire
  privé), portail du personnel en direct, mode gérant (l'établissement
  modifie son menu, ses prix, ses annonces), statistiques, rapport mensuel,
  chevalets de table, facturation dans les livres de la société.

## 4. Feuille de route

Chaque phase : ce qu'on construit, où, ce que ça coûte, et quand c'est fini.
Quand une phase est livrée : passer ses fonctions à « Disponible » sur le
site (section 5) et cocher ici.

### Phase 1 — la page multi-actions, pour tous les secteurs  ☐
| Fonction | Construction | Coût |
|---|---|---|
| **Page multi-actions** : une carte ouvre une mini-page aux couleurs de l'entreprise, avec plusieurs boutons (liens et modules) | Généraliser l'accueil de Services (`app/s/[code]`) à tout type d'établissement (nouveau type « commerce ») ; éditeur de boutons dans le back-office | Gratuit |
| **Zones et designs dans une commande** (Chambres 100, Espaces communs 25…) | Commandes Entreprise : une zone = un groupe, avec sa destination par défaut ; chaque design ≥ 25 cartes, vérifié par le formulaire et la base | Gratuit |
| **Destinations en lot et programmées** (campagnes : menu des fêtes du 1er au 31 déc., retour automatique) | Table `campagnes_destination`, appliquée par le réveil (`/api/eveil`) | Gratuit |
| **Formulaires et sondages** sur mesure (satisfaction, plainte, suggestion, intérêt immobilier, questionnaire de clinique) | Module formulaires : champs, réponses dans le back-office et le portail, export CSV | Gratuit |
| **Pages simples** : contact, WhatsApp, FAQ, témoignages, réseaux sociaux, catalogue ou brochure PDF | Blocs de la page multi-actions | Gratuit |
| **Infolettre** : collecte de courriels avec consentement, export vers l'outil du client | Bloc + table des inscrits | Gratuit |

Fini quand : un salon, une clinique ou un concessionnaire peut avoir sa page
multi-actions sans code ; test de bout en bout + test d'attaque.

### Phase 2 — réservations et attente  ☐
| Fonction | Construction | Coût |
|---|---|---|
| **Réservations et rendez-vous** (table, spa, salon, clinique, essai routier, visite) | Calendrier, places par créneau, confirmation et rappel par courriel, annulation par lien | Gratuit (≈ 100 courriels/jour) |
| **Liste d'attente** | Le client garde la page ouverte ou reçoit une notification sur son téléphone (pas de SMS) | Gratuit |
| **Enregistrement en ligne et départ** (hôtels) | Formulaires avant l'arrivée ; départ et départ tardif reprennent les demandes existantes | Gratuit |

### Phase 3 — les comptes des entreprises  ☐
- Plusieurs succursales dans un seul compte.
- Rôles et permissions : propriétaire, gérant de succursale, employé.
- Libre-service : le client change lui-même ses destinations et ses pages
  (avec historique).

### Phase 4 — l'argent  ☐
- Paiement à table, pourboires, commandes à emporter payées, cartes-cadeaux :
  **Stripe Connect** (compte Stripe du commerce ; Stripe Checkout, aucun
  numéro de carte chez Tapora).
- (Le programme de fidélité et le surclassement sont retirés de l'offre, à
  la demande d'Arthur, 26 oct.)

### Phase 5 — intégrations  ☐
- D'abord : webhooks (envoi automatique de chaque demande, commande ou
  réservation vers un autre logiciel) et export CSV.
- Ensuite, sur soumission : connecteurs vers le système de l'hôtel (PMS) ou
  la caisse, un fournisseur à la fois.

## 5. Le site web

### Où est la page
- Français : **https://taporacards.com/entreprise** — fichier `site/src/entreprise.html`
- Anglais : **https://taporacards.com/en/business** — fichier `site/src/en/business.html`

Publiée et indexée (Google, Bing : elle est dans `site/public/sitemap.xml`,
annoncée par IndexNow à chaque publication), mais **aucun lien ni bouton**
du site n'y mène : on y arrive par l'adresse exacte ou par une recherche.

### Le générateur
Les deux pages viennent d'une seule source : `site/outils/gen-entreprise.py`
(textes, fonctions, états, en français et en anglais). Pour un changement de
contenu : modifier ce fichier, puis `python3 site/outils/gen-entreprise.py`.
Attention : il réécrit les deux pages en entier — une retouche faite à la main
dans le HTML est perdue. Choisir une méthode : soit le générateur, soit les
fichiers HTML.

### Passer une fonction de « Bientôt » à « Disponible »
Dans les deux fichiers, chaque fonction porte un attribut
`data-etat="bientot"` ou `data-etat="disponible"`. Changer l'attribut suffit :
le badge, la couleur et les filtres suivent. Faire le même changement dans la
version anglaise, puis publier (commandes ci-dessous).

### Ajouter un lien vers la page (le jour venu)
1. Ajouter un lien dans le menu et le pied de page de `site/src/index.html`
   (`/entreprise`) et `site/src/en/index.html` (`/en/business`).
2. Publier.

### Publier ou mettre à jour le site
```bash
cd ~/Documents/tapora/site
npm run build          # construit dist/ (vérifier qu'il n'y a pas d'erreur)
npm run apercu         # optionnel : aperçu sur http://localhost:4321/entreprise
npm run deployer       # met en ligne sur Cloudflare Pages + prévient Bing (IndexNow)
```
`npm run deployer` publie **tout** ce qui est dans `site/src/`. Ce qui ne doit
pas être en ligne va dans `site/brouillons/` (jamais lu par la publication).

### Sécurité (section `#securite` de la page)
Seulement ce qui existe aujourd'hui, vérifié dans le code : pages privées par
mot de passe (scrypt), liens signés et renouvelables, freins aux essais et
alerte, mot de passe du gérant (12 h), statistiques sans IP ni identifiant,
effacement automatique (pages de services : 30 j / 13 mois / 25 mois),
hébergement au Canada et HTTPS, pages privées non indexées, plafonds de
demandes, prix recalculés par le serveur, double authentification de
l'équipe Tapora. N'y ajouter une ligne que le jour où elle est vraie.

### Brouillons
- `site/brouillons/services.html` (+ `en/`) : la page de vente de Tapora
  Services (21 oct.), avec des prix en brouillon. Non publiée.

## 6. Décisions en attente (Arthur)

- [ ] **Prix des modules logiciels** : inclus de base (page multi-actions,
      statistiques, changements de destination) et modules en abonnement
      mensuel ? Montants ? Le site dit « sur soumission » d'ici là.
- [ ] **Designs par commande** : combien inclus (proposition : 3), au-delà
      sur soumission ? Le site dit « on en discute avec la maquette ».
- [ ] **Nom** : « Tapora Entreprise » (fr) / « Tapora Business » (en).
- [ ] **Quand ajouter un lien vers la page** depuis l'accueil.
- [ ] **Tapora Services** : reste dans Tapora pour l'instant ; Arthur dira
      quand le sortir dans une entreprise séparée (dépôt, base, hébergement,
      domaine et nom à part, entente écrite, avocat).

## 7. Commandes utiles

```bash
# Back-office en local
cd ~/Documents/tapora
npm run db:migrer                     # applique les migrations (aussi fait au démarrage chez Render)
npx tsc --noEmit                      # vérification des types
npx next build && npx next start -p 3100

# Mise en ligne du back-office : un push sur la branche suffit (Render la suit)
git push origin claude/tapora-expenses-profits-lsclxr
# Si Render ne bouge pas : dashboard.render.com → tapora-backoffice → Events,
# ou « Manual Deploy → Deploy latest commit ».
```

- Base de données de production : projet Supabase `dovzrntybmjmjxjybxuq`
  (jamais l'autre projet du compte).
- Chaque migration doit protéger ses `revoke … from anon, authenticated` par
  un test sur `pg_roles` (la base locale n'a pas ces rôles).

## 8. Journal

- **21 oct. 2026** — Tapora Services livré (menus, appels, commandes, concierge,
  portail, mode gérant, facturation, rapport mensuel, chevalets) et en ligne.
- **21 oct. 2026** — Convention : retour au texte d'origine (articles sur le
  logiciel retirés à la demande d'Arthur).
- **26 oct. 2026** — Page Entreprise : 25 cartes minimum **par design**
  (calculette avec le nombre de designs), statistiques toujours incluses
  (Entreprise et toutes les cartes à l'unité),
  « on le construit pour vous, prix selon la demande », section Sécurité ;
  surclassement et programme de fidélité retirés.
- **26 oct. 2026** — Plan Entreprise écrit ; page `/entreprise` et
  `/en/business` publiées et indexées, sans lien depuis le site ; page de
  vente Services rangée dans `site/brouillons/`.
