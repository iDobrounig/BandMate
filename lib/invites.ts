import crypto from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { invites, users, bandMembers, bands, type BandRole } from "@/lib/db/schema";

// Bewusst KEIN "use server": Alles, was eine "use server"-Datei exportiert, ist
// potenziell per POST aufrufbar. Diese Helper prüfen keine Rechte selbst — das
// tun die aufrufenden Actions (createInvite, saInviteToBand, acceptInvite*).

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
 * Markiert die Einladung als verbraucht — atomar: nur wenn sie es noch nicht
 * war. false heißt, ein paralleler Klick (zweiter Tab, Doppelklick) war schneller.
 */
export async function consumeInvite(token: string): Promise<boolean> {
  const rows = await db
    .update(invites)
    .set({ usedAt: new Date() })
    .where(and(eq(invites.token, token), isNull(invites.usedAt)))
    .returning({ id: invites.id });
  return rows.length > 0;
}

/**
 * Fügt einen User per Einladung der Band hinzu (Wiedereintritt inkl.).
 * Eine bestehende, aktive Mitgliedschaft wird höchstens hochgestuft, nie
 * herabgestuft — sonst würde ein Admin, der einen Mitglieds-Link anklickt,
 * seine eigenen Admin-Rechte verlieren.
 */
export async function joinBand(userId: number, bandId: number, role: BandRole) {
  const vorhanden = await db.query.bandMembers.findFirst({
    where: and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)),
  });
  if (!vorhanden) {
    await db.insert(bandMembers).values({ bandId, userId, role });
    return;
  }
  const neueRolle: BandRole =
    vorhanden.active && vorhanden.role === "band_admin" ? "band_admin" : role;
  await db
    .update(bandMembers)
    .set({ active: true, role: neueRolle })
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.userId, userId)));
}
