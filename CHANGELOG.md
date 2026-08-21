# Changelog

Alle nennenswerten Änderungen an BandMate. Format nach
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/) — siehe [RELEASING.md](RELEASING.md).

## [Unreleased]

_Noch nichts._

## [1.22.0] — 2026-08-21

### Geändert
- **Profilseite neu strukturiert**: Layout jetzt wie bei Equipment (Grid mit schmaler
  Seitenspalte rechts). Stammdaten und Benachrichtigungen sind getrennte Cards, die
  Formulare nutzen die volle verfügbare Breite statt der bisherigen `max-w-2xl`-Begrenzung.

### Hinzugefügt
- **„Meine Beteiligungen" auf der Profilseite**: Liste der eigenen Equipment-Kostenbeteiligungen
  mit Summe, jeder Eintrag verlinkt zum jeweiligen Gerät.
- **„Über dich" auf der Profilseite**: zeigt Beitrittsdatum und die eigene Anwesenheitsquote
  bei Proben.

## [1.21.2] — 2026-08-21

### Geändert
- **Sichtbarer Schatten an der Floating-Navigationsleiste**: Der bisherige `shadow-xl`
  war auf dem dunklen Hintergrund praktisch unsichtbar (schwarzer Schatten). Die Bar
  bekommt jetzt einen dezenten hellen Glow, der sie klarer vom Hintergrund abhebt.

## [1.21.1] — 2026-08-21

### Geändert
- **Mitglieder- und Papierkorb-Seite auf volle Breite**: Die Listen nutzen jetzt wie
  Songs/Termine/Equipment die volle Inhaltsbreite statt der bisherigen `max-w-3xl`-Begrenzung.
  Die Formulare auf der Mitglieder-Seite (Neues Mitglied, SMTP-Test) bleiben bewusst schmal.

## [1.21.0] — 2026-08-21

### Geändert
- **Navigation als schwebende Bottom-Leiste**: Die obere Leiste entfällt komplett; die
  Navigation schwebt jetzt zentriert am unteren Bildschirmrand — am Handy in Daumenreichweite,
  nur mit Icons, am Desktop mit Icon + Beschriftung. Der bisherige Footer-Link „Papierkorb"
  ist mit umgezogen.

### Hinzugefügt
- **Menü-Popup** rechts in der Bottom-Leiste: bündelt Profil, Hilfe, Papierkorb und Logout
  hinter einem Button (öffnet nach oben, schließt per Escape oder Klick daneben).
- **Band-Logo auf dem Dashboard**: ersetzt den bisherigen „BandMate"-Schriftzug der oberen
  Leiste durch Icon + Schriftzug oben auf der Startseite.

## [1.20.0] — 2026-08-20

### Hinzugefügt
- **Equipment-Verwaltung**: Neuer Bereich `/equipment` für gemeinsam angeschafftes
  Band-Equipment. Stammdaten (Kategorie, Zustand, Anschaffungsdatum/-kosten, Standort,
  Notizen), frei eintragbare Kostenbeteiligungen einzelner Mitglieder inkl. Vermerk und
  Live-Summenabgleich, dazu ein „Anteil Bandkasse"-Feld für ganz oder teilweise aus der
  Kasse finanzierte Anschaffungen — die Offen-Berechnung bleibt dadurch auch bei
  Kassa-Finanzierung korrekt. Foto-Upload (auch direkt per Smartphone-Kamera) und
  Rechnungs-Upload je Gerät, eigene Datei-Ablage parallel zu den Song-Anhängen. Liste mit
  Kategorie-/Status-Filter und Suche (auch über den Standort), Kategorie-Icons statt Text
  für gleichmäßige Zeilenausrichtung unabhängig von der Namenslänge. Vollständig ins
  bestehende Papierkorb-System integriert (löschen, wiederherstellen, endgültig
  entfernen). Neuer Navigationspunkt „Equipment".

## [1.19.4] — 2026-08-13

### Geändert
- **Bestätigungsdialog vor Logout**: der Abmelden-Button (mobil & Desktop) fragt jetzt
  vor dem Ausloggen nach — verhindert versehentliches Abmelden bei Fehlklick.

