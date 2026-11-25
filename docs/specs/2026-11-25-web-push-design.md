# Web Push: Benachrichtigungen aufs Handy, unabhängig vom Mailversand

Stand: 25.11.2026 · Basis: v2.2.1
Vorgänger: [2026-07-23-benachrichtigungen-design.md](2026-07-23-benachrichtigungen-design.md)
(dort war Web Push ausdrücklich „Nicht im Umfang“; die `channel`-Spalte wurde dafür reserviert)

## Anlass und Ziel

Der Mailversand macht wiederholt Probleme. Benachrichtigungen, auf die sich die Band
verlässt (vor allem Termin-Erinnerungen), kommen dann nicht an. Die meisten Mitglieder
haben BandMate als Web-App auf dem Homescreen installiert. Damit steht Web Push als
zweiter, vom Mailserver unabhängiger Kanal zur Verfügung.

**Erfolg heißt:** Ein Mitglied tippt einmal auf „Benachrichtigungen aktivieren“ und
bekommt ab dann jede Nachricht, die es heute per Mail bekäme, als Push aufs Gerät.
Antippen öffnet die passende Seite in der App.

### Ziele

- Push für alle **Sofort-Nachrichten** (`notifyBand()`: Vorschlag, Kommentar, neuer und
  geänderter Termin) und für die **Termin-Erinnerungen** (Cron).
- Pro Person wählbar: **Push / Mail / beides** (Entscheidung B, 25.11.2026).
- Einfache Aktivierung, verständliche Hinweise, wenn es auf einem Gerät nicht geht.
- Sicher, siehe Abschnitt Sicherheit.

### Nicht-Ziele

- **Wochen-Digest per Push.** Eine Wochenzusammenfassung ist für eine Push-Nachricht zu
  lang. Der Digest bleibt Mail.
- **Offline-Fähigkeit / Caching im Service Worker.** Der Service Worker bekommt bewusst
  **keinen** `fetch`-Handler.
- **Eine eigene Push-Matrix pro Ereignistyp** (Variante C, verworfen). Die bestehende
  Matrix (sofort / gesammelt / nie) gilt für beide Kanäle.
- **Band-Wechsel per Link.** Für Mitglieder mehrerer Bands zeigt ein Link auf einen
  Inhalt einer anderen als der aktiven Band ins Leere. Das gilt heute schon für die Mail
  und wird hier nicht gelöst. Der Push-Titel nennt die Band, damit es zumindest
  erkennbar ist.

### Anti-Ziele: was es zum Fehlschlag machen würde, auch wenn es technisch läuft

- Jemand bekommt **still gar nichts mehr**, z.B. weil er „nur Push“ gewählt hat und das
  Gerät abgelaufen ist.
- Bestehender Mailversand, Erinnerungen, Digest oder Statuszeile ändern ihr Verhalten
  für Leute, die Push nicht aktivieren.
- Der Service Worker verursacht veraltete Seiten oder hängende Versionen.
- Die App bettelt beim Öffnen um Berechtigungen wie die News-Seiten.
- Auf einem geteilten Gerät landen nach dem Abmelden die Nachrichten einer anderen
  Person.

## Ansätze

