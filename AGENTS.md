<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Projekt „Bandraum" — Hinweise für künftige Sessions

Internes Band-Dashboard (deutsche UI) für Ingos Band: Songvorschläge, Noten/Audio,
Voting, Setlisten, Termine. Feature-Stand & Roadmap: `FEATURES.md`. Setup/Deploy: `README.md`.

## Stack & Struktur

- Next.js App Router + TypeScript, Tailwind v4 (Theme in `app/globals.css` via `@theme`)
- SQLite via better-sqlite3 + Drizzle. Schema: `lib/db/schema.ts`, Client-Singleton mit
  Auto-Migration beim Start: `lib/db/index.ts`. Migrationen: `npm run db:generate` → `drizzle/`
- Auth: iron-session (`lib/session.ts`), Guards `requireUser()`/`requireAdmin()` in `lib/auth.ts`
- Server Actions in `lib/actions/*.ts` („use server"), Formular-Actions mit Signatur
  `(prev: FormState, formData) => FormState` für `useActionState`; einfache Button-Actions direkt
- Seiten: `app/(app)/…` (Route-Group mit Auth-Layout + Nav), Login separat unter `app/login`
- Datei-Uploads: `lib/files.ts` → `data/uploads/<songId>/`, Auslieferung (auth + Range-Support):
  `app/api/files/[id]/route.ts`
- E-Mail: `notifyBand()` in `lib/mail.ts` — no-op mit Log, wenn `SMTP_HOST` fehlt
- Akkord-/Transponier-Logik (pure, client-tauglich): `lib/chords.ts`
- Wiederkehrende Termine = materialisierte Einzel-Events mit gemeinsamer `seriesId` (kein RRULE)

## Konventionen

- UI-Sprache Deutsch; URLs deutsch (`/mitglieder`, `/setlisten`, `/termine`, `/profil`)
- Styling über Komponenten-Klassen aus `globals.css`: `.card .btn .btn-primary .btn-sm .input
  .label .badge .headline`; Ziffern/Akkorde mit `.mono-display`
- Status-/Farb-Metadaten zentral in `lib/constants.ts` (`SONG_STATUS`, `EVENT_KIND`,
  `PRACTICE_STATUS`, `ATTENDANCE_STATUS`)
- Nach Mutationen großzügig `revalidatePath("/", "layout")`
- Commits: deutsch, ein Feature-Block pro Commit

## Stolperfallen (bereits erlebt)

- **Drizzle + `sql`-Subqueries**: `${table.column}` wird dort unqualifiziert gerendert →
  Spaltennamen in Subqueries als Roh-SQL qualifizieren (z.B. `songs.id`), sonst
  ambiguous/falsche Bezüge. Siehe `lib/queries.ts`.
- `background-attachment: fixed` + `backdrop-blur` verursachte Render-Artefakte → vermeiden.
- Textareas liefern CRLF (`\r\n`) — `lib/chords.ts` toleriert das; bei neuer Textverarbeitung dran denken.
- Upload-Limit: `next.config.ts` `serverActions.bodySizeLimit: "60mb"`; better-sqlite3 steht in
  `serverExternalPackages`.
- Dev-Server läuft über `.claude/launch.json` (`bandraum-dev`, Port 3000).

## Verifikation

Kein Test-Framework — Verifikation per Browser-Durchlauf (Login → Feature-Flow) plus
`npx tsc --noEmit` und `npm run build`. Testdaten in `data/` (nicht im Git); echte Nutzung
hat begonnen — **Daten in `data/` nie löschen/überschreiben.**
