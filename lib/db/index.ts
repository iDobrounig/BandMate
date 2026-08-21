import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
export const uploadsDir = path.join(dataDir, "uploads");

type DB = BetterSQLite3Database<typeof schema>;

/**
 * Einmaliger Datenmigrations-Backfill für die Mandantenfähigkeit (Welle 4).
 *
 * Läuft direkt nach `migrate()` und NUR, wenn noch keine Band existiert — dann
 * gehört der Altbestand einer einzigen (impliziten) Band. Er bekommt eine
 * „Band 1", alle vorhandenen Inhalte werden ihr zugeordnet, und aus jedem
 * bestehenden User wird eine Bandmitgliedschaft (bisherige Rolle + Instrument).
 *
 * Muss hier im Bootstrap liegen, nicht als separater Schritt: Laut AGENTS.md
 * migriert eine Schema-Änderung bei laufendem Dev-Server sofort — ohne diesen
 * Backfill hätten die Altbestände dann `band_id IS NULL` und wären unsichtbar.
 * Idempotent durch den Null-Bands-Guard; Zeitstempel als Unix-Sekunden.
 */
function ensureTenancyBackfill(sqlite: Database.Database): void {
  const bandCount = (
    sqlite.prepare("SELECT count(*) AS c FROM bands").get() as { c: number }
  ).c;
  if (bandCount > 0) return;

  const userCount = (
    sqlite.prepare("SELECT count(*) AS c FROM users").get() as { c: number }
  ).c;
  // Frische Installation ohne User: nichts zu migrieren, die erste Band legt
  // der Super-Admin an.
  if (userCount === 0) return;

  const token = crypto.randomBytes(16).toString("hex");
  const name = process.env.DEFAULT_BAND_NAME ?? "Meine Band";

  const run = sqlite.transaction(() => {
    const { lastInsertRowid } = sqlite
      .prepare(
        "INSERT INTO bands (name, active, calendar_token, created_at) VALUES (?, 1, ?, unixepoch())"
      )
      .run(name, token);
    const bandId = Number(lastInsertRowid);

    for (const table of ["songs", "setlists", "events", "equipment"]) {
      sqlite
        .prepare(`UPDATE ${table} SET band_id = ? WHERE band_id IS NULL`)
        .run(bandId);
    }

    // Rolle admin → band_admin, sonst member. Instrument und Aktiv-Status aus
    // dem bisherigen globalen User übernehmen. Super-Admins gibt es zu diesem
    // Zeitpunkt noch keine (Flag default false).
    sqlite
      .prepare(
        `INSERT INTO band_members (band_id, user_id, role, instrument, active, created_at)
         SELECT ?, id,
                CASE WHEN role = 'admin' THEN 'band_admin' ELSE 'member' END,
                instrument, active, unixepoch()
         FROM users`
      )
      .run(bandId);
  });
  run();
}

function createDb(): DB {
  fs.mkdirSync(uploadsDir, { recursive: true });
  const sqlite = new Database(path.join(dataDir, "band.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  ensureTenancyBackfill(sqlite);
  return db;
}

// Singleton, überlebt Hot-Reload im Dev-Modus
const globalForDb = globalThis as unknown as { __bandDb?: DB };
export const db = globalForDb.__bandDb ?? (globalForDb.__bandDb = createDb());

export * as tables from "./schema";
