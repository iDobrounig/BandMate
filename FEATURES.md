# BandMate — Feature-Liste & Roadmap

Stand: 23.07.2026 · Diese Liste ist das zentrale Dokument für „Was kann die App / was kommt als Nächstes".
Grundlage der Priorisierung: [docs/review-2026-07.md](docs/review-2026-07.md).

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
- [x] **Passwort vergessen / zurücksetzen** per E-Mail-Link (1 h gültig, einmal verwendbar) — *seit 1.9.0*
- [x] Admin legt Mitglieder an, setzt Passwörter, vergibt Rollen, deaktiviert Accounts
- [x] **Admin bearbeitet Profile** (Name, E-Mail, Instrument) inline
- [x] Jedes Mitglied bearbeitet das eigene Profil (Name, Instrument, Passwort, Mail-Opt-out) unter `/profil`
- [x] E-Mail-Benachrichtigung bei neuem Vorschlag / Kommentar / Termin (wenn SMTP konfiguriert)
- [x] **SMTP-Test-Funktion** auf `/mitglieder` (nur Admin) — Verbindung prüfen + echte Test-Mail — *seit 1.6.0*
- [x] **Hilfe-Seite** `/hilfe` mit Screenshots, verlinkt im Header — *seit 1.8.0*
- [x] Dashboard: heiße Vorschläge, in Probe, nächste Termine mit RSVP-Status, letzte Kommentare
- [x] Mobile-taugliches, dunkles „Backstage"-Design
- [x] **App-Icon/Favicon + PWA-Manifest** — „Zum Homescreen hinzufügen" wie eine echte App

---

## 🔜 Roadmap

Gegliedert in **Wellen**. Eine Welle = ein Release. Reihenfolge ist bewusst und nicht
verhandelbar: Welle 0 schützt die Daten, Welle 1 hält die Band in der App, erst danach
kommen neue Fähigkeiten. Begründung: [docs/review-2026-07.md](docs/review-2026-07.md).

### Welle 0 — Datensicherheit *(nächstes Release, blockiert alles andere)*

> **Warum zuerst:** Aktuell ist ein Fehltipp oder eine fehlerhafte Migration von einem
> vollständigen, unwiederbringlichen Datenverlust getrennt. Alle Noten, Aufnahmen und die
> Bandhistorie liegen in einer SQLite-Datei plus einem Upload-Ordner — ohne Sicherung, ohne
> Papierkorb, ohne Rollback.

- [ ] **Automatisches Backup**
  Script `scripts/backup.sh`: `sqlite3 .backup` der DB (WAL-sicher, kein Kopieren der
  laufenden Datei!) + `tar` über `data/uploads/`, Ablage in `$BACKUP_DIR` mit Datumsstempel,
  Rotation über N Tage (Default 14). Als täglicher Cron-Job dokumentiert im README.
  Zusätzlich: Restore-Anleitung schreiben **und einmal durchspielen** — ein Backup, das nie
  zurückgespielt wurde, ist kein Backup.

- [ ] **Pre-Migration-Snapshot in `deploy.sh`**
  Vor `pm2 restart` (also bevor die Auto-Migration in `lib/db/index.ts` läuft) einen
  Snapshot ziehen und den Pfad ausgeben. Bei fehlgeschlagener Migration ist der Weg zurück
  dann ein einzelner `cp`.

- [ ] **Papierkorb statt hartem Löschen (Soft Delete)**
  Spalte `deletedAt` auf `songs`, `setlists`, `events`, `attachments`, `comments`. Alle
  Queries filtern `deletedAt IS NULL`. Neue Admin-Seite `/papierkorb`: gelöschte Objekte der
  letzten 30 Tage mit „Wiederherstellen" und „Endgültig löschen". Dateien auf der Platte
  erst beim endgültigen Löschen entfernen (heute: sofort, `lib/actions/songs.ts:158`).
  *Achtung: berührt alle Listen-Queries — nach dem Backup umsetzen, nicht davor.*

- [ ] **Löschen-Buttons auf Touchgeräten erkennbar machen**
  `.btn-danger` färbt heute **nur bei `:hover`** (`app/globals.css`). Auf dem Handy ist
  „Löschen" optisch identisch mit „Speichern". Fix: dauerhafte rote Kontur/Schrift, Hover
  nur als Verstärkung. Einzeiler mit der größten Sicherheitswirkung im Projekt.

- [ ] **Zeitzone festnageln**
  `TZ: "Europe/Vienna"` in `ecosystem.config.js` (`env`). Ohne das nutzt `toLocaleString`
  die Server-Zeitzone — auf einem UTC-VPS sind alle Kommentar-Zeitstempel 1–2 h falsch.

