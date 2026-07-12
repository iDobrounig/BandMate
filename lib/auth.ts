import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

/** Liefert den eingeloggten, aktiven User oder null. */
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

/** Nur Admin — sonst zurück zur Startseite. */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
