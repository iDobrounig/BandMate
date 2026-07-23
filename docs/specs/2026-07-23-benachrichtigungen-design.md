# Welle 1 — Aktivierung: Benachrichtigungen, die ankommen

Stand: 23.07.2026 · Basis: v1.10.1 + Restore-Script
Anlass: [docs/review-2026-07.md](../review-2026-07.md), Abschnitt 2.2 („Der Nutzungs-Todeszyklus")

## Problem

BandMate ist eine reine Pull-App: Es passiert nur etwas, wenn jemand aktiv die Seite
öffnet. Es gibt keinen einzigen Kanal, der Leute zurückholt — keine Terminerinnerung,
keine Zusammenfassung, keine Nachfrage bei offenen Zusagen. Der typische Verlauf solcher
Werkzeuge: Woche 1 begeistert, Woche 4 nur noch der Betreiber, Monat 3 tot.

Dazu kommt eine Erfahrung aus dem Betrieb: Der SMTP-Versand war **wochenlang kaputt**
(`SMTP_SECURE=true` auf Port 587), und niemand hat es gemerkt — `notifyBand()` ist
fire-and-forget und schreibt Fehler nur ins Log. Bei Erinnerungen wäre ein stiller Ausfall
schlimmer als heute: Dann verlässt sich die Band darauf, erinnert zu werden, und niemand
kommt zur Probe.

**Welle 1 muss deshalb zwei Dinge liefern, nicht eines:** Nachrichten, die von selbst
rausgehen — und die Gewissheit, dass sie es tun.

## Entscheidungen

Alle am 23.07.2026 mit Ingo abgestimmt.

### E1 — System-Cron als Auslöser

Wie `backup.sh` und `trash:purge`: eine Zeile in derselben crontab.

*Warum:* Konsistent mit dem bestehenden Betriebsmodell, der Web-Prozess bleibt ein
Web-Prozess, und der Versand ist einzeln aufrufbar und damit testbar.

*Preis:* Wird der Cron vergessen, passiert stillschweigend nichts. Genau dagegen ist E3
gerichtet — die beiden Entscheidungen gehören zusammen und dürfen nicht getrennt
umgesetzt werden.

*Verworfen:* Zeitgeber im App-Prozess (heilt sich zwar nach Ausfällen selbst, hängt aber
einen Scheduler in den Web-Prozess und ist schlechter testbar); Cron ruft HTTP-Route
(neue von außen erreichbare Fläche, ohne Nutzen bei vorhandenem Shell-Zugang).

### E2 — Pro Ereignistyp: sofort · gesammelt · nie

Statt des heutigen einen `notifyByEmail`-Schalters eine Matrix.

*Warum:* Der eine Schalter ist der Grund, warum jemand Benachrichtigungen ganz abdreht —
wer den Vorschlags-Spam loswerden will, verliert damit auch jede Gig-Ankündigung. „Gesammelt"
heißt: erscheint im Wochen-Digest statt einzeln, also keine Doppelung.

*Struktur:* `(user, kind, channel, mode)`. Der Kanal ist heute immer `mail`. Er steht
trotzdem schon in der Tabelle, damit **Web Push später ohne zweite Schema-Migration und
ohne Umbau der Profilseite dazukommt** — siehe „Nicht im Umfang".

### E3 — Statuszeile auf dem Dashboard, nur für Admins

> Letzter Erinnerungslauf: heute 06:00 · 3 Mails · keine Fehler

Rot und auffällig, sobald der letzte Lauf älter als zwei Tage ist oder Fehler enthält.

*Warum:* Fängt beide Fehlerfälle ab — kaputten Versand *und* vergessenen Cron — und zwar
dort, wo der Admin ohnehin täglich hinschaut. Eine Warnmail wäre das falsche Mittel: Ist der
Versand kaputt, kommt genau sie nicht an. Eine Log-Ansicht unter `/mitglieder` wäre sauber
einsortiert, aber niemand geht hin, solange er keinen Verdacht hat.

### E4 — Zwei Erinnerungen mit verschiedenem Zweck

| Wann | An wen | Inhalt |
|---|---|---|
| 2 Tage vorher | alle **ohne** Rückmeldung | „Du hast noch nicht zugesagt", Direktlink |
| Vortag | alle mit **ja** oder **vielleicht** | Ort, Uhrzeit, Probe-Agenda |

*Warum:* Die erste holt fehlende Zusagen ein, solange noch umdisponiert werden kann; die
zweite ist die eigentliche Erinnerung. Nie zwei gleiche Mails an dieselbe Person.

## Ohne Rückfrage gesetzt

- **`VALARM` im ICS-Feed** ([lib/calendar.ts](../../lib/calendar.ts)): Termine kommen heute
  ohne Wecker im Kalender an. Zwei Alarme je Termin — `-P1D` (Vortag zur selben Zeit) und
  `-PT2H` (zwei Stunden vorher). Fünf Zeilen, und jedes Mitglied bekommt eine native
  Erinnerung vom eigenen Handy, ohne Berechtigung, ohne Service Worker, unabhängig von
  jedem Mailversand. Der billigste Gewinn dieser Welle.
- **Versand-Log**: für Idempotenz ohnehin nötig, damit ein doppelter Cron-Lauf keine
  Doppelmails erzeugt. Zugleich Grundlage für E3.

## Schema

```ts
// Was will wer, worüber, wie?
notificationSettings = {
  userId, kind, channel, mode        // PK (userId, kind, channel)
}
// kind:    suggestion | comment | event_new | event_changed | reminder
// channel: mail                     (push kommt später dazu)
// mode:    sofort | gesammelt | nie
```

`reminder` kennt nur `sofort` und `nie` — eine Erinnerung im Wochen-Digest wäre sinnlos. Die
Profilseite bietet „gesammelt" dort erst gar nicht an.

```ts
// Was ist rausgegangen? Verhindert Doppelversand, trägt E3.
notificationLog = {
  id, kind, refType, refId, userId,  // UNIQUE (kind, refType, refId, userId)
  sentAt, status, error              // status: ok | fehler
}

// Was hat der Cron getan? Auch "gelaufen, nichts zu tun" ist eine Information,
// die im Log fehlen würde.
notificationRuns = {
  id, art, startedAt, finishedAt, sentCount, errorCount, note
}

users.lastSeenAt                     // für "neu seit deinem letzten Besuch"
users.digestEnabled                  // Wochen-Digest überhaupt erhalten
```

**Datenmigration:** Der bestehende `users.notifyByEmail` wird in die Matrix überführt —
`true` → alle Typen `sofort`, `false` → alle `nie` —, danach entfällt die Spalte. Das
erzeugt `drizzle-kit` nicht von selbst; das `INSERT ... SELECT` kommt von Hand in die
Migrationsdatei. Vor dem Deploy greift der Pre-Migration-Snapshot aus Welle 0.

## Versand

`scripts/notify.ts` mit Unterbefehl, zwei npm-Skripte:

```cron
0  6 * * *  cd … && npm run notify:reminders   # täglich früh
0 18 * * 0  cd … && npm run notify:digest      # sonntags abends
```

Beide laden die `.env` über `loadEnvConfig` und importieren `lib/db` erst danach dynamisch —
dieselbe Falle wie bei `trash:purge`, siehe [AGENTS.md](../../AGENTS.md).

**Idempotenz:** Vor jedem Versand ein Blick ins Log. Läuft der Cron zweimal, passiert beim
zweiten Mal nichts. Fällt ein Tag aus, wird **nicht** nachgeholt — eine Erinnerung für einen
Termin, der schon war, ist Lärm.

**Fehlerbehandlung:** Anders als `notifyBand()` wird hier auf jeden Versand gewartet und das
Ergebnis je Empfänger ins Log geschrieben. Ein Fehler bricht den Lauf nicht ab, aber er wird
gezählt und macht die Statuszeile rot.

## Digest (sonntags)

Nur verschicken, wenn es etwas zu berichten gibt. Enthält:

- alles, was seit dem letzten Digest als `gesammelt` angefallen ist
- kommende Termine mit dem **eigenen** Rückmeldungsstand
- Vorschläge ohne meine Stimme
- was auf der Agenda der nächsten Probe steht

## Dashboard: „Was muss ich tun?"

Neuer Block **ganz oben**, vor „Heiße Vorschläge". Alle Daten liegen bereits in der DB:

- offene Zu-/Absagen für die nächsten 14 Tage
- Vorschläge ohne meine Stimme
- Songs der nächsten Probe-Agenda, die ich noch nicht „kann"
- neue Kommentare seit meinem letzten Besuch (`lastSeenAt`, höchstens stündlich fortgeschrieben)
- **nur Admin:** die Statuszeile aus E3

Ist nichts offen, verschwindet der Block ganz — er soll nicht zur Tapete werden.

## „Band benachrichtigen" beim Bearbeiten von Terminen

Fehlt heute komplett ([components/event-forms.tsx:145](../../components/event-forms.tsx)) —
eine Gig-Verschiebung erreicht niemanden. Checkbox auch im Bearbeiten-Modus; die Mail nennt
**was** sich geändert hat (alt → neu), nicht nur dass sich etwas geändert hat. Beim Anlegen
künftig per Default **an** statt aus.

## Nicht im Umfang

- **Web Push.** Machbar und nicht besonders komplex (~300–400 Zeilen mit `web-push`), aber
  die falsche Reihenfolge: Der Wert dieser Welle liegt im Inhalt und Zeitpunkt der
  Nachrichten, und den liefert E-Mail vollständig. Dazu zwei harte Einschränkungen, die
  ausgerechnet für eine Band schlecht passen — auf iOS funktioniert Push **nur**, wenn die
  Seite vorher über „Zum Homescreen hinzufügen" installiert wurde (sonst bekommt die Person
  stillschweigend nichts), und eine einmal abgelehnte Berechtigung lässt sich nicht erneut
  erfragen. Kommt als eigener Punkt, sobald Welle 1 steht; die `channel`-Spalte aus E2 hält
  den Platz frei.
