"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { equipmentAttachments, equipment } from "@/lib/db/schema";
import { requireBandContext } from "@/lib/auth";
import { saveEquipmentUpload } from "@/lib/files";
import type { FormState } from "@/lib/actions/auth";

export async function uploadEquipmentAttachment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, bandId } = await requireBandContext();
  const equipmentId = Number(formData.get("equipmentId"));
  const kind = formData.get("kind") === "rechnung" ? "rechnung" : "foto";
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bitte eine Datei auswählen." };
  }

  const geraet = await db.query.equipment.findFirst({
    where: and(eq(equipment.id, equipmentId), eq(equipment.bandId, bandId)),
  });
  if (!geraet) return { error: "Gerät nicht gefunden." };

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
  const { user, bandId } = await requireBandContext();
  const [row] = await db
    .select({ id: equipmentAttachments.id, equipmentId: equipmentAttachments.equipmentId })
    .from(equipmentAttachments)
    .innerJoin(equipment, eq(equipmentAttachments.equipmentId, equipment.id))
    .where(and(eq(equipmentAttachments.id, attachmentId), eq(equipment.bandId, bandId)))
    .limit(1);
  if (!row) return;
  await db
    .update(equipmentAttachments)
    .set({ deletedAt: new Date(), deletedById: user.id })
    .where(eq(equipmentAttachments.id, attachmentId));
  revalidatePath(`/equipment/${row.equipmentId}`);
}
