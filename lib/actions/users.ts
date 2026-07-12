"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import type { FormState } from "@/lib/actions/auth";

export async function createUser(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const instrument = String(formData.get("instrument") ?? "").trim();
  const role = formData.get("role") === "admin" ? "admin" : "member";

  if (!name || !email) return { error: "Name und E-Mail sind Pflichtfelder." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Ungültige E-Mail-Adresse." };
  if (password.length < 8)
    return { error: "Das Startpasswort braucht mindestens 8 Zeichen." };

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return { error: "Diese E-Mail-Adresse ist bereits vergeben." };

  await db.insert(users).values({
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    instrument: instrument || null,
    role,
  });
  revalidatePath("/mitglieder");
  return { success: `${name} wurde angelegt.` };
}

export async function setUserPassword(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const userId = Number(formData.get("userId"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 8)
    return { error: "Das Passwort braucht mindestens 8 Zeichen." };
  await db
    .update(users)
    .set({ passwordHash: bcrypt.hashSync(password, 10) })
    .where(eq(users.id, userId));
  revalidatePath("/mitglieder");
  return { success: "Passwort neu gesetzt." };
}

export async function toggleUserActive(userId: number) {
  const admin = await requireAdmin();
  if (userId === admin.id) return; // sich selbst nicht aussperren
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return;
  await db.update(users).set({ active: !user.active }).where(eq(users.id, userId));
  revalidatePath("/mitglieder");
}

export async function setUserRole(userId: number, role: "admin" | "member") {
  const admin = await requireAdmin();
  if (userId === admin.id) return; // eigene Admin-Rolle nicht entziehen
  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath("/mitglieder");
}
