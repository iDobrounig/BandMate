/**
 * Legt den ersten Admin-User an, falls noch keine User existieren.
 * Aufruf: npm run seed
 * Konfiguration über Env: ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { users } from "../lib/db/schema";

async function main() {
  const { db } = await import("../lib/db");

  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    console.log("Es existieren bereits User — Seed übersprungen.");
    return;
  }

  const name = process.env.ADMIN_NAME ?? process.env.admin_name ?? "Admin";
  const email = (
    process.env.ADMIN_EMAIL ??
    process.env.admin_email ??
    "admin@example.com"
  ).toLowerCase();
  const password =
    process.env.ADMIN_PASSWORD ??
    process.env.ADMIN_PASSWORT ??
    process.env.admin_password ??
    process.env.admin_passwort ??
    crypto.randomBytes(9).toString("base64url");

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

