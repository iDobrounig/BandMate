# Bühnenmodus: Voll/Notenpult-Umschalter als Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Voll/Notenpult-Dichte-Umschalter in der Bühnenmodus-Kopfzeile zeigt auf schmalen
Bildschirmen nur noch Icons, damit die Kopfzeile ohne Scrollen passt und „Beenden" direkt
sichtbar ist.

**Architektur:** Zwei neue Feather-Stil-Icons in `components/icons.tsx`, verwendet in den
beiden Dichte-Buttons in `components/stage/stage-view.tsx` mit `hidden sm:inline` für den Text
(gleiches Muster wie beim bestehenden „Beenden"-Button).

**Tech Stack:** Next.js App Router (Client Component), Tailwind v4, reine CSS/JSX-Änderung.

## Global Constraints

- Icons im bestehenden Feather-Strich-Stil (`Svg`-Wrapper aus `components/icons.tsx`: 24×24
  Viewbox, `currentColor`, `strokeWidth={2}`, `strokeLinecap="round"`, `strokeLinejoin="round"`).
- Text „Voll"/„Notenpult" bleibt ab `sm:` (≥640px) sichtbar, nur unterhalb davon Icon-only.
- `aria-label` bleibt auf beiden Buttons unabhängig von der Bildschirmgröße gesetzt.
- `overflow-x-auto` auf dem Kopfzeilen-Container bleibt unverändert bestehen.
- Kein DB-Eingriff, keine Migration.
- Kein Test-Framework für diese rein clientseitige UI-Änderung — Verifikation per
  `npx tsc --noEmit`, `npm run build` und Browser-Durchlauf bei 375px Breite.

---

### Task 1: Icons + Umschalter-Buttons

**Files:**
- Modify: `components/icons.tsx`
- Modify: `components/stage/stage-view.tsx`

**Interfaces:**
- Produces: `IconLayoutFull({ className }: IconProps)`, `IconLayoutSplit({ className }: IconProps)`
  — exportiert aus `components/icons.tsx`, gleiche Signatur wie alle anderen Icons dort.

- [ ] **Step 1: Neue Icons in `components/icons.tsx` ergänzen**

Füge am Ende der Datei (nach der letzten Funktion, `IconExpand`) ein:

```tsx

export function IconLayoutFull({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </Svg>
  );
}

export function IconLayoutSplit({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </Svg>
  );
}
```

- [ ] **Step 2: Dichte-Buttons in `stage-view.tsx` umstellen**

In `components/stage/stage-view.tsx`: Import-Zeile

```tsx
import { IconExpand, IconClose } from "@/components/icons";
```

wird zu:

```tsx
import { IconExpand, IconClose, IconLayoutFull, IconLayoutSplit } from "@/components/icons";
```

Der Dichte-Button-Block:

```tsx
          <div className="flex items-center rounded-md border border-line p-0.5">
            <button
              type="button"
              className={`btn btn-stage border-0 ${density === "full" ? "bg-accent/20 text-accent-hi" : "text-mute"}`}
              onClick={() => changeDensity("full")}
            >
              Voll
            </button>
            <button
              type="button"
              className={`btn btn-stage border-0 ${density === "minimal" ? "bg-accent/20 text-accent-hi" : "text-mute"}`}
              onClick={() => changeDensity("minimal")}
            >
              Notenpult
            </button>
          </div>
```

wird zu:

```tsx
          <div className="flex items-center rounded-md border border-line p-0.5">
            <button
              type="button"
              className={`btn btn-stage border-0 ${density === "full" ? "bg-accent/20 text-accent-hi" : "text-mute"}`}
              onClick={() => changeDensity("full")}
              aria-label="Vollständig"
            >
              <IconLayoutFull className="size-5" />
              <span className="hidden sm:inline">Voll</span>
            </button>
            <button
              type="button"
              className={`btn btn-stage border-0 ${density === "minimal" ? "bg-accent/20 text-accent-hi" : "text-mute"}`}
              onClick={() => changeDensity("minimal")}
              aria-label="Notenpult"
            >
              <IconLayoutSplit className="size-5" />
              <span className="hidden sm:inline">Notenpult</span>
            </button>
          </div>
```

Rest der Datei (State, Effects, restliche Kopfzeile, Inhalt-Block mit dem Blitz-Overlay)
bleibt unverändert.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 4: Production-Build**

Run: `npm run build`
Expected: Build erfolgreich

- [ ] **Step 5: Browser-Check**

Dev-Server, Bühnenmodus einer Setliste, Browser-Viewport auf 375px:

1. Kopfzeile passt ohne horizontales Scrollen vollständig in den Viewport, „Beenden" direkt
   sichtbar und tappbar.
2. Dichte-Umschalter zeigt nur die beiden Icons (kein Text), aktiver Zustand weiterhin optisch
   erkennbar (Hintergrund-/Textfarbe wechselt beim Umschalten zwischen Voll/Notenpult).
3. Viewport auf ≥640px (`sm`) vergrößern: Text „Voll"/„Notenpult" erscheint zusätzlich zu den
   Icons.

- [ ] **Step 6: Commit**

```bash
git add components/icons.tsx components/stage/stage-view.tsx
git commit -m "feat: Voll/Notenpult-Umschalter im Bühnenmodus als Icons auf schmalen Bildschirmen"
```
