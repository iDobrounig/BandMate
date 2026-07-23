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
      // Bei mehreren Node-Versionen am Server die Laufzeit-Version festnageln
      // (Next.js braucht >= 20.9). Per Env NODE_BIN setzen, z.B.
      //   NODE_BIN=/usr/local/node22/bin/node pm2 start ecosystem.config.js
      // Ohne NODE_BIN nutzt PM2 die Node-Version, unter der der Daemon läuft.
      interpreter: process.env.NODE_BIN || undefined,
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
        // Ohne TZ nutzt toLocaleString() die Zeitzone des Servers — auf einem
        // UTC-VPS wären alle Zeitstempel (Kommentare, Termine) 1–2 h falsch.
        TZ: process.env.TZ || "Europe/Vienna",
      },
    },
  ],
};
