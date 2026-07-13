#!/usr/bin/env bash
# Auf dem Server im App-Verzeichnis ausführen, um auf den neuesten main-Stand
# zu aktualisieren. Vorher einmalig einrichten (siehe README, Abschnitt Deployment).
set -euo pipefail

cd "$(dirname "$0")"

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
