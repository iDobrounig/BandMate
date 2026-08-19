# Equipment-Bereich — Design

Stand: 19.08.2026

## Problem

Die Band schafft gemeinsam Equipment an (Verstärker, Mikrofone, PA, etc.), wobei sich
einzelne Mitglieder oft mit unterschiedlichen Beträgen an den Anschaffungskosten beteiligen.
Aktuell gibt es dafür keine zentrale Erfassung — wer wieviel zu welchem Gerät beigetragen hat,
ist nirgends dokumentiert. Zusätzlich fehlt ein Ort, um Fotos der Geräte und die zugehörigen
Rechnungen/Belege zu hinterlegen.

## Ziel

Neuer Bereich „Equipment" mit Liste aller angeschafften Geräte und einer Detailansicht pro
Gerät mit allen Stammdaten, den Kostenbeteiligungen der Mitglieder sowie hochgeladenen Fotos
(auch direkt per Smartphone-Kamera) und Rechnungen.

## Entscheidungen

### Kostenbeteiligung

Frei eintragbare Euro-Beträge pro Mitglied (kein Prozent-/Anteilsmodell) — passt zur Realität,
dass die Summe der Beteiligungen nicht zwingend den Anschaffungskosten entsprechen muss (z.B.
wenn die Bandkasse einen Teil trägt). Auf der Detailseite wird die Summe der Beteiligungen den
Anschaffungskosten informativ gegenübergestellt, keine Fehlervalidierung bei Abweichung.
Zusätzlich pro Beteiligung ein einzeiliges Freitextfeld für einen Vermerk (z.B. „per Überweisung",
„inkl. Zubehör").

Kein separates Eigentümer-/Verwahrer-Feld — die Beteiligungen dokumentieren bereits, wer
finanziell involviert ist.

### Felder

Neben Bild/Rechnung und Anschaffungskosten: Name, Kategorie (feste Liste), Anschaffungsdatum,
Standort/Lagerort (Freitext), Zustand/Status (feste Liste), Freitext-Notizen.

### Dateien (Fotos & Rechnungen)

Eigene, zu `attachments` parallele Tabelle `equipmentAttachments` statt Umbau der bestehenden,
produktiv genutzten `attachments`-Tabelle auf ein polymorphes Modell (entityType/entityId) —
das hätte Migration von echten Nutzerdaten und Anpassung des laufenden Songs-Codes bedeutet,
ohne Mehrwert für dieses Feature. Etwas Code-Duplikation (Upload-Handling, Auslieferungs-Route)
wird zugunsten von Isolation und Risikominimierung in Kauf genommen.

Mehrere Dateien pro Gerät, kategorisiert über `kind: "foto" | "rechnung"` (analog `attachments.kind`
bei Songs: `"audio" | "sheet"`). Upload erst auf der Detailseite nach dem Anlegen des Geräts
(Attachments brauchen eine existierende `equipmentId`) — wie bei Songs.

Foto-Upload unterstützt `capture="environment"` für direkten Kamera-Zugriff auf dem Smartphone,
zusätzlich normale Dateiauswahl. Rechnung akzeptiert Bilder und PDF, ohne `capture`.

### Berechtigungen

Alle eingeloggten Mitglieder dürfen Equipment anlegen, bearbeiten und löschen — analog
Songs/Setlisten/Termine (`requireUser()`), kein `requireAdmin()`-Sonderfall trotz Geldbezug.

### Papierkorb

Equipment und Equipment-Anhänge werden ins bestehende Soft-Delete-/Papierkorb-System integriert
(`lib/trash.ts`), analog zu `"song"` und `"attachment"`. Zwei neue `TrashKind`-Werte:
`"equipment"` und `"equipmentAttachment"`.

### Navigation

Equipment wird vorerst als flacher Punkt in `components/nav-links.tsx` ergänzt. Eine spätere
Gruppierung von „Mitglieder" und „Equipment" unter einem Hauptpunkt „Band" mit Sub-Nav ist
denkbar, aber bewusst **nicht** Teil dieses Designs — eigenes, kleineres Folge-Task bei Bedarf.

## Architektur

### Schema (`lib/db/schema.ts`)

**`equipment`**
- `id` (PK)
- `name` (text, Pflicht)
- `category` (text, Enum `EquipmentCategory`)
- `status` (text, Enum `EquipmentStatus`)
- `acquisitionDate` (integer/timestamp, nullable)
- `acquisitionCost` (real, nullable, Euro)
- `location` (text, nullable)
- `notes` (text, nullable)
- `createdById` (FK → `users.id`)
- `createdAt`, `updatedAt` (timestamp)
- `deletedAt`, `deletedById` (nullable, Soft-Delete-Paar wie bei `songs`)

**`equipmentContributions`** (n:m Equipment↔User, analog `votes`)
- Composite PK `(equipmentId, userId)`
- `amount` (real, Euro)
- `note` (text, nullable) — einzeiliger Vermerk

**`equipmentAttachments`** (1:n zu `equipment`, `onDelete: cascade`, analog `attachments`)
- `id` (PK)
- `equipmentId` (FK)
- `kind` (text, Enum `"foto" | "rechnung"`)
- `storedName`, `originalName`, `mime`, `size`
- `uploadedById` (FK → `users.id`)
- `createdAt`
- `deletedAt`, `deletedById` (nullable, Soft-Delete-Paar)

Exportierte `$inferSelect`-Types (`Equipment`, `EquipmentContribution`, `EquipmentAttachment`,
`EquipmentCategory`, `EquipmentStatus`) analog den bestehenden Song-Types.

Migration via `npm run db:generate`. **Vor der Schema-Arbeit Dev-Server stoppen oder
`./scripts/backup.sh` laufen lassen** (Auto-Migration beim Neuladen von `lib/db/schema.ts`).

### Konstanten (`lib/constants.ts`)

- `EQUIPMENT_CATEGORY`: `Record<EquipmentCategory, {label, badge}>` + `EQUIPMENT_CATEGORY_ORDER`
  — Werte: Verstärker, Mikrofon, Kabel/Zubehör, Lautsprecher/PA, Licht, Sonstiges
- `EQUIPMENT_STATUS`: `Record<EquipmentStatus, {label, badge}>` + `EQUIPMENT_STATUS_ORDER`
  — Werte: in Nutzung, verliehen, defekt, ausgemustert
- `EQUIPMENT_PHOTO_MAX_BYTES`, `EQUIPMENT_INVOICE_MAX_BYTES`
- `EQUIPMENT_PHOTO_MIMES` (jpg/png/heic), `EQUIPMENT_INVOICE_MIMES` (jpg/png/heic + pdf)

### Dateien & Uploads

- `lib/files.ts`: neue Funktionen `saveEquipmentUpload({file, equipmentId, kind, userId})`,
  `equipmentAttachmentPath(equipmentId, storedName)`, `deleteStoredEquipmentFile(equipmentId, storedName)`
  — gleiche Validierung/Struktur wie die bestehenden Song-Pendants, Speicherort
  `data/uploads/equipment/<equipmentId>/<uuid>.<ext>`
- `lib/queries.ts`: `fetchServableEquipmentAttachment(id)` (Join gegen `equipment`, prüft
  `equipmentAktiv` + `equipmentAttachmentAktiv`)
- `lib/db/filters.ts`: `equipmentAktiv = isNull(equipment.deletedAt)`,
  `equipmentAttachmentAktiv = isNull(equipmentAttachments.deletedAt)`
- `app/api/equipment-files/[id]/route.ts`: 1:1 nach Vorbild von `app/api/files/[id]/route.ts`
  (Auth via `currentUser()`, Range-Support, `Content-Disposition` inline/attachment)

### Server Actions

- `lib/actions/equipment.ts`: `createEquipment`, `updateEquipment`, `deleteEquipment`
  (Soft-Delete) — `FormState`-Signatur wie `lib/actions/songs.ts`, `requireUser()`,
  `revalidatePath("/", "layout")`, Redirect nach Create/Update auf Detailseite
- `lib/actions/equipment-attachments.ts`: `uploadEquipmentAttachment` (FormState, bleibt auf
  Seite), `deleteEquipmentAttachment` (Soft-Delete, kein Rückgabewert) — analog
  `lib/actions/attachments.ts`

### Seiten

- `app/(app)/equipment/page.tsx` — Liste: Server Component, `requireUser()`, Card-Liste analog
  Songs-Liste, Filter (Kategorie, Status, Suche) über `searchParams`, kein Client-State
- `app/(app)/equipment/neu/page.tsx` — dünner Wrapper um `EquipmentForm`
- `app/(app)/equipment/[id]/page.tsx` — Detailansicht: Stammdaten, Foto-Galerie, Rechnungen-Liste
  (Download-Links via `/api/equipment-files/[id]?download`), Beteiligungs-Tabelle (Mitglied,
  Betrag, Vermerk, Summe, Differenz zu Anschaffungskosten), Bearbeiten-/Löschen-Buttons
- `app/(app)/equipment/[id]/bearbeiten/page.tsx` — Bearbeiten, gleiche `EquipmentForm` im Edit-Modus

### Komponenten

- `components/equipment-form.tsx` (Client Component): `useActionState(isEdit ? updateEquipment
  : createEquipment, initial)`, dynamische Beteiligungs-Zeilen (Mitglied-Select aus aktiven
  `users` + Betrag + Vermerk, „+ Zeile"/Entfernen wie bei Song-Links), Live-Summe der
  Beteiligungen mit Hinweis bei Abweichung von den Anschaffungskosten
- `components/icons.tsx`: neues `IconEquipment` im bestehenden SVG-Stil
- `components/nav-links.tsx`: neuer Eintrag `{ href: "/equipment", label: "Equipment", Icon:
  IconEquipment }`

### Papierkorb (`lib/trash.ts`)

- `TrashKind` erweitert um `"equipment"` und `"equipmentAttachment"`
- `fetchTrash`, `restore`, `purge`, `purgeExpired` bekommen je einen neuen Zweig, analog zu
  `"song"`/`"attachment"`

## Verifikation

Browser-Durchlauf (Dev-Server `bandmate-dev`): Equipment anlegen (mit mehreren Beteiligungen +
Vermerk), Foto per Datei-Upload und Kamera-Input hochladen, Rechnung als PDF hochladen, Liste
mit Filtern prüfen, Detailansicht inkl. Summen-Anzeige prüfen, Bearbeiten, einzelnes Foto löschen
und im Papierkorb wiederherstellen, Gerät löschen und im Papierkorb wiederherstellen sowie
endgültig löschen. Abschluss `npx tsc --noEmit` + `npm run build`.
