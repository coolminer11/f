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

attendre_et_fermer() {
  echo
  echo "  Appuyez sur Entrée pour fermer cette fenêtre."
  read -r
  exit "${1:-1}"
}

# Un script lancé depuis le Finder n'hérite pas toujours du PATH configuré dans
# votre shell : Homebrew et Postgres.app peuvent être installés sans être
# visibles ici. On va les chercher là où ils se trouvent.
for dossier in \
  /opt/homebrew/bin \
  /usr/local/bin \
  /opt/homebrew/opt/postgresql@16/bin \
  /usr/local/opt/postgresql@16/bin \
  /Applications/Postgres.app/Contents/Versions/latest/bin
do
  [ -d "$dossier" ] && case ":$PATH:" in *":$dossier:"*) ;; *) PATH="$dossier:$PATH" ;; esac
done
export PATH

cat <<'ENTETE'

  ┌─────────────────────────────────────┐
  │   Tapora S.E.N.C. — back-office     │
  └─────────────────────────────────────┘

ENTETE

if ! command -v node >/dev/null 2>&1; then
  cat <<'MANQUE'
  Node.js n'est pas installé.

  Ouvrez Terminal et collez cette ligne, puis suivez DEMARRAGE-MAC.md :

    brew install node

  Si « brew » est inconnu, installez d'abord Homebrew :

    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

MANQUE
  attendre_et_fermer
fi

version=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null)
if [ -z "$version" ] || [ "$version" -lt 20 ]; then
  echo "  Node.js ${version:-inconnu} est trop ancien : il faut la version 20 ou plus."
  echo "  Dans Terminal :  brew upgrade node"
  attendre_et_fermer
fi

# Un port déjà pris est la cause d'échec la plus fréquente au deuxième
# lancement : on le dit clairement plutôt que de laisser une erreur obscure.
# On teste avec Node plutôt qu'avec lsof : Node vient d'être vérifié, alors
# que lsof dépend de la machine.
# Le port peut être fixé une fois pour toutes dans .env.local (npm run port).
# Le Finder ne transmet aucune variable d'environnement : sans cette lecture,
# le double-clic retomberait sur 3000 alors que le reste écoute ailleurs.
if [ -z "$PORT" ] && [ -f .env.local ]; then
  PORT=$(sed -n 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*\([0-9]*\).*/\1/p' .env.local | tail -1)
fi
PORT="${PORT:-3000}"
export PORT

port_occupe() {
  node -e '
    const net = require("net")
    const prise = net.connect(Number(process.argv[1]), "127.0.0.1")
    prise.on("connect", () => { prise.destroy(); process.exit(0) })
    prise.on("error", () => process.exit(1))
    setTimeout(() => process.exit(1), 1500)
  ' "$1" 2>/dev/null
}
if port_occupe "$PORT"; then
  echo "  Le port $PORT est déjà utilisé — Tapora tourne probablement déjà"
  echo "  dans une autre fenêtre du Terminal."
  echo
  echo "  Fermez cette autre fenêtre, ou ouvrez simplement :"
  echo "      http://localhost:$PORT"
  attendre_et_fermer 0
fi

if [ ! -d node_modules ]; then
  echo "  Première installation des composants — quelques minutes…"
  if ! npm install --silent; then
    echo "  L'installation a échoué. Vérifiez votre connexion Internet."
    attendre_et_fermer
  fi
  echo
fi

echo "  Préparation de la base de données…"
if ! node scripts/local.mjs; then
  attendre_et_fermer
fi

echo "  Préparation de l'application…"
if ! npm run build --silent >/tmp/tapora-build.log 2>&1; then
  echo "  La préparation a échoué. Détail :"
  echo
  tail -20 /tmp/tapora-build.log
  attendre_et_fermer
fi

# Ouvre le navigateur dès que le serveur répond.
(
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null "http://localhost:$PORT/connexion"; then
      open "http://localhost:$PORT"
      break
    fi
    sleep 1
  done
) &

echo
echo "  Pour tout arrêter : fermez cette fenêtre."
echo
npm run partage
