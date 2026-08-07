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
- [x] **Update-Banner nach Deploy**: erkennt über eine Build-Kennung (`/api/version`), wenn
  der Server aktualisiert wurde, und bietet einen wegklickbaren „Neu laden"-Hinweis — prüft
  beim Zurückkehren in den Tab und alle paar Minuten, meldet sich nur bei echt neuer Version

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

- [x] **Automatisches Backup** — *erledigt 23.07.2026*
  `scripts/backup.sh` + `scripts/backup-db.js`: DB über die SQLite-Online-Backup-API
  (WAL-sicher), anschließend mit `PRAGMA integrity_check` geprüft, dazu `uploads.tar.gz`
  und ein `MANIFEST.txt` mit Zeilenzahlen. Unveränderte Uploads werden als Hardlink auf den
  Vorlauf gelegt statt neu gepackt. Rotation nach `RETENTION_DAYS` (35) mit Untergrenze
  `KEEP_MIN` (3). Sperre gegen Parallelläufe inkl. Erkennung verwaister Sperren,
  Aufräumen halbfertiger Läufe bei Abbruch. Cron-Beispiel im README.
  Dazu `scripts/restore.sh` mit Auswahl aus den vorhandenen Läufen, Umfang
  (alles/nur DB/nur Uploads), Differenz-Vorschau, getippter Bestätigung,
  Sicherheitsnetz-Backup und Kontrolle gegen das Manifest. Einmal vollständig
  durchgespielt — ein Backup, das nie zurückgespielt wurde, ist kein Backup.

- [x] **Pre-Migration-Snapshot in `deploy.sh`** — *erledigt 23.07.2026*
  `./scripts/backup.sh --label pre-deploy` läuft direkt vor `pm2 restart`, also bevor die
  Auto-Migration die DB anfasst. Schlägt er fehl, bricht das Deployment ab, bevor etwas
  verändert wurde (`SKIP_BACKUP=1` als bewusster Notausgang).

- [x] **Papierkorb statt hartem Löschen (Soft Delete)** — *erledigt 23.07.2026. Entwurf:
  [docs/specs/2026-07-23-papierkorb-design.md](docs/specs/2026-07-23-papierkorb-design.md)*
  `deletedAt`/`deletedById` auf `songs`, `setlists`, `events`, `attachments` (Kommentare
  bleiben bewusst Hartlöschung). Verweise aus Setlisten und Probe-Agenden bleiben stehen und
  werden nur ausgeblendet — dadurch ist Wiederherstellen trivial korrekt. `/papierkorb` für
  alle sichtbar (Footer-Link), 30 Tage Frist, endgültig löschen nur Admin. Zusätzlich ein
  „Rückgängig"-Band direkt nach dem Löschen und ein Löschdialog, der vorher nennt, in wie
  vielen Setlisten und Agenden der Song vorkommt. Dateien verlassen die Platte erst beim
  endgültigen Löschen. Aufräumen per `npm run trash:purge` (Cron) und beim Öffnen von
  `/papierkorb`. 27 Tests, per Mutationsprobe abgesichert.

- [x] **Löschen-Buttons auf Touchgeräten erkennbar machen** — *erledigt 23.07.2026*
  `.btn-danger` trägt jetzt dauerhaft rote Kontur und Schrift, Hover nur noch als
  Verstärkung. Neue Klasse `.link-danger` für die Text-/✕-Varianten in Listenzeilen, die
  dasselbe Problem hatten. In der Mitgliederverwaltung nur noch in der zerstörenden
  Richtung („Deaktivieren", nicht „Aktivieren").

- [x] **Zeitzone festnageln** — *erledigt 23.07.2026*
  `TZ` in `ecosystem.config.js` (Default `Europe/Vienna`, per Env überschreibbar),
  Hinweis im README unter „Vor dem Livegang".

- [x] **Minimaler Test-Rahmen** — *erledigt 23.07.2026*
  Vitest mit Test-DB in einem Temp-`DATA_DIR` (`tests/setup.ts`), Fixtures mit einem
  vollständigen Bandzustand und 14 Tests gegen `fetchSongList`, `fetchSongDetail`,
  `fetchSetlists` und `fetchEvents`. `npm test`. Per Mutationsprobe bestätigt, dass die
  Tests bei echten Fehlern anschlagen. Aus der Kür wurde eine Voraussetzung: der
  Papierkorb-Umbau berührt 26 Lesestellen, das ist nicht durchklickbar.

