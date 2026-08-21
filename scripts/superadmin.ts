/**
 * Legt ein Super-Admin-Konto an (globale Band-/Nutzer-Verwaltung, selbst NIE
 * Bandmitglied). Aufruf: npm run superadmin
 * Konfiguration über Env: SUPERADMIN_NAME, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *
 * Idempotent-freundlich: existiert die E-Mail schon, wird sie nur zum
 * Super-Admin erhoben (kein Duplikat, kein Passwort-Reset).
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { users } from "../lib/db/schema";

async function main() {
  const { db } = await import("../lib/db");

  const name = process.env.SUPERADMIN_NAME ?? "Super-Admin";
  const email = (process.env.SUPERADMIN_EMAIL ?? "superadmin@example.com").toLowerCase();
  const password =
    process.env.SUPERADMIN_PASSWORD ?? crypto.randomBytes(9).toString("base64url");

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    if (existing.isSuperAdmin) {
      console.log(`${email} ist bereits Super-Admin — nichts zu tun.`);
      return;
    }
    await db.update(users).set({ isSuperAdmin: true }).where(eq(users.id, existing.id));
    console.log(`Bestehendes Konto ${email} wurde zum Super-Admin erhoben.`);
    return;
  }

  await db.insert(users).values({
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    isSuperAdmin: true,
  });

  console.log("Super-Admin angelegt:");
  console.log(`  E-Mail:   ${email}`);
  console.log(`  Passwort: ${password}`);
  console.log("Bitte nach dem ersten Login das Passwort ändern.");
}

main();
