# Browser-Audio-Aufnahme (Welle 3)

Stand: 11.08.2026 · umgesetzt.

## Kontext

Wave-3-Punkt aus [FEATURES.md](../../../FEATURES.md): Proberaum-Mitschnitte sollen direkt am
Song aufgenommen werden können, statt eine Datei vom Handy manuell hochladen zu müssen. Damit
die Aufnahmen platzsparend am Server liegen, werden sie serverseitig per ffmpeg zu OGG/Opus
konvertiert (Browser liefern je nach Browser unterschiedliche Formate: Chrome/Firefox
WebM+Opus, Safari/iOS MP4+AAC).

## Entscheidungen

- **Umfang:** nur die Songseite. Die Recorder-Komponente ist so gebaut, dass sie sich später
  ohne Umbau in Termine/Setlisten (Gig-Mitschnitt) einbauen lässt, ist in diesem Schritt aber
  nur dort verdrahtet.
- **ffmpeg** ist auf dem Server bereits vorhanden (5.1.9, Debian 12) — kein Install-Schritt.
- **Konvertierung läuft synchron** beim Speichern (kein Async-Job-Mechanismus).
- **Niedrige Bitrate statt Limit-Erhöhung:** Aufnahmen werden mit niedriger Ziel-Bitrate
  (48 kbps Opus) konvertiert, damit auch eine 2-3h-Probe-Aufnahme locker unter dem
  bestehenden 60-MB-Limit (`next.config.ts` `serverActions.bodySizeLimit`) bleibt —
  `next.config.ts` und die nginx-Konfiguration bleiben unangetastet. Zusätzlich ein
  Sicherheits-Auto-Stopp nach 3 h, falls das Stoppen vergessen wird.
- **Review-Schritt vor dem Speichern:** nach dem Stoppen gibt es ein Vorhören + einen
  vorausgefüllten, editierbaren Namen (`Songtitel JJJJ-MM-TT HH:MM`, 24h-Format,
  `formatIsoDateTime` in `lib/format.ts`) mit „Speichern"/„Verwerfen" — kein automatischer
  Upload direkt nach Stop.
- **Download-Dateiendung:** `originalName` ist bei Aufnahmen der frei vergebene Name ohne
  Endung (anders als bei Uploads, wo er vom Datei-Input kommt). `app/api/files/[id]/route.ts`
  ergänzt die Endung beim Download deshalb bei Bedarf aus `storedName`.
- **Aufnahmen sind als solche erkennbar** (Mikro-Icon in der Liste), nicht optisch identisch
  zu manuellen Uploads.
- Bewusst **kein Remux-Sonderfall** (WebM+Opus umkopieren statt neu zu kodieren): es wird immer
  mit fester Ziel-Bitrate transkodiert. Das garantiert eine vorhersagbare Dateigröße unabhängig
  davon, ob der jeweilige Browser die `audioBitsPerSecond`-Vorgabe überhaupt beachtet (Safari
  tut das laut Roadmap-Notiz teils nicht).

## Architektur

Wiederverwendete Bausteine: bestehende `attachments`-Tabelle/-Auslieferung
(`app/api/files/[id]/route.ts`, unverändert), Fullscreen-Overlay-Pattern aus
`components/stage/stage-view.tsx` (`fixed inset-0 z-50`), `formatDateTime` aus `lib/format.ts`,
SVG-Icon-Konvention aus `components/icons.tsx`.

Neu:
1. **`attachments.source`** (`"upload" | "recording"`, Default `"upload"`) — Unterscheidung in
   der UI.
2. **`lib/audio-transcode.ts`** — ffmpeg-Wrapper (`node:child_process`, `execFile`):
   `buildTranscodeArgs` (reine Funktion, testbar) + `transcodeToOpus` (Promise-Wrapper mit
   Timeout).
3. **`lib/actions/recordings.ts`** — Server Action `saveRecording`: nimmt den rohen
   Browser-Blob entgegen, schreibt ihn nach `os.tmpdir()` (bewusst außerhalb von
   `data/uploads/`, damit ein liegengebliebener Temp-File nie im Backup landet), transkodiert
   nach `data/uploads/<songId>/<uuid>.ogg`, legt den Attachment-Datensatz an
   (`kind: "audio"`, `source: "recording"`), räumt die Temp-Datei in `finally` auf. Kein
   `FormState`/`useActionState`-Muster, weil es kein Formular-Submit ist, sondern ein
   mehrstufiger Ablauf (Aufnehmen → Review → Speichern) aus einer Client-Komponente heraus.
4. **`components/audio-recorder.tsx`** — `AudioRecorderButton` + `AudioRecorderOverlay` mit
   State-Maschine `idle → recording → review → saving`, `MediaRecorder` mit
   `audioBitsPerSecond` aus der Konstante, Timer, 3h-Auto-Stopp, Review mit `<audio controls>`
   + editierbarem Namensfeld, `saveRecording` wird imperativ aufgerufen (nicht über
   `useActionState`), `router.refresh()` nach Erfolg.
5. Icons `IconMic`/`IconStop` in `components/icons.tsx` (Projekt-Konvention: keine Emoji).
6. Konstanten `RECORDING_BITRATE_KBPS` (48) und `RECORDING_MAX_MS` (3 h) in `lib/constants.ts`.

## Verifikation

- `npx tsc --noEmit`, `npm run build`, `npm test` (inkl. neuer Vitest-Fälle für
  `buildTranscodeArgs`).
- Browser-Durchlauf: Aufnahme starten (synthetischer Audio-Stream über Web-Audio-API anstelle
  eines echten Mikrofons, da die Test-Umgebung keinen Mikrofonzugriff erlaubt), stoppen,
  Vorschau + vorausgefüllter Name geprüft, gespeichert. Ergebnis-Datei mit `ffprobe` geprüft:
  Container OGG, Codec Opus, plausible Größe. Wiedergabe über `/api/files/[id]` mit
  Range-Support verifiziert (Status 206, `Content-Type: audio/ogg`). Fehlerpfad (Mikro-Zugriff
  verweigert) zeigt die vorgesehene Meldung. Papierkorb-Löschen einer Aufnahme funktioniert
  über den bestehenden, unveränderten Soft-Delete-Pfad.
