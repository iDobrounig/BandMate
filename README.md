# Bandraum

Selbst gehostetes Band-Dashboard: Songvorschläge mit Voting, Noten & Audio pro Song, Übe-Status, Bandchat, Setlisten, Probetermine mit Zu-/Absagen — alles an einem Ort, gebaut für kleine Bands (3–15 Leute).

> **English:** Bandraum ("band room") is a self-hosted dashboard for bands: song suggestions with voting, sheet music & audio per song, practice status, comments, drag-and-drop setlists with print view, rehearsal/gig scheduling with RSVPs, an ICS calendar feed, a built-in metronome and a chord transposer. Single Node.js process, SQLite, no external services required. UI is currently German only — contributions welcome.

**Stack:** Next.js (App Router) · SQLite (better-sqlite3 + Drizzle) · Tailwind CSS · iron-session — läuft als einzelner Node-Prozess, keine externen Dienste nötig.

![Dashboard](docs/screenshots/dashboard.png)

<table>
  <tr>
    <td><img src="docs/screenshots/song.png" alt="Songseite mit Embeds, Übe-Status und Noten" /></td>
    <td><img src="docs/screenshots/termine.png" alt="Termine mit Zu-/Absagen und Serien" /></td>
  </tr>
</table>

## Features

- **Songs** mit Status-Workflow: Vorschlag → In Probe → Repertoire → Archiv
- Tempo (BPM), Tonart, Capo, Dauer, Lyrics/Akkorde, Notizen
- **Uploads**: Noten pro Instrument (PDF/Bilder, max. 20 MB) und Audio-Dateien (max. 50 MB) mit Player
- **Links** mit YouTube-/Spotify-Embed
- **Voting** (Daumen hoch/runter) auf Vorschläge
- **Übe-Status** pro Mitglied („Noch nicht angeschaut / Übe noch / Kann ich")
- **Bandchat**: Kommentare pro Song
- **Setlisten** mit Drag-&-Drop-Reihenfolge, Gesamtdauer und Druck-/PDF-Ansicht
- **Metronom** (Web Audio) mit Tap-Tempo, vorbelegt mit dem Song-Tempo
- **Userverwaltung**: Admin legt Mitglieder an und setzt Passwörter; sonst dürfen alle alles
- Optionale **E-Mail-Benachrichtigung** bei neuem Vorschlag/Kommentar (SMTP), pro User abschaltbar

- **Termine**: Proben (auch als wöchentliche Serie) und Gigs mit Zu-/Absagen der Mitglieder, optionaler E-Mail beim Anlegen, Setlisten-Verknüpfung
- **PDF-Noten-Viewer** direkt auf der Songseite
- **Transponieren**: Akkordzeilen in den Lyrics live um Halbtöne verschieben (deutsch H/B und englisch B unterstützt), optional dauerhaft speichern

Die vollständige Feature-Liste inkl. priorisierter Roadmap steht in **[FEATURES.md](FEATURES.md)**.

## Lokal starten

```bash
npm install
cp .env.example .env        # SESSION_SECRET setzen!
npm run seed                # legt den ersten Admin an (gibt Passwort aus)
npm run dev                 # http://localhost:3000
```

`npm run seed` liest optional `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` aus der Umgebung/.env; ohne Angabe wird `admin@example.com` mit Zufallspasswort angelegt (wird in der Konsole ausgegeben). Nach dem ersten Login das Passwort im Profil ändern.

## Daten

Alle persistenten Daten liegen in `data/` (per `DATA_DIR` konfigurierbar):

- `data/band.db` — SQLite-Datenbank (WAL-Modus)
- `data/uploads/<songId>/…` — hochgeladene Dateien

**Backup = dieses Verzeichnis sichern.** Es liegt nicht im Git.

Schema-Änderungen: `lib/db/schema.ts` anpassen, dann `npm run db:generate` — die Migration in `drizzle/` wird beim nächsten App-Start automatisch angewendet.

## Deployment (Webhosting mit Node.js)

1. Repo auf den Server bringen, Node ≥ 20 wählen
2. `.env` anlegen:
   - `SESSION_SECRET` — Pflicht, mind. 32 Zeichen (`openssl rand -base64 32`)
   - `APP_URL` — öffentliche URL (für Links in E-Mails)
   - `DATA_DIR` — optional, absoluter Pfad zum Datenverzeichnis (sollte außerhalb des Deploy-Ordners liegen, damit Updates die Daten nicht anfassen)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — optional für Mails
3. Erstinstallation:
   ```bash
   npm install
   npm run build
   npm run seed        # nur beim ersten Mal — legt den Admin an
   ```
4. Läuft ein Reverse-Proxy davor (nginx/Apache): Upload-Limit auf ≥ 60 MB stellen (nginx: `client_max_body_size 60m`), sonst schlagen Audio-Uploads fehl.

Checkliste vor dem Livegang: siehe [FEATURES.md](FEATURES.md), Abschnitt „Vor dem ersten echten Deployment".

### Betrieb mit PM2

Die App läuft als einzelner Node-Prozess unter [PM2](https://pm2.keymetrics.io/). Konfiguration: [`ecosystem.config.js`](ecosystem.config.js) (Port 3000, fork-Modus, **eine** Instanz — wegen SQLite kein cluster-Modus).

```bash
pm2 start ecosystem.config.js   # einmalig starten
pm2 save                        # aktuelle Prozessliste merken
pm2 startup                     # PM2 beim Server-Boot automatisch starten (Anweisung ausführen)
pm2 logs bandmate               # Logs ansehen
```

Port oder Speicherlimit ändern: Werte in `ecosystem.config.js` anpassen, dann `pm2 restart ecosystem.config.js`.

### Updates einspielen

Nach einem Push auf `main` auf dem Server im App-Verzeichnis:

```bash
./deploy.sh
```

Das Script macht `git pull` → `npm install` → `npm run build` → `pm2 restart`. DB-Migrationen laufen automatisch beim Neustart. `data/` (SQLite + Uploads) und `.env` bleiben unangetastet.

## Scripts

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklung |
| `npm run build` / `npm start` | Produktion |
| `npm run seed` | Ersten Admin anlegen (no-op, wenn User existieren) |
| `npm run db:generate` | Drizzle-Migration aus Schema-Änderungen erzeugen |
| `./deploy.sh` | Produktiv-Update auf dem Server (pull, install, build, PM2-restart) |

## Lizenz

[MIT](LICENSE) — frei nutzbar, auch für eure Band. Pull Requests willkommen.
