#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé. Installe-le depuis https://nodejs.org/"
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Un fichier .env a été créé. Remplis-le puis relance ce script."
  ${EDITOR:-nano} .env
fi

if [ ! -d node_modules ]; then
  npm install
fi

( sleep 2; (open http://localhost:3001/campagne.html 2>/dev/null || xdg-open http://localhost:3001/campagne.html 2>/dev/null || true) ) &
npm start