- [ ] *(optional, empfohlen)* **Minimaler Test-Rahmen**
  Vitest + eine Handvoll Tests für `lib/chords.ts`, `lib/format.ts` und die neuen
  Soft-Delete-Queries. Kein Vollausbau — nur genug, um beim Umbau destruktiver Pfade nicht
  blind zu sein.

### Welle 1 — Aktivierung *(die App muss sich melden)*

> **Warum:** BandMate ist heute eine reine Pull-App — es passiert nur etwas, wenn jemand
> aktiv die Seite öffnet. Ohne Rückholkanal ist der typische Verlauf: Woche 1 begeistert,
> Woche 4 nur noch der Betreiber, Monat 3 tot.

- [ ] **Erinnerungs-Mail vor Terminen**
  Cron-Job (`scripts/reminders.ts`, täglich früh): für jeden Termin in genau 2 Tagen eine
  Mail an alle aktiven Mitglieder **ohne Rückmeldung** — „Du hast für Probe am … noch nicht
  zugesagt", mit Direktlink. Zusätzlich am Vortag eine Zusammenfassung an alle Zusagenden
  (Ort, Uhrzeit, Probe-Agenda). Idempotent halten (Versand-Log-Tabelle), damit ein doppelter
  Cron-Lauf keine Doppel-Mails erzeugt.

- [ ] **Wochen-Digest**
  Sonntagabend eine Mail pro Mitglied: nächste Termine mit eigenem RSVP-Stand, neue
  Vorschläge **ohne meine Stimme**, was in der kommenden Probe auf der Agenda steht, neue
  Kommentare. Nur verschicken, wenn es etwas zu berichten gibt.

- [ ] **Getrennte Benachrichtigungs-Schalter**
  Heute ein einziges `notifyByEmail`-Flag für alles — wer Vorschlags-Spam abstellt, verpasst
  auch jeden Gig. Aufteilen in: Vorschläge · Kommentare · Termine · Erinnerungen · Digest.
  Schema-Migration + `/profil`-UI + `notifyBand()` um einen `kind`-Parameter erweitern.

- [ ] **„Band benachrichtigen" auch beim Bearbeiten von Terminen**
  Fehlt heute komplett (`components/event-forms.tsx:145`) — eine Gig-Verschiebung erreicht
  niemanden. Checkbox auch im Edit-Modus, Mail nennt explizit *was* sich geändert hat
  (alt → neu). Beim Anlegen sinnvollerweise per Default **an** statt aus.

- [ ] **Dashboard: „Was muss ich tun?"**
  Neuer Block ganz oben, vor allem anderen: offene Zu-/Absagen · Vorschläge ohne meine
  Stimme · Songs der nächsten Probe-Agenda, die ich noch nicht „kann" · neue Kommentare seit
  meinem letzten Besuch. **Alle Daten liegen schon in der DB** — es fehlt nur die Abfrage.
  Billigste große Wirkung im Projekt.

### Welle 2 — Bühnenwert *(das, was WhatsApp nie können wird)*

- [ ] **Chord-Sheet-Druck**
  Die Druckansicht zeigt heute nur Metadaten. Der eigentliche Wert — Lyrics und Akkorde —
  ist nirgends druckbar. Zwei Ausgaben: pro Song und für eine ganze Setliste (Seitenumbruch
  je Song, `break-inside: avoid`, Tabellenkopf wiederholen, optional transponiert).

- [ ] **Bühnenmodus**
  Vollbild-Ansicht einer Setliste: großer, kontrastreicher Text, Wischen/Pfeiltasten von Song
  zu Song, Wake Lock (Bildschirm bleibt an), Metronom eingeblendet. Macht das Tablet am
  Notenständer zum Grund, die App überhaupt zu öffnen.

