# Mettre Tapora en ligne

Trois pièces, à monter dans cet ordre :

1. **Supabase** — la base de données et les reçus.
2. **L'hébergeur de l'application** — Render ou Vercel.
3. **Resend** — l'envoi des documents par courriel (facultatif, à faire plus tard).

Comptez 45 minutes, dont l'essentiel en attente de propagation DNS si vous
branchez un domaine.

---

## Avant de commencer : les secrets

Trois valeurs, dans ce projet, donnent un accès complet :

| Valeur | Ce qu'elle ouvre |
|---|---|
| `DATABASE_URL` | Toute la base de données, en lecture et en écriture |
| `SUPABASE_SERVICE_ROLE_KEY` | Tout Supabase, en contournant la sécurité |
| `SESSION_SECRET` | La capacité de forger une session valide |

**Ne les collez nulle part ailleurs que dans le tableau de bord de
l'hébergeur.** Pas dans une conversation, pas dans un courriel, pas dans le
dépôt. Si l'une d'elles a circulé, changez-la : le mot de passe de la base se
réinitialise dans Supabase, `SESSION_SECRET` se régénère dans l'hébergeur (tout
le monde est alors déconnecté, rien d'autre).

---

## 1. Supabase — la base de données

1. Créer un compte sur **supabase.com**, puis **New project**.
2. Renseigner :
   - **Name** : `tapora`
   - **Database Password** : générer un mot de passe fort et le garder dans
     votre gestionnaire de mots de passe — il fait partie de `DATABASE_URL`.
   - **Region** : la plus proche du Québec (Est du Canada, sinon Est des
     États-Unis).
   - **Plan** : Free.
3. Attendre deux ou trois minutes que le projet se monte.
4. Aller dans **Project Settings → Database → Connection string**, onglet
   **Transaction pooler** (ou « Connection pooling », port `6543`). Copier la
   chaîne et y remplacer `[YOUR-PASSWORD]` par le mot de passe de l'étape 2.
   C'est votre `DATABASE_URL`.
5. Copier aussi, dans **Project Settings → API** :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

### Appliquer le schéma

**Chez Render, il n'y a rien à faire** : les migrations s'appliquent au
démarrage du service. Cette section ne sert que pour appliquer le schéma à la
main — une base montée avant le premier déploiement, ou un hébergeur qui ne
lance pas `npm run db:migrer`.

Depuis votre machine, dans le dossier du projet :

```bash
npm install
DATABASE_URL="<votre chaîne Supabase>" npm run db:migrer
```

Les 17 migrations s'appliquent une à une et s'affichent au fur et à mesure. La
commande est rejouable : la relancer ne rejoue rien.

> Si la commande échoue avec une erreur de transaction, reprenez la chaîne de
> l'onglet **Session pooler** (port `5432`) pour cette commande seulement, puis
> gardez celle du Transaction pooler pour l'application.

**Ne chargez pas le jeu d'essai** (`npm run db:demo`) sur la base de
production : ces données sont fausses. Il refuse d'ailleurs de s'exécuter sur
une base qui contient déjà des écritures.

---

## 2. L'hébergeur de l'application

Supabase héberge la base, pas l'application. Il faut donc un endroit où faire
tourner le serveur Next.js.

### Option A — Render (gratuit, usage commercial permis)

> **N'acceptez pas la base de données que Render propose au passage.** Son
> PostgreSQL gratuit **expire 30 jours après sa création**, puis il est
> supprimé après un délai de grâce. Une comptabilité qui s'efface au bout d'un
> mois n'est pas une comptabilité. La base reste chez Supabase, qui ne met en
> pause qu'après une semaine d'inactivité — sans rien perdre.

1. Créer un compte sur **render.com**, connecter le dépôt GitHub.
2. Ouvrir ce lien, qui va droit au bon écran avec le dépôt et la branche déjà
   remplis :

   <https://dashboard.render.com/blueprint/new?repo=https://github.com/coolminer11/f/tree/claude/tapora-expenses-profits-lsclxr>

   Render lit `render.yaml` et propose le service `tapora-backoffice`.
3. Render demande les valeurs marquées « sync: false ». Coller :
   - `DATABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` : pour les
     photos de reçus. Vous pouvez les laisser vides au début — les reçus sont
     alors écrits sur le disque du serveur, qui est effacé à chaque
     redéploiement. Le reste de la comptabilité n'en dépend pas.
   - `RESEND_API_KEY` et `COURRIEL_EXPEDITEUR` : laisser vides pour l'instant.

   `SESSION_SECRET` est tiré au hasard par Render, ne le touchez pas.
4. **Apply**. Le premier déploiement prend cinq à dix minutes.

**Ce qu'il faut savoir sur le forfait gratuit :** le service s'endort après
quinze minutes sans visite, et la première visite suivante attend environ une
minute que le serveur se réveille. Pour un outil interne consulté quelques fois
par jour, c'est vivable mais agaçant. Le forfait payant le plus bas supprime
l'endormissement.

