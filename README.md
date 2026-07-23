# BandMate

Selbst gehostetes Band-Dashboard: Songvorschläge mit Voting, Noten & Audio pro Song, Übe-Status, Bandchat, Setlisten, Probetermine mit Zu-/Absagen — alles an einem Ort, gebaut für kleine Bands (3–15 Leute).

> **English:** BandMate is a self-hosted dashboard for bands: song suggestions with voting, sheet music & audio per song, practice status, comments, drag-and-drop setlists with print view, rehearsal/gig scheduling with RSVPs, an ICS calendar feed, a built-in metronome and a chord transposer. Single Node.js process, SQLite, no external services required. UI is currently German only — contributions welcome.

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

Schema-Änderungen: `lib/db/schema.ts` anpassen, dann `npm run db:generate` — die Migration in `drizzle/` wird beim nächsten App-Start automatisch angewendet.

## Backup & Restore

> **Wichtig:** Ein simples `cp band.db` ist **kein** gültiges Backup. Die App läuft im WAL-Modus — frisch geschriebene Daten stehen dann noch in `band.db-wal`, und eine Kopie mitten in einem Schreibvorgang kann zerrissen sein. `scripts/backup.sh` nutzt deshalb die Online-Backup-API von SQLite und prüft das Ergebnis anschließend mit `PRAGMA integrity_check`.

```bash
./scripts/backup.sh                      # normaler Lauf
./scripts/backup.sh --label pre-deploy   # Snapshot vor einem Deploy
```

Pro Lauf entsteht ein Verzeichnis:

```
$BACKUP_DIR/2026-07-23_030000/
  band.db          geprüfte Kopie der Datenbank
  uploads.tar.gz   Noten und Audio-Dateien
  MANIFEST.txt     Zeitpunkt, Version, Zeilenzahlen, Prüfergebnis
$BACKUP_DIR/latest -> neuester Lauf
```

Unveränderte Uploads werden nicht neu gepackt, sondern als Hardlink auf den Vorlauf gelegt — eine unveränderte Upload-Sammlung kostet über die ganze Aufbewahrungszeit nur einmal Platz statt einmal pro Nacht.

| Variable | Default | Zweck |
|---|---|---|
| `DATA_DIR` | `<repo>/data` | wie in der App |
| `BACKUP_DIR` | `<DATA_DIR>/../bandmate-backups` | Ablage der Backups — **auf eine andere Platte legen**, sonst nimmt ein Plattenschaden beides mit |
| `RETENTION_DAYS` | `35` | Aufbewahrung. Bewusst länger als die 30-Tage-Frist des Papierkorbs — sonst liegt eine endgültig gepurgte Datei in keinem Backup mehr |
| `KEEP_MIN` | `3` | so viele Läufe bleiben immer erhalten, egal wie alt |

### Als Cron-Job

```bash
crontab -e
```
```cron
30 3 * * * cd /pfad/zu/BandMate && DATA_DIR=/var/bandmate-data BACKUP_DIR=/mnt/backup/bandmate ./scripts/backup.sh >> /var/log/bandmate-backup.log 2>&1
```

Das Script beendet sich bei jedem Problem mit Exit-Code ≠ 0 und räumt einen halbfertigen Lauf wieder weg — ein unvollständiges Backup bleibt nie als scheinbar gültiges stehen. Cron schickt die Ausgabe fehlgeschlagener Läufe per Mail, wenn `MAILTO` gesetzt ist.

### Restore

Bewusst **kein** Script: Zurückspielen überschreibt Daten und soll eine überlegte Handlung sein, kein Einzeiler, den man nachts versehentlich auslöst.