### Welle 1 — Aktivierung *(die App muss sich melden)*

> **Warum:** BandMate ist heute eine reine Pull-App — es passiert nur etwas, wenn jemand
> aktiv die Seite öffnet. Ohne Rückholkanal ist der typische Verlauf: Woche 1 begeistert,
> Woche 4 nur noch der Betreiber, Monat 3 tot.
>
> **Entwurf abgestimmt 23.07.2026:**
> [docs/specs/2026-07-23-benachrichtigungen-design.md](docs/specs/2026-07-23-benachrichtigungen-design.md)
> — System-Cron als Auslöser, Schalter je Ereignistyp (sofort/gesammelt/nie),
> Statuszeile fürs Admin-Dashboard, zwei Erinnerungen mit verschiedenem Zweck.
> Verschärft durch den Betrieb: Der SMTP-Versand war wochenlang still kaputt. Bei
> Erinnerungen wäre das schlimmer als heute — dann verlässt sich die Band darauf.

- [x] **Kalender-Erinnerungen (`VALARM`) im ICS-Feed** — *erledigt 23.07.2026*
  Zwei Alarme je Termin mit Uhrzeit (Vortag zur selben Zeit, zwei Stunden vorher), einer
  bei ganztägigen (mittags am Vortag — `-P1D` wäre dort Mitternacht). Native
  Handy-Erinnerung ohne Berechtigung, ohne Service Worker, unabhängig vom Mailversand.
  Dabei zusätzlich die RFC-5545-Zeilenfaltung nachgeholt, die vorher fehlte.
  10 Tests für `buildIcs`, per Mutationsprobe abgesichert.

- [x] **Erinnerungs-Mail vor Terminen** — *erledigt 23.07.2026*
  `npm run notify:reminders` (Cron): zwei Tage vorher an Unentschiedene, am Vortag an
  Zusagende (mit Ort, Zeit, Agenda). Idempotent über das Versand-Log
  (`notification_log`, Unique-Index je Empfänger/Termin/Sorte); ein Fehlversuch blockiert
  den nächsten Lauf nicht. Jeder Lauf wird in `notification_runs` festgehalten — Grundlage
  für die Statuszeile aus dem nächsten Häppchen. 12 Tests, per Mutationsprobe abgesichert.

- [x] **Wochen-Digest** — *erledigt 23.07.2026*
  `npm run notify:digest` (Cron, So 18:00 im Dispatcher): offene Punkte + „gesammelt"-Posten
  der letzten 7 Tage je nach Einstellungen. Idempotent je ISO-Woche, leer = keine Mail,
  pro Mitglied abschaltbar. 8 Tests, per Mutationsprobe abgesichert, gegen Mailpit geprüft.

- [x] **Getrennte Benachrichtigungs-Schalter** — *erledigt 23.07.2026*
  Matrix `(Mitglied × Ereignistyp × Kanal)` mit drei Stufen (sofort/gesammelt/nie), UI auf
  `/profil` und `/mitglieder`, `notifyBand()` filtert nach `kind`. Gespeichert werden nur
  Abweichungen vom Standard — ein später ergänzter Ereignistyp bekommt dadurch ohne
  Nachmigration einen sinnvollen Wert. Die `channel`-Spalte steht schon bereit, damit Web
  Push ohne zweite Schema-Migration dazukommt. Migration 0005/0006 überführt den alten
  `notifyByEmail`-Schalter; gegen eine Kopie der echten Daten geprüft.
  13 Tests, per Mutationsprobe abgesichert.

- [x] **„Band benachrichtigen" auch beim Bearbeiten von Terminen** — *erledigt 23.07.2026*
  Checkbox im Edit-Modus (vorausgewählt), Mail nur bei Änderung von Datum/Uhrzeit/Ort mit
  konkretem alt → neu. Titel/Notiz/Setliste lösen nichts aus. Beim Anlegen jetzt Default an.
  Reine, testbare Änderungserkennung (`lib/event-notify.ts`), gegen Mailpit Ende-zu-Ende
  geprüft.

