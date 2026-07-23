# Changelog

Alle nennenswerten Änderungen an BandMate. Format nach
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/) — siehe [RELEASING.md](RELEASING.md).

## [Unreleased]

_Noch nichts._

## [1.10.0] — 2026-07-23

Diese Version dreht sich um **Datensicherheit**: Bisher war ein Fehltipp von
einem endgültigen Verlust nicht getrennt — jedes Mitglied konnte jeden Song
samt allen Noten und Aufnahmen unwiderruflich löschen, und eine Sicherung gab
es nicht. Grundlage der Priorisierung: [docs/review-2026-07.md](docs/review-2026-07.md).

### Hinzugefügt
- **Papierkorb** (`/papierkorb`, im Footer verlinkt): Songs, Setlisten, Termine
  und hochgeladene Dateien landen beim Löschen 30 Tage dort und lassen sich bis
  dahin zurückholen. Wiederherstellen darf jedes Mitglied, endgültig löschen nur
  ein Admin — das ist die einzige Aktion ohne Rückweg. Verweise bleiben erhalten:
  ein wiederhergestellter Song steht wieder an genau derselben Stelle in Setliste
  und Probe-Agenda. Eine gesammelt gelöschte Terminserie erscheint als **ein**
  Eintrag und kommt gemeinsam zurück.
- **„Rückgängig" direkt nach dem Löschen** auf der jeweiligen Liste — der
  Fehltipp fällt in derselben Sekunde auf, dafür ist ein Papierkorb, den man
  nicht kennt, nutzlos.
