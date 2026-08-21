"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { equipment, equipmentContributions, bandMembers, type EquipmentCategory, type EquipmentStatus } from "@/lib/db/schema";
import { requireBandContext } from "@/lib/auth";
import { EQUIPMENT_CATEGORY_ORDER, EQUIPMENT_STATUS_ORDER } from "@/lib/constants";
import type { FormState } from "@/lib/actions/auth";

/** Beteiligungen auf tatsächliche Mitglieder DIESER Band beschränken (inkl.
 *  ausgetretener — sie können bestehende Beteiligungen behalten). */
async function filterBandContributions(
  contributions: { userId: number; amount: number; note: string | null }[],
  bandId: number
) {
  if (contributions.length === 0) return [];
  const members = await db
    .select({ userId: bandMembers.userId })
    .from(bandMembers)
    .where(eq(bandMembers.bandId, bandId));
  const ids = new Set(members.map((m) => m.userId));
  return contributions.filter((c) => ids.has(c.userId));
}

function readEquipmentFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "other") as EquipmentCategory;
  const statusRaw = String(formData.get("status") ?? "in_use") as EquipmentStatus;
  const acquisitionDate = String(formData.get("acquisitionDate") ?? "").trim();
  const costRaw = String(formData.get("acquisitionCost") ?? "").trim();
  const acquisitionCost = costRaw ? Number(costRaw) : null;
  const treasuryRaw = String(formData.get("treasuryAmount") ?? "").trim();
  const treasuryAmount = treasuryRaw ? Number(treasuryRaw) : null;
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  return {
    name,
    category: EQUIPMENT_CATEGORY_ORDER.includes(categoryRaw) ? categoryRaw : "other",
    status: EQUIPMENT_STATUS_ORDER.includes(statusRaw) ? statusRaw : "in_use",
    acquisitionDate: acquisitionDate || null,
    acquisitionCost: acquisitionCost !== null && Number.isFinite(acquisitionCost) ? acquisitionCost : null,
    treasuryAmount: treasuryAmount !== null && Number.isFinite(treasuryAmount) ? treasuryAmount : null,
    location: location || null,
    notes: notes || null,
  };
}

function readContributions(formData: FormData) {
  const userIds = formData.getAll("contribUserId").map(String);
  const amounts = formData.getAll("contribAmount").map(String);
  const notes = formData.getAll("contribNote").map(String);
  const parsed = userIds
    .map((userIdRaw, i) => ({
      userId: Number(userIdRaw),
      amount: Number(amounts[i]),
      note: notes[i]?.trim() || null,
    }))
    .filter((c) => Number.isInteger(c.userId) && c.userId > 0 && Number.isFinite(c.amount) && c.amount > 0);

  // Ein Mitglied kann nur eine Beteiligungszeile haben (Composite-PK) — bei
  // versehentlicher Doppelauswahl im Formular gewinnt die letzte Zeile, statt
  // dass der Insert an der Unique-Constraint scheitert.
  const byUser = new Map<number, (typeof parsed)[number]>();
  for (const c of parsed) byUser.set(c.userId, c);
  return [...byUser.values()];
}

export async function createEquipment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, bandId } = await requireBandContext();
  const fields = readEquipmentFields(formData);
  if (!fields.name) return { error: "Der Name darf nicht leer sein." };

  const [item] = await db
    .insert(equipment)
    .values({ ...fields, bandId, createdById: user.id })
    .returning();

  const contributions = await filterBandContributions(readContributions(formData), bandId);
  if (contributions.length > 0) {
    await db
      .insert(equipmentContributions)
      .values(contributions.map((c) => ({ ...c, equipmentId: item.id })));
  }

  revalidatePath("/", "layout");
  redirect(`/equipment/${item.id}`);
}

export async function updateEquipment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { bandId } = await requireBandContext();
  const equipmentId = Number(formData.get("equipmentId"));
  const fields = readEquipmentFields(formData);
  if (!fields.name) return { error: "Der Name darf nicht leer sein." };

  // Fremdes Gerät? Dann nicht anfassen.
  const vorhanden = await db.query.equipment.findFirst({
    where: and(eq(equipment.id, equipmentId), eq(equipment.bandId, bandId)),
  });
  if (!vorhanden) return { error: "Gerät nicht gefunden." };

  await db
    .update(equipment)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(equipment.id, equipmentId), eq(equipment.bandId, bandId)));

  // Beteiligungen komplett ersetzen, wie Songs es mit Links macht.
  await db.delete(equipmentContributions).where(eq(equipmentContributions.equipmentId, equipmentId));
  const contributions = await filterBandContributions(readContributions(formData), bandId);
  if (contributions.length > 0) {
    await db
      .insert(equipmentContributions)
      .values(contributions.map((c) => ({ ...c, equipmentId })));
  }

  revalidatePath("/", "layout");
  redirect(`/equipment/${equipmentId}`);
}

/**
 * Legt das Gerät in den Papierkorb. Fotos, Rechnungen und Beteiligungen
 * bleiben erhalten — siehe lib/trash.ts.
 */
export async function deleteEquipment(equipmentId: number) {
  const { user, bandId } = await requireBandContext();
  await db
    .update(equipment)
    .set({ deletedAt: new Date(), deletedById: user.id })
    .where(and(eq(equipment.id, equipmentId), eq(equipment.bandId, bandId)));
  revalidatePath("/", "layout");
  redirect(`/equipment?undo=equipment:${equipmentId}`);
}