- [x] **Statuszeile für Admins** (Teil des Dashboards) — *erledigt 23.07.2026*
  Zeigt den letzten Erinnerungs-Lauf aus `notification_runs`, wird ab 2 Tagen ohne Lauf
  oder bei Fehlern auffällig. Das Sicherheitsnetz zum Cron-Dispatcher.

- [x] **Dashboard: „Was für dich ansteht"** — *erledigt 23.07.2026*
  Block ganz oben mit offenen Zu-/Absagen (14 Tage), ungestimmten Vorschlägen, ungeübten
  Agenda-Songs und neuen Kommentaren seit dem letzten Besuch (`lastSeenAt`). Verschwindet,
  wenn nichts offen ist. `lib/todo.ts`, 15 Tests, per Mutationsprobe abgesichert.

### Welle 2 — Bühnenwert *(das, was WhatsApp nie können wird)*

- [ ] **Chord-Sheet-Druck**
  Die Druckansicht zeigt heute nur Metadaten. Der eigentliche Wert — Lyrics und Akkorde —
  ist nirgends druckbar. Zwei Ausgaben: pro Song und für eine ganze Setliste (Seitenumbruch
  je Song, `break-inside: avoid`, Tabellenkopf wiederholen, optional transponiert).

- [x] **Bühnenmodus** — *erledigt 27.07.2026. Entwurf:
  [docs/superpowers/specs/2026-07-27-buehnenmodus-design.md](docs/superpowers/specs/2026-07-27-buehnenmodus-design.md)*
  Vollbild-Ansicht einer Setliste (`/setlisten/[id]/buehne`), die die Elemente **1:1 als
  Seitenfolge** abbildet — Songs, Set-Überschriften und Pausen. Blättern per **Wischen und
  Pfeiltasten/Leertaste**, **Wake Lock** (Bildschirm bleibt an, erneuert bei Tab-Rückkehr).
  Je Song standardmäßig die **Noten des eigenen Instruments** (aus dem Profil), umschaltbar
  auf andere Instrumente oder **Lyrics/Akkorde**; die Wahl „klebt" über die Songs. PDFs
  eingebettet mit iOS-Fallback („in neuem Tab öffnen"). **Metronom fix eingeblendet**, auf die
  Song-BPM vorbelegt; **Transponieren** (flüchtig) und **Schriftgröße** in einer wegblendbaren
  Werkzeugleiste. Pausen-Seite mit **Countdown** (startet auf Tipp, zählt über null ins Rote)
  und „Weiter mit …". Metronom-Scheduler in den Hook `useMetronome` ausgelagert (vom
  bestehenden Widget mitgenutzt). Rein lesend, kein Schema-Eingriff.
  Dazu ein Umschalter **„Voll ⇄ Notenpult"**: die Minimal-Ansicht für Mitglieder mit
  physischen Noten zeigt den aktuellen Ablaufpunkt groß (Titel, Tonart/Capo/Tempo, Notiz +
  Metronom bzw. Pausen-Countdown) plus die **nächsten zwei Elemente** als Vorschau; pro Gerät
  gemerkt. Reine Logik `lib/stage.ts` mit Tests.

- [x] **Sets & Pausen in Setlisten** — *erledigt 26.07.2026. Entwurf:
  [docs/superpowers/specs/2026-07-26-sets-und-pausen-design.md](docs/superpowers/specs/2026-07-26-sets-und-pausen-design.md)*
  Benannte **Set-Überschriften** und **Pausen** (Dauer + optionales Label) als eigene
  Element-Typen in einer geordneten Liste (`kind` in `setlist_items`, `songId` nullable).
  Zwischensummen je Set, Song-Nummern je Set neu, Fuß mit **Musik / Pausen / Gesamt** und
  **Zielzeit-Abgleich** (`targetSeconds` an der Setliste, Musik + Pausen gegen die gebuchte
  Spielzeit, Ampel). Editor (Drag&Drop über alle Typen) und Druckansicht bilden es ab.
  Reine Logik `lib/setlist-structure.ts` mit 10 Tests. Migration (Tabellen-Rebuild) gegen
  eine Kopie der echten DB verifiziert — kein Datenverlust.

