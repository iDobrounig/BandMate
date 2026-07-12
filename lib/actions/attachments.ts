"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { attachments } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { saveUpload, deleteStoredFile } from "@/lib/files";
import type { FormState } from "@/lib/actions/auth";

export async function uploadAttachment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const songId = Number(formData.get("songId"));
  const kind = formData.get("kind") === "audio" ? "audio" : "sheet";
  const instrument = String(formData.get("instrument") ?? "").trim();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bitte eine Datei auswählen." };
  }
  if (kind === "sheet" && !instrument) {
    return { error: "Bitte angeben, für welches Instrument die Noten sind." };
  }

  try {
    await saveUpload({ file, songId, kind, instrument, userId: user.id });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload fehlgeschlagen." };
  }

  revalidatePath(`/songs/${songId}`);
  return { success: "Datei hochgeladen." };
}

export async function deleteAttachment(attachmentId: number) {
  await requireUser();
  const attachment = await db.query.attachments.findFirst({
    where: eq(attachments.id, attachmentId),
  });
  if (!attachment) return;
  deleteStoredFile(attachment.songId, attachment.storedName);
  await db.delete(attachments).where(eq(attachments.id, attachmentId));
  revalidatePath(`/songs/${attachment.songId}`);
}