Tant qu'un onglet reste ouvert, le rafraîchissement automatique interroge le
serveur toutes les douze secondes : il ne s'endort donc pas pendant que vous
travaillez. Ne laissez pas pour autant un onglet ouvert jour et nuit — le
forfait gratuit compte 750 heures de service par mois, et un service éveillé
en permanence les consomme toutes.

### Option B — Vercel (le plus simple, mais lisez ceci)

Vercel est fait pour Next.js : import du dépôt, trois variables, c'est en
ligne, et il n'y a pas d'endormissement.

**Mais le forfait Hobby de Vercel est réservé à un usage personnel et non
commercial.** Un back-office de société qui vend des cartes est un usage
commercial : il demande le forfait Pro. Beaucoup de très petites entreprises
restent sur Hobby ; c'est votre décision, prenez-la en connaissance de cause
plutôt que par ignorance.

Si vous y allez : **Add New → Project**, importer le dépôt, puis coller les
mêmes variables que ci-dessus dans **Settings → Environment Variables**, en
ajoutant `SESSION_SECRET` (32 caractères au hasard — `openssl rand -base64 32`).

---

## 3. Premier démarrage

1. Ouvrir l'adresse donnée par l'hébergeur.
2. L'écran propose de créer le premier compte : c'est le vôtre, avec un accès
   complet.
3. Aller dans **Comptes** et créer celui de votre associé.
4. Aller dans **Marge** et corriger les coûts unitaires de référence — ceux du
   départ sont des valeurs d'exemple.
5. Aller dans la base Supabase (**Table Editor → parametres**) et renseigner
   vos vrais numéros de TPS et de TVQ, votre adresse et votre NEQ : ils
   s'impriment sur les factures.

---

## 4. Le courriel — envoyer depuis le Gmail de la société

Les documents partent depuis l'adresse Gmail de la société, avec le PDF en
pièce jointe, et apparaissent dans ses « Messages envoyés ». Le texte du
courriel est dans `parametres.modele_courriel` (Supabase → Table Editor) ;
les repères `{document}`, `{numero}`, `{client}` et `{entreprise}` sont
remplacés à l'envoi.

**Pourquoi pas une connexion Gmail « normale » (SMTP) :** le forfait gratuit
de Render bloque les ports 25, 465 et 587. Une configuration SMTP marcherait
sur votre Mac et échouerait en silence une fois en ligne. L'API Gmail passe
par HTTPS, comme une page web : elle n'est pas bloquée.

À faire une fois, connecté au compte Gmail de la société :

1. **console.cloud.google.com** → en haut, sélecteur de projet → **Nouveau
   projet** → nom `Tapora` → **Créer**.
2. Menu → **API et services → Bibliothèque** → chercher **Gmail API** →
   **Activer**.
3. Menu → **Google Auth Platform** (anciennement « Écran de consentement
   OAuth ») → **Commencer** :
   - Nom de l'application : `Tapora back-office`
   - Adresse d'assistance : l'adresse Gmail de la société
   - Audience : **Externe**
   - Coordonnées : la même adresse → accepter → **Créer**
4. **Audience → Publier l'application → Confirmer.**
   **N'oubliez pas cette étape.** Une application restée « En test » voit son
   autorisation révoquée par Google au bout de **sept jours**, et les envois
   s'arrêtent sans prévenir.
5. **Clients → Créer un client** → type **Application de bureau** → nom
   `Tapora` → **Créer**. Gardez l'**ID client** et le **code secret** affichés.
6. Sur votre Mac :

   ```bash
   cd ~/Documents/tapora && git pull && npm install
   npm run gmail:autoriser -- <ID_CLIENT> <CODE_SECRET>
   ```

   Le navigateur s'ouvre. Choisissez le compte Gmail de la société. Google
   affichera « Google n'a pas validé cette application » : c'est normal pour
   une application privée → **Paramètres avancés → Accéder à Tapora back-office
   (non sécurisé)** → cochez **Envoyer des e-mails en votre nom** → **Continuer**.
7. Le Terminal affiche quatre valeurs `GMAIL_…`. Render → votre service →
   **Environment → Add variable**, une par une → **Save, rebuild, and deploy**.
8. Vérifiez sur `/etat` : la ligne **Envoi des documents** passe au vert.
   Puis envoyez-vous un reçu de test.

La seule permission demandée est « envoyer » : l'application ne peut ni lire
la boîte, ni effacer, ni voir les contacts.

> **Changer le mot de passe Gmail révoque l'autorisation.** L'écran du
> document le dira à l'envoi suivant ; refaites l'étape 6 et remplacez
> `GMAIL_REFRESH_TOKEN` chez Render.

**L'envoi automatique.** Sur un nouveau document, la case « Envoyer le PDF à
ce courriel dès l'enregistrement » est cochée d'office pour les reçus, les
factures et les notes de crédit, dès qu'un courriel client est saisi. Un envoi
raté ne défait jamais la vente : le document est enregistré, et l'écran dit
ce qui a échoué.

**Avec votre propre nom de domaine**, Resend reste possible à la place de
Gmail : renseignez `RESEND_API_KEY` et `COURRIEL_EXPEDITEUR`
(`Tapora S.E.N.C. <facturation@votredomaine.ca>`) après avoir vérifié le
domaine chez Resend. Si les deux sont configurés, Resend l'emporte : un
domaine authentifié évite les indésirables mieux qu'une adresse Gmail neuve.

