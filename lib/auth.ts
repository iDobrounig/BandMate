import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, bands, bandMembers, type User, type BandRole } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

/** Liefert den eingeloggten, global aktiven User oder null. */
export async function currentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });
  if (!user || !user.active) return null;
  return user;
}

/** Für Seiten/Actions: leitet zu /login um, wenn nicht eingeloggt. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** Nur Super-Admin (globale Band-/User-Verwaltung). */
export async function requireSuperAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isSuperAdmin) redirect("/");
  return user;
}

export type BandMembershipRow = {
  bandId: number;
  bandName: string;
  calendarToken: string;
  role: BandRole;
  instrument: string | null;
};

/** Aktive Bandmitgliedschaften eines Users (nur aktive Bands), nach Name sortiert. */
export async function fetchMemberships(userId: number): Promise<BandMembershipRow[]> {
  return db
    .select({
      bandId: bandMembers.bandId,
      bandName: bands.name,
      calendarToken: bands.calendarToken,
      role: bandMembers.role,
      instrument: bandMembers.instrument,
    })
    .from(bandMembers)
    .innerJoin(bands, eq(bandMembers.bandId, bands.id))
    .where(
      and(
        eq(bandMembers.userId, userId),
        eq(bandMembers.active, true),
        eq(bands.active, true)
      )
    )
    .orderBy(bands.name);
}

export type BandContext = {
  user: User;
  bandId: number;
  bandName: string;
  calendarToken: string;
  role: BandRole;
  instrument: string | null;
};

/**
 * Der Band-Kontext für alle Inhaltsseiten: eingeloggter User + gewählte Band
 * inkl. bandlokaler Rolle und Instrument. Kümmert sich um alle Weichen:
 * - nicht eingeloggt → /login
 * - Super-Admin ohne Bandmitgliedschaft → /verwaltung
 * - keine (aktive) Mitgliedschaft → /keine-band
 * - genau eine Mitgliedschaft → automatisch aktivieren
 * - mehrere, aber keine/ungültige Wahl → /band-waehlen
 */
export async function requireBandContext(): Promise<BandContext> {
  const user = await requireUser();
  const session = await getSession();
  const memberships = await fetchMemberships(user.id);

  if (memberships.length === 0) {
    redirect(user.isSuperAdmin ? "/verwaltung" : "/keine-band");
  }

  // Nicht hier speichern: Cookies dürfen nur in Server Actions/Route Handlers
  // geschrieben werden, nicht beim Rendern. Die aktive Band wird pro Request
  // aufgelöst; persistiert wird sie ausschließlich beim expliziten Wechsel
  // (setActiveBand). Für Einzel-Band-User ist die Wahl ohnehin eindeutig.
  let chosen = memberships.find((m) => m.bandId === session.activeBandId);
  if (!chosen) {
    if (memberships.length === 1) {
      chosen = memberships[0];
    } else {
      redirect("/band-waehlen");
    }
  }

  return {
    user,
    bandId: chosen.bandId,
    bandName: chosen.bandName,
    calendarToken: chosen.calendarToken,
    role: chosen.role,
    instrument: chosen.instrument,
  };
}

/** Nur Band-Admin der aktiven Band — sonst zurück ins Dashboard. */
export async function requireBandAdmin(): Promise<BandContext> {
  const ctx = await requireBandContext();
  if (ctx.role !== "band_admin") redirect("/");
  return ctx;
}
