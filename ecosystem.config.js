// PM2-Konfiguration für den Produktivbetrieb.
// Start (einmalig):   pm2 start ecosystem.config.js
// Neustart/Update:    pm2 restart ecosystem.config.js   (macht auch deploy.sh)
// Beim Booten laden:  pm2 startup   &&   pm2 save
//
// WICHTIG: nur EINE Instanz im fork-Modus. Die App nutzt SQLite (better-sqlite3)
// mit einem prozess-internen DB-Singleton — mehrere Instanzen / cluster-Modus
// würden zu Sperr-/Schreibkonflikten führen.
module.exports = {
  apps: [
    {
      name: "bandmate",
      cwd: __dirname,
      // Next-Binary direkt starten (sauberes Signal-Handling durch PM2)
      script: "./node_modules/next/dist/bin/next",
      args: "start -p 8059",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      // Env-Variablen (SESSION_SECRET, DATA_DIR, SMTP_*, APP_URL) kommen aus der
      // .env-Datei im Projektverzeichnis — die liest Next selbst ein. So bleiben
      // Secrets aus dieser (eingecheckten) Datei heraus.
      env: {
        NODE_ENV: "production",
        PORT: "8059",
      },
    },
  ],
};
