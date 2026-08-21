# Floating-Nav Umbau — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die obere Leiste entfällt; Navigation und Menü (Profil/Hilfe/Papierkorb/Logout) wandern in eine zentrierte Floating-Bar am unteren Bildschirmrand.

**Architecture:** Rein präsentativer Umbau. Die primären Nav-Links (`components/nav-links.tsx`) werden für die Bottom-Bar umgestylt (mobil nur Icons, Desktop Icon + Label). Ein neues Client-Popup (`components/app-menu.tsx`) bündelt Profil/Hilfe/Papierkorb/Logout hinter einem Menü-Button rechts. Das App-Layout (`app/(app)/layout.tsx`) verliert Header und Footer, rendert stattdessen einen fixierten Floating-Container um beide Komponenten und gibt dem Content unten Platz. Das Branding zieht auf die Dashboard-Seite.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind v4 (Theme-Tokens aus `app/globals.css`). Keine DB-, Auth- oder Server-Action-Änderungen.

**Spec:** Kein separates Spec-Dokument — Anforderungen aus dem User-Screenshot (Affinity-Export) und den geklärten Antworten, zusammengefasst unter „Global Constraints".

## Global Constraints

- **UI-Sprache Deutsch**, deutsche URLs (`/profil`, `/hilfe`, `/papierkorb`).
- **Mobil:** Nav-Items nur Icons. **Desktop (`lg`):** Icons + Textlabel.
- **Floating-Bar:** zentriert am unteren Rand, `fixed`, Breite = Inhalt (nicht voll), abgerundet, mit Rahmen + Schatten, **opak** (`bg-panel`) — **kein `backdrop-blur`** (Render-Artefakt-Falle laut AGENTS.md).
- **Menü-Popup** öffnet nach oben, enthält in dieser Reihenfolge: Profil (mit Nutzername), Hilfe, Papierkorb, Logout. Schließt bei Klick außerhalb und mit Escape. Papierkorb bleibt für alle sichtbar (keine Rollen-Gate).
- **Branding:** obere Leiste komplett entfernt. Logo (`/icon-192.png` + Schriftzug „BandMate") nur oben auf dem Dashboard, ersetzt den bisherigen `● BandMate`-Eyebrow.
- Theme-Tokens verwenden: `bg-panel`, `bg-raise`, `border-line`, `border-line-soft`, `text-ink`, `text-mute`, `text-faint`, `text-accent`, `text-accent-hi`, `bg-accent/15`.
- Alle Nav-/Menü-Container tragen `print-hidden` (wie bisher Header/Footer).
- **Keine Testframework-Schritte** — Verifikation per `npx tsc --noEmit`, `npm run build` und Browser-Durchlauf (`bandmate-dev`, Port 3000). Vor dem Start Dev-Server ggf. laufen lassen; keine Schema-Änderungen, daher unkritisch für `data/`.
- Commits deutsch, ein Feature-Block pro Commit.

---

## File Structure

- **Create:** `components/app-menu.tsx` — Client-Popup (Menü-Button + Overlay mit Profil/Hilfe/Papierkorb/Logout).
- **Modify:** `components/nav-links.tsx` — Styling für die Bottom-Bar (Icon-only mobil, Icon + Label Desktop).
- **Modify:** `app/(app)/layout.tsx` — Header + Footer raus, fixierter Floating-Container um `<NavLinks/>` + `<AppMenu/>`, Bottom-Padding im `<main>`.
- **Modify:** `app/(app)/page.tsx` — Logo-Block statt `● BandMate`-Eyebrow.

---

### Task 1: AppMenu-Popup-Komponente

**Files:**
- Create: `components/app-menu.tsx`
- Test: Browser-Durchlauf (nach Task 3 sichtbar) + `npx tsc --noEmit`

**Interfaces:**
- Consumes: `LogoutForm` aus `@/components/logout-form` (Props: `className`, `ariaLabel`, `title`, `children`; enthält bereits `confirm("Wirklich abmelden?")`). Icons `IconUser`, `IconHelp`, `IconTrash`, `IconLogout` aus `@/components/icons`.
- Produces: `export function AppMenu({ userName }: { userName: string })` — wird von `layout.tsx` mit `userName={user.name}` gerendert.

- [ ] **Step 1: Komponente anlegen**

Datei `components/app-menu.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconUser, IconHelp, IconTrash, IconLogout } from "@/components/icons";
import { LogoutForm } from "@/components/logout-form";

export function AppMenu({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-mute transition hover:bg-raise hover:text-ink";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="Menü"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center rounded-xl p-2.5 transition ${
          open ? "bg-accent/15 text-accent-hi" : "text-mute hover:bg-raise hover:text-ink"
        }`}
      >
        <IconUser className="size-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 mb-2 w-52 rounded-xl border border-line bg-panel p-1.5 shadow-xl"
        >
          <Link
            role="menuitem"
            href="/profil"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <IconUser className="size-4" />
            <span className="truncate">{userName}</span>
          </Link>
          <Link
            role="menuitem"
            href="/hilfe"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <IconHelp className="size-4" />
            Hilfe
          </Link>
          <Link
            role="menuitem"
            href="/papierkorb"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <IconTrash className="size-4" />
            Papierkorb
          </Link>
          <div className="my-1 h-px bg-line-soft" />
          <LogoutForm
            ariaLabel="Abmelden"
            title="Abmelden"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-faint transition hover:bg-raise hover:text-ink cursor-pointer"
          >
            <IconLogout className="size-4" />
            Abmelden
          </LogoutForm>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler in `components/app-menu.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/app-menu.tsx
git commit -m "Floating-Nav: AppMenu-Popup mit Profil/Hilfe/Papierkorb/Logout"
```

