"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { bands, users, bandMembers, type BandRole } from "@/lib/db/schema";
import { requireSuperAdmin } from "@/lib/auth";
import { makeInvite } from "@/lib/actions/invites";
import type { FormState } from "@/lib/actions/auth";

const asRole = (v: FormDataEntryValue | null): BandRole =>
  v === "admin" || v === "band_admin" ? "band_admin" : "member";

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

// ---- Eigenes Super-Admin-Konto -------------------------------------------

export async function updateOwnAccount(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireSuperAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!name || !email) return { error: "Name und E-Mail sind Pflichtfelder." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Ungültige E-Mail-Adresse." };

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing && existing.id !== admin.id) {
    return { error: "Diese E-Mail-Adresse ist bereits vergeben." };
  }
  await db.update(users).set({ name, email }).where(eq(users.id, admin.id));
  revalidatePath("/verwaltung", "layout");
  return { success: "Konto gespeichert." };
}

export async function changeOwnPassword(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireSuperAdmin();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");
  if (!bcrypt.compareSync(current, admin.passwordHash)) {
    return { error: "Das aktuelle Passwort ist falsch." };
  }
  if (next.length < 8) return { error: "Das neue Passwort braucht mindestens 8 Zeichen." };
  if (next !== repeat) return { error: "Die Wiederholung stimmt nicht überein." };
  await db
    .update(users)
    .set({ passwordHash: bcrypt.hashSync(next, 10) })
    .where(eq(users.id, admin.id));
  return { success: "Passwort geändert." };
}

// ---- Band bearbeiten ------------------------------------------------------

export async function renameBand(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSuperAdmin();
  const bandId = Number(formData.get("bandId"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Die Band braucht einen Namen." };
  const band = await db.query.bands.findFirst({ where: eq(bands.id, bandId) });
  if (!band) return { error: "Band nicht gefunden." };
  await db.update(bands).set({ name }).where(eq(bands.id, bandId));
  revalidatePath("/verwaltung", "layout");
  return { success: "Bandname gespeichert." };
}

// ---- Mitgliedschaften (bandId + userId explizit) --------------------------

/** Nimmt einen bestehenden User in eine Band auf bzw. reaktiviert ihn. */
export async function saAddMembership(bandId: number, userId: number, role: BandRole) {
  await requireSuperAdmin();
  const [band, user] = await Promise.all([
    db.query.bands.findFirst({ where: eq(bands.id, bandId) }),
    db.query.users.findFirst({ where: eq(users.id, userId) }),
  ]);
  if (!band || !user || user.isSuperAdmin) return; // Super-Admins sind nie Bandmitglied
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
  revalidatePath("/verwaltung", "layout");
}

/** Entfernt einen User aus einer Band (band_members.active = false). */
export async function saRemoveMembership(bandId: number, userId: number) {
  await requireSuperAdmin();
  await db
    .update(bandMembers)
    .set({ active: false })
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)));
  revalidatePath("/verwaltung", "layout");
}

export async function saSetMembershipRole(bandId: number, userId: number, role: BandRole) {
  await requireSuperAdmin();
  await db
    .update(bandMembers)
    .set({ role })
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)));
  revalidatePath("/verwaltung", "layout");
}

/**
 * Band-Detail: Person per E-Mail aufnehmen. Bekanntes Konto → sofort Mitglied;
 * unbekannt → Einladungslink für diese Band (zurückgegeben zum Teilen).
 */
export async function saAddMemberByEmail(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireSuperAdmin();
  const bandId = Number(formData.get("bandId"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = asRole(formData.get("role"));
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Bitte eine gültige E-Mail angeben." };
  const band = await db.query.bands.findFirst({ where: eq(bands.id, bandId) });
  if (!band) return { error: "Band nicht gefunden." };

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (user) {
    if (user.isSuperAdmin) return { error: "Super-Admin-Konten sind keine Bandmitglieder." };
    await saAddMembership(bandId, user.id, role);
    return { success: `${user.name} wurde aufgenommen.` };
  }
  const res = await makeInvite(bandId, email, role, admin.id);
  if ("error" in res) return { error: res.error };
  return { success: `Konto unbekannt — Einladungslink (7 Tage): ${res.url}` };
}

// ---- Globale Nutzer-Verwaltung -------------------------------------------

export async function createUserGlobal(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSuperAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const bandIdRaw = String(formData.get("bandId") ?? "").trim();
  const role = asRole(formData.get("role"));
  if (!name || !email) return { error: "Name und E-Mail sind Pflichtfelder." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Ungültige E-Mail-Adresse." };
  if (password.length < 8) return { error: "Das Startpasswort braucht mindestens 8 Zeichen." };

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return { error: "Diese E-Mail-Adresse ist bereits vergeben." };

  const [neu] = await db
    .insert(users)
    .values({ name, email, passwordHash: bcrypt.hashSync(password, 10) })
    .returning({ id: users.id });

  if (bandIdRaw) {
    const bandId = Number(bandIdRaw);
    const band = await db.query.bands.findFirst({ where: eq(bands.id, bandId) });
    if (band) await db.insert(bandMembers).values({ bandId, userId: neu.id, role });
  }

  revalidatePath("/verwaltung/nutzer");
  return { success: `${name} wurde angelegt.` };
}

export async function updateUserGlobal(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSuperAdmin();
  const userId = Number(formData.get("userId"));
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!name || !email) return { error: "Name und E-Mail sind Pflichtfelder." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Ungültige E-Mail-Adresse." };
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing && existing.id !== userId) return { error: "Diese E-Mail-Adresse ist bereits vergeben." };
  await db.update(users).set({ name, email }).where(eq(users.id, userId));
  revalidatePath("/verwaltung", "layout");
  return { success: "Konto gespeichert." };
}

export async function setUserGlobalPassword(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSuperAdmin();
  const userId = Number(formData.get("userId"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Das Passwort braucht mindestens 8 Zeichen." };
  await db
    .update(users)
    .set({ passwordHash: bcrypt.hashSync(password, 10) })
    .where(eq(users.id, userId));
  revalidatePath("/verwaltung/nutzer");
  return { success: "Passwort neu gesetzt." };
}
