#!/usr/bin/env bash
# Auf dem Server im App-Verzeichnis ausführen, um auf den neuesten main-Stand
# zu aktualisieren. Vorher einmalig einrichten (siehe README, Abschnitt Deployment).
set -euo pipefail

cd "$(dirname "$0")"

# Bei mehreren Node-Versionen am Server die gewünschte voranstellen, damit
# node/npm/next einheitlich diese Version nutzen (Next.js braucht >= 20.9).
# NODE_BIN_DIR setzen — per Umgebungsvariable oder hier fest eintragen, z.B.:
#   NODE_BIN_DIR="/usr/local/node22/bin"
NODE_BIN_DIR="${NODE_BIN_DIR:-}"
if [[ -n "$NODE_BIN_DIR" ]]; then
  export PATH="$NODE_BIN_DIR:$PATH"
  # An PM2 durchreichen (wird in ecosystem.config.js als interpreter genutzt):
  export NODE_BIN="${NODE_BIN:-$NODE_BIN_DIR/node}"
fi
echo "→ Node: $(node -v)  ·  npm: $(npm -v)"

echo "→ Code aktualisieren"
git pull origin main

echo "→ Abhängigkeiten installieren"
npm install

echo "→ Produktions-Build erstellen"
npm run build   # baut Server-Code UND CSS (kein separates build:css nötig)

# DB-Migrationen laufen automatisch beim App-Start (lib/db/index.ts).

echo "→ App neu starten (PM2)"
pm2 restart ecosystem.config.js --update-env

echo "✓ Deployment abgeschlossen"
