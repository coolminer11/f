# Démarrer sur un MacBook — les commandes exactes

À faire **une seule fois**, sur un Mac neuf, environ 20 minutes dont 15
d'attente. Ensuite l'application se lance en double-cliquant sur une icône.

**Julien n'a rien à installer.** L'application tourne sur **une seule** machine
— la vôtre. Julien l'ouvre dans Safari, avec l'adresse que le programme
affiche, quand vous êtes sur le même Wi-Fi. C'est voulu : deux copies séparées
donneraient deux comptabilités qui divergent en silence, et vous ne le verriez
qu'au moment de faire les taxes.

---

## Ouvrir le Terminal

`⌘` + `espace`, taper **Terminal**, `entrée`. Une fenêtre noire ou blanche
s'ouvre. C'est là que tout se colle.

Coller = `⌘` + `V`, puis `entrée`. **Une étape à la fois**, en attendant que
chacune se termine avant de passer à la suivante.

---

## Étape 1 — Homebrew

C'est le gestionnaire d'installation de macOS. Il installe aussi, au passage,
les outils de développement d'Apple (dont `git`), ce qui évite trois
téléchargements séparés.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Il va vous demander deux choses :

- **`Press RETURN to continue`** → appuyez sur `entrée` ;
- **`Password:`** → votre mot de passe de session Mac. **Rien ne s'affiche
  pendant que vous tapez**, pas même des points. C'est normal, tapez et faites
  `entrée`.

Puis il travaille 5 à 15 minutes. Laissez la fenêtre tranquille.

## Étape 2 — Rendre Homebrew utilisable

Sans cette ligne, la commande `brew` n'existe pas dans les fenêtres suivantes.
Elle marche aussi bien sur les Mac Apple Silicon (M1 à M4) que sur les anciens
Mac Intel.

```bash
BREW=/usr/local/bin/brew; [ -x /opt/homebrew/bin/brew ] && BREW=/opt/homebrew/bin/brew
eval "$($BREW shellenv)"
grep -q 'brew shellenv' ~/.zprofile 2>/dev/null || echo "eval \"\$($BREW shellenv)\"" >> ~/.zprofile
```

Vérification — la commande doit répondre un numéro de version :

```bash
brew --version
```

## Étape 3 — Node.js et PostgreSQL

Node.js fait tourner l'application, PostgreSQL garde les données.

```bash
brew install node postgresql@16
```

Cinq minutes environ. Puis on démarre la base, et on lui dit de se relancer
toute seule à chaque redémarrage du Mac :

```bash
brew services start postgresql@16
```

Vérification — les deux lignes doivent répondre :

```bash
node --version
"$(brew --prefix postgresql@16)/bin/pg_isready"
```

Attendu : `v22.…` (ou plus haut) puis `accepting connections`.

## Étape 4 — Télécharger l'application

```bash
cd ~/Documents
git clone https://github.com/coolminer11/f.git tapora
cd tapora
```

## Étape 5 — Premier démarrage

```bash
./Demarrer-Tapora.command
```

Trois à cinq minutes : il installe les composants, crée la base, applique les
migrations et construit l'application. Le navigateur s'ouvre tout seul sur
l'écran de création de compte.

**Les fois suivantes, plus besoin du Terminal** : ouvrez le dossier
`Documents/tapora` dans le Finder et double-cliquez sur
**`Demarrer-Tapora.command`**. Une dizaine de secondes.

> **macOS refuse d'ouvrir le fichier depuis le Finder ?** Clic droit dessus →
> **Ouvrir** → **Ouvrir** dans la fenêtre qui apparaît. Une seule fois, pour
> toutes les suivantes.

Pour l'avoir sous la main : glissez `Demarrer-Tapora.command` dans la barre
latérale du Finder, ou faites-en un alias sur le Bureau (clic droit → **Créer
un alias**).

## Changer de port

Par défaut l'application écoute sur le port 3000 — celui que la moitié des
outils de développement veulent aussi. Pour lui en donner un autre, tiré au
hasard et libre :

```bash
cd ~/Documents/tapora && npm run port
```

Il affiche le port retenu, le note dans `.env.local`, et tous les démarrages
suivants l'utilisent — double-clic compris. Pour en imposer un précis :

```bash
npm run port -- 48210
```

Et pour revenir au réglage d'origine : `npm run port -- 3000`.

Le changement vaut aussi pour Julien : l'adresse à lui donner porte le nouveau
port, et c'est celle que la fenêtre affiche au démarrage.

---

## Faire entrer Julien

1. Dans l'application, aller dans **Comptes** et créer le compte de Julien.
2. La fenêtre du Terminal affiche une adresse du genre
   `http://192.168.2.14:3000`, sous « Application accessible sur ce réseau ».
   C'est celle-là qu'il lui faut — recopiez-la telle quelle, port compris.
3. Julien la tape dans Safari, sur le **même Wi-Fi**, et se connecte avec son
   compte.

Il voit les mêmes chiffres que vous — il recharge la page après une de vos
saisies.

## Arrêter

Fermez la fenêtre du Terminal ouverte par le démarrage. Julien perd l'accès en
même temps : c'est votre machine qui fait tourner l'application.

## Chaque vendredi

Dans le Terminal :

```bash
cd ~/Documents/tapora && npm run sauvegarde
```

Puis copiez le fichier créé dans `sauvegardes/` **ailleurs** — iCloud, un
disque externe, une clé. Une sauvegarde rangée à côté de l'original ne protège
de rien.

Pour récupérer une sauvegarde (la base est vidée d'abord, le script vous le
fait confirmer) :

```bash
npm run restaurer -- sauvegardes/tapora-2026-09-12-18-30-00.sql
```

## Mettre à jour

```bash
cd ~/Documents/tapora && git pull
```

Puis relancez `Demarrer-Tapora.command` : il réapplique les migrations
manquantes et reconstruit.

---

## Quand ça coince

| Ce que vous voyez | Ce qu'il faut faire |
|---|---|
| `command not found: brew` | L'étape 2 n'a pas été faite, ou dans une autre fenêtre. Fermez le Terminal, rouvrez-le, refaites l'étape 2. |
| `Could not read package.json` | Vous n'êtes pas dans le dossier du projet : `cd ~/Documents/tapora` |
| `command not found: node` | L'étape 3 a échoué. Relancez `brew install node`. |
| `Aucune base de données trouvée` | PostgreSQL est arrêté : `brew services start postgresql@16` |
| `xcrun: error: invalid active developer path` | Les outils Apple manquent : `xcode-select --install`, puis reprenez. |
| `Le port … est déjà utilisé` | L'application tourne déjà dans une autre fenêtre : fermez-la, ou ouvrez l'adresse affichée. Si un autre programme occupe le port : `npm run port` |
| macOS refuse d'ouvrir `Demarrer-Tapora.command` | Clic droit → **Ouvrir** → **Ouvrir**. |
| Julien ne voit rien | Même Wi-Fi ? L'adresse commence-t-elle par `192.168` ou `10.` ? |
| Julien voit la page mais est déconnecté à chaque écran | Vous n'êtes pas à jour : `git pull`, puis redémarrez. |

## Repartir de zéro

Si l'installation part en vrille, ceci efface la base et le dossier — **et
toute la comptabilité avec** (faites une sauvegarde avant) :

```bash
brew services stop postgresql@16
rm -rf ~/Documents/tapora
```

Puis reprenez à l'étape 3.
