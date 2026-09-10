#!/bin/bash
#
# Double-cliquez ce fichier pour démarrer Tapora.
#
# Il vérifie ce qu'il faut, prépare la base au premier lancement, démarre
# l'application et ouvre votre navigateur. Laissez la fenêtre du Terminal
# ouverte tant que vous vous en servez : c'est elle qui fait tourner
# l'application. Fermez-la pour tout arrêter.
#
cd "$(dirname "$0")" || exit 1
clear

cat <<'ENTETE'

  ┌─────────────────────────────────────┐
  │   Tapora S.E.N.C. — back-office     │
  └─────────────────────────────────────┘

ENTETE

if ! command -v node >/dev/null 2>&1; then
  cat <<'MANQUE'
  Node.js n'est pas installé sur cette machine.

    1. Aller sur nodejs.org
    2. Télécharger la version « LTS » pour macOS
    3. Ouvrir le fichier téléchargé et suivre l'installation
    4. Double-cliquer de nouveau sur Demarrer-Tapora

MANQUE
  echo "  Appuyez sur Entrée pour fermer."
  read -r
  exit 1
fi

version=$(node -p "process.versions.node.split('.')[0]")
if [ "$version" -lt 20 ]; then
  echo "  Node.js $version est trop ancien : il faut la version 20 ou plus."
  echo "  Téléchargez la version « LTS » sur nodejs.org, puis réessayez."
  echo
  echo "  Appuyez sur Entrée pour fermer."
  read -r
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  Première installation des composants — quelques minutes…"
  npm install --silent || { echo "  L'installation a échoué."; read -r; exit 1; }
  echo
fi

echo "  Préparation de la base de données…"
if ! node scripts/local.mjs; then
  echo
  echo "  Appuyez sur Entrée pour fermer."
  read -r
  exit 1
fi

echo "  Préparation de l'application…"
npm run build --silent >/dev/null 2>&1 || { echo "  La préparation a échoué."; read -r; exit 1; }

# Ouvre le navigateur dès que le serveur répond.
(
  for _ in $(seq 1 40); do
    if curl -s -o /dev/null http://localhost:3000/connexion; then
      open http://localhost:3000
      break
    fi
    sleep 1
  done
) &

echo
echo "  Pour tout arrêter : fermez cette fenêtre."
echo
npm run partage