- [x] **Gig-Logistik** — *erledigt 26.07.2026. Entwurf:
  [docs/superpowers/specs/2026-07-26-gig-logistik-design.md](docs/superpowers/specs/2026-07-26-gig-logistik-design.md)*
  Acht Felder nur bei Gigs: `startTime` = **Load-in** (Anker für Kalender & Erinnerung),
  dazu **Soundcheck** und **Auftritt** als Zusatzzeiten, **Ansprechpartner + Telefon**
  (auf der Detailseite als `tel:`-Link antippbar), **Gage** als Zahl (`real`, summierbar)
  plus **Verpflegung & Extras**, **Anfahrt/Parken** und **Backline/Technik** als Freitext.
  Logistik-Karte zuoberst auf der Termin-Detailseite (nur befüllte Zeilen). Geänderte
  Soundcheck-/Auftrittszeit löst die „Band benachrichtigen"-Mail aus (Gage/Kontakt/Anfahrt/
  Backline bewusst nicht). Der ICS-Feed bekommt bei Gigs einen Logistik-Block in der
  `DESCRIPTION` und `DTEND` bis Auftritt + 2 h. Nebenbei alle Labels im Terminformular mit
  `htmlFor`/`id` (Teil von „Konsistenz & Kleinkram" F1). Neue Tests für `describeEventChanges`,
  `buildIcs` und `formatFee`.

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

- [x] `htmlFor`/`id` an allen Formular-Labels — *erledigt 07.08.2026: letzte 21 Fundstellen
  in `event-forms.tsx`, `setlist-forms.tsx`, `song-form.tsx` und `member-admin.tsx`
  nachgezogen (Letzteres mit Mitglieds-ID im `id`, da das Formular pro Zeile wiederholt
  wird). Die reinen Gruppen-Überschriften (Links-Sektion) sind jetzt `<h3>` statt `<label>`,
  wie es das Projekt bei „Benachrichtigungen" schon vormacht.*
- [x] Einheitliche Speicher-Rückmeldung — *erledigt 07.08.2026: Kommentar-Absenden zeigt
  jetzt „Kommentar gesendet." (`lib/actions/interactions.ts`); die Onblur-Autospeicher ohne
  eigenen Button (RSVP-Kommentar, Setlisten-Notiz/Set-Name/Pausenfelder) blenden kurz
  „✓ gespeichert" ein (`useSavedHint`/`SavedHint` in `components/form.tsx`). Redirect-Formulare
  (Song/Termin/Setliste anlegen/bearbeiten) bleiben als eigenes, bewusstes Muster bestehen.*
- [x] Upload-Fehler beim Song-Anlegen nicht mehr verschlucken — *erledigt 07.08.2026:
  `lib/actions/songs.ts` reicht einen Fehlschlag als `?upload_error=1` an die Detailseite
  durch, die daraus einen Hinweis-Banner zeigt statt nur `console.error`*
- [x] RSVP-Kommentar ohne Statusklick geht verloren — *erledigt 07.08.2026:
  `components/attendance.tsx` sperrt das Kommentarfeld, bis eine Zu-/Absage gewählt ist
  (Platzhalter „Erst zu-/absagen, dann kommentieren"), statt den Text beim Blur stillschweigend
  zu verwerfen*
- [x] Einheitliche Position für „Löschen" — *erledigt 07.08.2026: bei Song, Setliste und
  Termin jetzt einheitlich im Kopf neben „Bearbeiten" (`components/song-actions.tsx` in
  `DeleteSongButton` von den Status-Buttons getrennt, `DeleteEventButtons` vom Seitenende
  nach oben verschoben; Setliste war dort schon)*
- [x] Bestätigungsdialoge vereinheitlichen — *erledigt 07.08.2026: Admin-Rechte **vergeben**
  fragt jetzt nach („Admin entz." bleibt wie das Deaktivieren-Muster ohne Rückfrage die
  ungefährliche Richtung), `components/member-admin.tsx`. Song/Setliste/Termin/Datei/
  Kommentar-Löschen hatten schon Rückfragen. Song/Agenda aus Setliste bzw. Probe-Agenda
  entfernen bewusst ohne Rückfrage gelassen — ein Klick zum Wiederherstellen über die
  Dropdown-Auswahl, anders als bei den harten Löschvorgängen.*
- [x] Ikonografie: Emoji/Unicode durch das SVG-Set aus `components/icons.tsx` ersetzen —
  *erledigt 07.08.2026: die 12 im Review gelisteten Symbole (🖨 ⧉ ⠿ 𝄞 ♫ 💬 ↻ ✎ ✕ 👍 👎)
  über 15 Dateien ersetzt, `components/icons.tsx` um `IconEdit/IconPrint/IconCopy/IconClose/
  IconThumbsUp/IconThumbsDown/IconMusicNote/IconSheet/IconComment/IconGrip/IconExpand`
  ergänzt. Bewusst ausgenommen: ✓/✗/? (Zu-/Absage-Symbole aus `ATTENDANCE_STATUS`,
  Zähler-Häkchen) sowie ▶/■ (Metronom/Bühnenmodus-Transportsymbole) — beide standen nicht
  auf der Review-Liste, sind universell lesbar und ✓/✗ hängen an einer zentralen
  Konstante mit vielen Verwendungsstellen; eigener Punkt bei Bedarf.*
- [x] „Leg **rechts** die erste an!" stimmt mobil nicht — *erledigt 26.07.2026: Anlegen
  bei Terminen und Setlisten jetzt über „+ Neuer …" auf eigener Seite (`/termine/neu`,
  `/setlisten/neu`), Bearbeiten analog auf `/…/[id]/bearbeiten`, Detailseiten schlank*
