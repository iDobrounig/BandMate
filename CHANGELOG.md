# Changelog

Alle nennenswerten Änderungen an BandMate. Format nach
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/) — siehe [RELEASING.md](RELEASING.md).

## [Unreleased]

_Noch nichts._

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

[Unreleased]: https://github.com/iDobrounig/BandMate/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/iDobrounig/BandMate/releases/tag/v1.1.0
[1.0.0]: https://github.com/iDobrounig/BandMate/releases/tag/v1.0.0
