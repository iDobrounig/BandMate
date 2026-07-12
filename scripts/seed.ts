/**
 * Legt den ersten Admin-User an, falls noch keine User existieren.
 * Aufruf: npm run seed
 * Konfiguration über Env: ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
 */
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";

async function main() {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    console.log("Es existieren bereits User — Seed übersprungen.");
    return;
  }

  const name = process.env.ADMIN_NAME ?? "Admin";
  const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const password =
    process.env.ADMIN_PASSWORD ?? crypto.randomBytes(9).toString("base64url");

  await db.insert(users).values({
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    role: "admin",
  });

  console.log("Admin-User angelegt:");
  console.log(`  E-Mail:   ${email}`);
  console.log(`  Passwort: ${password}`);
  console.log("Bitte nach dem ersten Login das Passwort ändern.");
}

main();
