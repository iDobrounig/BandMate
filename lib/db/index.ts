import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
export const uploadsDir = path.join(dataDir, "uploads");

type DB = BetterSQLite3Database<typeof schema>;

function createDb(): DB {
  fs.mkdirSync(uploadsDir, { recursive: true });
  const sqlite = new Database(path.join(dataDir, "band.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

// Singleton, überlebt Hot-Reload im Dev-Modus
const globalForDb = globalThis as unknown as { __bandDb?: DB };
export const db = globalForDb.__bandDb ?? (globalForDb.__bandDb = createDb());

export * as tables from "./schema";
