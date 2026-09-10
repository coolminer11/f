# Démarrer sur un MacBook

## Ce qu'il faut savoir d'abord

**Julien n'a rien à installer.** L'application tourne sur **une seule**
machine — la vôtre. Julien l'ouvre dans Safari, avec l'adresse que le
programme affiche, quand vous êtes sur le même Wi-Fi.

C'est voulu : deux copies séparées donneraient deux comptabilités qui
divergent en silence, et vous ne le verriez qu'au moment de faire les taxes.

## Une seule fois : installer

### 1. Node.js

Aller sur **nodejs.org**, télécharger la version **LTS** pour macOS, ouvrir le
fichier et suivre l'installation.

### 2. PostgreSQL

Aller sur **postgresapp.com**, télécharger, glisser **Postgres.app** dans
Applications, l'ouvrir, cliquer **Initialize**. Un petit éléphant apparaît dans
la barre de menus : c'est votre base de données.

### 3. Le projet

Ouvrir **Terminal** (⌘ + espace, taper « Terminal ») et coller ces trois
lignes, une par une :

```bash
cd ~/Documents
git clone https://github.com/coolminer11/f.git tapora
cd tapora
```

## Ensuite : double-cliquer

Ouvrir le dossier `Documents/tapora` dans le Finder et double-cliquer sur
**`Demarrer-Tapora.command`**.

Le premier lancement prend quelques minutes : il installe les composants,
prépare la base et construit l'application. Les suivants prennent une dizaine
de secondes.

Votre navigateur s'ouvre tout seul. Le premier écran vous propose de créer
votre compte.

> **macOS refuse d'ouvrir le fichier ?** Clic droit dessus → **Ouvrir** →
> **Ouvrir** dans la fenêtre qui apparaît. C'est à faire une seule fois.

## Faire entrer Julien

1. Dans l'application, aller dans **Comptes** et créer le compte de Julien.
2. La fenêtre du Terminal affiche une adresse du genre
   `http://192.168.2.14:3000`. C'est celle-là qu'il lui faut.
3. Julien la tape dans Safari, sur le **même Wi-Fi**, et se connecte avec son
   compte.

Il voit les mêmes chiffres que vous, à la seconde près — il suffit qu'il
recharge la page après une de vos saisies.

## Arrêter

Fermez la fenêtre du Terminal. Julien perd l'accès en même temps : c'est votre
machine qui fait tourner l'application.

## Chaque vendredi

Dans le Terminal, dans le dossier du projet :

```bash
npm run sauvegarde
```

Puis copiez le fichier créé dans `sauvegardes/` **ailleurs** — iCloud, un
disque externe, une clé. Une sauvegarde rangée à côté de l'original ne protège
de rien.

## Quand ça coince

| Ce que vous voyez | Ce qu'il faut faire |
|---|---|
| `Could not read package.json` | Vous n'êtes pas dans le dossier du projet. `cd ~/Documents/tapora` |
| `Aucune base de données trouvée` | Postgres.app n'est pas lancé. Ouvrez-le, vérifiez l'éléphant dans la barre de menus. |
| `Node.js n'est pas installé` | Installez-le depuis nodejs.org, version LTS. |
| Julien ne voit rien | Même Wi-Fi ? L'adresse commence-t-elle par `192.168` ou `10.` ? |
| Julien voit la page mais est déconnecté à chaque écran | Vous n'êtes pas à jour : `git pull`, puis redémarrez. |
