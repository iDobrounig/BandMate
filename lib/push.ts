import webpush from "web-push";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { deleteSubscriptionByEndpoint, markDelivered } from "@/lib/push-subscriptions";
import type { PushPayload } from "@/lib/notify-channels";

/**
 * Web-Push-Versand über `web-push` (VAPID, aes128gcm).
 * Entwurf: docs/specs/2026-11-25-web-push-design.md
 *
 * Die VAPID-Werte werden bei JEDEM Aufruf aus der Umgebung gelesen und als
 * Option übergeben (kein globales setVapidDetails): So spielt es keine Rolle,
 * ob ein Script (scripts/notify.ts) die .env erst nach dem Import lädt.
 * Fehlt einer der drei Werte, ist Push aus — keine UI, kein Versand.
 */

function vapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  return publicKey && privateKey && subject ? { subject, publicKey, privateKey } : null;
}

export function isPushConfigured(): boolean {
  return vapid() !== null;
}

/** Öffentlicher Schlüssel für die Anmeldung im Browser; null = Push aus. */
export function vapidPublicKey(): string | null {
  return vapid()?.publicKey ?? null;
}

/** Wie lange der Push-Dienst eine Nachricht für ein offline Gerät aufhebt (Sekunden). */
export const PUSH_TTL = { sofort: 86_400, erinnerung: 43_200 } as const;

export type PushResult = {
  /** an so viele Geräte zugestellt */
  delivered: number;
  /** echte Fehler (Netz, 5xx, …) — das Abo bleibt */
  failed: number;
  /** als abgelaufen gemeldet (404/410) und gelöscht — kein Fehler */
  removed: number;
  lastError?: string;
};

/** Nur der Host — Endpoints enthalten gerätebezogene Kennungen, die nicht ins Log gehören. */
function host(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return "?";
  }
}

/** Schickt eine Nachricht an alle Geräte einer Person, nacheinander. */
export async function sendToUser(
  userId: number,
  payload: PushPayload,
  opts: { ttl: number; urgency: "normal" | "high" }
): Promise<PushResult> {
  const ergebnis: PushResult = { delivered: 0, failed: 0, removed: 0 };
  const details = vapid();
  if (!details) return ergebnis;

  const geraete = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .orderBy(asc(pushSubscriptions.id));

  const body = JSON.stringify(payload);
  for (const g of geraete) {
    try {
      await webpush.sendNotification(
        { endpoint: g.endpoint, keys: { p256dh: g.p256dh, auth: g.auth } },
        body,
        { TTL: opts.ttl, urgency: opts.urgency, vapidDetails: details, timeout: 10_000 }
      );
      ergebnis.delivered++;
      await markDelivered(g.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        ergebnis.removed++;
        await deleteSubscriptionByEndpoint(g.endpoint);
        continue;
      }
      ergebnis.failed++;
      const message = err instanceof Error ? err.message : String(err);
      ergebnis.lastError = status ? `Push-Dienst antwortet ${status}: ${message}` : message;
      console.error(`[push] Zustellung an ${host(g.endpoint)} fehlgeschlagen:`, ergebnis.lastError);
    }
  }
  return ergebnis;
}
