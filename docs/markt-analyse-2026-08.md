# BandMate — Markt-Analyse August 2026

Stand: 22.08.2026 · Basis: v2.1.0 · Fokus: DACH · Reviewer: Claude (Opus 4.8)

Ausgangsfrage: BandMate ist funktional weit gereift und seit Welle 4 mandantenfähig. Damit
steht die Grundsatzfrage im Raum, ob daraus ein **kommerzielles SaaS-Produkt** oder ein
**ernst gemeintes Open-Source-Projekt** werden soll. Diese Analyse ordnet die Marktlage ein
und leitet daraus konkrete Aufgaben ab.

Wie beim [Projekt-Review](review-2026-07.md) gilt: Dies ist eine Momentaufnahme. Die
abgeleiteten Aufgaben werden in [FEATURES.md](../FEATURES.md) gepflegt (→ „Welle 5 —
Marktreife & Öffnung"); abgearbeitete Punkte werden **hier nicht** nachgeführt.

---

## 1. Die Marktlage (DACH)

Der Markt ist besetzt und wird 2026 sogar voller. Drei Gruppen:

### 1.1 DACH-native Direktkonkurrenten

| Tool | Kernprofil | Preis | Mobile |
|---|---|---|---|
| **BANDZONE** (the.band.zone) | Song-DB mit FoH/Technik-Infos, **GEMA-Export**, Kalender mit Abwesenheit, öffentliches Bandprofil | ab **1,40 €/Mitglied/Monat**, 32-Tage-Test, Einmalkauf möglich | native Apps |
| **BandBook** (bandbook.de) | All-in-One: Termine, Setlisten, Gigplaner, **Finanzen**, Probenplanung, Packlisten, Songkatalog (PDF-Leadsheets) | **2,99 €/Monat pro Band** (bis 10 Mitgl.), 6 Wochen Test | Android-App |
| **Bandbee** (bandbee.com) | Bands, Orchester & **Chöre**; Kalender, Setlisten (Excel-Export), Equipment, Musikersuche | **kostenlos** + Premium 15/29 € | PWA |
| **BandAtlas**, **cloud-band-manager.de** | Neuere Entrants 2026 | — | teils Apps |

### 1.2 Internationaler Platzhirsch

**BandHelper** (bandhelper.com) — seit 13+ Jahren, iOS/Android/Mac/Web, im **deutschen App
Store** präsent. Extrem feature-reich (Repertoire, Schedule, Finance, Stage Plots, **MIDI,
Backing Tracks**, Live-Lyrics/Chords) und mit **$2,25–8/Monat pro Band** sehr günstig. Das
ist der Preis- und Feature-Anker, an dem BandMate gemessen wird.

### 1.3 Semi-pro / pro & US-Markt

BandMGT, SetBook, BandPencil ($49/Monat!), BandSlate, Back On Stage, GigBook — Fokus auf
Booking/CRM/Rechnungen, englischsprachig, andere Zielgruppe.

---

## 2. Wo BandMate steht

### 2.1 Stärken (feature-seitig ganz vorne)

- **Bühnenmodus + „Notenpult"-Ansicht** — Vollbild-Seitenfolge, Wake Lock, Wisch-Navigation.
  Haben die DACH-Nativen so nicht.
- **Browser-Audio-Aufnahme direkt am Song** — Proberaum-Mitschnitt ohne Datei-Transfer.
  Alleinstellung.
- **Transponieren live + Capo-Rechner**, Noten pro Instrument, eingebettetes Metronom.
- **Übe-Status-Ampel, Anwesenheitsstatistik, Repertoire-Gedächtnis** („am längsten nicht
  gespielt").
- **Betriebliche Reife**, wie man sie bei Hobbyprojekten selten sieht: WAL-sicheres Backup +
  geprobter Restore, Soft-Delete/Papierkorb, idempotente Cron-Benachrichtigungen,
  Mandantenfähigkeit mit Tenancy-Tests (210 Tests grün).

### 2.2 Lücken gegen den Markt

- **Keine native Mobile-App** — nur PWA. Für Bühne/Proberaum ist die App-Erwartung real.
- **Kein GEMA-Export** — in DACH das Killer-Feature von BANDZONE für alle, die Auftritte
  melden müssen.
- **Kein Self-Service-Signup, kein i18n, kein Docker** (steht so in FEATURES.md).
- **Betrieb schlank** — ein PM2-Fork + SQLite, kein Cluster. Perfekt fürs eigene Tool,
  Baustelle für Massen-SaaS.

---

## 3. Die entscheidende Zahl: Zahlungsbereitschaft

Alle DACH-Preise clustern bei **1,40–3 € pro Band und Monat**, plus kostenlose Tiers. Das ist
kein Zufall — Hobbybands zahlen ungern für Orga-Software. Konsequenz für den SaaS-Weg:

Bei ~3 €/Band/Monat braucht es **~300 zahlende Bands** für ~900 €/Monat brutto — und dafür
stemmt eine Einzelperson: Self-Signup, Billing, DSGVO/AVV/Rechtstexte, Support,
Mobile-App-Erwartung, Migration auf clusterfähige DB, 24/7-Betrieb. Gegen BandHelper (13
Jahre, Apps, $2) und ein GEMA-fähiges BANDZONE ist das ein sehr steiler Berg für eine sehr
dünne Marge.

---

## 4. Empfehlung: SaaS vs. Open Source

| Weg | Bewertung | Begründung |
|---|---|---|
| **A — Massen-SaaS** | eher nein | Besetzter Markt, niedrige Zahlungsbereitschaft, fehlende App und fehlender GEMA-Export als Einstiegshürden, plus der ganze nicht-technische Overhead auf einer Person. |
| **B — Open Source** | **empfohlen** | *Kein* Wettbewerber ist self-hostbar. „Das einzige ernstzunehmende, self-hosted, datensouveräne Bandtool" ist eine verteidigbare Positionierung — für datenschutzbewusste Vereine, Musikschulen, Chöre/Orchester, technische Bands. Die betriebliche Reife wird dort zum Verkaufsargument. |
| **C — Open Core / Managed Hosting** | wenn Monetarisierung | Code bleibt MIT + self-host; optional eine gehostete Instanz für Nicht-Techniker (pauschal pro Band/Jahr). Monetarisiert Bequemlichkeit ohne vollen SaaS-Betriebszwang. |

**Ehrlichster Fit: Weg B mit offener Tür zu C.** Beide teilen dasselbe Fundament — es gibt
einen *No-Regret*-Startpunkt, der die eigentliche Richtungsentscheidung noch offen lässt.

---

## 5. Abgeleitete Aufgaben (→ Welle 5)

Das **No-Regret-Bündel** hilft OSS *und* einem späteren Hosting — dafür muss die
SaaS-vs-OSS-Frage nicht entschieden sein:

1. **Docker-Compose** — größter Adoptions-Blocker. „In 5 Minuten läuft's" statt VPS + PM2 +
   nginx + Node-Jonglage.
2. **i18n-Minimalgerüst** — UI ist heute komplett deutsch hartkodiert. Ein schlankes Gerüst
   (DE zuerst, EN als Beweis) vervielfacht die mögliche Community, ohne alles sofort zu
   übersetzen.
3. **Contribution-Reife** — die README lädt schon zu Beiträgen ein; das Projekt dafür rüsten:
   EN-README, `CONTRIBUTING.md`, Screenshots/Demo, „good first issue"-Issues, Lizenz-Klarheit.

Dazu der stärkste einzelne DACH-Differenzierer:

4. **GEMA-Export** — Setlist im GEMA-kompatiblen Format exportieren. Schließt die auffälligste
   inhaltliche Lücke gegenüber BANDZONE.

**Bewusst nicht auf dem kritischen Pfad:** native Mobile-App und Web-Push (App-Erwartung,
aber Adoption entscheidet sich an Punkt 1–3), Self-Service-Signup und SQLite→MariaDB
(gehören zum Open-Core-Zweig, stehen bereits unter „Später").

---

## 6. Quellen

- BandHelper — https://www.bandhelper.com/
- BANDZONE — https://the.band.zone/en
- BandBook — https://www.bandbook.de/
- Bandbee — https://www.bandbee.com/
- Vergleich BANDZONE vs. BandHelper — https://bandup.blog/musikblog/bandalltag/bandzone-vs-bandhelper-die-beste-bandhelper-alternative-fuer-bandverwaltung
- Best Band Management Software 2026 (StagePortal) — https://stageportal.gg/blog/best-band-management-software/
- Amateurmusik in Deutschland (miz.org) — https://miz.org/en/statistics/amateur-music-making-in-germany
