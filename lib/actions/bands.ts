"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, fetchMemberships } from "@/lib/auth";
import { getSession } from "@/lib/session";

/**
 * Setzt die aktive Band in der Session — nur, wenn der User dort aktives
 * Mitglied ist. Danach zurück ins Dashboard der gewählten Band.
 */
export async function setActiveBand(bandId: number) {
  const user = await requireUser();
  const memberships = await fetchMemberships(user.id);
  if (!memberships.some((m) => m.bandId === bandId)) redirect("/band-waehlen");

  const session = await getSession();
  session.activeBandId = bandId;
  await session.save();
  revalidatePath("/", "layout");
  redirect("/");
}
