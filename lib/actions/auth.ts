"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { requireUser } from "@/lib/auth";
import { sendPasswordResetMail } from "@/lib/mail";

export type FormState = { error?: string; success?: string };

export async function login(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !user.active || !bcrypt.compareSync(password, user.passwordHash)) {
    return { error: "E-Mail oder Passwort ist falsch." };
  }
  const session = await getSession();
  session.userId = user.id;
  await session.save();
  redirect("/");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

export async function updateProfile(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const instrument = String(formData.get("instrument") ?? "").trim();
  const notifyByEmail = formData.get("notifyByEmail") === "on";

  if (!name || !email) return { error: "Name und E-Mail sind Pflichtfelder." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Ungültige E-Mail-Adresse." };

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing && existing.id !== user.id) {
    return { error: "Diese E-Mail-Adresse ist bereits vergeben." };
  }

  await db
    .update(users)
    .set({ name, email, instrument: instrument || null, notifyByEmail })
    .where(eq(users.id, user.id));
  revalidatePath("/", "layout");
  return { success: "Profil gespeichert." };
}

export async function changePassword(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");
  if (!bcrypt.compareSync(current, user.passwordHash)) {
    return { error: "Das aktuelle Passwort ist falsch." };
  }
  if (next.length < 8) {
    return { error: "Das neue Passwort braucht mindestens 8 Zeichen." };
  }
  if (next !== repeat) {
    return { error: "Die Wiederholung stimmt nicht überein." };
  }
  await db
    .update(users)
    .set({ passwordHash: bcrypt.hashSync(next, 10) })
    .where(eq(users.id, user.id));
  return { success: "Passwort geändert." };
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 Stunde

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const generic: FormState = {
    success:
      "Falls diese E-Mail-Adresse bei uns registriert ist, wurde eine Mail mit einem Link verschickt.",
  };
  if (!email) return generic;

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !user.active) {
    console.log(`[passwort-vergessen] Keine aktive Adresse gefunden: ${email}`);
    return generic;
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await db
    .update(users)
    .set({ resetToken: token, resetTokenExpiresAt: expiresAt })
    .where(eq(users.id, user.id));

  const resetUrl = `${process.env.APP_URL ?? ""}/passwort-zuruecksetzen?token=${token}`;
  await sendPasswordResetMail(user.email, resetUrl);

  return generic;
}

export async function resetPassword(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (!token) return { error: "Ungültiger oder abgelaufener Link." };

  const user = await db.query.users.findFirst({ where: eq(users.resetToken, token) });
  if (
    !user ||
    !user.resetTokenExpiresAt ||
    user.resetTokenExpiresAt.getTime() < Date.now()
  ) {
    return { error: "Ungültiger oder abgelaufener Link. Bitte erneut anfordern." };
  }
  if (next.length < 8) {
    return { error: "Das neue Passwort braucht mindestens 8 Zeichen." };
  }
  if (next !== repeat) {
    return { error: "Die Wiederholung stimmt nicht überein." };
  }

  await db
    .update(users)
    .set({
      passwordHash: bcrypt.hashSync(next, 10),
      resetToken: null,
      resetTokenExpiresAt: null,
    })
    .where(eq(users.id, user.id));

  return { success: "Passwort geändert. Du kannst dich jetzt anmelden." };
}
