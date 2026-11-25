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
 * Fehlt einer der drei Werte oder ist er falsch geformt, ist Push aus — keine
 * UI, kein Versand, Mail übernimmt — mit einem einmaligen Hinweis im Log.
 */

/** Jede Meldung nur einmal pro Prozess — isPushConfigured() läuft bei jedem Seitenaufruf. */
let zuletztGemeldet: string | null = null;
function meldeEinmal(art: "info" | "warn", text: string) {
  if (zuletztGemeldet === text) return;
  zuletztGemeldet = text;
  console[art](text);
}

function bytes(wert: string): number {
  return /^[A-Za-z0-9_-]+={0,2}$/.test(wert) ? Buffer.from(wert, "base64url").length : -1;
}

/** Was an der Konfiguration falsch ist — oder null, wenn alles passt. */
function konfigFehler(subject: string, publicKey: string, privateKey: string): string | null {
  if (!/^(mailto:\S+@\S+|https:\/\/\S+)$/.test(subject)) {
    return "VAPID_SUBJECT muss mit mailto: (Adresse) oder https:// beginnen";
  }
  if (bytes(publicKey) !== 65) return "VAPID_PUBLIC_KEY hat nicht das erwartete Format";
  if (bytes(privateKey) !== 32) return "VAPID_PRIVATE_KEY hat nicht das erwartete Format";
  return null;
}

function vapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() ?? "";
  if (!publicKey && !privateKey && !subject) {
    meldeEinmal(
      "info",
      "[push] Web Push ist aus — keine VAPID-Schlüssel gesetzt (npm run push:keys, siehe README)."
    );
    return null;
  }
  if (!publicKey || !privateKey || !subject) {
    meldeEinmal(
      "warn",
      "[push] Web Push ist AUS: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY und VAPID_SUBJECT müssen alle gesetzt sein."
    );
    return null;
  }
  const fehler = konfigFehler(subject, publicKey, privateKey);
  if (fehler) {
    meldeEinmal("warn", `[push] Web Push ist AUS: ${fehler}.`);
    return null;
  }
  return { subject, publicKey, privateKey };
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
