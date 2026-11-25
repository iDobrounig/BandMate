"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { parseSubscription, deviceLabel } from "@/lib/notify-channels";
import {
  saveSubscription,
  removeSubscription,
  removeSubscriptionById,
} from "@/lib/push-subscriptions";
import { isPushConfigured, sendToUser } from "@/lib/push";
import { isLimited, record } from "@/lib/rate-limit";

/**
 * Web Push: Geräte an- und abmelden, Test-Push.
 * Entwurf: docs/specs/2026-11-25-web-push-design.md
 *
 * Abos hängen an der Person, nicht an der Band — deshalb requireUser().
 */

export type PushActionResult = { ok: true } | { ok: false; error: string };

export async function savePushSubscription(raw: unknown): Promise<PushActionResult> {
  const user = await requireUser();
  if (!isPushConfigured()) {
    return { ok: false, error: "Push ist auf dem Server nicht eingerichtet." };
  }
  const sub = parseSubscription(raw);
  if (!sub) {
    return { ok: false, error: "Die Push-Anmeldung dieses Geräts ist ungültig." };
  }
  const ua = (await headers()).get("user-agent");
  await saveSubscription(user.id, sub, deviceLabel(ua));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Meldet ein Gerät per Endpoint ab (eigenes Gerät, z.B. beim Abmelden). */
export async function removePushSubscription(endpoint: string): Promise<void> {
  const user = await requireUser();
  if (typeof endpoint !== "string" || endpoint.length > 1000) return;
  await removeSubscription(user.id, endpoint);
  revalidatePath("/", "layout");
}

/** Entfernt eines der eigenen Geräte aus der Liste im Profil. */
export async function removeMyDevice(id: number): Promise<void> {
  const user = await requireUser();
  if (!Number.isInteger(id)) return;
  await removeSubscriptionById(user.id, id);
  revalidatePath("/", "layout");
}

const TEST_LIMIT = 5;
const TEST_FENSTER_MS = 60_000;

export async function sendTestPush(): Promise<
  { ok: true; delivered: number } | { ok: false; error: string }
> {
  const user = await requireUser();
  if (!isPushConfigured()) {
    return { ok: false, error: "Push ist auf dem Server nicht eingerichtet." };
  }
  const key = `push-test:${user.id}`;
  if (isLimited(key, TEST_LIMIT)) {
    return { ok: false, error: "Zu viele Test-Pushes. Bitte in einer Minute erneut versuchen." };
  }
  record(key, TEST_FENSTER_MS);

  const r = await sendToUser(
    user.id,
    {
      title: "BandMate",
      body: "Test-Push: Benachrichtigungen kommen auf diesem Gerät an. 🎸",
      url: "/profil",
      tag: "push-test",
    },
    { ttl: 300, urgency: "normal" }
  );
  revalidatePath("/", "layout");
  if (r.delivered > 0) return { ok: true, delivered: r.delivered };
  if (r.failed > 0) return { ok: false, error: `Zustellung fehlgeschlagen: ${r.lastError}` };
  if (r.removed > 0) {
    return {
      ok: false,
      error: "Das Gerät war beim Push-Dienst abgelaufen und wurde entfernt. Bitte neu aktivieren.",
    };
  }
  return { ok: false, error: "Auf keinem Gerät ist Push aktiv." };
}
