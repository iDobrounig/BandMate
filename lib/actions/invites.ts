"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users, type BandRole } from "@/lib/db/schema";
import { requireBandAdmin, requireUser } from "@/lib/auth";
import { consumeInvite, fetchValidInvite, joinBand, makeInvite } from "@/lib/invites";
import { getSession } from "@/lib/session";
import type { FormState } from "@/lib/actions/auth";

/**
 * Band-Admin erzeugt einen Einladungslink. Die Ziel-E-Mail ist Pflicht (sie
 * entscheidet beim Einlösen zwischen „Konto anlegen" und „nur beitreten"); der
 * Link wird zurückgegeben, damit der Admin ihn teilen kann (auch ohne SMTP).
 */
export async function createInvite(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, bandId } = await requireBandAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role: BandRole = formData.get("role") === "admin" ? "band_admin" : "member";
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Bitte eine gültige E-Mail angeben." };

  const res = await makeInvite(bandId, email, role, user.id);
  if ("error" in res) return { error: res.error };

  revalidatePath("/mitglieder");
  return { success: `Einladungslink für ${email} (7 Tage gültig): ${res.url}` };
}

/** Eingeloggter User löst die Einladung ein → tritt der Band bei, wechselt hinein. */
export async function acceptInviteAsUser(token: string) {
  const user = await requireUser();
  const valid = await fetchValidInvite(token);
  // Ungültig, fremde Adresse oder Super-Admin: Die Einladungsseite zeigt jeweils
  // die passende Meldung. Die Einladung gilt nur für die eingeladene E-Mail —
  // sonst macht ein weitergeleiteter Admin-Link jeden Account zum Band-Admin.
  if (!valid || valid.invite.email !== user.email.toLowerCase() || user.isSuperAdmin) {
    redirect("/einladung/" + token);
  }
  if (!(await consumeInvite(token))) redirect("/einladung/" + token);
  await joinBand(user.id, valid.invite.bandId, valid.invite.role);

  const session = await getSession();
  session.activeBandId = valid.invite.bandId;
  await session.save();
  revalidatePath("/", "layout");
  redirect("/");
}

/** Neuer Nutzer legt über die Einladung Konto + Mitgliedschaft an. */
export async function acceptInviteNew(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  const valid = await fetchValidInvite(token);
  if (!valid) return { error: "Ungültiger oder abgelaufener Einladungslink." };
  if (!name) return { error: "Bitte einen Namen angeben." };
  if (password.length < 8) return { error: "Das Passwort braucht mindestens 8 Zeichen." };
  if (password !== repeat) return { error: "Die Wiederholung stimmt nicht überein." };

  // Zwischenzeitlich doch schon registriert? Dann bitte anmelden.
  const existing = await db.query.users.findFirst({ where: eq(users.email, valid.invite.email) });
  if (existing) {
    return { error: "Für diese E-Mail gibt es bereits ein Konto. Bitte melde dich an." };
  }

  if (!(await consumeInvite(token))) {
    return { error: "Ungültiger oder abgelaufener Einladungslink." };
  }
  const [neu] = await db
    .insert(users)
    .values({
      name,
      email: valid.invite.email,
      passwordHash: bcrypt.hashSync(password, 10),
    })
    .returning({ id: users.id });
  await joinBand(neu.id, valid.invite.bandId, valid.invite.role);

  const session = await getSession();
  session.userId = neu.id;
  session.activeBandId = valid.invite.bandId;
  await session.save();
  redirect("/");
}