```bash
# 1. App stoppen — sonst schreibt sie weiter in die alte DB
pm2 stop bandmate

# 2. Aktuellen Stand beiseitelegen statt löschen (falls das Backup doch älter ist als gedacht)
mv /var/bandmate-data /var/bandmate-data.kaputt-$(date +%F)
mkdir -p /var/bandmate-data

# 3. Aus dem gewünschten Lauf zurückspielen
SRC=/mnt/backup/bandmate/latest          # oder ein konkretes Verzeichnis
cat "$SRC/MANIFEST.txt"                  # erst schauen: Zeitpunkt und Zeilenzahlen plausibel?
cp "$SRC/band.db" /var/bandmate-data/band.db
tar xzf "$SRC/uploads.tar.gz" -C /var/bandmate-data

# 4. Gegenprüfen
sqlite3 /var/bandmate-data/band.db "pragma integrity_check; select count(*) from songs;"

# 5. Starten — Migrationen laufen beim Start automatisch an
pm2 start ecosystem.config.js
```

Es gibt **keine** `band.db-wal`/`band.db-shm` im Backup und es sollen auch keine zurückkopiert werden: die Backup-Datei ist bereits in sich vollständig, alte WAL-Reste würden sie nur beschädigen.

Dieser Ablauf wurde am 23.07.2026 einmal vollständig durchgespielt (Restore in ein leeres Verzeichnis, Upload-Prüfsummen identisch, App startet inkl. Migrationen). **Nach jeder Änderung an Schema oder Backup-Script erneut proben** — ein Backup, das nie zurückgespielt wurde, ist kein Backup.

## Produktiv-Deployment