---

### Task 2: NavLinks für die Bottom-Bar umstylen

**Files:**
- Modify: `components/nav-links.tsx` (JSX in der `.map`-Schleife und Wrapper-`<nav>`)
- Test: Browser-Durchlauf (nach Task 3) + `npx tsc --noEmit`

**Interfaces:**
- Consumes: unverändert `usePathname`, Icon-Komponenten, `links`-Array.
- Produces: `export function NavLinks()` (Signatur unverändert) — rendert eine kompakte Icon-Reihe; Label ab `lg` sichtbar.

- [ ] **Step 1: Wrapper und Link-Styling ersetzen**

In `components/nav-links.tsx` den `return (...)`-Block (aktuell `<nav className="flex items-stretch justify-between ...">` … `</nav>`) ersetzen durch:

```tsx
  return (
    <nav className="flex items-center gap-0.5">
      {links.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={label}
            className={`flex items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold leading-none transition ${
              active
                ? "bg-accent/15 text-accent-hi"
                : "text-mute hover:bg-raise hover:text-ink"
            }`}
          >
            <Icon className="size-5" />
            <span className="hidden whitespace-nowrap lg:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
```

Hinweis: `aria-label` + `title` bleiben, damit die Icons auch ohne sichtbares Label (mobil) benannt sind.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add components/nav-links.tsx
git commit -m "Floating-Nav: NavLinks als kompakte Icon-Reihe (Label ab Desktop)"
```

---

### Task 3: Layout umbauen — Header/Footer raus, Floating-Container rein

**Files:**
- Modify: `app/(app)/layout.tsx` (komplettes JSX)
- Test: Browser-Durchlauf `bandmate-dev` + `npx tsc --noEmit`

**Interfaces:**
- Consumes: `AppMenu` aus `@/components/app-menu` (Task 1), `NavLinks` aus `@/components/nav-links` (Task 2), `requireUser`, `VersionWatcher`.
- Produces: das App-Shell-Layout mit fixierter Bottom-Nav; keine öffentlichen Symbole für spätere Tasks.

- [ ] **Step 1: layout.tsx ersetzen**

`app/(app)/layout.tsx` vollständig ersetzen durch:

```tsx
import { requireUser } from "@/lib/auth";
import { NavLinks } from "@/components/nav-links";
import { AppMenu } from "@/components/app-menu";
import { VersionWatcher } from "@/components/version-watcher";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-28">
        <VersionWatcher />
        {children}
      </main>

      <div className="print-hidden pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-line bg-panel p-1.5 shadow-xl">
          <NavLinks />
          <div className="h-8 w-px shrink-0 bg-line-soft" aria-hidden />
          <AppMenu userName={user.name} />
        </div>
      </div>
    </div>
  );
}
```

Wegfall gegenüber vorher: `Link`, `LogoutForm`, `IconUser/IconLogout/IconHelp/IconTrash`-Imports (nicht mehr genutzt), der gesamte `<header>` und der `<footer>`. Der Papierkorb-Link ist jetzt im `AppMenu`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler, keine „unused import"-Reste.

- [ ] **Step 3: Dev-Server starten und visuell prüfen**

Browser-Pane: `preview_start` mit `{ name: "bandmate-dev" }`, einloggen, dann Dashboard öffnen.
Erwartet:
- Keine obere Leiste mehr, kein Footer.
- Unten mittig eine schwebende Bar mit 6 Icons + Trennstrich + Menü-Button.
- Content wird nicht von der Bar verdeckt (Padding unten greift).

- [ ] **Step 4: Menü-Popup testen**

Menü-Button (rechts, Personen-Icon) klicken → Popup öffnet nach oben mit Profil (Nutzername), Hilfe, Papierkorb, Logout.
- Klick außerhalb schließt.
- Escape schließt.
- Klick auf „Profil" navigiert nach `/profil` und schließt.
Prüfen via `read_page`/`computer` und `read_console_messages` (keine Fehler).

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/layout.tsx
git commit -m "Floating-Nav: obere Leiste und Footer durch schwebende Bottom-Nav ersetzt"
```

