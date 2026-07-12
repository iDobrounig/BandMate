"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { requireUser } from "@/lib/auth";

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
  const instrument = String(formData.get("instrument") ?? "").trim();
  const notifyByEmail = formData.get("notifyByEmail") === "on";
  if (!name) return { error: "Name darf nicht leer sein." };
  await db
    .update(users)
    .set({ name, instrument: instrument || null, notifyByEmail })
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