Die App läuft als **ein** Node-Prozess (Next.js `next start`) unter [PM2](https://pm2.keymetrics.io/), standardmäßig auf **Port 8059**, und wird üblicherweise über einen Reverse-Proxy (nginx/Apache) mit HTTPS nach außen gestellt. Voraussetzung: Node ≥ 20.9 und PM2 (`npm install -g pm2`) auf dem Server.

> **Mehrere Node-Versionen am Server?** Ein Aufruf wie `/usr/local/node22/bin/npm run build` genügt **nicht** — `npm` und `next` starten via `#!/usr/bin/env node` und nehmen dann das `node` aus dem PATH (oft eine ältere Default-Version). Stell die gewünschte Version dem PATH voran, dann nutzen `node`/`npm`/`next` einheitlich diese:
> ```bash
> export PATH="/usr/local/node22/bin:$PATH"
> ```
> Für `deploy.sh` und PM2 gibt es dafür die Variablen `NODE_BIN_DIR` bzw. `NODE_BIN` (siehe unten).

### 1. Erstinstallation

```bash
git clone https://github.com/iDobrounig/BandMate.git
cd BandMate
cp .env.example .env          # anschließend ausfüllen (siehe unten)
npm install
npm run build
npm run seed                  # nur beim ersten Mal — legt den Admin an (Passwort wird ausgegeben)
```

Pflicht- und optionale Werte in der `.env`:

| Variable | | Zweck |
|---|---|---|
| `SESSION_SECRET` | **Pflicht** | Session-Verschlüsselung, mind. 32 Zeichen: `openssl rand -base64 32` |
| `APP_URL` | empfohlen | öffentliche URL (z.B. `https://band.example.com`) — für Links in E-Mails |
| `DATA_DIR` | empfohlen | absoluter Pfad zum Datenverzeichnis **außerhalb** des Clone-Ordners, damit `git pull` die Daten nie berührt (z.B. `/var/bandmate-data`) |
| `SMTP_HOST` … `SMTP_FROM` | optional | E-Mail-Versand; ohne diese Werte werden keine Mails verschickt |

> Der Port wird **nicht** über die `.env`, sondern in [`ecosystem.config.js`](ecosystem.config.js) gesetzt.

### 2. Start mit PM2

Konfiguration: [`ecosystem.config.js`](ecosystem.config.js) — Prozessname `bandmate`, Port 8059, fork-Modus, **eine** Instanz (wegen SQLite kein cluster-Modus, sonst Schreibkonflikte).

```bash
pm2 start ecosystem.config.js   # App starten
pm2 save                        # aktuelle Prozessliste merken
pm2 startup                     # PM2 beim Server-Boot autostarten (ausgegebenen Befehl ausführen)
pm2 logs bandmate               # Logs ansehen
pm2 status                      # Übersicht
```

Port oder Speicherlimit ändern: Werte in `ecosystem.config.js` anpassen, dann `pm2 restart ecosystem.config.js --update-env`.

Läuft der PM2-Daemon unter einer zu alten Node-Version, die App aber soll Node 22 nutzen, den Interpreter beim Start festnageln:
```bash
NODE_BIN=/usr/local/node22/bin/node pm2 start ecosystem.config.js
```
Der Wert landet in `ecosystem.config.js` als `interpreter` und bleibt über `pm2 save` erhalten.

### 3. Reverse-Proxy (nginx-Beispiel)

```nginx
server {
    server_name band.example.com;

    client_max_body_size 60m;          # sonst scheitern Audio-Uploads (bis 50 MB)

    location / {
        proxy_pass http://127.0.0.1:8059;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

HTTPS anschließend z.B. per Certbot einrichten. (Apache: `ProxyPass / http://127.0.0.1:8059/` plus `LimitRequestBody 62914560`.)

### 4. Updates einspielen

Nach einem Push auf `main` auf dem Server im App-Verzeichnis:

```bash
./deploy.sh
```

Das Script macht `git pull` → `npm install` → `npm run build` → **Snapshot** → `pm2 restart --update-env`. DB-Migrationen laufen automatisch beim Neustart; `data/` (SQLite + Uploads) und `.env` bleiben unangetastet.

Der Snapshot (`./scripts/backup.sh --label pre-deploy`) läuft direkt vor dem Neustart — also bevor eine neue Migration die DB anfasst. Schlägt er fehl, bricht das Deployment ab, **bevor** etwas verändert wurde. Notfalls überspringbar mit `SKIP_BACKUP=1 ./deploy.sh`, aber dann ohne Netz.

Bei mehreren Node-Versionen die gewünschte übergeben (setzt PATH **und** den PM2-Interpreter):
```bash
NODE_BIN_DIR=/usr/local/node22/bin ./deploy.sh
```
Alternativ `NODE_BIN_DIR` fest oben in `deploy.sh` eintragen, dann genügt `./deploy.sh`.

### Vor dem Livegang

- `SESSION_SECRET` gesetzt? (sonst läuft die App mit unsicherem Dev-Geheimnis)
- Seed-Admin `admin@example.com` nach dem ersten echten Login deaktivieren
- Backup als Cron-Job einrichten und **einmal einen Restore proben** (→ Abschnitt „Backup & Restore"). `BACKUP_DIR` auf eine andere Platte legen als `DATA_DIR`
- Zeitzone prüfen: `ecosystem.config.js` setzt `TZ` auf `Europe/Vienna`. Steht der Server
  woanders, den Wert dort anpassen oder `TZ` beim Start mitgeben — sonst zeigt die App
  alle Zeitstempel in der Server-Zeitzone an.

Vollständige Checkliste: [FEATURES.md](FEATURES.md), Abschnitt „Vor dem ersten echten Deployment".

## Scripts

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklung |
| `npm run build` / `npm start` | Produktion |
| `npm run seed` | Ersten Admin anlegen (no-op, wenn User existieren) |
| `npm run db:generate` | Drizzle-Migration aus Schema-Änderungen erzeugen |
| `./scripts/backup.sh` | Backup von DB + Uploads (für Cron; siehe „Backup & Restore") |
| `./deploy.sh` | Produktiv-Update auf dem Server (pull, install, build, Snapshot, PM2-restart) |

## Versionierung

[SemVer](https://semver.org/lang/de/) (`MAJOR.MINOR.PATCH`), Git-Tags `vX.Y.Z`. Änderungen stehen im [CHANGELOG.md](CHANGELOG.md), der Release-Ablauf in [RELEASING.md](RELEASING.md).

## Lizenz

[MIT](LICENSE) — frei nutzbar, auch für eure Band. Pull Requests willkommen.
