import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions, type PushSubscriptionRow } from "@/lib/db/schema";
import type { ValidSubscription } from "@/lib/notify-channels";

/**
 * Web-Push-Abos (ein Abo = ein Gerät/Browser einer Person).
 * Entwurf: docs/specs/2026-11-25-web-push-design.md
 *
 * Abos hängen an der Person, nicht an der Band — Empfänger werden weiterhin
 * über die Bandmitgliedschaft ermittelt (fetchRecipients).
 */

/** Höchstens so viele Geräte pro Person; beim nächsten fällt das älteste weg. */
export const MAX_DEVICES = 10;

/**
 * Speichert ein Abo. Ein bekannter Endpoint wird aktualisiert — auch wenn er
 * bisher einer anderen Person gehörte: Nur der Browser selbst kennt die
 * Schlüssel, wer ihn vorlegt, sitzt also an diesem Gerät (z.B. Abmelden und
 * Anmelden als jemand anderes).
 */
export async function saveSubscription(
  userId: number,
  sub: ValidSubscription,
  label: string
): Promise<void> {
  // better-sqlite3 ist synchron — die Transaktion muss es auch sein.
  db.transaction((tx) => {
    const jetzt = new Date();
    tx.insert(pushSubscriptions)
      .values({ userId, ...sub, label, createdAt: jetzt })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId,
          p256dh: sub.p256dh,
          auth: sub.auth,
          label,
          createdAt: jetzt,
          lastSuccessAt: null,
        },
      })
      .run();

    const ueberzaehlig = tx
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .orderBy(desc(pushSubscriptions.createdAt), desc(pushSubscriptions.id))
      .offset(MAX_DEVICES)
      .limit(1000)
      .all();
    if (ueberzaehlig.length > 0) {
      tx.delete(pushSubscriptions)
        .where(
          inArray(
            pushSubscriptions.id,
            ueberzaehlig.map((u) => u.id)
          )
        )
        .run();
    }
  });
}

/** Entfernt das Abo dieses Endpoints — nur, wenn es der Person gehört. */
export async function removeSubscription(userId: number, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

/** Entfernt ein eigenes Gerät per ID. false, wenn es nicht (mehr) der Person gehört. */
export async function removeSubscriptionById(userId: number, id: number): Promise<boolean> {
  const geloescht = await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.id, id)))
    .returning({ id: pushSubscriptions.id });
  return geloescht.length > 0;
}

/** Eigene Geräte, neuestes zuerst. */
export async function listSubscriptions(userId: number): Promise<PushSubscriptionRow[]> {
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .orderBy(desc(pushSubscriptions.createdAt), desc(pushSubscriptions.id));
}

/** Anzahl Geräte je Person. Wer keins hat, fehlt in der Map. */
export async function countDevices(userIds: number[]): Promise<Map<number, number>> {
  if (userIds.length === 0) return new Map();
  const zeilen = await db
    .select({ userId: pushSubscriptions.userId, n: count() })
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds))
    .groupBy(pushSubscriptions.userId);
  return new Map(zeilen.map((z) => [z.userId, z.n]));
}

/** Vom Push-Dienst als abgelaufen gemeldet (404/410) → weg damit. */
export async function deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/** Zustellung hat geklappt. */
export async function markDelivered(id: number): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ lastSuccessAt: new Date() })
    .where(eq(pushSubscriptions.id, id));
}