Tant qu'aucun des deux n'est configuré, l'application ne casse pas : les
envois sont **simulés**, écrits sur disque, et l'écran le dit en orange.

---

## 5. Les cartes NFC — avant de programmer la première puce

La puce contient `https://go.taporacards.com/t/K7M2QX`, pas le lien Google du
client : l'application redirige et compte. Cette adresse est **permanente** —
une carte posée chez un client ne se reprogramme pas. Elle doit donc être sur
le domaine de la société, jamais sur celui de l'hébergeur (`…onrender.com`),
pour que l'hébergeur puisse changer un jour sans casser une seule carte.

1. **Render** → le service → **Settings → Custom Domains → Add** →
   `go.taporacards.com`. Render affiche une cible (`tapora-backoffice.onrender.com`).
2. **Cloudflare** → `taporacards.com` → **DNS → Add record** :
   type `CNAME`, nom `go`, cible `tapora-backoffice.onrender.com`,
   **proxy désactivé (nuage gris)** — Render émet lui-même le certificat.
3. Attendre que Render affiche le domaine **Verified** et le certificat émis.
4. **Render → Environment** : `URL_CARTES` = `https://go.taporacards.com`
   → **Save, rebuild, and deploy**.

Tant que `URL_CARTES` manque, l'écran Cartes le dit en orange : ne programmez
aucune puce avant.

### Le réveil du serveur

Le forfait gratuit endort le serveur après quinze minutes sans visite ; le
réveil prend près d'une minute. Pour le back-office, c'est agaçant. Pour une
carte tapée au comptoir, c'est rédhibitoire : le client range son téléphone
avant que la page ne s'ouvre.

Solution gratuite, en place : **le Worker Cloudflare appelle
`https://go.taporacards.com/api/eveil` toutes les 10 minutes** (`[triggers]`
dans `worker/wrangler.toml`, fonction `scheduled`). Rien à configurer
ailleurs ; cron-job.org n'est plus nécessaire (le garder ne fait pas de mal).
Le réveil garde aussi des connexions à la base ouvertes et chaudes : la
première visite d'un client ne paie pas l'ouverture des connexions. Le
serveur reste éveillé en permanence, ce qui consomme environ 744 des 750
heures gratuites du mois — assez pour ce service, à condition de ne pas en
ajouter un deuxième sur le forfait gratuit.

Solution sûre, quand les cartes rapportent : le forfait payant le plus bas de
Render (environ 7 $ US par mois) ne s'endort jamais.

### Vérifier que le serveur tient

