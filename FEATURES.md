# Bandraum — Feature-Liste & Roadmap

Stand: 12.07.2026 · Diese Liste ist das zentrale Dokument für „Was kann die App / was kommt als Nächstes".

## ✅ Umgesetzt

### Songs
- [x] Songvorschläge mit Status-Workflow: **Vorschlag → In Probe → Repertoire → Archiv**
- [x] Stammdaten: Titel, Interpret, Tempo (BPM), Tonart, Capo, Dauer, Notizen
- [x] Lyrics & Akkorde (Monospace-Ansicht)
- [x] **Transponieren**: Akkordzeilen live ±Halbton (deutsch H/B + englisch B), Tonart wandert mit, optional dauerhaft speichern
- [x] Links mit **YouTube-/Spotify-Embed**
- [x] **Noten-Upload pro Instrument** (PDF/Bilder, max. 20 MB) mit **Inline-PDF-Viewer**
- [x] **Audio-Upload** (MP3/M4A/WAV/OGG/FLAC, max. 50 MB) mit Browser-Player inkl. Seeking
- [x] **Voting** (👍/👎) auf Vorschläge, mit Wer-hat-gestimmt-Tooltip
- [x] **Übe-Status** pro Mitglied (offen / übe noch / kann ich) mit Band-Ampel
- [x] **Bandchat**: Kommentare pro Song (eigene/Admin löschen)
- [x] Suche, Status-Tabs, Sortierung (Votes/Titel/Neueste)
- [x] **Metronom** (Web Audio) mit Tap-Tempo, vorbelegt mit Song-BPM

### Setlisten
- [x] Beliebig viele Setlisten (Name, Datum, Notizen), **duplizierbar** als Basis fürs nächste Programm
- [x] Songs aus Repertoire/In-Probe hinzufügen, **Drag-&-Drop-Reihenfolge**
- [x] Notiz pro Song (z.B. „Pause danach"), Gesamtdauer
- [x] **Druck-/PDF-Ansicht** (weißes Blatt, Tonart/Capo/Tempo/Dauer)

### Termine
- [x] **Proben & Gigs** (farblich unterschieden), Datum/Uhrzeit/Ort/Notizen
- [x] Proben als **wöchentliche Serie** (materialisierte Einzeltermine, einzeln absagbar; löschen einzeln oder ganze Serie)
- [x] **Zu-/Absagen** (✓/?/✗) mit Kommentar, Übersicht aller Rückmeldungen
- [x] Verknüpfung mit Setliste
- [x] Optionale **E-Mail an die Band beim Anlegen** (Checkbox)
- [x] Vergangene Termine einklappbar
- [x] **Probe-Agenda**: Songs einem Termin zuordnen, mit „✓ x/y können's"-Anzeige
- [x] **ICS-Kalender-Feed**: Termine als Abo in Handy-/Google-Kalender (geheime Token-URL)

### Mitglieder & System
- [x] Login (Session-Cookie), alle Seiten geschützt, Datei-Downloads nur mit Login
- [x] Admin legt Mitglieder an, setzt Passwörter, vergibt Rollen, deaktiviert Accounts
- [x] **Admin bearbeitet Profile** (Name, E-Mail, Instrument) inline
- [x] Jedes Mitglied bearbeitet das eigene Profil (Name, Instrument, Passwort, Mail-Opt-out) unter `/profil`
- [x] E-Mail-Benachrichtigung bei neuem Vorschlag / Kommentar / Termin (wenn SMTP konfiguriert)
- [x] Dashboard: heiße Vorschläge, in Probe, nächste Termine mit RSVP-Status, letzte Kommentare
- [x] Mobile-taugliches, dunkles „Backstage"-Design
- [x] **App-Icon/Favicon + PWA-Manifest** — „Zum Homescreen hinzufügen" wie eine echte App

## 🔜 Ideen / Roadmap (grob priorisiert)

### Schnelle Gewinne
- [ ] **Passwort-Reset per E-Mail** — sinnvoll, sobald SMTP eingerichtet ist
- [ ] **Dubletten-Warnung** beim Songvorschlag („gibt's schon als…")

### Mittel
- [ ] **Browser-Audio-Aufnahme** — Sprachmemo/Idee direkt am Song aufnehmen (MediaRecorder)
- [ ] **Erinnerungs-Mail vor Terminen** (z.B. 2 Tage vorher) — braucht Cron-Job am Server
- [ ] **Sets & Pausen in Setlisten** (Set 1 / Pause / Set 2 mit Zwischensummen)
- [ ] **Anwesenheits-Statistik** über alle Proben (wer war wie oft da)
- [ ] **Serien-Termine gesammelt bearbeiten** (z.B. Uhrzeit der ganzen Serie ändern)
- [ ] **Globale Suche** über Songs, Setlisten, Termine

### Später / bei Bedarf
- [ ] Web-Push-Benachrichtigungen (statt/zusätzlich zu E-Mail)
- [ ] Papierkorb bzw. Undo statt hartem Löschen
- [ ] Login-Rate-Limit (Brute-Force-Schutz; intern niedriges Risiko)
- [ ] Automatisches Backup-Script für `data/` (Cron + zip)
- [ ] Speicherplatz-Übersicht der Uploads
- [ ] Akkord-Diagramme / Capo-Rechner in der Lyrics-Ansicht

## ⚠️ Vor dem ersten echten Deployment beachten

1. `SESSION_SECRET` in `.env` setzen (sonst unsicheres Dev-Geheimnis)
2. Seed-Admin-Passwort ändern bzw. echten Admin anlegen und `admin@example.com` deaktivieren
3. `DATA_DIR` außerhalb des Deploy-Ordners legen + **Backup einrichten**
4. SMTP-Daten eintragen, wenn Mails gewünscht
5. Falls Reverse-Proxy (nginx/Apache) davor: Upload-Limit erhöhen (z.B. nginx `client_max_body_size 60m`), sonst scheitern Audio-Uploads
