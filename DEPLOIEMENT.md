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

1. Créer un compte sur **render.com**, connecter le dépôt GitHub.
2. **New → Blueprint**, choisir ce dépôt. Render lit `render.yaml` et propose
   le service `tapora-backoffice`.
3. Render demande les valeurs marquées « sync: false ». Coller :
   - `DATABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY` et `COURRIEL_EXPEDITEUR` : laisser vides pour l'instant.

   `SESSION_SECRET` est tiré au hasard par Render, ne le touchez pas.
4. **Apply**. Le premier déploiement prend cinq à dix minutes.

**Ce qu'il faut savoir sur le forfait gratuit :** le service s'endort après
quinze minutes sans visite, et la première visite suivante attend environ une
minute que le serveur se réveille. Pour un outil interne consulté quelques fois
par jour, c'est vivable mais agaçant. Le forfait payant le plus bas supprime
l'endormissement.

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

## 4. Le courriel, plus tard

1. Créer un compte sur **resend.com**.
2. **Domains → Add Domain**, entrer votre domaine, puis ajouter chez votre
   registraire les enregistrements DNS que Resend affiche (DKIM, SPF).
   La vérification prend de quelques minutes à quelques heures.
3. **API Keys → Create**, copier la clé.
4. Dans l'hébergeur, renseigner :
   - `RESEND_API_KEY`
   - `COURRIEL_EXPEDITEUR` = `Tapora S.E.N.C. <facturation@votredomaine.ca>`
5. Redéployer.

Tant que ces deux valeurs sont vides, l'application ne casse pas : les envois
sont **simulés**, écrits sur disque, et l'écran le dit en orange.

---

## Sauvegardes

Le forfait gratuit de Supabase ne garde pas d'historique de sauvegardes long.
Une exportation régulière vaut mieux que rien :

```bash
DATABASE_URL="<votre chaîne>" npx pg-dump-quelconque   # ou pg_dump si installé
```

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
