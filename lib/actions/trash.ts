"use server";

import { revalidatePath } from "next/cache";
import { requireBandContext, requireBandAdmin } from "@/lib/auth";
import { restore, purge, purgeExpired, trashBelongsToBand, type TrashKind } from "@/lib/trash";

/** Holt einen Eintrag zurück. Darf jedes Mitglied — siehe Entwurf E3. */
export async function restoreItem(kind: TrashKind, id: number) {
  const { bandId } = await requireBandContext();
  if (!(await trashBelongsToBand(kind, id, bandId))) return;
  await restore(kind, id);
  revalidatePath("/", "layout");
}

/**
 * Löscht endgültig. Nur Admin: das ist die einzige Aktion in BandMate, die
 * sich durch nichts mehr rückgängig machen lässt (Entwurf E3).
 */
export async function purgeItem(kind: TrashKind, id: number) {
  const { bandId } = await requireBandAdmin();
  if (!(await trashBelongsToBand(kind, id, bandId))) return;
  await purge(kind, id);
  revalidatePath("/", "layout");
}

/** Leert alles Abgelaufene — vom Papierkorb-Aufruf und vom Cron-Script genutzt. */
export async function purgeExpiredItems() {
  await requireBandContext();
  const bericht = await purgeExpired();
  return bericht;
}