1. Créer une carte « Test de charge » (n'importe quelle destination) et noter
   son code.
2. Ouvrir **Cartes → En direct**.
3. Depuis le Mac : `npm run stress -- https://go.taporacards.com CODE 500 50`.
4. Lire le verdict du script et celui de l'écran, puis **supprimer la carte de
   test** (ses taps partent avec elle).

### Ce que Render gratuit encaisse

Mesuré : environ 30 taps par seconde. Au-delà, les taps attendent leur tour
(3 à 4 s en rafale). C'est la raison de la section suivante.

## 6. Les cartes sur Cloudflare Workers — gratuit, sans sommeil

Le dossier `worker/` contient un Worker Cloudflare qui sert les adresses
`/t/CODE` directement, depuis la ville du client. Il ne s'endort jamais,
encaisse des milliers de taps par seconde, et le plan gratuit couvre
100 000 requêtes par jour. Tout le reste de `go.taporacards.com` continue
vers Render.

Il parle à Supabase avec la **clé publique** (« publishable »), qui ne peut
appeler que deux fonctions : lire la destination d'une carte active, compter
un tap. Aucune table, aucune vente, aucun client (migration
`20261018000100_cartes_worker.sql`).

Les replis, pour qu'une carte ne casse jamais :

| Situation | Ce qui se passe |
|---|---|
| Worker déployé sans ses secrets | tout passe à Render, comme avant |
| Supabase ne répond pas | dernière destination connue (cache 30 jours), sinon Render |
| Quota gratuit dépassé | route en « fail open » : Cloudflare envoie à Render |

Une destination modifiée dans l'app s'applique sur les cartes en 15 s au plus.

### Mise en place (une fois, depuis le Mac)

Attendre que Render ait déployé la dernière version : la migration qui crée
les deux fonctions s'applique à son démarrage.

1. **Supabase** → le projet → **Project Settings → API Keys** : copier la
   **Publishable key** (`sb_publishable_…`). L'URL du projet est celle de
   `NEXT_PUBLIC_SUPABASE_URL` chez Render (`https://xxxx.supabase.co`).
2. **Terminal** :
   ```
   cd ~/Documents/tapora && git pull
   cd worker && npm install
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_CLE
   ```
   `wrangler login` ouvre le navigateur : **Allow**. Chaque `secret put`
   demande la valeur : la coller, Entrée. Elle part chez Cloudflare, nulle
   part ailleurs.
3. **Cloudflare** → `taporacards.com` → **SSL/TLS → Overview** → mode
   **Full (strict)**. (En « Flexible », Render et Cloudflare se renverraient
   la page à l'infini.)
4. **Cloudflare → DNS → Records** → la ligne `go` → **Edit** → **Proxy
   status : Proxied** (nuage orange) → **Save**. Sans le nuage orange, le
   Worker n'est jamais appelé.
5. **Cloudflare → Workers & Pages** → `tapora-cartes` → **Settings →
   Domains & Routes** → la route `go.taporacards.com/*` → **Request limit
   failure mode : Fail open**.
6. Vérifier : taper une carte, puis **Cartes → En direct** doit afficher
   « tous servis par Cloudflare ».

`npm run journal` (dans `worker/`) affiche les requêtes en direct, pour
déboguer. Revenir en arrière : remettre le nuage gris — tout repasse par
Render, rien d'autre à toucher.

### Le jour où même ça ne suffit plus

Au-delà de 100 000 requêtes par jour : Workers Paid, 5 $ US par mois pour
10 millions. Rien à changer dans le code.

## 7. Avis Google — saisis à la main, une fois par semaine

Gratuit, sans clé ni carte de crédit. Chaque semaine, l'écran **Cartes**
affiche « Avis Google : N commerces à mettre à jour ». Pour chacun : **Voir
sur Google ↗**, lire le nombre d'avis et la note, les taper, **Enregistrer**
(dix secondes). Le compte à rebours repart pour 7 jours.

Le relevé se fait par dossier (une carte sans dossier a le sien). Tout le
reste en découle : tuiles « avis gagnés », courbe des avis, page du client,
rapport mensuel.

L'intégration automatique (API Places de Google) reste dans le code
(`lib/avis-google.ts`), éteinte : elle ne s'active que si la variable
`GOOGLE_PLACES_CLE` existe — ce qui demande une carte de crédit chez Google.

## 8. Dossiers, lien client et rapport mensuel

- **Cartes → Dossiers** : un dossier par commerce. Ses cartes, ses
  statistiques, la création en lot, la liste à programmer (CSV) et la
  planche de QR pour l'imprimeur (PDF).
- **Lien privé du client** : la page `go.taporacards.com/stats/…` ne montre
  que les statistiques de ce commerce. Le lien est signé avec
  `SESSION_SECRET` : changer ce secret invalide tous les liens clients
  (et toutes les sessions) — à ne faire qu'en cas de fuite.
- **Rapport mensuel** : cocher « Envoyer le rapport mensuel » dans le
  dossier. Il part le 1er du mois à partir de 9 h, par le réveil de
  cron-job.org — qui doit donc rester actif. Jamais deux fois le même mois.
- **Page client, ce qui fait revenir le commerce** :
  - bonjour selon l'heure (« Bon matin », « Bon après-midi », « Bonsoir ») ;
  - liste de lancement à cocher (les 60 premiers jours) et « premiers pas »
    (premier tap, 10 taps, 3 jours de suite…) jusqu'à ce qu'ils soient franchis ;
  - la surprise du jour : un fait vrai tiré de ses chiffres, différent chaque
    jour (plus de 80 avant de se répéter) ;
  - conseils de la semaine tirés de ses chiffres ;
  - « Votre prochaine étoile » : combien d'avis 5 ★ pour la note suivante,
    calcul exact vérifié par `node --experimental-strip-types scripts/verifier-note-google.mjs` ;
  - « Avant / après Tapora » : remplir dans le dossier « Avis le jour de la
    pose » (sinon : le premier relevé) et « Avis par mois avant Tapora » ;
  - la course des cartes (dès 2 cartes), remise à zéro chaque lundi ;
  - partage d'une médaille en image (publication ou story), signée
    taporacards.com ;
  - « Votre année Tapora » : bannière sur la page en décembre et en janvier ;
    aperçu à tout moment par le bouton « Votre année ↗ » du dossier ;
  - mode comptoir : plus de bouton (ni sur la page client, ni dans le
    dossier) ; la page `…/stats/<lien>/comptoir` existe toujours ;
  - date de la pose : si la carte était posée avant d'être ajoutée ici,
    la saisir dans « Modifier le dossier » avec les avis de ce jour-là.
    Les avis gagnés (30 jours, graphiques, rapport) partent de cette date ;
  - « Ding ! » : notification sur le téléphone du commerce à chaque tap (au
    plus une par minute, regroupées). Sur iPhone, il faut d'abord ajouter la
    page à l'écran d'accueil (exigence d'Apple). Les clés se créent toutes
    seules ; rien à configurer sur Render. **Le Worker doit être redéployé
    une fois** pour que les taps passés par Cloudflare déclenchent le Ding :
    `cd worker && npx wrangler deploy`.
- **Le Worker ne voit que les taps** (route `go.taporacards.com/t/*`) : les
  pages client et le mode comptoir vont droit à Render, sans consommer le
  quota gratuit de 100 000 requêtes par jour. Après `npx wrangler deploy`,
  vérifier dans Cloudflare → Workers → tapora-cartes → Routes qu'il ne
  reste que `go.taporacards.com/t/*` (supprimer l'ancienne `/*` si elle y est).
- **Rapports mensuels étalés** : au plus 60 par jour (variable
  `RAPPORTS_PAR_JOUR` sur Render pour changer), de 9 h à 19 h, à partir du
  1er du mois — le forfait gratuit de Resend permet 100 courriels par jour.
- **Page client, ce qu'elle contient** :
  - « Aujourd'hui » en direct (mis à jour toutes les 15 s), série de jours
    d'affilée et record ;
  - paliers d'avis et de taps, fêtés une fois avec des confettis ; l'objectif
    d'avis se fixe dans « Modifier le dossier » (vide = prochain palier) ;
  - français ou anglais : la langue par défaut se choisit dans le dossier,
    et le client bascule avec le bouton FR/EN ;
  - « Ajouter à l'écran d'accueil » : la page s'installe comme une app ;
  - « Commander plus de cartes » : la demande apparaît dans le dossier et
    dans /cartes, et un courriel part à l'adresse de contact de la société
    (Paramètres). Au plus 3 demandes par commerce et par 24 h.

## 9. Le site taporacards.com (Cloudflare Pages)

Le dossier `site/` est un site statique : HTML, Tailwind compilé, GSAP pour
les animations, polices hébergées sur place. Aucun script tiers, aucun
traceur — la politique de sécurité (`site/public/_headers`) n'autorise que
le domaine lui-même. Gratuit, sans limite de visites.

**Mettre en ligne (et à chaque modification)**, depuis le Mac :
```
cd ~/Documents/tapora && git pull
cd site && npm install
npm run deployer
```
La première fois, wrangler demande de créer le projet `taporacards` : Entrée.

**Brancher le domaine (une seule fois)** :
1. Cloudflare → **Workers & Pages** → `taporacards` → **Custom domains** →
   **Set up a custom domain** → `taporacards.com` → Activate.
   Si Cloudflare signale un enregistrement existant pour `taporacards.com`
   (A ou CNAME `@`), supprimez-le d'abord dans DNS — pas les MX ni les TXT
   (ce sont les courriels).
2. Même chose pour `www.taporacards.com`.
3. **Rules → Redirect Rules → Create rule → modèle « Redirect from WWW to
   root »** → Deploy : une seule adresse pour Google.

Aperçu local avant d'envoyer : `npm run apercu` → http://localhost:4321.

Deux langues : le français à `/`, l'anglais à `/en/` (`site/src/en/`). Une
modification de texte se fait dans les deux fichiers ; les balises
`hreflang` et le plan du site disent à Google quelle page montrer à qui.

### Guides, IndexNow et prix

- **Guides** : le contenu est dans `site/guides/contenu_fr.py` et
  `contenu_en.py`. Après une modification : `cd site && python3 guides/generer.py`
  (régénère les pages et le sitemap), puis `npm run deployer`.
- **IndexNow** : `npm run deployer` prévient Bing tout seul après chaque
  déploiement (Bing nourrit aussi ChatGPT et Copilot). La clé publique est
  `site/public/<clé>.txt` ; à relancer à la main : `npm run indexnow`.
- **Conditions** : `/conditions` et `/en/terms`. Les prix sont aussi dans
  les données structurées et dans `llms.txt` : à changer partout si les prix
  changent.

## 10. Croissance : cartes qui dorment, badge, parrainage, étude de cas

- **Cartes qui dorment** (écran Cartes, bloc 😴) : cartes actives sans tap
  depuis 7 jours, ou jamais tapées une semaine après la pose. Téléphone et
  courriel du client à côté. « C'est réglé » retire la carte pour 7 jours.
  Chaque **lundi dès 8 h**, la liste part par courriel à l'adresse de
  contact de la société (Paramètres) — une fois par semaine, rien si tout
  dort bien. C'est le réveil (/api/eveil, cron-job.org) qui sert d'horloge.
- **Badge d'avis** : `go.taporacards.com/b/<clé>.svg`, note + nombre d'avis,
  clair ou sombre, mis à jour à chaque relevé. Le client copie le code depuis
  sa page (bloc « Montrez vos avis à tout le monde ») ; vous aussi, depuis le
  dossier. La clé n'est PAS le lien privé du client. « Désactiver » ou
  « Nouvelle adresse » le fait disparaître des sites (jusqu'à une heure de
  cache Cloudflare). Le Worker sert les badges depuis son cache : il faut
  le **redéployer une fois** (nouvelle route `go.taporacards.com/b/*`).
- **Parrainage** : bloc « Recommandez-nous » sur la page client. Le filleul
  a **10 % sur sa première commande** (à appliquer sur sa facture) ; le
  parrain coche s'il veut paraître sur `taporacards.com/partenaires`.
  Écran Cartes → **Recommandations** : nouveau → contacté → client. Au
  passage à « client », le parrain devient **Ambassadeur** (pastille sur sa
  page et sur la page Partenaires) et un merci LinkedIn est prêt à copier.
  Au plus 5 recommandations par commerce et par 24 h.
- **Page Partenaires** du site : construite au chargement à partir de
  `go.taporacards.com/b/partenaires.json` (cache Cloudflare). Un commerce y
  paraît s'il l'a accepté (case cochée par lui, ou par vous dans « Modifier
  le dossier » avec son accord) et a au moins une carte active.
- **Étude de cas** (fiche du dossier) : image LinkedIn 1080 × 1350, FR ou
  EN, avec les avis gagnés depuis la pose, la note, les taps, et l'avant /
  après si le rythme d'avant est saisi. Il faut les avis du jour de la pose
  et un relevé récent. À publier avec l'accord du commerce.

## 11. Associés : qui fait quoi et convention

- **Qui fait quoi** (Associés → onglet « Qui fait quoi ») : le rôle de chacun,
  ses responsabilités et ses objectifs de la semaine (du lundi au dimanche).
  Chacun entre SES chiffres, depuis son compte ; personne n'écrit ceux de
  l'autre. Les objectifs marqués « auto » sont comptés par l'app pour toute
  l'équipe (nouveaux dossiers, cartes créées, recommandations traitées).
  Les 8 dernières semaines restent consultables ; le score est la part des
  objectifs atteints. Rôles et objectifs se modifient dans « Modifier le
  rôle ».
- **Convention** (onglet « Convention ») : « Commencer avec l'ébauche »
  crée un texte rempli avec vos noms, le NEQ, les parts et les rôles. Les
  chiffres entre crochets sont à discuter. Chaque modification crée une
  nouvelle version et remet les approbations à zéro ; chacun approuve pour
  lui-même. Le PDF signé se joint une fois les deux approbations données
  (bucket privé, comme les reçus). « Imprimer / PDF » sort le document seul.
  Les parts de la comptabilité ne changent pas toutes seules.
- C'est une ébauche, pas un avis juridique : la faire valider par un
  notaire ou un avocat avant de signer.

## 12. Vos profits : le partage dans le temps et les impôts

- **Le partage peut changer** (60/40, puis 50/50 à partir d'une date).
  Chaque revenu et chaque dépense se partage selon le partage en vigueur à
  SA date ; les profits d'avant gardent l'ancien partage. Tout est calculé
  en base (`repartition_profits`), au cent près : par morceau (un mois × une
  période), chacun reçoit sa part tronquée au cent et les cents restants
  vont aux plus fortes fractions — la somme des parts égale toujours le
  profit, et à 50/50 le cent d'écart ne va pas toujours au même.
- **Changer le partage** : Associés → Vos profits → « Proposer un nouveau
  partage » (date de début, part de chacun). Proposer, c'est approuver pour
  soi ; il s'applique quand l'autre associé approuve, et s'inscrit tout seul
  au registre des décisions (unanime). Une seule proposition à la fois ;
  impossible de commencer dans un exercice clos. Une date passée répartit à
  nouveau les profits depuis cette date (exercices ouverts seulement).
- Les comptes d'associés (« Part de l'exercice en cours ») et la clôture
  d'exercice utilisent le même calcul.
- **Impôts** (même page) : une S.E.N.C. ne paie pas d'impôt sur le revenu ;
  chaque associé déclare sa part (T2125 au fédéral, TP-80 au Québec), même
  s'il ne l'a pas prélevée. Les repas et frais de représentation ne sont
  déductibles qu'à 50 % : l'app l'ajoute au bénéfice imposable. Le bouton
  « Télécharger le résumé pour le comptable » donne un CSV par associé et par
  année. La réserve de 30 % est un repère, pas un calcul d'impôt.

## 13. Stock de cartes : réceptions et coût réel

- **Réception de cartes** (Cartes → Stock, ou Transactions → « Réception de
  cartes ») : le nombre de cartes reçues et le total payé. Les cartes vont
  au STOCK (un actif) : ce n'est pas une dépense tant qu'elles ne sont pas
  vendues. Chaque reçu ou facture en sort une à son coût moyen ; la vente
  montre son vrai profit. Société non inscrite aux taxes : le total payé est
  le coût (si elle s'inscrit, un champ « dont TPS + TVQ » apparaît).
- **Coût moyen pondéré perpétuel** : il se refait à chaque réception sur les
  cartes encore en stock. Ce qui a été payé = cartes vendues + stock, au
  cent près. Une réception datée dans le passé recalcule les ventes qui
  suivent.
- **Automatique** : une dépense qui ressemble à un achat de cartes
  (« carte », « Alibaba », « NFC »…) est proposée en conversion ; la part
  « cartes » va au stock, le reste reste une dépense. « Corriger » change le
  nombre de cartes ou sépare des frais (ex. immatriculation) sans rien
  perdre du total payé. Annuler un reçu remet sa carte en stock et retire son
  coût (avant : seul le revenu disparaissait). Sous le seuil (10 par défaut),
  alerte dans Cartes et dans le courriel du lundi.
- L'écran Marge prend le coût réel de la carte dès qu'une réception existe.
  Le résumé fiscal (Vos profits) donne le stock au début, les achats, le
  stock à la fin et le coût des cartes vendues (section « coût des produits
  vendus » du T2125).
- Correction faite le 20 octobre 2026 en production (migration
  `20261020000300`) : la dépense du 29 septembre (357,95 $) est devenue la
  réception de 50 cartes ; le reçu test R-2026-00009 est annulé.

## 14. Catalogue, commandes Entreprise, mot de passe et statistiques détaillées

- **Trois cartes** (Commandes → Catalogue) : **Carte Québec** (35 $, à
  l'unité, français mis en valeur puis anglais, sans personnalisation),
  **Entreprise — Québec** (30 $ la carte, 25 au minimum, personnalisée,
  français d'abord) et **Entreprise — International** (30 $, 25 au minimum,
  anglais d'abord, jamais posée au Québec). Prix, minimum et seuil d'alerte
  se changent dans le catalogue. La migration `20261020000400` renomme la
  carte existante en Carte Québec à 35 $ (son stock et son coût restent) et
  ajoute les deux cartes Entreprise.
- **Loi 96 / Charte de la langue française** : au Québec, le français doit
  être nettement prédominant. Une commande « International » posée au
  Québec est refusée à l'écran ET par la base ; idem sous le minimum.
- **Commande Entreprise** (Commandes → + Nouvelle commande) : sept étapes,
  un bouton chacune. Demande → devis prérempli ; maquette (fichier joint) ;
  approuvée ; commandée au fournisseur ; **reçue** (le total payé : les
  cartes entrent au stock de leur modèle, à leur coût réel) ; **posée** (les
  cartes NFC sont créées dans le dossier du client, une par nom de la liste,
  le dossier est créé au besoin) ; **facturée** (le devis devient la
  facture, les cartes sortent du stock à leur coût : la marge est exacte).
- **Mot de passe de la page client** (dossier → Lien privé du client) :
  facultatif, pour un hôtel qui fait circuler le lien. Stocké en empreinte
  scrypt, jamais réaffiché. Le client l'entre une fois par appareil
  (30 jours) ; le changer ferme la page partout ; 8 essais ratés en
  15 minutes bloquent l'adresse IP. Un associé connecté voit la page sans
  le mot de passe (« Vue du client »). Rien d'autre à configurer.
- **Statistiques détaillées** (page client, dès deux cartes) : classement
  complet carte par carte avec l'évolution, cartes muettes depuis 14 jours
  signalées, totaux par **groupe** (dossier → Groupes de cartes : « Chambres »,
  « Bar »…), et export CSV (une ligne par carte et par jour ; point-virgule
  en français, virgule en anglais).

## 15. Portail des entreprises, Messages et double authentification obligatoire

- **Double authentification obligatoire** pour tous les comptes : un compte
  qui ne l'a pas activée n'ouvre QUE la page Sécurité (aucun menu, API en
  401) jusqu'à ce qu'il scanne le code QR. On ne la désactive plus : « Changer
  de téléphone » (mot de passe + code) mène directement au nouveau code QR.
- **Portail du client** = sa page privée (`/stats/…`, avec son mot de passe
  s'il en a un) :
  - « Où en sont vos cartes » : ses commandes, étape par étape ;
  - la maquette à voir et à **approuver en un clic** (la commande passe
    d'elle-même à « Approuvée », vous recevez un courriel) ou « Demander un
    changement » ;
  - « Écrivez-nous » : son message arrive dans **Messages** (pastille dans le
    menu) et par courriel ; votre réponse s'affiche sur sa page et part par
    courriel. 10 messages par jour et par client au plus.
- **Espace client** : `go.taporacards.com/portail` (lien « Espace client »
  du site). Le client entre son courriel ; s'il est celui d'un dossier, son
  lien lui est envoyé. Même réponse pour une adresse inconnue.
- **Messages** (back-office) : le compte rendu de tout ce qui attend —
  demandes Entreprise du site, messages des portails, cartes demandées,
  maquettes pas encore approuvées, commandes immobiles depuis 7 jours. Le
  courriel du lundi en fait le résumé.
- **Formulaire Entreprise du site** → `POST /api/demande-entreprise`
  (seulement depuis taporacards.com ; champ piège, délai minimal, 5 par heure
  et par adresse, 40 par jour). « Créer la commande » ouvre la commande
  préremplie et range la demande.
- Sur une commande : « Ouvrir le portail du client » crée son dossier dès le
  début ; joindre la maquette prévient alors le client tout seul.
- **Durcissement** (migration `20261020000600`) : destinations https
  seulement (le Worker refuse le http), `search_path` fixe sur chaque
  fonction, index manquants. Les liens des courriels viennent toujours de la
  configuration (`URL_APP` ou `URL_CARTES`), jamais de l'en-tête Host. Les
  téléversements n'acceptent que photos, PDF et fichiers de logo ; les
  exports pour le comptable neutralisent les formules.
- **Site** : prix (Carte Québec 35 $, Entreprise 30 $ dès 25), section
  Entreprises et son formulaire, lien Espace client. Mise en ligne :
  `cd site && npm run deployer` APRÈS le déploiement du back-office (sinon
  le formulaire retombe sur le courriel prérempli, sans rien perdre).
- Revenus récurrents et paiements (Stripe) : voir `PLAN-REVENUS.md`.

## 16. Vitesse, mode sombre et animations de la page client

- **Vitesse** : la page client réunit ses chiffres en deux vagues de requêtes
  au lieu de six (vérification du lien et lectures en parallèle, graphiques
  et avis demandés d'avance) ; les connexions à la base restent ouvertes
  15 minutes et le réveil les réchauffe ; la session du back-office n'est lue
  qu'une fois par page. Mesuré avec 100 ms d'aller-retour vers la base :
  670 ms → 270 ms, et un squelette animé s'affiche en moins de 50 ms.
- **Back-office** : une fine barre terre cuite en haut dès le clic sur un
  lien ; la page d'avant reste affichée jusqu'à la suivante.
- **Mode sombre** de la page client, de l'écran du mot de passe et de
  l'espace client : il suit le téléphone, et le bouton soleil/lune le fixe
  (cookie `tapora_mode`, un an). Les pages « Votre année » et comptoir
  gardent leur décor. Toutes les couleurs sont des variables `--cl-…`
  (globals.css) : un composant client n'écrit jamais une couleur en dur.
- **Animations** : boutons et tuiles qui répondent au survol, cadenas qui
  s'ouvre au bon mot de passe (et carte qui secoue au mauvais), bulles de
  messages, confettis à l'approbation d'une maquette, défilement Lenis plus
  doux. « Réduire les animations » sur le téléphone : tout reste immobile.

## 17. Tapora Services (menus vivants, appel du serveur, concierge de chambre)

- **À qui :** le logiciel et Tapora Services appartiennent à Arthur
  (convention d'associés, article 8, à faire approuver par les deux
  associés). La société les utilise tant qu'elle existe avec ses associés
  actuels ; les revenus de Services sont inscrits dans sa comptabilité. Dans
  le back-office, **seul le compte d'Arthur** voit la section « ✦ Services »
  (colonne `utilisateurs.proprietaire_logiciel`, réglée par la migration
  `20261021000100`, jamais depuis l'app) ; pour tout autre compte, les pages
  n'existent pas (404).
- **Pour les clients d'un établissement** (`go.taporacards.com/s/<code>`) :
  chaque table ou chambre a son code (carte NFC ou QR). Menu dans toutes les
  langues de l'établissement (français d'abord), plat du jour, appel du
  serveur ou de l'addition — suivi en direct de la demande, puis la note et
  le lien d'avis Google offert à tous —, concierge de chambre, demandes en
  un tap, Wi-Fi.
- **Pour le personnel** (`go.taporacards.com/service/<lien>`) : la file des
  demandes en direct, « J'arrive » / « Fait », notifications sur les
  tablettes et téléphones, plat du jour et plats épuisés, statistiques.
  Lien signé, mot de passe facultatif, mêmes freins que les pages client.
- **Dans le back-office (Arthur)** : établissements, menus (traductions,
  photos, PDF par langue, import en texte), annonces, concierge, types de
  demandes, emplacements et planche de QR, réglages et apparence, et des
  démonstrations toutes prêtes (restaurant, hôtel) pour les rendez-vous.
- Les fichiers (photos, logos, menus PDF) sont redimensionnés en WebP et
  rangés sous `services/` du même bucket ; seul ce dossier est public.

## Sauvegardes

Le forfait gratuit de Supabase ne garde pas d'historique de sauvegardes long.
Une exportation régulière vaut mieux que rien :

```bash
cd ~/Documents/tapora
DATABASE_URL="<votre chaîne Supabase>" npm run sauvegarde
```

Le fichier atterrit dans `sauvegardes/`, sur votre machine — c'est-à-dire
ailleurs que chez l'hébergeur, ce qui est tout l'intérêt.

> Si `pg_dump` refuse en parlant de version (« server version mismatch »),
> c'est que Supabase tourne sur un PostgreSQL plus récent que le vôtre :
> `brew install postgresql@17` suffit, le script trouve tout seul le plus
> récent des deux.

Plus simple et suffisant au début : l'écran **Export** produit les cinq
fichiers comptables de la période. Faites-le à chaque fin de mois et rangez-les
quelque part.

---

## Ce qui peut coincer

| Symptôme | Cause probable |
|---|---|
| Les écrans sont vides, sans erreur | `DATABASE_URL` pointe sur une base sans migrations. Relancer `npm run db:migrer`. |
| « SESSION_SECRET est requis » | La variable manque chez l'hébergeur. |
| Le téléversement d'un reçu échoue | `SUPABASE_SERVICE_ROLE_KEY` ou `NEXT_PUBLIC_SUPABASE_URL` manquent. |
| Un import CSV de plusieurs milliers de lignes expire | La limite de durée d'une requête chez l'hébergeur. Découpez le relevé, ou signalez-le : l'insertion se fait ligne par ligne et peut être groupée. |
| Le projet Supabase est « paused » | Le forfait gratuit met en pause après une semaine sans activité. Un bouton le relance, sans perte. |

Les forfaits gratuits et leurs conditions changent souvent : vérifiez les
conditions à l'inscription plutôt que de vous fier à cette page.
