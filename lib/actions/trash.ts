"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/auth";
import { restore, purge, purgeExpired, type TrashKind } from "@/lib/trash";

/** Holt einen Eintrag zurück. Darf jedes Mitglied — siehe Entwurf E3. */
export async function restoreItem(kind: TrashKind, id: number) {
  await requireUser();
  await restore(kind, id);
  revalidatePath("/", "layout");
}

/**
 * Löscht endgültig. Nur Admin: das ist die einzige Aktion in BandMate, die
 * sich durch nichts mehr rückgängig machen lässt (Entwurf E3).
 */
export async function purgeItem(kind: TrashKind, id: number) {
  await requireAdmin();
  await purge(kind, id);
  revalidatePath("/", "layout");
}

/** Leert alles Abgelaufene — vom Papierkorb-Aufruf und vom Cron-Script genutzt. */
export async function purgeExpiredItems() {
  await requireUser();
  const bericht = await purgeExpired();
  return bericht;
}