- Erinnerungen für Songvorschläge oder Setlisten. Termine sind der Fall mit echter Frist.
- Nachholen ausgefallener Läufe (siehe Idempotenz).

## Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Cron wird nie eingerichtet → alles bleibt still | Statuszeile E3 wird rot, sobald zwei Tage kein Lauf verzeichnet ist. E1 und E3 gehören zusammen. |
| Doppelter Cron-Lauf → Doppelmails | Eindeutigkeit über `(kind, refType, refId, userId)` im Log |
| Zu viele Mails → jemand dreht alles ab | E2: „gesammelt" als Mittelweg statt nur an/aus |
| Datenmigration der Schalter geht schief | Handgeschriebenes `INSERT ... SELECT` mit Test; Pre-Migration-Snapshot aus Welle 0 |
| Mailversand bricht wieder still | Je Empfänger geloggt, Fehler zählen, Statuszeile |

## Umsetzungsreihenfolge

1. **`VALARM` im ICS-Feed** — unabhängig von allem, sofort nützlich, eigener Commit
2. Schema + Datenmigration der bestehenden Schalter, Tests dafür
3. Benachrichtigungs-Matrix auf `/profil` und `/mitglieder`, `notifyBand()` auf `kind` umstellen
4. `scripts/notify.ts` mit Erinnerungen, Log und Idempotenz — Tests gegen die Auswahllogik
   („wer bekommt was, wann, und genau einmal")
5. Digest
6. Dashboard-Block + Statuszeile
7. Termin-Bearbeiten mit Benachrichtigung
8. README (Cron), Hilfe-Seite, FEATURES.md

Schritt 4 ist der Kern und der einzige mit echter Auswahllogik — dort liegt der
Testschwerpunkt.
