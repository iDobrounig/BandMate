"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { invites, users, bandMembers, bands, type BandRole } from "@/lib/db/schema";
import { requireBandAdmin, requireUser } from "@/lib/auth";
import { getSession } from "@/lib/session";
import type { FormState } from "@/lib/actions/auth";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Erzeugt einen Einladungs-Token für eine Band und gibt die teilbare URL zurück
 * — oder eine Fehlermeldung, wenn die Person dort schon aktives Mitglied ist.
 * Gemeinsamer Kern für Band-Admin (createInvite) und Super-Admin.
 */
export async function makeInvite(
  bandId: number,
  email: string,
  role: BandRole,
  invitedById: number
): Promise<{ url: string } | { error: string }> {
  const bereits = await db
    .select({ userId: bandMembers.userId })
    .from(bandMembers)
    .innerJoin(users, eq(bandMembers.userId, users.id))
    .where(and(eq(bandMembers.bandId, bandId), eq(users.email, email), eq(bandMembers.active, true)))
    .limit(1);
  if (bereits.length > 0) return { error: "Diese Person ist bereits in der Band." };

  const token = crypto.randomUUID();
  await db.insert(invites).values({
    bandId,
    email,
    token,
    role,
    invitedById,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });
  return { url: `${process.env.APP_URL ?? ""}/einladung/${token}` };
}

/** Gültige, nicht verbrauchte, nicht abgelaufene Einladung zu diesem Token. */
export async function fetchValidInvite(token: string) {
  const invite = await db.query.invites.findFirst({
    where: and(
      eq(invites.token, token),
      isNull(invites.usedAt),
      gt(invites.expiresAt, new Date())
    ),
  });
  if (!invite) return null;
  const band = await db.query.bands.findFirst({
    where: and(eq(bands.id, invite.bandId), eq(bands.active, true)),
  });
  if (!band) return null;
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, invite.email),
    columns: { id: true },
  });
  return { invite, bandName: band.name, emailKnown: !!existingUser };
}

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

/** Fügt ein bestehendes Mitglied per gültigem Token der Band hinzu (Wiedereintritt inkl.). */
async function joinBand(userId: number, bandId: number, role: BandRole) {
  const vorhanden = await db.query.bandMembers.findFirst({
    where: and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)),
  });
  if (vorhanden) {
    await db
      .update(bandMembers)
      .set({ active: true, role })
      .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)));
  } else {
    await db.insert(bandMembers).values({ bandId, userId, role });
  }
}

/** Eingeloggter User löst die Einladung ein → tritt der Band bei, wechselt hinein. */
export async function acceptInviteAsUser(token: string) {
  const user = await requireUser();
  const valid = await fetchValidInvite(token);
  if (!valid) redirect("/einladung/" + token); // zeigt die „ungültig"-Meldung
  await joinBand(user.id, valid.invite.bandId, valid.invite.role);
  await db.update(invites).set({ usedAt: new Date() }).where(eq(invites.token, token));

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

  const [neu] = await db
    .insert(users)
    .values({
      name,
      email: valid.invite.email,
      passwordHash: bcrypt.hashSync(password, 10),
    })
    .returning({ id: users.id });
  await joinBand(neu.id, valid.invite.bandId, valid.invite.role);
  await db.update(invites).set({ usedAt: new Date() }).where(eq(invites.token, token));

  const session = await getSession();
  session.userId = neu.id;
  session.activeBandId = valid.invite.bandId;
  await session.save();
  redirect("/");
}
