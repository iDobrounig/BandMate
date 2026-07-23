"use server";

import { and, eq, max } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { setlists, setlistItems } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import type { FormState } from "@/lib/actions/auth";

export async function createSetlist(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!name) return { error: "Die Setliste braucht einen Namen." };

  const [setlist] = await db
    .insert(setlists)
    .values({ name, eventDate: eventDate || null, notes: notes || null })
    .returning();

  revalidatePath("/setlisten");
  redirect(`/setlisten/${setlist.id}`);
}

export async function updateSetlist(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireUser();
  const setlistId = Number(formData.get("setlistId"));
  const name = String(formData.get("name") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!name) return { error: "Die Setliste braucht einen Namen." };

  await db
    .update(setlists)
    .set({ name, eventDate: eventDate || null, notes: notes || null })
    .where(eq(setlists.id, setlistId));

  revalidatePath("/setlisten");
  revalidatePath(`/setlisten/${setlistId}`);
  return { success: "Gespeichert." };
}

/** Kopiert eine Setliste samt Songs (ohne Datum), z.B. als Basis für den nächsten Gig. */
export async function duplicateSetlist(setlistId: number) {
  await requireUser();
  const original = await db.query.setlists.findFirst({
    where: eq(setlists.id, setlistId),
  });
  if (!original) return;

  const [copy] = await db
    .insert(setlists)
    .values({
      name: `${original.name} (Kopie)`,
      eventDate: null,
      notes: original.notes,
    })
    .returning();

  const items = await db.query.setlistItems.findMany({
    where: eq(setlistItems.setlistId, setlistId),
  });
  if (items.length > 0) {
    await db.insert(setlistItems).values(
      items.map((item) => ({
        setlistId: copy.id,
        songId: item.songId,
        position: item.position,
        note: item.note,
      }))
    );
  }

  revalidatePath("/setlisten");
  redirect(`/setlisten/${copy.id}`);
}

export async function deleteSetlist(setlistId: number) {
  const user = await requireUser();
  await db
    .update(setlists)
    .set({ deletedAt: new Date(), deletedById: user.id })
    .where(eq(setlists.id, setlistId));
  revalidatePath("/", "layout");
  redirect(`/setlisten?undo=setlist:${setlistId}`);
}

export async function addSongToSetlist(setlistId: number, songId: number) {
  await requireUser();
  const [row] = await db
    .select({ maxPos: max(setlistItems.position) })
    .from(setlistItems)
    .where(eq(setlistItems.setlistId, setlistId));
  await db.insert(setlistItems).values({
    setlistId,
    songId,
    position: (row?.maxPos ?? 0) + 1,
  });
  revalidatePath(`/setlisten/${setlistId}`);
}

export async function removeSetlistItem(itemId: number) {
  await requireUser();
  const item = await db.query.setlistItems.findFirst({
    where: eq(setlistItems.id, itemId),
  });
  if (!item) return;
  await db.delete(setlistItems).where(eq(setlistItems.id, itemId));
  revalidatePath(`/setlisten/${item.setlistId}`);
}

/** Speichert die neue Reihenfolge (Array von Item-IDs in Zielreihenfolge). */
export async function reorderSetlist(setlistId: number, orderedItemIds: number[]) {
  await requireUser();
  for (let i = 0; i < orderedItemIds.length; i++) {
    await db
      .update(setlistItems)
      .set({ position: i + 1 })
      .where(
        and(
          eq(setlistItems.id, orderedItemIds[i]),
          eq(setlistItems.setlistId, setlistId)
        )
      );
  }
  revalidatePath(`/setlisten/${setlistId}`);
}

export async function updateSetlistItemNote(itemId: number, note: string) {
  await requireUser();
  const item = await db.query.setlistItems.findFirst({
    where: eq(setlistItems.id, itemId),
  });
  if (!item) return;
  await db
    .update(setlistItems)
    .set({ note: note.trim() || null })
    .where(eq(setlistItems.id, itemId));
  revalidatePath(`/setlisten/${item.setlistId}`);
}