- **Automatisches Backup** (`./scripts/backup.sh`) von Datenbank und Uploads:
  nutzt die Online-Backup-API von SQLite (ein `cp` der laufenden Datei wäre im
  WAL-Modus **kein** gültiges Backup) und prüft das Ergebnis anschließend mit
  `PRAGMA integrity_check`. Unveränderte Uploads werden per Hardlink auf den
  Vorlauf gelegt statt neu gepackt. Cron-Beispiel und erprobte Restore-Anleitung
  im [README](README.md#backup--restore).
- **Snapshot vor jedem Deploy**: `./deploy.sh` sichert jetzt, bevor die
  Auto-Migration die Datenbank anfasst, und bricht ab, wenn das nicht klappt.
- **Aufräum-Job** `npm run trash:purge` — löscht abgelaufene Papierkorb-Einträge
  endgültig, inklusive der Dateien auf der Platte. Passiert zusätzlich beim
  Öffnen von `/papierkorb`.
- **Testrahmen** (Vitest, `npm test`): 41 Tests auf der Query-Ebene mit eigener
  Test-Datenbank. Vor dem Papierkorb-Umbau eingeführt, weil ein dort vergessener
  Filter Gelöschtes wieder auftauchen oder Vorhandenes verschwinden lässt.
- Hilfe-Seite um einen Abschnitt **Papierkorb** ergänzt.

### Geändert
- **Löschen vernichtet nicht mehr sofort**, sondern legt in den Papierkorb.
  Dateien verlassen die Platte erst beim endgültigen Löschen.
- **Löschdialoge nennen die Folgen**: „Kommt in 2 Setlisten und 1 Probe-Agenda
  vor und verschwindet dort." Ohne das schrumpft eine Setliste scheinbar grundlos.
- **Zeitzone festgenagelt** (`TZ` in `ecosystem.config.js`, Default
  `Europe/Vienna`). Ohne das richtet sich die Anzeige nach der Server-Zeitzone —
  auf einem UTC-Server waren alle Zeitstempel 1–2 Stunden falsch.
- Aufbewahrung der Backups auf **35 Tage** angehoben. Sie muss länger sein als
  die 30-Tage-Frist des Papierkorbs, sonst läge eine endgültig entfernte Datei in
  keiner Sicherung mehr.

### Behoben
- **Zerstörende Schaltflächen waren am Handy nicht erkennbar**: `.btn-danger`
  färbte sich ausschließlich bei `:hover`, „Löschen" sah dort also exakt aus wie
  „Speichern". Jetzt dauerhaft rot, Hover nur noch als Verstärkung. Betrifft auch
  die kleinen „löschen"- und ✕-Varianten in Listenzeilen.
- In der Mitgliederverwaltung trug auch **„Aktivieren"** die Warnfarbe.
- Setlisten-Übersicht schrieb „1 Songs".

### Hinweis für den Server
Neu in der `.env` (siehe [.env.example](.env.example)) — alle optional:
`BACKUP_DIR`, `RETENTION_DAYS`, `KEEP_MIN`. `BACKUP_DIR` sollte auf einer
**anderen Platte** liegen als `DATA_DIR`, sonst nimmt ein Plattenschaden beides
mit. `./scripts/backup.sh` und `npm run trash:purge` lesen dieselbe `.env` wie
die App, es muss also nichts doppelt gepflegt werden.

Vor dem ersten `./deploy.sh` das Backup einmal von Hand ausführen — schlägt es
fehl, bricht das Deployment ab (mit Absicht):

```bash
./scripts/backup.sh
```

Danach zwei Cron-Jobs einrichten (die Reihenfolge ist Absicht — der Papierkorb
wird erst geleert, wenn der Zustand davor gesichert ist):

```cron
30 3 * * * cd /pfad/zu/BandMate && ./scripts/backup.sh  >> /var/log/bandmate-backup.log 2>&1
0  4 * * * cd /pfad/zu/BandMate && npm run trash:purge  >> /var/log/bandmate-purge.log  2>&1
```

## [1.9.0] — 2026-07-22

### Hinzugefügt
- **Passwort vergessen / zurücksetzen**: Mitglieder können sich auf
  `/passwort-vergessen` (verlinkt von der Anmeldeseite) einen Reset-Link per
  E-Mail schicken lassen und auf `/passwort-zuruecksetzen` selbst ein neues
  Passwort vergeben — ohne den Admin fragen zu müssen. Link ist eine Stunde
  gültig und nur einmal verwendbar; die Anfrage-Seite zeigt bewusst immer
  dieselbe Meldung, egal ob die E-Mail-Adresse registriert ist.

## [1.8.0] — 2026-07-22

### Hinzugefügt
- **Hilfe-Seite** (`/hilfe`, verlinkt über ein Icon im Header): Kurzanleitung
  für Bandmitglieder zu Songs, Setlisten, Termine und Profil, jeweils mit
  Screenshots — erweiterbar um weitere Abschnitte, wenn neue Features
  dazukommen.

## [1.7.0] — 2026-07-21

### Geändert
- **E-Mail-Design überarbeitet**: Benachrichtigungs-Mails (neuer Songvorschlag,
  neuer Termin, neuer Kommentar) sowie die SMTP-Test-Mail kommen jetzt als
  strukturiertes HTML mit Kopfzeile (Logo, Wortmarke), Akzentfarbe und
  Fußzeile (Link zu den Benachrichtigungs-Einstellungen) statt als reiner
  Klartext — Klartext-Alternative bleibt für Mail-Clients ohne HTML erhalten.

## [1.6.0] — 2026-07-20

### Hinzugefügt
- **SMTP-Test-Funktion** auf `/mitglieder` (nur Admin): prüft die
  SMTP-Verbindung und verschickt eine echte Test-Mail, Erfolg/Fehler
  erscheinen direkt in der UI — kein Server-Log-Zugriff mehr nötig, um
  E-Mail-Probleme zu diagnostizieren.

### Behoben
- `notifyBand()` loggt jetzt auch den bisher stillen Fall „keine Empfänger"
  (z.B. wenn der Auslöser der einzige benachrichtigungsfähige aktive User ist).

## [1.5.0] — 2026-07-20

### Hinzugefügt
- Admin kann beim Bearbeiten eines Mitglieds (`/mitglieder`) jetzt auch die
  **E-Mail-Benachrichtigung** aktivieren/deaktivieren — dieselbe Einstellung,
  die jedes Mitglied auch selbst im eigenen Profil steuern kann.

## [1.4.0] — 2026-07-20

### Hinzugefügt
- Mitglieder können ihre **E-Mail-Adresse selbst im Profil ändern**
  (`/profil`), mit denselben Prüfungen wie beim Admin (Pflichtfeld, Format,
  Eindeutigkeit). Wirkt sofort, kein Re-Login nötig; die neue Adresse gilt
  gleich für den nächsten Login.

## [1.3.0] — 2026-07-15

### Hinzugefügt
- **„Alle"-Tab** in der Songliste: zeigt alle Songs statusübergreifend in einer
  Liste, jede Zeile mit farbigem Status-Badge. Default-Sortierung „Nach Status"
  (gruppiert Vorschlag→Archiv), zusätzlich Votes/Titel/Neueste; Suche inklusive.

### Geändert
- Beim Öffnen von **Songs** startet jetzt der „Alle"-Tab (statt Vorschlag).
- Status-Badge im Alle-Tab am Handy als **Icon** (Glühbirne = Vorschlag,
  Loop = In Probe, Haken = Repertoire, Box = Archiv), ab Tablet/Desktop wieder
  mit Text-Label — mehr Platz für den Songtitel.

## [1.2.0] — 2026-07-14

### Hinzugefügt
- Mobile **Menüleiste mit Icons** (Dashboard, Songs, Setlisten, Termine,
  Mitglieder) samt Icons für Profil und Abmelden. Auf großen Bildschirmen
  bleiben die gewohnten Text-Einträge.

### Behoben
- Horizontaler Überlauf am Handy bei langen Datei-, Song- und Setlistennamen
  auf den zweispaltigen Seiten (Song-Detail, Termine, Setlisten): alle
  Grid-Spalten mit `min-w-0` gehärtet, `truncate` greift wieder.
- `scripts/release.sh` findet die CHANGELOG-Notes jetzt korrekt (Tag hat
  `v`-Präfix, Überschrift nicht) — Releases bekommen wieder die richtigen Notes.

## [1.1.0] — 2026-07-13

### Geändert
- App umbenannt von „Bandraum" in **BandMate** (Oberfläche, Seitentitel,
  PWA-Manifest, E-Mail-Betreff, Kalendername). Der Session-Cookie heißt jetzt
  `bandmate_session` — dadurch werden bestehende Logins einmalig ausgeloggt.