---

### Task 4: Branding aufs Dashboard

**Files:**
- Modify: `app/(app)/page.tsx` (Eyebrow im Kopf des `return`-Blocks, ~Zeile 63–66)
- Test: Browser-Durchlauf Dashboard + `npx tsc --noEmit`

**Interfaces:**
- Consumes: statisches Asset `public/icon-192.png` (existiert bereits).
- Produces: keine.

- [ ] **Step 1: Eyebrow durch Logo-Block ersetzen**

In `app/(app)/page.tsx` diesen Absatz:

```tsx
          <p className="mono-display text-xs uppercase tracking-[0.3em] text-accent">
            ● BandMate
          </p>
```

ersetzen durch:

```tsx
          <div className="mb-1 flex items-center gap-2">
            <img
              src="/icon-192.png"
              alt=""
              className="size-7 rounded-lg"
            />
            <span className="headline text-lg leading-none text-accent">
              BandMate
            </span>
          </div>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 3: Dashboard prüfen**

Browser: Dashboard neu laden. Erwartet: Logo (Icon + „BandMate") oben links über „Servus, {Vorname}!", der alte `● BandMate`-Text ist weg.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/page.tsx
git commit -m "Floating-Nav: Band-Logo am Dashboard statt Header-Schriftzug"
```

---

### Task 5: Gesamt-Verifikation über Breakpoints

**Files:**
- Test: `npx tsc --noEmit`, `npm run build`, Browser über mehrere Viewports.

- [ ] **Step 1: Typecheck + Build**

Run: `npx tsc --noEmit && npm run build`
Expected: beide fehlerfrei.

- [ ] **Step 2: Mobil (375px)**

`resize_window` Preset `mobile`, Dashboard + eine Unterseite (z. B. `/songs`).
Erwartet: Nav-Items **nur Icons**, Bar passt in die Breite (bei Bedarf horizontal scrollbar), aktive Seite ist per Accent hervorgehoben, Menü-Popup öffnet innerhalb des Viewports.

- [ ] **Step 3: Desktop (1280px)**

`resize_window` Preset `desktop`.
Erwartet: Nav-Items **Icon + Label**, Bar nur so breit wie ihr Inhalt und mittig, Menü-Button so schmal wie nötig.

- [ ] **Step 4: Screenshot als Nachweis**

`computer {action: "screenshot"}` je einmal mobil und desktop an den User schicken.

- [ ] **Step 5: FEATURES.md / CHANGELOG nachziehen (Projektkonvention)**

Kurzen Eintrag zum Nav-Redesign in `FEATURES.md` ergänzen (und ggf. CHANGELOG, falg vor Release). Commit:

```bash
git add FEATURES.md
git commit -m "docs: Floating-Nav-Redesign in FEATURES.md nachtragen"
```

---

## Self-Review

- **Spec-Abdeckung:** obere Leiste entfernt (T3) · Bottom-Nav zentriert/floating (T3) · mobil Icons / Desktop Icon+Label (T2, verifiziert T5) · Menü-Popup mit Profil/Hilfe/Papierkorb/Logout + außerhalb/Escape schließen (T1, verifiziert T3) · Papierkorb aus Footer ins Popup (T1/T3) · Logo aufs Dashboard (T4). Alle Punkte haben eine Task.
- **Platzhalter:** keine — jeder Code-Step enthält vollständigen Code.
- **Typ-Konsistenz:** `AppMenu({ userName: string })` in T1 definiert, in T3 als `userName={user.name}` genutzt. `NavLinks()` Signatur unverändert. Icons/`LogoutForm`-Props gegen bestehende Dateien geprüft (`size-4`/`size-5` sind gültige Tailwind-Klassen; `size-4.5` bewusst vermieden).
- **Offener Abwägungspunkt für die Umsetzung:** Falls 6 Icons + Menü mobil doch zu eng werden, ist die Bar via `overflow-x-auto` scrollbar; alternativ könnten selten genutzte Items ins Popup wandern — erst bei sichtbarem Bedarf entscheiden (T5, Step 2).
