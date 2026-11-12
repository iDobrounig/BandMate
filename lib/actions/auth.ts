"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users, bandMembers } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { requireUser, requireBandContext, setPassword } from "@/lib/auth";
import { sendPasswordResetMail } from "@/lib/mail";
import { clientIp, isLimited, record, reset, LOGIN_LIMIT, RESET_LIMIT } from "@/lib/rate-limit";
import { saveSettings, readSettingsForm } from "@/lib/notifications";

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
  // Gezählt werden nur Fehlversuche — pro Adresse (gezieltes Raten) und pro IP
  // (viele Adressen durchprobieren). Erfolgreicher Login setzt die Adresse zurück.
  const emailKey = `login:email:${email}`;
  const ipKey = `login:ip:${await clientIp()}`;
  if (isLimited(emailKey, LOGIN_LIMIT.perEmail) || isLimited(ipKey, LOGIN_LIMIT.perIp)) {
    return { error: "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen." };
  }
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !user.active || !bcrypt.compareSync(password, user.passwordHash)) {
    record(emailKey, LOGIN_LIMIT.windowMs);
    record(ipKey, LOGIN_LIMIT.windowMs);
    return { error: "E-Mail oder Passwort ist falsch." };
  }
  reset(emailKey);
  const session = await getSession();
  session.userId = user.id;
  session.sessionVersion = user.sessionVersion;
  await session.save();
  // Nur interne Pfade zulassen (kein Open-Redirect).
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
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
  const { user, bandId } = await requireBandContext();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const instrument = String(formData.get("instrument") ?? "").trim();
  const digestEnabled = formData.get("digestEnabled") === "on";

  if (!name || !email) return { error: "Name und E-Mail sind Pflichtfelder." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Ungültige E-Mail-Adresse." };

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing && existing.id !== user.id) {
    return { error: "Diese E-Mail-Adresse ist bereits vergeben." };
  }

  // Name/E-Mail/Digest sind global; das Instrument gehört zur aktiven Band.
  await db
    .update(users)
    .set({ name, email, digestEnabled })
    .where(eq(users.id, user.id));
  await db
    .update(bandMembers)
    .set({ instrument: instrument || null })
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, user.id)));
  await saveSettings(user.id, readSettingsForm(formData));

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
  // Andere Geräte abmelden, dieses angemeldet lassen.
  const session = await getSession();
  session.sessionVersion = await setPassword(user.id, next);
  await session.save();
  return { success: "Passwort geändert. Andere Geräte wurden abgemeldet." };
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

  // Schutz vor Mail-Bomben gegen eine bekannte Adresse. Bei Überschreitung
  // dieselbe neutrale Antwort — sonst verriete die Meldung, welche Adressen
  // existieren.
  const emailKey = `reset:email:${email}`;
  const ipKey = `reset:ip:${await clientIp()}`;
  if (isLimited(emailKey, RESET_LIMIT.perEmail) || isLimited(ipKey, RESET_LIMIT.perIp)) {
    console.log("[passwort-vergessen] Rate-Limit erreicht — keine Mail verschickt.");
    return generic;
  }
  record(emailKey, RESET_LIMIT.windowMs);
  record(ipKey, RESET_LIMIT.windowMs);

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !user.active) {
    console.log("[passwort-vergessen] Keine aktive Adresse gefunden.");
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

  await setPassword(user.id, next, { resetToken: null, resetTokenExpiresAt: null });

  return { success: "Passwort geändert. Du kannst dich jetzt anmelden." };
}
