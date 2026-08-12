# Bühnenmodus: Voll/Notenpult-Umschalter an Druckansicht-Optik angleichen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Voll/Notenpult-Umschalter in der Bühnenmodus-Kopfzeile bekommt die gleiche
Pillen-Optik wie `PrintViewSwitcher` in der Druckansicht (volle Amber-Füllung bei aktivem Tab,
`rounded-full`), ohne die größere Touch-Fläche zu verlieren.

**Architektur:** Reine Klassen-Änderung an einer bestehenden Stelle in
`components/stage/stage-view.tsx`, keine neuen Komponenten/Props.

**Tech Stack:** Next.js App Router (Client Component), Tailwind v4.

## Global Constraints

- Icon-Größe, Padding (`px-2 sm:px-4`), `aria-label`, Klick-Handler und Text-Sichtbarkeit
  (`hidden sm:inline`) bleiben unverändert — nur Farb-/Formklassen ändern sich.
- Touch-Target bleibt ≥44px (`.btn-stage`s `min-h-11 min-w-11` bleibt aktiv).
- Kein DB-Eingriff, keine Migration.
- Kein Test-Framework für diese rein clientseitige CSS-Änderung — Verifikation per
  `npx tsc --noEmit`, `npm run build` und visuellem Vergleich mit `PrintViewSwitcher`.

---

### Task 1: Umschalter-Klassen angleichen

**Files:**
- Modify: `components/stage/stage-view.tsx`

- [ ] **Step 1: Dichte-Umschalter-Block anpassen**

Ersetze in `components/stage/stage-view.tsx`:

```tsx
          <div className="flex items-center rounded-md border border-line p-0.5">
            <button
              type="button"
              className={`btn btn-stage border-0 px-2 sm:px-4 ${density === "full" ? "bg-accent/20 text-accent-hi" : "text-mute"}`}
              onClick={() => changeDensity("full")}
              aria-label="Vollständig"
            >
              <IconLayoutFull className="size-5" />
              <span className="hidden sm:inline">Voll</span>
            </button>
            <button
              type="button"
              className={`btn btn-stage border-0 px-2 sm:px-4 ${density === "minimal" ? "bg-accent/20 text-accent-hi" : "text-mute"}`}
              onClick={() => changeDensity("minimal")}
              aria-label="Notenpult"
            >
              <IconLayoutSplit className="size-5" />
              <span className="hidden sm:inline">Notenpult</span>
            </button>
          </div>
```

durch:

```tsx
          <div className="flex items-center rounded-full border border-line bg-raise p-0.5">
            <button
              type="button"
              className={`btn btn-stage border-0 rounded-full px-2 sm:px-4 ${density === "full" ? "bg-accent font-semibold text-[#1a1508]" : "bg-transparent text-mute hover:text-ink"}`}
              onClick={() => changeDensity("full")}
              aria-label="Vollständig"
            >
              <IconLayoutFull className="size-5" />
              <span className="hidden sm:inline">Voll</span>
            </button>
            <button
              type="button"
              className={`btn btn-stage border-0 rounded-full px-2 sm:px-4 ${density === "minimal" ? "bg-accent font-semibold text-[#1a1508]" : "bg-transparent text-mute hover:text-ink"}`}
              onClick={() => changeDensity("minimal")}
              aria-label="Notenpult"
            >
              <IconLayoutSplit className="size-5" />
              <span className="hidden sm:inline">Notenpult</span>
            </button>
          </div>
```

(Nur Klassen geändert: äußerer Container `rounded-md` → `rounded-full` + `bg-raise`;
beide Buttons zusätzlich `rounded-full`; aktiver Zustand `bg-accent/20 text-accent-hi` →
`bg-accent font-semibold text-[#1a1508]`; inaktiver Zustand `text-mute` →
`bg-transparent text-mute hover:text-ink`. Handler, Props, Icons, Text unverändert.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 3: Production-Build**

Run: `npm run build`
Expected: Build erfolgreich

- [ ] **Step 4: Browser-Check**

Bühnenmodus einer Setliste öffnen: Umschalter ist jetzt eine durchgehende Pille, aktiver Tab
voll amber gefüllt mit dunklem Text (Icon eingeschlossen), inaktiver Tab transparent mit
gedämpftem Text. Optisch vergleichbar mit dem Umschalter auf `/setlisten/[id]/druck`. Touch-
Target weiterhin ≥44px, Kopfzeile weiterhin ohne Scrollen nutzbar (aus vorheriger
Nachbesserung).

- [ ] **Step 5: Commit**

```bash
git add components/stage/stage-view.tsx
git commit -m "style: Voll/Notenpult-Umschalter im Bühnenmodus an Druckansicht-Optik angleichen"
```
