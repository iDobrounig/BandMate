# Mandantenfähigkeit — Design

Stand: 09.08.2026 · Welle 4 („Mandantenfähigkeit"), Entwurf vor Umsetzungsbeginn.

## Problem

BandMate ist heute komplett Single-Tenant: keine Tabelle, Query oder Action kennt den
Begriff „Band" — jede Instanz bedient genau eine Band. Ingo möchte künftig mehrere Bands auf
derselben Installation betreiben können, jede mit eigenen Songs, Setlisten, Terminen und
Mitgliedern, ohne dass sie sich gegenseitig sehen. Dazu braucht es eine Ebene *über* den
Bands: einen Super-Admin, der Bands und User verwaltet, aber keine Bandinhalte sieht.

## Ziel

Eine gemeinsame Installation trägt mehrere Bands. Ein User kann Mitglied in einer oder
mehreren Bands sein (mit potenziell unterschiedlicher Rolle je Band) und wechselt zwischen
ihnen über ein Kontextmenü am Profil-Icon. Ein Super-Admin verwaltet Bands und User über eine
eigene, von den Bandinhalten getrennte Oberfläche. Band-Admins (die heutigen Admins) legen
weitere Mitglieder ihrer Band an — direkt mit Passwort wie bisher, oder per Einladungslink,
sowohl für neue als auch für bereits bei BandMate registrierte Personen.

Zum Start **halb-offen**: nur der Super-Admin legt neue Bands an (samt deren erstem
Band-Admin). Ein öffentliches Self-Service-Signup („ich registriere meine eigene Band selbst")
ist im Datenmodell vorgesehen, aber **nicht Teil von Welle 4** — kein öffentliches
Anmeldeformular, keine Rechtstexte für fremde Nutzer.

## Entscheidungen

### Isolation: gemeinsame DB mit `band_id`, nicht eine Datei pro Band

Bewusst gegen „eine SQLite-Datei pro Band" entschieden. Der ausschlaggebende Grund: BandMate
braucht eine **globale User-Identität** (ein Login, eine Email, mehrere Bandmitgliedschaften) —
mit getrennten DB-Dateien pro Band wäre entweder die Identität dupliziert oder eine zusätzliche
Cross-DB-Synchronisation nötig. Eine gemeinsame DB mit `band_id`-Spalten macht das trivial,
weil `users` ohnehin schon eine globale Tabelle ist.

Der Preis dieser Wahl: es gibt kein physisches „kann nicht versehentlich passieren" gegen
Datenlecks zwischen Bands — jede Query muss sauber gefiltert sein. Das wird über ein
Scoping-Sicherheitsnetz abgefedert (siehe unten), nicht über die Architektur allein.

### Zielbild: halb-offen, Selbst-Registrierung vorbereitet aber nicht gebaut

`bands` bekommt ein Feld für einen späteren „öffentlich registrierbar"-Schalter, aber Welle 4
liefert dafür keine UI. Landet als eigener Punkt unter „Später / bei Bedarf" in `FEATURES.md`.

### URL-Struktur: eine Domain, Band-Wechsel im Profilmenü

Keine Subdomains, kein DNS-/nginx-Aufwand pro neuer Band. Das bestehende Profil-Icon bekommt
ein Kontextmenü: **Profil bearbeiten** (heutige `/profil`-Seite) · **Band wechseln** (nur
sichtbar, wenn >1 aktive Mitgliedschaft) · **Verwaltung** (nur für Super-Admins) · **Logout**.

### Mitglieder-Anlage: Direktanlage und Einladungslink nebeneinander

Beide Wege bleiben nebeneinander bestehen, für neue wie für bereits registrierte Personen. Die
heutige Direktanlage (Name/Email/Passwort durch den Admin, `lib/actions/users.ts`) ist der
schnelle Weg am Küchentisch; der Einladungslink ist der Weg für „lade jemanden per WhatsApp
ein". Kein Zwang zu einem der beiden.

## Datenmodell

### Neue Tabellen

- **`bands`** — `id`, `name`, `slug` (für spätere Links/URLs), `active`, `createdAt`. Kein
  `registrationOpen`-Feld in Welle 4 nötig, da Selbst-Registrierung nicht gebaut wird — aber
  als Spalte vorgesehen, damit ein späterer Schalter ohne zweite Migration dazukommt.
- **`band_members`** — `bandId`, `userId`, `role` (`band_admin` | `member`), `active`,
  `joinedAt`. Primärschlüssel `(bandId, userId)`. **Die Rolle wandert hierher** — ein User kann
  in Band A Admin und in Band B einfaches Mitglied sein.
- **`invites`** — `bandId`, `email`, `token`, `role`, `expiresAt`, `invitedById`, `usedAt`.
  Verallgemeinerung des bestehenden `resetToken`/`resetTokenExpiresAt`-Musters aus
  `lib/actions/auth.ts` (Passwort-vergessen-Link): derselbe Grundmechanismus (zeitlich
  begrenzter, einmal verwendbarer Token in einer Mail-URL), zweimal genutzt — für die
  Einladung *neuer* Personen (führt zu „Name + Passwort setzen") und für bestehende User
  (führt zu „Band beitreten", ein Klick nach Login).

### Geänderte Tabellen

- **`users`** wird reine globale Identität: `email` bleibt global unique, `name`,
  `passwordHash`, Reset-Token-Felder bleiben. Neu: `isSuperAdmin` (boolean, default false).
  Der bisherige `role`-Enum (`admin`/`member`) **entfällt** — seine Bedeutung wandert
  vollständig nach `band_members.role`. Migration: für jeden bestehenden User eine
  `band_members`-Zeile mit seiner bisherigen `role` anlegen, danach die Spalte droppen.
- **`songs`**, **`setlists`**, **`events`** bekommen `bandId` (not null, FK auf `bands.id`).
  Das sind die einzigen Root-Tabellen mit direktem Bandbezug.
- Kind-Tabellen — `song_links`, `attachments`, `comments`, `votes`, `practice_status`,
  `setlist_items`, `event_attendance`, `event_songs` — bekommen **keine eigene** `band_id`.
  Ihr Scope ergibt sich transitiv über die Eltern-Tabelle (Song/Setlist/Event). Das hält die
  Migration kleiner und es gibt so oder so nur einen Weg, an sie heranzukommen (über die
  Eltern-ID), der bereits scope-geprüft sein muss.
- **`notification_settings`**, **`notification_log`**, **`notification_runs`** bekommen
  `bandId` — ein User kann pro Band unterschiedliche Benachrichtigungs-Einstellungen und
  eine getrennte Versandhistorie haben, sonst mischen sich Vorlieben aus verschiedenen Bands.

## Auth & Session

- `SessionData` (`lib/session.ts`) bekommt `activeBandId?: number` neben `userId`.
- Die Rolle wird **nicht** in der Session gecacht, sondern bei jedem Request aus
  `band_members` (`userId` + `activeBandId`) aufgelöst — verhindert, dass ein per Cookie
  „eingefrorener" Admin-Status eine gerade entzogene Berechtigung überlebt.
- Neue Guards neben `requireUser()` (`lib/auth.ts`): `requireBandAdmin()` ersetzt
  `requireAdmin()` im Bandkontext (prüft `band_members.role === "band_admin"` für die aktive
  Band), `requireSuperAdmin()` prüft `users.isSuperAdmin` unabhängig von jeder Band.
- Login-Flow: nach erfolgreichem Login, falls der User in mehr als einer aktiven Band
  Mitglied ist → Bandwahl-Zwischenschritt; bei genau einer Mitgliedschaft wird sie automatisch
  aktiv gesetzt. Ein Super-Admin ohne eigene Bandmitgliedschaft landet direkt in `/verwaltung`.

## Super-Admin-Oberfläche

Eigene Route-Group, z. B. `app/(superadmin)/verwaltung/...`, mit eigenem Layout — komplett
getrennt vom bestehenden Band-Nav aus `app/(app)/layout.tsx`. Zeigt **ausschließlich** Band-
und User-Verwaltung, keine Songs/Setlisten/Termine irgendeiner Band:

- Bands anlegen/deaktivieren.
- Beim Anlegen einer neuen Band direkt deren ersten Band-Admin anlegen (Direktanlage oder
  Einladung — derselbe Mechanismus wie beim Band-Admin, nur global nutzbar).
- Globale Userliste mit ihren Bandmitgliedschaften (welche Bands, welche Rolle je Band), User
  global deaktivieren.

Ein Super-Admin, der zusätzlich selbst Bandmitglied ist, sieht im Profil-Dropdown zusätzlich
den Eintrag „Verwaltung" und kann zwischen Bandkontext und Verwaltungsbereich wechseln.

## Band-Admin-Flow

Erweiterung von `lib/actions/users.ts` und der Mitgliederverwaltungs-UI (`member-admin.tsx`):

- Bestehende Direktanlage (Name/Email/Passwort, sofort einsatzbereiter Account) bleibt
  unverändert für die eigene Band erhalten.
- Neu: Einladungslink erzeugen (Rolle wählbar, Empfänger-Email optional zur Vorbefüllung).
  Zwei Fälle beim Einlösen:
  - **Email bereits bei BandMate bekannt** → nach Login (falls nötig) genügt ein Klick, um die
    `band_members`-Zeile für die neue Band anzulegen. Kein neues Passwort nötig.
  - **Email unbekannt** → Formular „Name + Passwort setzen" (analog zum bestehenden
    Passwort-Reset-Formular), legt `users`- und `band_members`-Zeile in einem Schritt an.

## Erzwungene Zusatz-Fixes

Bei der Exploration des bestehenden Codes fielen zwei Stellen auf, die unter Mandantenfähigkeit
nicht optional bleiben können, weil sie sonst sofort Daten zwischen Bands lecken:

- **ICS-Feed-Token ist heute global.** `lib/calendar.ts:calendarToken()` leitet einen
  einzigen, installationsweiten Token aus `SESSION_SECRET` ab; `app/api/kalender/[token]/route.ts`
  liefert darüber **alle** Termine ohne jeden Filter. Mit mehreren Bands würde ein einziger
  bekannter Link die Termine sämtlicher Bands preisgeben. Muss auf einen bandbezogenen Token
  plus `bandId`-Filter in der Event-Query umgestellt werden. Trifft sich mit dem ohnehin schon
  offenen Welle-2-Punkt „Pro-Mitglied-Token für den ICS-Feed statt eines gemeinsamen" — beide
  sollten zusammen gelöst werden.
- **`notifyBand()`** (`lib/mail.ts`) muss die Empfängerliste über `band_members` der jeweiligen
  Band ermitteln statt (wie vermutlich heute) über die komplette `users`-Tabelle — sonst
  bekommen Mitglieder Mails aus Bands, in denen sie gar nicht sind.

Keine Änderung nötig bei **Datei-Uploads** (`lib/files.ts`): Der Speicherpfad basiert auf
`songId` (`data/uploads/<songId>/…`), und `songId` bleibt bei einer gemeinsamen DB weiterhin
global eindeutig — keine Kollisionsgefahr zwischen Bands.

## Scoping-Sicherheitsnetz

Weil bewusst gegen physische Trennung entschieden wurde, braucht jede Lese- und
Schreibfunktion in `lib/queries.ts` und `lib/actions/*.ts` eine korrekte `bandId`-Filterung —
ein einziges vergessenes `WHERE` würde Daten zwischen Bands sichtbar machen. Empfehlung für die
Umsetzung: ein Test analog zum bestehenden Vitest-Setup (`tests/setup.ts`), der zwei Bands mit
je eigenen Songs/Setlisten/Terminen seedet und für jede exportierte Fetch-Funktion prüft, dass
sie ausschließlich Daten der aktiven Band liefert. Genau die Art von Test, die schon beim
Papierkorb-Umbau (26 betroffene Lesestellen) den Ausschlag für einen Test-Rahmen gegeben hat.

## Datenmigration

Bestehende Installationen haben genau eine (implizite) Band. Migration:

1. `./scripts/backup.sh` (Pflicht vor jedem Schema-Eingriff, siehe AGENTS.md).
2. Eine `bands`-Zeile für die bestehende Band anlegen.
3. Allen bestehenden `songs`/`setlists`/`events` diese `bandId` zuweisen.
4. Für jeden bestehenden User eine `band_members`-Zeile mit seiner bisherigen `role` anlegen.
5. `users.role` droppen.

Läuft als einmaliges Migrationsskript zusätzlich zur regulären Drizzle-Migration, nicht als
manueller Schritt — Ausführung ändert `data/` und muss deshalb wie jede Schema-Änderung
zuerst gegen ein frisches Backup laufen (siehe Stolperfalle „Schema-Änderung bei laufendem
Dev-Server" in AGENTS.md).

## Explizit außerhalb von Welle 4

Öffentliches Self-Service-Signup („fremde Person registriert ihre eigene Band selbst") ist im
Datenmodell nicht ausgeschlossen (`bands`, `invites` sind dafür geeignet), aber es gibt in
Welle 4 keine öffentliche Anmeldeseite, keine Email-Verifizierung für Fremdregistrierung und
keine Rechtstexte dafür. Eigener Punkt unter „Später / bei Bedarf" in `FEATURES.md`.

## Verifikation (bei Umsetzung)

Kein Test-Framework-Wechsel — wie gehabt Vitest + Browser-Durchlauf. Mindestens: das oben
beschriebene Zwei-Band-Scoping-Sicherheitsnetz, ein Durchlauf durch alle drei Rollen
(Super-Admin, Band-Admin, Mitglied) inklusive Band-Wechsel bei einem Mehrfach-Mitglied, beide
Einladungswege (bekannte/unbekannte Email), sowie eine Kontrolle, dass der ICS-Feed und
`notifyBand()` nach der Umstellung strikt auf die jeweilige Band beschränkt bleiben. Abschluss
wie üblich `npx tsc --noEmit` + `npm run build`.