- [x] Singular/Plural („1 Songs") — *bereits erledigt (vermutlich im Zuge von 1.12.0),
  verifiziert 07.08.2026 in `components/setlist-editor.tsx`*
- [x] Setlisten-Liste: Suche/Sortierung, Trennung vergangen/kommend — *erledigt 26.07.2026*
- [x] Termine: „Vergangene ausblenden"-Weg zurück — *erledigt 26.07.2026*
- [x] `readyCount` zählt deaktivierte Mitglieder mit — *erledigt 07.08.2026: Subquery in
  `lib/queries.ts` und `app/(app)/termine/[id]/page.tsx` joint jetzt gegen `users.active`,
  wie es `memberCount` bereits tat*
- [x] Dashboard verlinkt Setlisten nirgends — *erledigt 07.08.2026: neue Sidebar-Sektion
  „Setlisten" mit den nächsten anstehenden (Vorbild „Nächste Termine")*
- [ ] Hilfe-Seite auf aktuellen Stand bringen — *Stand 07.08.2026: Passwort-Reset steht
  inzwischen drin, es fehlen aber weiterhin Mitgliederverwaltung, Bühnenmodus, Sets & Pausen,
  Gig-Logistik und die Benachrichtigungs-Einstellungen aus Welle 1/2*

### Später / bei Bedarf

- [ ] **Web-Push-Benachrichtigungen** (zusätzlich zu E-Mail, nicht statt)
  Machbar und nicht besonders komplex (~300–400 Zeilen mit `web-push`), aber zwei harte
  Einschränkungen: Auf iOS funktioniert Push **nur**, wenn die Seite vorher über „Zum
  Homescreen hinzufügen" installiert wurde — sonst bekommt die Person stillschweigend
  nichts. Und eine einmal abgelehnte Berechtigung lässt sich nicht erneut erfragen.
  Damit ist Push die unzuverlässigere Zustellung, nicht die zuverlässigere. Die
  `channel`-Spalte aus Welle 1 hält den Platz frei, sodass es ohne zweite
  Schema-Migration dazukommt.
- [ ] Login-Rate-Limit + Rate-Limit auf „Passwort vergessen" (Mail-Bombe gegen bekannte Adresse)
- [ ] Pro-Mitglied-Token für den ICS-Feed statt eines gemeinsamen (heute nur global widerrufbar)
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
