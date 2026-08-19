import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db, uploadsDir } from "@/lib/db";
import { attachments, equipmentAttachments } from "@/lib/db/schema";
import {
  AUDIO_MAX_BYTES,
  AUDIO_MIMES,
  SHEET_MAX_BYTES,
  SHEET_MIMES,
  EQUIPMENT_PHOTO_MAX_BYTES,
  EQUIPMENT_INVOICE_MAX_BYTES,
  EQUIPMENT_PHOTO_MIMES,
  EQUIPMENT_INVOICE_MIMES,
} from "@/lib/constants";

const EXT_WHITELIST = new Set([
  ".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac",
  ".pdf", ".png", ".jpg", ".jpeg", ".webp",
]);

/**
 * Validiert und speichert einen Upload unter data/uploads/<songId>/,
 * legt den Attachment-Datensatz an. Wirft Error mit deutscher Meldung.
 */
export async function saveUpload(opts: {
  file: File;
  songId: number;
  kind: "audio" | "sheet";
  instrument?: string | null;
  userId: number;
}) {
  const { file, songId, kind, userId } = opts;
  if (!file || file.size === 0) throw new Error("Keine Datei ausgewählt.");

  const maxBytes = kind === "audio" ? AUDIO_MAX_BYTES : SHEET_MAX_BYTES;
  if (file.size > maxBytes) {
    throw new Error(
      `Datei ist zu groß (max. ${Math.round(maxBytes / 1024 / 1024)} MB).`
    );
  }
  const allowed = kind === "audio" ? AUDIO_MIMES : SHEET_MIMES;
  if (!allowed.has(file.type)) {
    throw new Error(
      kind === "audio"
        ? "Nur Audio-Dateien erlaubt (MP3, M4A, WAV, OGG, FLAC)."
        : "Nur PDF oder Bilder erlaubt (PDF, PNG, JPG, WebP)."
    );
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!EXT_WHITELIST.has(ext)) throw new Error("Dateiendung nicht erlaubt.");

  const dir = path.join(uploadsDir, String(songId));
  fs.mkdirSync(dir, { recursive: true });
  const storedName = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, storedName), buffer);

  await db.insert(attachments).values({
    songId,
    kind,
    instrument: kind === "sheet" ? opts.instrument || null : null,
    storedName,
    originalName: file.name,
    mime: file.type,
    size: file.size,
    uploadedById: userId,
  });
}

export function attachmentPath(songId: number, storedName: string) {
  // storedName ist eine UUID+ext aus unserer DB, aber zur Sicherheit normalisieren
  const safe = path.basename(storedName);
  return path.join(uploadsDir, String(songId), safe);
}

export function deleteStoredFile(songId: number, storedName: string) {
  try {
    fs.unlinkSync(attachmentPath(songId, storedName));
  } catch {
    // Datei fehlt schon — ignorieren
  }
}

const EQUIPMENT_EXT_WHITELIST = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".heic", ".heif",
]);

/**
 * Validiert und speichert einen Equipment-Upload unter
 * data/uploads/equipment/<equipmentId>/, legt den Anhang-Datensatz an.
 * Eigene Funktion statt Wiederverwendung von saveUpload — siehe Entwurf
 * (Ansatz A: equipment_attachments bleibt von attachments getrennt).
 */
export async function saveEquipmentUpload(opts: {
  file: File;
  equipmentId: number;
  kind: "foto" | "rechnung";
  userId: number;
}) {
  const { file, equipmentId, kind, userId } = opts;
  if (!file || file.size === 0) throw new Error("Keine Datei ausgewählt.");

  const maxBytes = kind === "foto" ? EQUIPMENT_PHOTO_MAX_BYTES : EQUIPMENT_INVOICE_MAX_BYTES;
  if (file.size > maxBytes) {
    throw new Error(
      `Datei ist zu groß (max. ${Math.round(maxBytes / 1024 / 1024)} MB).`
    );
  }
  const allowed = kind === "foto" ? EQUIPMENT_PHOTO_MIMES : EQUIPMENT_INVOICE_MIMES;
  if (!allowed.has(file.type)) {
    throw new Error(
      kind === "foto"
        ? "Nur Bilder erlaubt (PNG, JPG, WebP, HEIC)."
        : "Nur PDF oder Bilder erlaubt (PDF, PNG, JPG, WebP, HEIC)."
    );
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!EQUIPMENT_EXT_WHITELIST.has(ext)) throw new Error("Dateiendung nicht erlaubt.");

  const dir = path.join(uploadsDir, "equipment", String(equipmentId));
  fs.mkdirSync(dir, { recursive: true });
  const storedName = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, storedName), buffer);

  await db.insert(equipmentAttachments).values({
    equipmentId,
    kind,
    storedName,
    originalName: file.name,
    mime: file.type,
    size: file.size,
    uploadedById: userId,
  });
}

export function equipmentAttachmentPath(equipmentId: number, storedName: string) {
  const safe = path.basename(storedName);
  return path.join(uploadsDir, "equipment", String(equipmentId), safe);
}

export function deleteStoredEquipmentFile(equipmentId: number, storedName: string) {
  try {
    fs.unlinkSync(equipmentAttachmentPath(equipmentId, storedName));
  } catch {
    // Datei fehlt schon — ignorieren
  }
}