- **Mobile-Optimierung** der gesamten Oberfläche: Header/Navigation, Song-Detail
  inkl. Metronom, Setlist-Editor (Notizfeld jetzt auch am Handy), Termine,
  Mitglieder und Formulare passen sich an kleine Bildschirme an.

### Behoben
- Horizontaler Überlauf am Handy im Setlist-Editor (langes Song-Auswahlfeld) und
  im Dashboard (lange Songtitel).
- Vote-Badge im Dashboard mobil auf „offen" gekürzt, damit der Titel Platz behält.
- `secure`-Flag des Session-Cookies wird dynamisch aus Protokoll/`APP_URL`
  bestimmt (Login hinter Reverse-Proxy bzw. über HTTP).
- Seed-Script lädt `.env` und akzeptiert deutsche/kleingeschriebene Env-Namen.

### Deployment
- Robust bei mehreren Node-Versionen am Server: `deploy.sh` respektiert
  `NODE_BIN_DIR` (PATH), `ecosystem.config.js` den PM2-`interpreter` via `NODE_BIN`.
  Behebt „Node.js version >=20.9.0 is required" beim Build trotz node22-npm.
- `.env.example` wieder im Repo (`.gitignore`-Ausnahme).
- Release-Workflow über die GitHub CLI; `scripts/release.sh` legt Tag und
  GitHub-Release in einem Schritt an.

## [1.0.0] — 2026-07-13

Erster stabiler Release — die App geht in den produktiven Bandbetrieb.

### Songs
- Songvorschläge mit Status-Workflow: Vorschlag → In Probe → Repertoire → Archiv
- Stammdaten: Interpret, Tempo (BPM), Tonart, Capo, Dauer, Notizen
- Lyrics & Akkorde mit **Transponier-Funktion** (±Halbton, deutsch/englisch, optional speichern)
- Links mit YouTube-/Spotify-Embed
- Noten-Upload pro Instrument (PDF/Bild) mit **Inline-Viewer**, Audio-Upload mit Player
- Voting (👍/👎), Übe-Status pro Mitglied, Bandchat je Song
- Suche, Status-Tabs, Sortierung; eingebautes **Metronom** mit Tap-Tempo

### Setlisten
- Beliebig viele Setlisten, **Drag-&-Drop-Reihenfolge**, Notiz je Song, Gesamtdauer
- Druck-/PDF-Ansicht, Setliste duplizieren

### Termine
- Proben & Gigs (farblich getrennt), Proben als wöchentliche Serie
- Zu-/Absagen mit Kommentar, Setlisten-Verknüpfung, **Probe-Agenda** (Songs je Termin)
- Optionale E-Mail beim Anlegen, **ICS-Kalender-Feed** zum Abonnieren

### Mitglieder & System
- Login (Session-Cookie), alle Seiten geschützt, Datei-Downloads nur mit Login
- Admin-Userverwaltung inkl. Profil-Bearbeitung; Selbst-Profil für jedes Mitglied
- E-Mail-Benachrichtigungen (optional, SMTP), Dashboard, dunkles Design, PWA/App-Icon
- Deployment mit PM2 (`ecosystem.config.js`, Port 8059) und `deploy.sh`

[Unreleased]: https://github.com/iDobrounig/BandMate/compare/v1.9.0...HEAD
[1.9.0]: https://github.com/iDobrounig/BandMate/releases/tag/v1.9.0
[1.8.0]: https://github.com/iDobrounig/BandMate/releases/tag/v1.8.0
[1.7.0]: https://github.com/iDobrounig/BandMate/releases/tag/v1.7.0
[1.6.0]: https://github.com/iDobrounig/BandMate/releases/tag/v1.6.0
[1.5.0]: https://github.com/iDobrounig/BandMate/releases/tag/v1.5.0
[1.4.0]: https://github.com/iDobrounig/BandMate/releases/tag/v1.4.0
[1.3.0]: https://github.com/iDobrounig/BandMate/releases/tag/v1.3.0
[1.2.0]: https://github.com/iDobrounig/BandMate/releases/tag/v1.2.0
[1.1.0]: https://github.com/iDobrounig/BandMate/releases/tag/v1.1.0
[1.0.0]: https://github.com/iDobrounig/BandMate/releases/tag/v1.0.0
