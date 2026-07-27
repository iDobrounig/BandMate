# Bühnenmodus — Design

Stand: 27.07.2026 · Welle 2 („Bühnenwert"), letzter offener Punkt neben Chord-Sheet-Druck.

## Problem

BandMate ist am Notenständer heute nutzlos: Die Setliste ist nur eine Liste, Lyrics/Akkorde
und Noten liegen einzeln auf den Songseiten, das Metronom muss man pro Song raussuchen. Es
fehlt der eine Grund, die App *während* des Auftritts offen zu haben.

## Ziel

Vollbild-Ansicht einer Setliste: großer, kontrastreicher Inhalt, Wischen/Pfeiltasten von
Element zu Element, Bildschirm bleibt an (Wake Lock), Metronom je Song auf Tempo
eingeblendet. Rein lesend — kein Schema-Eingriff, keine Migration.

## Entscheidungen

### Inhalt je Song
Standardmäßig die **Noten-PDF/-Bild des eigenen Instruments** (aus `user.instrument`).
Umschaltbar auf:
- andere Instrumente, für die *dieser* Song Noten hat,
- **Lyrics/Akkorde** (immer wählbar, nicht nur Fallback).

Auflösungsreihenfolge, wenn die gewählte Ansicht für einen Song nichts hat:
gewählte Ansicht → Lyrics/Akkorde → nur Kopfzeile (Titel/Interpret/Tonart/Capo/Tempo).

Die Ansicht-Wahl **„klebt"** über die Songs hinweg (in-memory für die Dauer der Session),
damit man bei 20 Songs nicht 20-mal tippt. Beim nächsten Öffnen startet es wieder mit der
Profil-Vorgabe (dem eigenen Instrument). Persistent (in `localStorage`) bleibt nur die
Schriftgröße.

**iOS-Safari-Haken:** PDFs werden per `<object>` eingebettet (wie
`components/sheet-viewer.tsx`), mit klarem Fallback „PDF in neuem Tab öffnen". Der
Lyrics/Akkord-Weg ist der überall robuste Inhalt.

### Navigation
Die Setliste wird **1:1 als Seitenfolge** abgebildet: Songs, Set-Überschriften und Pausen
sind je eine eigene Vollbild-Seite (Reihenfolge = `position`). Vor/Zurück per Wischen
(Touch) und Pfeiltasten/Leertaste (Tastatur), Esc/✕ beendet.

- **Song-Seite:** Kopf + Inhalt (PDF/Bild/Lyrics) + Ansicht-Umschalter + fixes Metronom +
  wegblendbare Werkzeugleiste.
- **Set-Überschrift:** schlichte Trenner-Seite („Set 2").
- **Pausen-Seite:** großer „▶ Pause starten"-Button → Countdown von `breakSeconds`, zählt
  **über null hinaus ins Plus** (`+2:14` in Rot — Pausen laufen immer über). Zeigt außerdem
  **„Weiter mit: 〈nächster Song〉"**.

### Werkzeuge je Song
- **Metronom fix eingeblendet**, kompakt, schon auf die Song-BPM gesetzt (nur Start/Stopp
  nötig, plus ±). Kein Song-BPM → dezenter Default (120), aber ohne Vorbelegungs-Badge.
- **Werkzeugleiste** (blendet sich weg): Transponieren ± und Schriftgröße A−/A+.
- **Transponieren ist flüchtig** — nur die Ansicht, kein Speichern in der DB. Zurückgesetzt
  je Song. Schriftgröße wird pro Gerät gemerkt.

### Wake Lock & Fullscreen
Beim Start Fullscreen anfordern (best effort) und Screen Wake Lock holen; bei
`visibilitychange` (Tab-Wechsel und zurück) neu anfordern. Beenden gibt beides frei.

## Architektur

### Route & Einstieg
- `app/(app)/setlisten/[id]/buehne/page.tsx` — Server Component: `requireUser()`, lädt Daten,
  rendert den Client-Wrapper. Analog zur `druck/`-Route.
- Einstieg: „▶ Bühnenmodus"-Link in der Aktionsleiste der Setlisten-Detailseite.

### Datenladung
Item-Query analog `druck/page.tsx`, zusätzlich `songs.lyricsChords` und `songs.capo`.
Zweiter Schritt: aktive Sheet-Attachments aller vorkommenden Songs
(`kind = "sheet"`, `anhangAktiv`), je `songId` gruppiert (`id`, `instrument`, `mime`,
`originalName`). An den Client: geordnete Item-Liste (Song-Metadaten + Lyrics + Sheets),
Setlisten-Name, `currentInstrument = user.instrument`.

### Komponenten (`components/stage/`)
- `stage-view.tsx` (Client): Index-Zustandsmaschine, Fullscreen + Wake Lock, Tastatur- und
  Swipe-Handler (ohne Library), klebende Instrument-Wahl (in-memory), persistente
  Schriftgröße (`localStorage`). Kopfzeile mit Fortschritt („3 / 18") und „✕ Beenden".
  Rendert je `kind` die passende Seite.
- `stage-song.tsx`, `stage-break.tsx`, `stage-section.tsx`.

### Wiederverwendung
- **Metronom-Scheduler** aus `components/metronome.tsx` in einen Hook `useMetronome(bpm)`
  extrahieren (`{ running, start, stop, beatFlash }`). Das bestehende `Metronome`-Widget
  nutzt den Hook weiter (kein Verhaltensbruch); der Bühnenmodus bekommt eine eigene kompakte
  UI auf demselben Scheduler.
- **Transponieren:** `transposeLyrics` / `transposeKey` aus `lib/chords.ts` direkt (wie
  `components/transpose.tsx`, aber ohne Speichern).
- **Reine Stage-Logik** in `lib/stage.ts`: „nächster Song nach einer Pause", Countdown-
  Formatierung inkl. Überzug (`+m:ss`). Mit ein paar Vitest-Tests.

### Styling
Rendert außerhalb des App-Chrome (kein Nav), Vollbild-Container über den Viewport, dunkel &
kontrastreich über bestehende Theme-Variablen, Text groß im `mono-display`. Schriftgröße per
CSS-Variable. Kein `background-attachment: fixed` (AGENTS.md-Stolperfalle).

## „Notenpult"-Ansicht (Minimal) — Nachtrag

Für Mitglieder mit **physischen Noten** ist Lyrics/PDF überflüssig; sie brauchen Orientierung
im Ablauf und das Tempo. Ein Umschalter **„Voll ⇄ Notenpult"** in der Kopfzeile (pro Gerät in
`localStorage`, Default „Voll") wechselt die Darstellung, ohne Navigation/Wake Lock/Index
anzutasten.

- **`StageMinimal`** (`components/stage/stage-minimal.tsx`) rendert je Seite einen **JETZT**-
  Block (Song: Titel groß, Interpret, Tonart/Capo/Tempo, Setlisten-Notiz + kompaktes Metronom;
  Pause: Countdown; Set: Set-Name) und einen **ALS NÄCHSTES**-Block mit den nächsten zwei
  Elementen als Einzeiler; am Listenende „— Ende —".
- Wiederverwendung: `StageMetronome` (aus `stage-song.tsx` in `stage-metronome.tsx`
  ausgelagert) und `BreakTimer` (aus `stage-break.tsx` ausgelagert). Reine Helfer
  `upcomingItems` / `describeUpcoming` in `lib/stage.ts` (mit Tests).
- `StageMinimal` wird in `StageView` **per `key={page.id}`** gerendert, damit Metronom und
  Pausen-Timer beim Blättern auf den neuen Song/die neue Pause zurückspringen (analog zum
  keyed Remount der Vollansicht-Seiten).

## Kein DB-Eingriff

Rein lesend. Keine Migration, `data/` unangetastet.

## Verifikation

Browser-Durchlauf (Dev-Server `bandmate-dev`) mit einer gemischten Setliste (Songs mit/ohne
Lyrics, Song mit Sheet fürs eigene Instrument, Song ohne Sheet, ≥1 Pause, ≥1 Set-Überschrift):
Seitenfolge & Fortschritt, Blättern per Taste und Wisch, Ansicht-Umschaltung inkl. Kleben und
Fallbacks, Metronom auf Song-BPM, flüchtiges Transponieren + Schriftgröße, Pausen-Countdown
mit Überzug und „Weiter mit …", Wake Lock/Beenden. Abschluss `npx tsc --noEmit` + `npm run
build`.