| Ansatz | Bewertung |
|---|---|
| **`web-push` (npm) + eigener schlanker Service Worker** | **Gewählt.** Standardweg laut Next.js-Doku (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`), kein Drittanbieter, kostenlos, Verschlüsselung (RFC 8291) und VAPID (RFC 8292) aus einer etablierten Bibliothek. |
| Firebase Cloud Messaging / OneSignal | Verworfen: Fremdanbieter-Konto, Datenschutz, zusätzliches SDK, für eine Band ohne Mehrwert. |
| Verschlüsselung/VAPID selbst implementieren | Verworfen: sicherheitskritisch und fehleranfällig, genau dafür gibt es `web-push`. |
| PWA-Plugin (`next-pwa`, `serwist`) | Verworfen: bringt Offline-Caching mit, das wir nicht wollen (Anti-Ziel „veraltete Seiten“). |

Kanal-Zusammenspiel: Varianten A (immer beides), B (Wahl pro Person), C (Matrix pro Kanal)
wurden vorgestellt. **Ingo hat B gewählt.**

## Entscheidungen mit Ingo (25.11.2026)

- **E1: Web Push** als zusätzlicher Kanal, Mail bleibt.
- **E2: Variante B.** Die Matrix bleibt unverändert („was und wann“). Darunter eine
  Kanalwahl pro Person: **Push / Mail / beides**. Wer Push aktiviert, hat standardmäßig
  „beides“ und kann die Mail abschalten.
- **E3:** Die Vorschläge aus der Abstimmung sind angenommen: Profil-Bereich mit
  Geräteliste und Test-Push; Hinweise für iOS ohne Homescreen und für blockierte
  Berechtigung; einmalige, wegklickbare Dashboard-Karte; Rückfall auf Mail; getrenntes
  Protokoll je Kanal; Allowlist der Push-Dienste; Geräte-Abmeldung beim Logout;
  automatisches Aufräumen; Push-Status in `/mitglieder`; Titel mit Bandname.

## Verhalten

### Wer bekommt was über welchen Kanal?

Die Matrix entscheidet wie bisher, **ob** eine Person zu einem Ereignis sofort etwas
bekommt (`fetchRecipients`, unverändert). Neu ist nur, **über welchen Kanal**:

| `users.notify_channel` | aktive Geräte | Push | Mail |
|---|---|---|---|
| `beides` (Standard) | ≥ 1 | ja | ja |
| `beides` | 0 | – | ja |
| `push` | ≥ 1 | ja | – |
| `push` | 0 | – | **ja (Rückfall)** |
| `mail` | egal | – | ja |

**Rückfall auch beim Versand:** Hat eine Person `push` gewählt und scheitert die
Zustellung an **alle** ihre Geräte (oder wurden alle gerade als abgelaufen entfernt),
bekommt sie diese Nachricht per Mail. Das ist eine reine Funktion
(`resolveChannels`) und der Testschwerpunkt.

Bestandsnutzer haben `beides` und keine Geräte und bekommen damit **exakt das Verhalten
von heute**.

### Aktivierung (pro Gerät)

Ort: **`/profil`**, eigene Karte „Push-Benachrichtigungen“ (Client-Komponente).

Zustände dieses Geräts, ermittelt im Browser:

| Zustand | Anzeige |
|---|---|
| Server hat keine VAPID-Schlüssel | Karte wird nicht angezeigt |
| Browser kann kein Push | „Dieser Browser unterstützt keine Push-Benachrichtigungen.“ |
| iOS/iPadOS, nicht als App gestartet (`display-mode: standalone` falsch) | Anleitung „Teilen → Zum Home-Bildschirm“, danach die App vom Homescreen öffnen |
| Berechtigung `default`, kein Abo | Knopf **„Auf diesem Gerät aktivieren“** |
| Berechtigung `denied` | Hinweis, dass die Berechtigung in den Einstellungen des Geräts/Browsers wieder erlaubt werden muss (die App kann nicht erneut fragen) |
| Abo aktiv | „Aktiv auf diesem Gerät“, Knöpfe **„Test-Push senden“** und **„Deaktivieren“** |

Die Berechtigungsabfrage passiert **ausschließlich nach einem Tippen** (iOS verlangt das,
und es ist das Gegenteil des News-Seiten-Verhaltens).

Darunter: **Liste meiner Geräte** (Bezeichnung aus dem User-Agent, z.B. „iPhone · Safari“,
aktiviert am, zuletzt erfolgreich zugestellt) mit „Entfernen“ je Gerät. Das aktuelle Gerät
ist markiert.

**Kanalwahl** Push / Mail / beides: als Feld `notifyChannel` im bestehenden
Profil-Formular direkt unter der Matrix, gespeichert von `updateProfile`. Steht sie auf
„nur Push“ und gibt es kein aktives Gerät, erscheint ein Hinweis: „Kein Gerät aktiv, du
bekommst bis dahin weiter Mails.“

Dieselbe Kanalwahl (ohne Geräteverwaltung) auf der Admin-Seite `/mitglieder/[id]`, wo die
Matrix heute auch steht.

### Dashboard-Karte

Einmalig, oberhalb des Blocks „Was muss ich tun?“: **„Benachrichtigungen auf diesem Gerät
aktivieren?“** mit „Aktivieren“ und „Nein, danke“. Sichtbar nur, wenn

- der Server Push anbietet,
- der Browser Push kann und (auf iOS) die App vom Homescreen läuft,
- die Berechtigung noch `default` ist,
- und sie auf diesem Gerät nicht weggeklickt wurde (`localStorage`, in try/catch).

Ohne `localStorage` erscheint sie wieder; das ist harmlos.

### Abmelden

Vor dem Absenden des Logout-Formulars (`components/logout-form.tsx`) entfernt der Client
das Abo dieses Geräts: Server Action mit dem Endpoint, danach
`subscription.unsubscribe()`. **Best effort mit kurzem Timeout:** Ein Fehler darf das
Abmelden nie blockieren.

### Die Nachricht

```
Titel:   BandMate · <Bandname>
Text:    <intro> <highlight>         (gekürzt auf ~180 Zeichen)
Tippen:  öffnet <cta.url>            (nur gleiche Herkunft, sonst "/")
tag:     <kind>-<refId>              (ein neuer Push zum selben Ding ersetzt den alten)
Icon:    /icon-192.png
```

Abgeleitet aus dem vorhandenen `MailContent` durch eine reine Funktion
(`toPushPayload`). Keine neuen Texte an den Aufrufstellen nötig. Der Bandname kommt aus
`bands.name`.

`notificationclick` im Service Worker: offenes Fenster der App fokussieren und dorthin
navigieren, sonst ein neues öffnen.

Versand-Optionen: `TTL` 24 h für Sofort-Nachrichten, 12 h für Erinnerungen;
`urgency: "high"` für Erinnerungen, sonst `"normal"`.

### Admin-Sicht

`/mitglieder`: je Mitglied ein kleines Badge „Push · 2 Geräte“ bzw. nichts. Damit sieht
der Admin, wen er noch zum Aktivieren bringen muss.

Die Statuszeile des Erinnerungslaufs bleibt; ihre `note` nennt künftig Mail und Push
getrennt (z.B. „3 Mails, 5 Push, 0 Fehler“). Fehler beider Kanäle zählen in
`errorCount`.

## Technik

### Schema

Migration mit `npm run db:generate`. **Vorher `./scripts/backup.sh`** bzw. Dev-Server
stoppen (siehe AGENTS.md, Schema-Änderungen migrieren `data/` sofort).

```ts
// Ein Abo = ein Gerät/Browser einer Person.
pushSubscriptions = {
  id,
  userId,            // FK users, onDelete cascade
  endpoint,          // UNIQUE
  p256dh, auth,      // Schlüssel aus PushSubscription.toJSON().keys
  label,             // "iPhone · Safari", aus dem User-Agent abgeleitet
  createdAt,
  lastSuccessAt,     // null bis zur ersten erfolgreichen Zustellung
}

users.notifyChannel  // "beides" | "push" | "mail", NOT NULL DEFAULT "beides"

notificationLog.channel  // "mail" | "push", NOT NULL DEFAULT "mail"
// Unique-Index wird (kind, refType, refId, userId, channel).
// Bestehende Zeilen bekommen "mail" → bisherige Idempotenz bleibt erhalten.
```

`notificationSettings.channel` bleibt wie es ist (`"mail"`) und trägt durch E2 die
kanalunabhängige Matrix. Der Kommentar dort wird angepasst, dass die Spalte für Push
nicht gebraucht wurde.

### Konfiguration

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:...   # oder https://… ; Pflicht laut RFC 8292
```

- Fehlen die Schlüssel, ist Push **aus**: keine UI, kein Versand, ein Log-Hinweis wie
  bei fehlendem SMTP. Nichts bricht.
- Der öffentliche Schlüssel geht **zur Laufzeit** vom Server an die Client-Komponente
  (Prop), nicht als `NEXT_PUBLIC_*`. Sonst wäre er in den Build eingebacken.
- `npm run push:keys` erzeugt ein Schlüsselpaar (`webpush.generateVAPIDKeys()`) und gibt
  die `.env`-Zeilen aus.
- **Schlüsselwechsel macht alle Abos ungültig.** Das steht in der README.
- `web-push` kommt in `serverExternalPackages`, falls der Build es verlangt.

### Module

- **`lib/push.ts`** (Server): `isPushConfigured()`, `sendPush(subscription, payload, opts)`
  über `web-push`. Bei **404/410** wird das Abo gelöscht, andere Fehler werden geloggt und
  gemeldet, das Abo bleibt. Erfolg setzt `lastSuccessAt`.
- **`lib/push-subscriptions.ts`**: Validieren, Speichern (Upsert nach `endpoint`; gehört
  der Endpoint einer anderen Person, wechselt er den Besitzer, denn das Gerät hat den
  Besitzer gewechselt), Löschen (nur eigene), Auflisten, Zählen je Mitglied.
- **`lib/notify-channels.ts`** (rein): `resolveChannels(user, deviceCount)` und
  `toPushPayload(content, bandName, opts)`.
- **`notifyBand()`** wird kanalfähig. Es zieht aus `lib/mail.ts` in ein neutrales
  `lib/notify.ts` um (drei Import-Stellen). Der frühe Ausstieg „SMTP nicht konfiguriert“
  gilt dann nur noch für den Mail-Zweig. Push geht auch ohne SMTP raus.
- **Erinnerungen** (`lib/reminders.ts`): Die Planung bleibt, der Versand läuft je
  Person über die aufgelösten Kanäle, das Log je Kanal. Mail-Rückfall nach
  gescheitertem Push siehe oben.
  **Wiederholung (Umsetzer-Entscheidung):** Eine Erinnerung gilt für eine Person als
  zugestellt, sobald **ein** Kanal `ok` geloggt hat. Ein gescheiterter zweiter Kanal wird
  dann im nächsten Lauf nicht nachgeholt, sonst käme dieselbe Erinnerung zweimal. Erst wenn
  alle Kanäle scheitern, versucht der nächste Lauf es erneut (wie heute bei Mail). Die
  `note` des Laufs unterscheidet „SMTP nicht konfiguriert“ von „nichts zu tun“ weiterhin,
  zählt aber Push mit.
- **Server Actions** `lib/actions/push.ts`: `savePushSubscription`,
  `removePushSubscription(endpoint)`, `removeMyDevice(id)`, `sendTestPush()`. Alle
  verlangen eine angemeldete Person (`requireUser`). Abos hängen an der Person, nicht an
  der Band.
- **`public/sw.js`**: nur `push` und `notificationclick`, kein `fetch`.
- **Registrierung** des Service Workers: kleine Client-Komponente im `(app)`-Layout,
  `navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })`,
  nur wenn `serviceWorker` und `PushManager` vorhanden sind.
- **Header für `/sw.js`** in `next.config.ts` wie in der Next.js-Doku:
  `Cache-Control: no-cache, no-store, must-revalidate` und
  `Content-Security-Policy: default-src 'self'; script-src 'self'`.

## Sicherheit

| Risiko | Gegenmaßnahme |
|---|---|
| **SSRF:** Der Server schickt HTTP-Requests an eine vom Client gelieferte URL | Endpoint muss `https:` sein, und der Host muss auf einer **Allowlist** der Push-Dienste stehen: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.push.apple.com`, `*.notify.windows.com`. Ein fremder Endpoint wird abgelehnt. (Liste beim Bau gegen aktuelle Browser prüfen.) |
| Manipulierte Abo-Daten | Strikte Prüfung: Endpoint ≤ 1000 Zeichen, `p256dh`/`auth` base64url mit plausibler Länge, sonst Ablehnung. |
| Fremde Abos löschen/übernehmen | Löschen nur eigener Abos. Übernahme eines Endpoints setzt den Besitz des Geräts voraus, denn nur der Browser kennt die Schlüssel. |
| Geteiltes Gerät nach Logout | Abmelden entfernt das Abo des Geräts (best effort). |
| Spam über „Test-Push“ / Abo-Flut | Test-Push über `lib/rate-limit.ts` begrenzt (z.B. 5/min). Höchstens 10 Abos pro Person, beim elften fällt das älteste weg. |
| Öffnen fremder URLs per Push-Klick | Der Service Worker öffnet nur Ziele derselben Herkunft, sonst `/`. |
| Schlüssel im Repo | VAPID-Schlüssel nur in `.env` (nicht in Git), privater Schlüssel nie an den Client. |
| Inhalte auf dem Sperrbildschirm | Inhalt wie in der Mail (Intro/Highlight), keine Gage, Kontakte oder sonstigen Termindetails. Payload ist Ende-zu-Ende verschlüsselt (`aes128gcm`), der Push-Dienst kann ihn nicht lesen. |
| Mandantenfähigkeit | Empfänger kommen weiter aus `fetchRecipients(kind, bandId)`, also nur Mitglieder der Band. Abos sind personenbezogen, wie die Benachrichtigungs-Einstellungen. Der Bandname im Titel kommt aus der auslösenden Band. |

## Verifikation

- **Vitest:**
  - `resolveChannels`: alle Zeilen der Kanal-Tabelle plus Rückfall nach gescheitertem Push.
  - `toPushPayload`: Kürzung, URL-Herkunft, tag.
  - Abo-Validierung: Allowlist, kaputte Schlüssel, `http:`.
  - Speichern/Upsert/Besitzerwechsel/Limit 10, Löschen nur eigener.
  - Versand mit gemocktem `web-push`: 410 löscht, 500 behält, `lastSuccessAt`.
  - Erinnerungslauf: Idempotenz **je Kanal**, doppelter Lauf verschickt nichts doppelt,
    Mail-only-Nutzer verhalten sich exakt wie vorher.
  - Migration: bestehende Log-Zeilen bekommen `channel = "mail"`.
  - Bestehende Tests bleiben grün.
- `npx tsc --noEmit`, `npm run build`.
- **Browser, Ende-zu-Ende auf `localhost`** (Chrome kann Push über FCM auch lokal):
  Aktivieren → Abo in DB → Test-Push kommt an → Klick öffnet Seite → Songvorschlag eines
  anderen Mitglieds erzeugt Push → Deaktivieren → Logout entfernt Abo.
  Kanalwahl „nur Push“ und „nur Mail“ prüfen.
- **iPhone (Homescreen-App):** nur auf dem Produktivserver mit HTTPS möglich. Das testet
  Ingo nach dem Deploy mit einer kurzen Checkliste.
- Vor jedem Schema-Schritt Backup von `data/`. `data/` wird nie gelöscht oder
  überschrieben.

## Doku

README (`.env`-Variablen, `npm run push:keys`, HTTPS-Pflicht, Schlüsselwechsel),
Hilfe-Seite (Aktivieren auf iPhone/Android, Berechtigung wieder freigeben),
`FEATURES.md` (Punkt „Web-Push“ abhaken), kurzer Hinweis in `AGENTS.md`
(Service Worker ohne `fetch`, Push-Allowlist), CHANGELOG.

## Dem Umsetzer überlassen

- Genaue Aufteilung in Module und Dateinamen (Vorschläge oben).
- User-Agent → Gerätebezeichnung (einfache Heuristik genügt).
- Ob die Gerätebezeichnung und „zuletzt zugestellt“ in der Liste relativ oder absolut
  angezeigt werden (bestehende `lib/format.ts` nutzen).
- Wortlaut der Hinweistexte (Stil der bestehenden UI: Du-Form, knapp).
- Reihenfolge der Commits. Vorschlag: (1) Schema + `lib/push*` + Tests, (2) Service
  Worker + Aktivierung im Profil + Test-Push, (3) `notifyBand` + Erinnerungen kanalfähig,
  (4) Dashboard-Karte, Logout, `/mitglieder`-Badge, (5) Doku.
