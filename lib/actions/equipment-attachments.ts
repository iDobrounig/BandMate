"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { equipmentAttachments } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { saveEquipmentUpload } from "@/lib/files";
import type { FormState } from "@/lib/actions/auth";

export async function uploadEquipmentAttachment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const equipmentId = Number(formData.get("equipmentId"));
  const kind = formData.get("kind") === "rechnung" ? "rechnung" : "foto";
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bitte eine Datei auswählen." };
  }

  try {
    await saveEquipmentUpload({ file, equipmentId, kind, userId: user.id });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload fehlgeschlagen." };
  }

  revalidatePath(`/equipment/${equipmentId}`);
  return { success: kind === "foto" ? "Foto hochgeladen." : "Rechnung hochgeladen." };
}

/**
 * Legt die Datei in den Papierkorb. Bleibt auf der Platte, bis endgültig
 * gelöscht wird — das „Rückgängig" auf der Equipment-Seite hängt daran.
 */
export async function deleteEquipmentAttachment(attachmentId: number) {
  const user = await requireUser();
  const attachment = await db.query.equipmentAttachments.findFirst({
    where: eq(equipmentAttachments.id, attachmentId),
  });
  if (!attachment) return;
  await db
    .update(equipmentAttachments)
    .set({ deletedAt: new Date(), deletedById: user.id })
    .where(eq(equipmentAttachments.id, attachmentId));
  revalidatePath(`/equipment/${attachment.equipmentId}`);
}