## [1.19.3] — 2026-08-13

### Geändert
- **Bühnenmodus-Umschalter (Voll/Notenpult) an Druckansicht-Optik angeglichen**: zeigt jetzt
  wie der „Vollständig/Kompakt"-Umschalter der Druckansicht eine volle Amber-Pille für den
  aktiven Tab statt der bisherigen transparenten Einfärbung — beide Umschalter wirken jetzt
  als dieselbe Komponentenfamilie. Touch-Fläche und Layout unverändert.

## [1.19.2] — 2026-08-12

### Behoben
- **„Drucken / PDF"-Button umbrach mobil**: in der Setlisten-Druckansicht (vollständig und
  kompakt) zeigt der Button auf schmalen Bildschirmen jetzt nur noch das Drucker-Icon statt
  den Text zweizeilig umzubrechen — Text erscheint wie beim Bühnenmodus-Muster erst ab
  Tablet-Breite.

## [1.19.1] — 2026-08-12

### Behoben
- **Bühnenmodus-Kopfzeile lief bei Smartphone-Breite über**: durch die größeren
  Touch-Targets aus v1.19.0 passte die Kopfzeile bei längeren Setlisten nicht mehr auf
  einen Blick ins Display — der „Beenden"-Button war ohne Scrollen kaum oder gar nicht
  erreichbar. Der Voll/Notenpult-Umschalter zeigt auf dem Handy jetzt nur noch Icons
  (Text erst ab Tablet-Breite, wie schon beim „Beenden"-Button), zusätzlich etwas
  schlankeres Padding bei Vollbild/Beenden — die Kopfzeile passt dadurch wieder ohne
  Scrollen komplett ins Display.

## [1.19.0] — 2026-08-12

### Hinzugefügt
- **Kompakte Druckansicht für Setlisten**: Neben der bestehenden vollständigen Druckansicht
  gibt es jetzt eine zweite, platzsparendere Variante (`/setlisten/[id]/druck-kompakt`) —
  nur Tonart und Tempo statt aller Spalten, engerer Zeilenabstand, damit deutlich mehr Songs
  auf eine Seite passen. Praktisch als Spickzettel am Notenständer oder für einen sparsameren
  Ausdruck fürs ganze Team. Ein Umschalter „Vollständig · Kompakt" direkt auf der Druckseite
  wechselt zwischen beiden Ansichten; die Setlisten-Detailseite selbst bleibt unverändert mit
  einem einzigen Druck-Link.

## [1.18.0] — 2026-08-11

### Hinzugefügt
- **Browser-Audio-Aufnahme**: Proberaum-Mitschnitte lassen sich jetzt direkt an einem Song
  aufnehmen, statt eine Datei vom Handy hochladen zu müssen — Overlay mit Aufnehmen →
  Vorhören/Benennen (Vorschlag „Songtitel JJJJ-MM-TT HH:MM") → Speichern/Verwerfen. Die
  Aufnahme wird serverseitig per ffmpeg immer echt zu OGG/Opus transkodiert (48 kbps), damit
  sie platzsparend abgelegt wird — unabhängig vom Browser-Ausgangsformat (Chrome/Firefox
  liefern WebM+Opus, Safari/iOS MP4+AAC) und ohne Änderung an bestehenden Upload-Limits.
  Aufnahmen sind in der Dateiliste am Mikro-Icon von normalen Uploads unterschieden.

## [1.17.0] — 2026-08-11

### Hinzugefügt
- **Dashboard: „Nächste Probe & Gig"**: der Block „Was für dich ansteht" zeigt jetzt
  ganz oben zusätzlich die zeitlich nächste Probe und den nächsten Gig — mit
  Probe-Agenda bzw., falls keine Agenda existiert, der verknüpften Setliste (Name +
  Songzahl). Reine Information unabhängig vom eigenen Übe-Status. Der Block
  verschwindet dadurch nicht mehr ganz, wenn sonst nichts offen ist — Sichtbarkeit auf
  dem Handy (Hauptnutzung von BandMate) war hier wichtiger als das bisherige „nur wenn
  was offen ist".

## [1.16.0] — 2026-08-10

**Welle 3, vier weitere Häppchen.** Anwesenheits-Statistik, Serien-Termine im Bulk
bearbeiten, ein Capo-Rechner in der Lyrics-Ansicht sowie Termine-Suche statt einer vollen
globalen Suche.

### Hinzugefügt
- **Anwesenheits-Statistik**: neue Karte auf „Mitglieder" (für alle Rollen sichtbar) —
  Zu-/Absagen/Vielleicht je aktivem Mitglied aus allen vergangenen Proben, dazu eine Quote
  (Zusagen ⁄ (Zusagen+Absagen), „Vielleicht" und offene Rückmeldungen zählen nicht mit).
- **Serien-Termine gesammelt bearbeiten**: neue Seite „Serie bearbeiten" an jedem
  Serientermin — Uhrzeit, Ort und Notizen für alle kommenden Termine der Serie auf einmal
  ändern, vergangene Termine bleiben unangetastet.
- **Capo-Rechner in der Lyrics-Ansicht**: Capo-Auswahl in der Transponieren-Werkzeugleiste
  (Songseite und Bühnenmodus) zeigt die zu greifenden Akkorde bei gewähltem Capo-Bund.
- **Termine-Suche**: „Termine" hat jetzt dieselbe Titel-/Ort-Suche wie Songs und
  Setlisten.

### Geändert
- **„Globale Suche" aus der Roadmap gestrichen** — eine echte seitenübergreifende Suche
  über Songs/Setlisten/Termine wurde bewusst nicht gebaut (zu wenig Mehrwert bei dieser
  Bandgröße), Termine-Suche schließt die eigentliche Lücke stattdessen.

## [1.15.0] — 2026-08-07

**Konsistenz & Kleinkram.** Die „Laufend"-Liste aus FEATURES.md abgearbeitet: drei echte
Bugs behoben, dazu Speicher-Rückmeldung, Löschen-Position, Bestätigungsdialoge und
Ikonografie über die ganze App vereinheitlicht.

### Hinzugefügt
- **Dashboard verlinkt jetzt Setlisten**: neue Sidebar-Sektion „Setlisten" mit den
  nächsten anstehenden — bisher ein Hauptmenüpunkt ohne jede Erwähnung auf der
  Startseite.

### Geändert
- **Dashboard-Sektionen einheitlich dargestellt**: „Setlisten", „Nächste Termine" und
  „Zuletzt im Bandchat" steckten bisher zusammen mit der Überschrift in einer einzigen
  Karte; „Heiße Vorschläge" und „Gerade in Probe" zeigten die Überschrift frei darüber
  und jede Zeile als eigene Karte. Alle fünf Sektionen folgen jetzt demselben Muster.
- **Alle Formular-Labels haben jetzt `htmlFor`/`id`**: Anklicken eines Labels fokussiert
  jetzt zuverlässig das zugehörige Feld, Screenreader haben einen Bezug. Betraf zuletzt
  Termin-, Setlisten-, Song- und Mitgliederformulare.
- **Speicher-Rückmeldung vereinheitlicht**: Kommentare zeigen nach dem Absenden jetzt
  eine Bestätigung; Felder, die beim Verlassen automatisch speichern (RSVP-Kommentar,
  Setlisten-Notizen, Set-Namen, Pausendauer), blenden kurz „✓ gespeichert" ein statt
  kommentarlos zu speichern.
- **„Löschen" jetzt an derselben Stelle**: bei Song, Setliste und Termin steht der
  Löschen-Button jetzt einheitlich im Kopf neben „Bearbeiten" — bei Terminen stand er
  bisher ganz unten auf der Seite, beim Song zwischen den Status-Buttons.
- **Admin-Rechte vergeben fragt jetzt nach**: bisher lief das ohne jede Rückfrage, obwohl
  es die einzige sicherheitsrelevante Aktion ohne Bestätigung war — Entziehen bleibt
  bewusst ohne Rückfrage (die ungefährliche Richtung).
- **Emoji/Unicode-Icons durch das SVG-Set ersetzt**: Drucker-, Bearbeiten-, Duplizieren-,
  Schließen-, Daumen-, Noten- und Kommentar-Symbole rendern jetzt als Strich-Icons statt
  als Emoji, die je nach Gerät unterschiedlich oder gar nicht dargestellt wurden (u.a.
  betroffen: Notenblatt-Symbol 𝄞, Ziehgriff ⠿ in der Setlisten-Sortierung).

### Behoben
- **Upload-Fehler beim Song-Anlegen wird nicht mehr verschluckt**: Schlägt ein Noten-
  oder Audio-Upload beim Anlegen eines Songs fehl, zeigt die Detailseite jetzt einen
  Hinweis-Banner statt den Fehler nur ins Server-Log zu schreiben.
- **RSVP-Kommentar ging ohne Statusklick verloren**: Das Kommentarfeld bei „Bist du
  dabei?" ist jetzt gesperrt, bis eine Zu-/Absage gewählt wurde — vorher verschwand ein
  getippter Kommentar beim Verlassen des Felds stillschweigend, wenn noch kein Status
  gesetzt war.
- **`readyCount` zählte deaktivierte Mitglieder mit**: Die „✓ x/y können's"-Anzeige bei
  Songs und in der Probe-Agenda konnte dadurch mehr Zusagen zeigen als aktive
  Mitglieder existieren. Zählt jetzt wie `memberCount` nur aktive Mitglieder.

## [1.14.2] — 2026-07-28

### Behoben
- **Bühnenmodus auf dem Handy** — Kopf- und Fußzeile für kleine Displays optimiert.
  In der Kopfzeile verrutschten Elemente (die Seitenzahl brach um): jetzt bleibt alles in
  einer Zeile, der „Beenden"-Button zeigt mobil nur das **✕** (Text erst auf größeren
  Schirmen), und der Setlisten-Name wird auf dem Handy ausgeblendet. In der Fußzeile wurde
  Text (z.B. „Schrift") an der abgerundeten Display-Kante abgeschnitten — die Bühnen-Route
  respektiert jetzt die **iOS-Safe-Area** (`viewport-fit=cover` plus Insets an Kopf- und
  Fußzeile); der Rest der App bleibt unberührt.

## [1.14.1] — 2026-07-28

### Behoben
- **Hydration-Warnung im Setlisten-Editor**: Der Drag-&-Drop-Kontext (dnd-kit) erzeugte
  die `aria-describedby`-IDs der Ziehgriffe über einen modul-globalen Zähler, der zwischen
  Server- und Client-Render abwich — React meldete einen Hydration-Mismatch. Der `DndContext`
  bekommt jetzt eine stabile ID (`useId`); Server und Client stimmen wieder überein. Kein
  sichtbarer Funktionsfehler, aber die Warnung ist weg und der betroffene Teilbaum wird
  wieder sauber hydriert.

## [1.14.0] — 2026-07-27

**Welle 2 — Bühnenmodus.** Das Tablet am Notenständer wird zum Grund, die App
während des Auftritts offen zu haben: eine Setliste als Vollbild-Ablauf, großer
kontrastreicher Inhalt, Metronom je Song, Bildschirm bleibt an.

### Hinzugefügt
- **Bühnenmodus** („▶ Bühnenmodus" auf der Setliste): Vollbild-Ansicht, die die
  Setliste **1:1 als Seitenfolge** abbildet — Songs, Set-Überschriften und Pausen.
  Blättern per **Wischen und Pfeiltasten/Leertaste**, **Wake Lock** (Bildschirm
  bleibt an, erneuert bei Tab-Rückkehr). Je Song die **Noten des eigenen
  Instruments** (aus dem Profil), umschaltbar auf andere Instrumente oder
  **Lyrics/Akkorde**; die Wahl „klebt" über die Songs. PDFs eingebettet mit
  iOS-Fallback. **Metronom** fix eingeblendet und auf die Song-BPM vorbelegt,
  **Transponieren** (flüchtig) und **Schriftgröße** in einer wegblendbaren
  Werkzeugleiste. Pausen mit **Countdown** (startet auf Tipp, zählt über null ins
  Rote) und „Weiter mit …".
- **Notenpult-Ansicht**: Umschalter „Voll ⇄ Notenpult" für Mitglieder mit
  physischen Noten — zeigt den aktuellen Ablaufpunkt groß (Titel, Tonart/Capo/Tempo,
  Notiz + Metronom bzw. Pausen-Countdown) plus die **nächsten zwei Elemente** als
  Vorschau; pro Gerät gemerkt.

> Rein lesend, keine DB-Änderung — `./deploy.sh` genügt.

## [1.13.0] — 2026-07-27

**Update-Hinweis nach Deploy.** Kleine Politur mit Wirkung fürs Vertrauen: Läuft
noch ein alter Tab, während eine neue Version deployt wird, meldet sich die App
jetzt — statt still auf dem alten Stand weiterzulaufen (und im schlimmsten Fall
eine Aktion gegen den neuen Server zu schicken, die fehlschlägt).

### Hinzugefügt
- **Update-Banner**: Über eine Build-Kennung (Endpunkt `/api/version`) erkennt die
  App, wenn der Server auf eine neue Version aktualisiert wurde, und zeigt oben
  einen dezenten, **wegklickbaren** Hinweis „Neue Version verfügbar — neu laden".
  Geprüft wird, wenn der Tab wieder in den Fokus kommt, und zusätzlich alle paar
  Minuten. Weggeklickt bleibt der Hinweis weg, bis eine **noch neuere** Version
  auftaucht — nervt also nicht. Kein Service Worker nötig (ein normaler Reload
  holt den content-gehashten Build), keine DB-Änderung.

> **Hinweis:** Dieser Release ist der „Bootstrap" — die bereits geladenen Tabs
> der Band haben den Wächter noch nicht. Sichtbar wird der Banner deshalb erst
> **ab dem nächsten** Deploy. `./deploy.sh` genügt, keine Migration dabei.

## [1.12.0] — 2026-07-26

**Welle 2 — Bühnenwert (Auftakt).** Das, was WhatsApp nie kann: Gigs und Setlisten
für den echten Auftritt. Ein Gig hält jetzt die Logistik fest, die sonst im Gruppenchat
verlorengeht, und eine Setliste lässt sich in Sets und Pausen gliedern und gegen die
gebuchte Spielzeit abgleichen. Nebenbei ist das Anlegen und Bearbeiten über Songs,
Termine und Setlisten hinweg einheitlich geworden.

### Hinzugefügt
- **Gig-Logistik**: Termine vom Typ „Gig" haben jetzt eigene Felder für **Load-in,
  Soundcheck und Auftrittszeit**, **Ansprechpartner + Telefon** (am Handy antippbar
  zum Anrufen), **Gage** (Zahl, später summierbar) plus **Verpflegung & Extras**,
  **Anfahrt/Parken** und **Backline/Technik**. Auf der Detailseite steht das als
  „Gig-Logistik"-Karte ganz oben; bei einem Gig ist die Termin-Uhrzeit das **Load-in**
  (Anker für Kalender-Erinnerung und Erinnerungs-Mail). Geänderte Soundcheck- oder
  Auftrittszeit löst die „Band benachrichtigen"-Mail aus; Gage/Kontakt/Anfahrt tun das
  bewusst nicht. Der Kalender-Feed nimmt die Logistik in die Termin-Beschreibung mit und
  spannt den Eintrag bis zum Auftritt.
- **Sets & Pausen in Setlisten**: eine Setliste lässt sich jetzt mit benannten
  **Set-Überschriften** und **Pausen** (Dauer + optionalem Label) gliedern — alles per
  Drag & Drop in einer Liste. Jedes Set zeigt seine **Zwischensumme** (Songs · Dauer),
  die Song-Nummern starten je Set neu, und der Fuß rechnet **Musik / Pausen / Gesamt**.
  Mit einer optionalen **Zielzeit** (gebuchte Spielzeit) an der Setliste kommt ein
  **Abgleich** dazu („Ziel 90:00 → 12:00 über"). Die Druckansicht bildet Sets, Pausen
  und den Zeit-Fuß mit ab.

### Geändert
- **Einheitliches Anlegen & Bearbeiten**: Termine und Setlisten werden jetzt — wie
  Songs — über einen **„+ Neu"-Button** auf einer **eigenen Seite** angelegt und über
  **„✎ Bearbeiten"** auf einer eigenen Seite bearbeitet, statt über ein Formular in der
  Seitenleiste. Die Listen laufen dadurch über die volle Breite; kein Runterscrollen
  mehr zum Anlegen. Die Termin-Detailseite ist damit eine reine Leseansicht.
- **Setlisten-Liste** bekommt **Suche**, **Sortierung** (Datum/Name/Songs) und eine
  Trennung in **kommende und vergangene** Setlisten (vergangene einklappbar).
- Die **„Kalender abonnieren"-Box** sitzt jetzt als Dropdown in der Termine-Kopfzeile
  (mit Icon statt Emoji) statt in der Seitenleiste.
- Kleinkram aus der Konsistenz-Liste mitgenommen: „← Vergangene ausblenden" bei
  Terminen, korrektes „1 Song" statt „1 Songs" im Setlisten-Fuß, `htmlFor` an mehr
  Formular-Labels.

> **Hinweis fürs Update:** Dieser Release bringt zwei automatische DB-Migrationen mit
> — eine additive (Gig-Logistik-Felder) und einen **Tabellen-Rebuild** von
> `setlist_items` (für Sets/Pausen; bestehende Daten werden kopiert, nichts geht
> verloren). Beide laufen beim App-Start; `./deploy.sh` zieht davor automatisch ein
> Pre-Deploy-Backup. `./deploy.sh` genügt, kein manueller Eingriff nötig.

## [1.11.0] — 2026-07-24

**Welle 1 — Aktivierung.** BandMate war bisher eine reine Pull-App: Es passierte
nur etwas, wenn jemand die Seite öffnete. Diese Version gibt der App eine Stimme —
Termin-Erinnerungen, ein Wochen-Digest und ein „Was für dich ansteht"-Block holen
die Band zurück, und eine Statuszeile verrät, wenn der Versand klemmt. Aufbauend
auf Welle 0 (Datensicherheit) aus 1.10.x. Grundlage:
[docs/review-2026-07.md](docs/review-2026-07.md).

### Hinzugefügt
- **„Was für dich ansteht" auf dem Dashboard**: ein Block ganz oben mit deinen
  offenen Punkten — Termine der nächsten 14 Tage ohne deine Rückmeldung,
  Vorschläge ohne deine Stimme, Songs der nächsten Probe-Agenda, die du noch
  nicht „kannst", und neue Kommentare seit deinem letzten Besuch. Ist nichts
  offen, verschwindet der Block.
- **Wochen-Digest** (`npm run notify:digest`, sonntags per Cron): eine
  Zusammenfassung pro Mitglied mit den offenen Punkten und dem, was in den
  letzten sieben Tagen anfiel (neue Vorschläge, Termine, Kommentare — je nach
  den „Gesammelt"-Einstellungen). Wer nichts zu berichten hat, bekommt keine
  Mail. Idempotent je Kalenderwoche; pro Mitglied unter „Wochen-Digest" im
  Profil abschaltbar.
- **Termin-Änderungen erreichen die Band**: Beim Bearbeiten eines Termins gibt es
  jetzt (wie beim Anlegen) die Checkbox „Band benachrichtigen" — vorausgewählt.
  Eine Mail geht aber nur raus, wenn sich **Datum, Uhrzeit oder Ort** wirklich
  geändert hat, und nennt konkret alt → neu. Titel-Korrekturen oder Notizen
  lösen bewusst nichts aus. Bisher erreichte eine Gig-Verschiebung niemanden.
- **Statuszeile auf dem Dashboard** (nur Admins): zeigt den letzten
  Erinnerungs-Lauf mit Datum, Mail-Zahl und Fehlern — und wird auffällig, wenn
  seit über zwei Tagen kein Lauf verzeichnet ist oder der letzte Fehler hatte.
  So fällt ein vergessener oder klemmender Cron-Job auf, statt still zu bleiben.
- **Zentraler Cron-Dispatcher** (`./scripts/cron.sh`): ein einziger Cron-Eintrag
  läuft minütlich und entscheidet anhand einer Zeitplan-Tabelle im Repo, welche
  Aufgabe dran ist (Backup, Papierkorb leeren, Erinnerungen). Der Zeitplan liegt
  damit in Git statt handgepflegt in der crontab, und neue periodische Aufgaben
  sind eine Zeile im Script. `--list` zeigt den Plan, `--run <name>` führt eine
  Aufgabe sofort aus. Setzt `TZ` selbst (sonst rechnete `date` in der
  System-Zeitzone), meldet Fehler nach stderr für die Cron-MAILTO und
  verhindert per Sperre, dass sich Läufe überlappen. Die Einzelskripte bleiben
  eigenständig aufrufbar — wer getrennte Cron-Zeilen bevorzugt, kann den
  Dispatcher ignorieren.
- **Termin-Erinnerungen per E-Mail** (`npm run notify:reminders`, für den täglichen
  Cron): zwei Tage vor einem Termin an alle, die noch nicht zu- oder abgesagt
  haben, und am Vortag mit Ort, Zeit und Probe-Agenda an alle Zusagenden. Der
  Lauf ist idempotent — ein doppelter Aufruf verschickt nichts doppelt, ein
  ausgefallener Tag wird nicht nachgeholt. Der Versand nutzt eine gepoolte
  SMTP-Verbindung für den ganzen Lauf und wiederholt eine einzelne Mail einmal,
  falls die Verbindung kurz zickt; jeder Versand wird protokolliert.
- **Benachrichtigungen je Ereignistyp einstellbar** (`/profil`, für Admins auch
  unter `/mitglieder`): Termin-Erinnerungen, neue Termine, geänderte Termine,
  neue Songvorschläge und Kommentare lassen sich einzeln auf **Sofort**,
  **Gesammelt** (im Wochen-Digest) oder **Nie** stellen. Bisher gab es nur einen
  Schalter für alles — wer den Vorschlags-Spam loswerden wollte, verlor damit
  auch jede Gig-Ankündigung und drehte irgendwann alles ab.
  Die bestehende Einstellung wird übernommen: Wer Mails abgeschaltet hatte,
  steht danach überall auf „Nie" und bekommt exakt so wenig Post wie vorher.
- **Erinnerungen im Kalender-Abo**: Termine aus dem ICS-Feed bringen jetzt einen
  Wecker mit — bei Terminen mit Uhrzeit zwei (am Vortag zur selben Zeit und zwei
  Stunden vorher), bei ganztägigen einen mittags am Vortag. Damit erinnert das
  eigene Handy an die Probe, ohne Berechtigung, ohne App-Installation und
  unabhängig vom Mailversand. Wer den Kalender bereits abonniert hat, muss
  nichts tun.
- **Restore-Script** (`./scripts/restore.sh`): führt durch das Zurückspielen
  eines Backups — Auswahl aus allen vorhandenen Läufen (mit Datum, Version und
  Inhalt aus dem `MANIFEST.txt`), Wahl des Umfangs (alles · nur Datenbank ·
  nur Uploads), Vorschau als Differenz („songs 42 → 38, du gehst 6 Tage
  zurück"), Bestätigung durch Abtippen des Laufnamens.
  Sichert sich selbst ab: Der aktuelle Stand wird vorher per `backup.sh
  --label vor-restore` gesichert **und** das Ersetzte nach
  `<DATA_DIR>.vor-restore-<Zeitstempel>` beiseitegelegt statt gelöscht. Die App
  wird über PM2 gestoppt und danach wieder gestartet — ohne das schreibt sie
  weiter in die alte Datenbank. Zum Schluss Kontrolle gegen das Manifest;
  weicht etwas ab, bleibt die App gestoppt und der Weg zurück wird genannt.
  Dazu `--dry-run`, `--run`, `--scope` und eine Warnung, wenn das Backup aus
  einer neueren App-Version stammt als die installierte.
  Ohne Terminal (Cron, Pipe) verweigert das Script den Dienst.

### Behoben
- **E-Mail-Versand robuster**: knappe Verbindungs-Timeouts (statt bis zu zwei
  Minuten am Default) und ein Wiederholungsversuch, falls die SMTP-Verbindung
  kurz zickt („Greeting never received"). Betrifft alle Benachrichtigungen, nicht
  nur die Erinnerungen.
- **ICS-Feed faltet lange Zeilen** nach RFC 5545 (höchstens 75 Oktette, gemessen
  in Oktetten und ohne Umlaute zu zerschneiden). Lange Notizen oder Ortsangaben
  konnten strenge Kalender-Programme bisher stören.
- **SMTP-Konfiguration dokumentiert**: `SMTP_PORT` und `SMTP_SECURE` gehören
  zusammen (465/true bzw. 587/false) — die falsche Paarung erzeugt beim
  Verbindungsaufbau „wrong version number" und lässt den Versand still scheitern.
  Als Tabelle im README und in der `.env.example`, mit Verweis auf den SMTP-Test.

### Geändert
- Die Zeilenzahl-Auskunft über eine Datenbank liegt jetzt in
  `scripts/db-info.js` und wird von Backup und Restore gemeinsam genutzt —
  vorher steckte sie nur im Backup-Script, damit ließe sich ein Restore nicht
  gegen das Manifest prüfen.

## [1.10.1] — 2026-07-23

### Behoben
- **`./deploy.sh` brach auf dem Server ab**, wenn `DATA_DIR` in der `.env`
  steht (also bei jeder Installation, die der README-Empfehlung folgt und die
  Daten außerhalb des Clones ablegt): `scripts/backup.sh` ist ein Shell-Script
  und las die `.env` nicht, suchte die Datenbank deshalb unter `<repo>/data`
  und fand sie nicht — und weil der Snapshot fehlschlug, stoppte das
  Deployment. Es stoppte dabei **vor** `pm2 restart` und damit vor jeder
  Migration, die laufende Version blieb also unangetastet.
  Lokal war der Fehler tückischer: dort existiert `<repo>/data`, also wurde
  stillschweigend das falsche Verzeichnis gesichert.
- Dasselbe bei **`npm run trash:purge`**: `tsx` lädt die `.env` nicht von
  selbst, das Script hätte auf die falsche Datenbank gezeigt — und dort
  endgültig gelöscht.
- Beide lesen jetzt dieselbe `.env` wie die App. Reihenfolge: gesetzte
  Umgebungsvariable > `.env` > Default, eine Cron-Zeile kann also weiterhin
  alles überschreiben.

### Hinzugefügt
- **`.env.example`** um `BACKUP_DIR`, `RETENTION_DAYS` und `KEEP_MIN` ergänzt
  (alle optional), mit dem Hinweis, `BACKUP_DIR` auf eine **andere Platte** zu
  legen als `DATA_DIR`, und der Bedingung `RETENTION_DAYS` > Papierkorb-Frist.

### Hinweis für den Server
Ab dieser Version genügen die Cron-Zeilen ohne vorangestellte Variablen:

```cron
30 3 * * * cd /pfad/zu/BandMate && ./scripts/backup.sh  >> /var/log/bandmate-backup.log 2>&1
0  4 * * * cd /pfad/zu/BandMate && npm run trash:purge  >> /var/log/bandmate-purge.log  2>&1
```

Wer von 1.10.0 kommt und dort schon Cron-Jobs **mit** `DATA_DIR=…`/`BACKUP_DIR=…`
eingetragen hat, kann sie so lassen — sie funktionieren weiterhin.

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
Nach `./deploy.sh` zwei Cron-Jobs einrichten (Reihenfolge ist Absicht — der
Papierkorb wird erst geleert, wenn der Zustand davor gesichert ist):

```cron
30 3 * * * cd /pfad/zu/BandMate && DATA_DIR=… BACKUP_DIR=… ./scripts/backup.sh >> /var/log/bandmate-backup.log 2>&1
0  4 * * * cd /pfad/zu/BandMate && DATA_DIR=…              npm run trash:purge  >> /var/log/bandmate-purge.log  2>&1
```

`BACKUP_DIR` auf eine **andere Platte** als `DATA_DIR` legen. Den Backup-Befehl
einmal von Hand ausführen, bevor `./deploy.sh` läuft: schlägt er fehl, bricht das
Deployment ab (mit Absicht).

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
