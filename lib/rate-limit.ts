import { headers } from "next/headers";

/**
 * Einfaches Rate-Limit mit festem Zeitfenster, im Speicher des Prozesses.
 *
 * Reicht, weil die App bewusst als EIN PM2-Fork läuft (SQLite-Singleton, siehe
 * ecosystem.config.js). Ein Neustart setzt die Zähler zurück — für Schutz
 * gegen Passwort-Raten und Reset-Mail-Spam ist das in Ordnung. Bei mehreren
 * Instanzen müsste das in die DB oder einen gemeinsamen Store.
 */

type Eintrag = { count: number; resetAt: number };

const globalForLimiter = globalThis as unknown as { __bandRateLimit?: Map<string, Eintrag> };
const store = globalForLimiter.__bandRateLimit ?? (globalForLimiter.__bandRateLimit = new Map());

function aktuell(key: string, now: number): Eintrag | undefined {
  const e = store.get(key);
  if (e && e.resetAt <= now) {
    store.delete(key);
    return undefined;
  }
  return e;
}

/** Ist das Limit für diesen Schlüssel im laufenden Fenster erreicht? */
export function isLimited(key: string, limit: number, now = Date.now()): boolean {
  return (aktuell(key, now)?.count ?? 0) >= limit;
}

/** Zählt einen Versuch; das Fenster beginnt mit dem ersten Versuch. */
export function record(key: string, windowMs: number, now = Date.now()): void {
  const e = aktuell(key, now);
  if (e) e.count++;
  else store.set(key, { count: 1, resetAt: now + windowMs });
  if (store.size > 10_000) aufraeumen(now);
}

/** Setzt den Zähler zurück (z.B. nach erfolgreichem Login). */
export function reset(key: string): void {
  store.delete(key);
}

function aufraeumen(now: number) {
  for (const [k, e] of store) if (e.resetAt <= now) store.delete(k);
}

/**
 * Client-IP für Rate-Limits. Produktiv setzt nginx `X-Real-IP $remote_addr`
 * (README) — den kann der Client nicht fälschen. Fallback: der LETZTE Eintrag
 * von X-Forwarded-For (den hängt der eigene Proxy an; frühere Einträge kann
 * der Client frei vorgeben). Ohne Proxy (Dev) teilen sich alle „unbekannt".
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    "unbekannt"
  );
}

export const LOGIN_LIMIT = { perEmail: 10, perIp: 30, windowMs: 15 * 60 * 1000 };
export const RESET_LIMIT = { perEmail: 3, perIp: 10, windowMs: 60 * 60 * 1000 };
