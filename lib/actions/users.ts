"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users, bandMembers, type BandRole } from "@/lib/db/schema";
import { requireBandAdmin } from "@/lib/auth";
import { sendTestMail } from "@/lib/mail";
import { saveSettings, readSettingsForm } from "@/lib/notifications";
import type { FormState } from "@/lib/actions/auth";

/** Ist der User Mitglied der Band? (egal ob aktiv) */
async function membershipOf(userId: number, bandId: number) {
  return db.query.bandMembers.findFirst({
    where: and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)),
  });
}

/**
 * Legt ein neues Mitglied direkt an: globales Konto + Mitgliedschaft in der
 * aktiven Band. Für bereits registrierte Personen ist der Einladungslink der
 * richtige Weg (der Band-Admin kennt deren Passwort nicht).
 */
export async function createUser(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { bandId } = await requireBandAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const instrument = String(formData.get("instrument") ?? "").trim();
  const role: BandRole = formData.get("role") === "admin" ? "band_admin" : "member";

  if (!name || !email) return { error: "Name und E-Mail sind Pflichtfelder." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Ungültige E-Mail-Adresse." };
  if (password.length < 8)
    return { error: "Das Startpasswort braucht mindestens 8 Zeichen." };

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    return {
      error:
        "Diese Person hat schon ein BandMate-Konto. Nimm sie über einen Einladungslink auf.",
    };
  }

  const [neu] = await db
    .insert(users)
    .values({ name, email, passwordHash: bcrypt.hashSync(password, 10) })
    .returning({ id: users.id });
  await db.insert(bandMembers).values({
    bandId,
    userId: neu.id,
    role,
    instrument: instrument || null,
  });

  revalidatePath("/mitglieder");
  return { success: `${name} wurde angelegt.` };
}

/**
 * Bearbeitet ein Bandmitglied: Name/E-Mail (global) und Benachrichtigungen
 * (personenbezogen) sowie das Instrument (bandlokal). Nur für Mitglieder der
 * eigenen Band.
 */
export async function updateUser(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { bandId } = await requireBandAdmin();
  const userId = Number(formData.get("userId"));
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const instrument = String(formData.get("instrument") ?? "").trim();
  const digestEnabled = formData.get("digestEnabled") === "on";

  if (!name || !email) return { error: "Name und E-Mail sind Pflichtfelder." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Ungültige E-Mail-Adresse." };
  if (!(await membershipOf(userId, bandId)))
    return { error: "Kein Mitglied dieser Band." };

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing && existing.id !== userId) {
    return { error: "Diese E-Mail-Adresse ist bereits vergeben." };
  }

  await db.update(users).set({ name, email, digestEnabled }).where(eq(users.id, userId));
  await db
    .update(bandMembers)
    .set({ instrument: instrument || null })
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)));
  await saveSettings(userId, readSettingsForm(formData));

  revalidatePath("/", "layout");
  return { success: "Profil gespeichert." };
}

export async function setUserPassword(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { bandId } = await requireBandAdmin();
  const userId = Number(formData.get("userId"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 8)
    return { error: "Das Passwort braucht mindestens 8 Zeichen." };
  if (!(await membershipOf(userId, bandId)))
    return { error: "Kein Mitglied dieser Band." };
  await db
    .update(users)
    .set({ passwordHash: bcrypt.hashSync(password, 10) })
    .where(eq(users.id, userId));
  revalidatePath("/mitglieder");
  return { success: "Passwort neu gesetzt." };
}

/**
 * Nimmt ein Mitglied aus der Band (band_members.active = false) oder wieder auf.
 * Das globale Konto bleibt unangetastet — das ist Sache des Super-Admins.
 */
export async function toggleUserActive(userId: number) {
  const { user: admin, bandId } = await requireBandAdmin();
  if (userId === admin.id) return; // sich selbst nicht aus der Band werfen
  const m = await membershipOf(userId, bandId);
  if (!m) return;
  await db
    .update(bandMembers)
    .set({ active: !m.active })
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)));
  revalidatePath("/mitglieder");
}

/** Setzt die bandlokale Rolle (Band-Admin / Mitglied). */
export async function setUserRole(userId: number, role: BandRole) {
  const { user: admin, bandId } = await requireBandAdmin();
  if (userId === admin.id) return; // eigene Admin-Rolle nicht entziehen
  if (!(await membershipOf(userId, bandId))) return;
  await db
    .update(bandMembers)
    .set({ role })
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)));
  revalidatePath("/mitglieder");
}

export async function sendTestEmail(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireBandAdmin();
  const to = String(formData.get("to") ?? "").trim();
  if (!to) return { error: "Bitte eine E-Mail-Adresse angeben." };

  const result = await sendTestMail(to);
  if (!result.ok) return { error: result.error };
  return { success: `Test-Mail an ${to} gesendet.` };
}