- [ ] **Sets & Pausen in Setlisten**
  Set 1 / Pause / Set 2 als Strukturelemente mit Zwischensummen, plus Zielzeit-Abgleich
  („90 min gebucht, 78 min programmiert"). Häufigster echter Gig-Bedarf.

- [ ] **Gig-Logistik**
  Ein Gig hat heute nur Titel/Datum/Ort/Notizen. Ergänzen: Gage, Ansprechpartner + Telefon,
  Load-in, Soundcheck, Auftrittszeit, Anfahrt/Parken, Backline/Technik. Sonst landet genau
  das wieder in WhatsApp — im Moment des größten Nutzens.

### Welle 3 — Gedächtnis & Komfort

- [ ] **Repertoire-Gedächtnis**
  Pro Song: „zuletzt geprobt am …", „zuletzt gespielt am …", „x× auf Setlisten". Die
  `event_songs`- und `setlist_items`-Daten liegen bereits vor, werden aber nirgends
  zurückgespielt. Auf der Songseite anzeigen und in der Songliste sortierbar machen
  („am längsten nicht gespielt").
- [ ] **Anwesenheits-Statistik** über alle Proben (wer war wie oft da)
- [ ] **Browser-Audio-Aufnahme** (MediaRecorder) — Proberaum-Mitschnitt direkt am Song statt
  Datei-Transfer vom Handy. Unterschätzt: bester Grund, die App *während* der Probe offen zu haben.
- [ ] **Mitgliederverzeichnis für alle** (Name, Instrument, Kontakt) — heute Admin-only
- [ ] **Globale Suche** über Songs, Setlisten, Termine
- [ ] **Serien-Termine gesammelt bearbeiten** (z.B. Uhrzeit der ganzen Serie ändern)
- [ ] **Dubletten-Warnung** beim Songvorschlag („gibt's schon als …")
- [ ] Rückverweise auf der Songseite: in welchen Setlisten / Probe-Agenden kommt der Song vor
- [ ] Akkord-Diagramme / Capo-Rechner in der Lyrics-Ansicht

### Laufend — Konsistenz & Kleinkram

Kein eigenes Release; wird mitgenommen, wenn die betroffene Datei ohnehin angefasst wird.
Vollständige Liste mit Fundstellen in [docs/review-2026-07.md](docs/review-2026-07.md), Abschnitt 1.

- [ ] `htmlFor`/`id` an allen Formular-Labels (29 von 40 fehlen)
- [ ] Einheitliche Speicher-Rückmeldung (heute vier verschiedene Muster)
- [ ] Upload-Fehler beim Song-Anlegen nicht mehr verschlucken (`lib/actions/songs.ts:82`)
- [ ] RSVP-Kommentar ohne Statusklick geht verloren (`components/attendance.tsx:44`)
- [ ] Einheitliche Position für „Löschen" (heute drei verschiedene Stellen)
- [ ] Bestätigungsdialoge vereinheitlichen (u.a. Admin-Rechte vergeben ohne Rückfrage)
- [ ] Ikonografie: Emoji/Unicode durch das SVG-Set aus `components/icons.tsx` ersetzen
- [ ] „Leg **rechts** die erste an!" stimmt mobil nicht
- [ ] Singular/Plural („1 Songs")
- [ ] Setlisten-Liste: Suche/Sortierung, Trennung vergangen/kommend
- [ ] Termine: „Vergangene ausblenden"-Weg zurück
- [ ] `readyCount` zählt deaktivierte Mitglieder mit (`lib/queries.ts:40`)
- [ ] Dashboard verlinkt Setlisten nirgends
- [ ] Hilfe-Seite auf aktuellen Stand bringen (Passwort-Reset, Mitgliederverwaltung, Termin-Mails)

### Später / bei Bedarf

- [ ] Web-Push-Benachrichtigungen (statt/zusätzlich zu E-Mail)
- [ ] Login-Rate-Limit + Rate-Limit auf „Passwort vergessen" (Mail-Bombe gegen bekannte Adresse)
- [ ] Pro-Mitglied-Token für den ICS-Feed statt eines gemeinsamen (heute nur global widerrufbar)
- [ ] ICS-Zeilenfaltung nach RFC 5545 (75 Oktette)
- [ ] Uploads streamen statt komplett in den RAM zu lesen (`lib/files.ts:52`)
- [ ] Speicherplatz-Übersicht der Uploads
- [ ] Health-Check / Monitoring (heute merkt niemand, wenn SMTP oder der Prozess ausfällt)

### Offene Grundsatzentscheidung: Open Source ernst gemeint?

Das README lädt auf Englisch zu Beiträgen ein, das Projekt ist dafür aber nicht gerüstet:
UI komplett deutsch hartkodiert, kein i18n-Gerüst, deutsche Routen, kein Docker/Compose,
Installation über VPS + PM2 + nginx + Node-Versions-Jonglage, keine Tests.

Entweder **bewusst „mein Bandtool"** — dann die englische Einladung aus dem README nehmen und
diesen Abschnitt streichen. Oder **ernst gemeint** — dann sind Docker-Compose, ein i18n-Gerüst
und eine Test-Basis die Blocker, nicht weitere Features. Erst entscheiden, dann planen.

---

## ⚠️ Vor dem ersten echten Deployment beachten

1. `SESSION_SECRET` in `.env` setzen (sonst unsicheres Dev-Geheimnis)
2. Seed-Admin-Passwort ändern bzw. echten Admin anlegen und `admin@example.com` deaktivieren
3. `DATA_DIR` außerhalb des Deploy-Ordners legen + **Backup einrichten** (→ Welle 0)
4. `TZ` in `ecosystem.config.js` setzen, sonst stimmen die Zeitstempel nicht (→ Welle 0)
5. SMTP-Daten eintragen, wenn Mails gewünscht
6. Falls Reverse-Proxy (nginx/Apache) davor: Upload-Limit erhöhen (z.B. nginx `client_max_body_size 60m`), sonst scheitern Audio-Uploads
