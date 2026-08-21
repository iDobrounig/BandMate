"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { bands, users, bandMembers } from "@/lib/db/schema";
import { requireSuperAdmin } from "@/lib/auth";
import type { FormState } from "@/lib/actions/auth";

/**
 * Legt eine neue Band an und direkt deren ersten Band-Admin (Konto + aktive
 * Mitgliedschaft mit Rolle band_admin). Weitere Mitglieder nimmt danach der
 * Band-Admin selbst auf.
 */
export async function createBand(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSuperAdmin();
  const bandName = String(formData.get("bandName") ?? "").trim();
  const adminName = String(formData.get("adminName") ?? "").trim();
  const adminEmail = String(formData.get("adminEmail") ?? "").trim().toLowerCase();
  const adminPassword = String(formData.get("adminPassword") ?? "");

  if (!bandName) return { error: "Die Band braucht einen Namen." };
  if (!adminName || !adminEmail) return { error: "Name und E-Mail des Band-Admins sind Pflicht." };
  if (!/^\S+@\S+\.\S+$/.test(adminEmail)) return { error: "Ungültige E-Mail-Adresse." };
  if (adminPassword.length < 8) return { error: "Das Startpasswort braucht mindestens 8 Zeichen." };

  const existing = await db.query.users.findFirst({ where: eq(users.email, adminEmail) });
  if (existing) {
    return {
      error: "Für diese E-Mail gibt es schon ein Konto — leg die Band an und lade die Person per Link ein.",
    };
  }

  const [band] = await db
    .insert(bands)
    .values({ name: bandName, calendarToken: crypto.randomBytes(16).toString("hex") })
    .returning({ id: bands.id });

  const [admin] = await db
    .insert(users)
    .values({ name: adminName, email: adminEmail, passwordHash: bcrypt.hashSync(adminPassword, 10) })
    .returning({ id: users.id });

  await db
    .insert(bandMembers)
    .values({ bandId: band.id, userId: admin.id, role: "band_admin" });

  revalidatePath("/verwaltung");
  return { success: `Band „${bandName}" mit Admin ${adminName} angelegt.` };
}

/** Band aktiv/inaktiv schalten (inaktive Bands verschwinden für ihre Mitglieder). */
export async function toggleBandActive(bandId: number) {
  await requireSuperAdmin();
  const band = await db.query.bands.findFirst({ where: eq(bands.id, bandId) });
  if (!band) return;
  await db.update(bands).set({ active: !band.active }).where(eq(bands.id, bandId));
  revalidatePath("/verwaltung");
}

/**
 * Globales Konto sperren/entsperren. Sperrt die Person aus ALLEN Bands aus —
 * die scharfe Variante, die nur der Super-Admin hat.
 */
export async function toggleUserGlobalActive(userId: number) {
  const admin = await requireSuperAdmin();
  if (userId === admin.id) return; // sich selbst nicht aussperren
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u) return;
  await db.update(users).set({ active: !u.active }).where(eq(users.id, userId));
  revalidatePath("/verwaltung/nutzer");
}
