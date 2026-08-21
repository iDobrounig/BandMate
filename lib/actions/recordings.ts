"use server";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, uploadsDir } from "@/lib/db";
import { attachments, songs } from "@/lib/db/schema";
import { requireBandContext } from "@/lib/auth";
import { transcodeToOpus } from "@/lib/audio-transcode";

function tempExtFor(mime: string): string {
  if (mime.startsWith("audio/mp4")) return ".mp4";
  if (mime.startsWith("audio/webm")) return ".webm";
  return ".webm";
}

/**
 * Nimmt eine rohe Browser-Aufnahme entgegen (WebM/Opus oder MP4/AAC, je nach
 * Browser), transkodiert sie nach OGG/Opus und legt den Attachment-Datensatz
 * an. Kein `FormState`/`useActionState`-Muster, weil das kein Formular-Submit
 * ist, sondern ein mehrstufiger Ablauf (Aufnehmen → Review → Speichern) aus
 * einer Client-Komponente heraus.
 */
export async function saveRecording(
  formData: FormData
): Promise<{ error: string } | { success: string }> {
  const { user, bandId } = await requireBandContext();
  const songId = Number(formData.get("songId"));
  const label = String(formData.get("label") ?? "").trim();
  const file = formData.get("file");

  if (!Number.isFinite(songId) || songId <= 0) {
    return { error: "Ungültiger Song." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Keine Aufnahme vorhanden." };
  }
  if (!label) {
    return { error: "Bitte eine Bezeichnung angeben." };
  }

  const song = await db.query.songs.findFirst({
    where: and(eq(songs.id, songId), eq(songs.bandId, bandId)),
  });
  if (!song) return { error: "Song nicht gefunden." };

  const tempPath = path.join(
    os.tmpdir(),
    `bandmate-rec-${crypto.randomUUID()}${tempExtFor(file.type)}`
  );
  const dir = path.join(uploadsDir, String(songId));
  const storedName = `${crypto.randomUUID()}.ogg`;
  const targetPath = path.join(dir, storedName);

  try {
    fs.writeFileSync(tempPath, Buffer.from(await file.arrayBuffer()));
    fs.mkdirSync(dir, { recursive: true });
    await transcodeToOpus(tempPath, targetPath);
  } catch (err) {
    try {
      fs.unlinkSync(targetPath);
    } catch {
      // nichts (oder nichts Vollständiges) geschrieben — ignorieren
    }
    return {
      error: err instanceof Error ? err.message : "Konvertierung fehlgeschlagen.",
    };
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Temp-Datei fehlt schon — ignorieren
    }
  }

  const size = fs.statSync(targetPath).size;
  await db.insert(attachments).values({
    songId,
    kind: "audio",
    source: "recording",
    storedName,
    originalName: label,
    mime: "audio/ogg",
    size,
    uploadedById: user.id,
  });

  revalidatePath(`/songs/${songId}`);
  return { success: "Aufnahme gespeichert." };
}
