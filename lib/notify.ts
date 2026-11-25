import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bands, type NotificationKind } from "@/lib/db/schema";
import { fetchRecipients } from "@/lib/notifications";
import { countDevices } from "@/lib/push-subscriptions";
import { isPushConfigured, sendToUser, PUSH_TTL } from "@/lib/push";
import { planChannels, mailFallbackNeeded, toPushPayload } from "@/lib/notify-channels";
import { sendBandMail } from "@/lib/mail";

/**
 * Sofort-Benachrichtigungen an die Band — über Push, Mail oder beides.
 * Entwurf: docs/specs/2026-11-25-web-push-design.md
 *
 * Die Matrix (fetchRecipients) entscheidet wie bisher, OB jemand sofort etwas
 * bekommt; `users.notifyChannel` und die Zahl der aktiven Geräte entscheiden,
 * WIE. Scheitert Push bei jemandem mit „nur Push" an allen Geräten, geht die
 * Nachricht per Mail raus — niemand fällt still durchs Raster.
 */

export type NotifyOpts = {
  kind: NotificationKind;
  /** Empfänger sind ausschließlich Mitglieder dieser Band. */
  bandId: number;
  subject: string;
  heading: string;
  intro: string;
  highlight?: string;
  details?: string[];
  quote?: string;
  cta: { label: string; url: string };
  excludeUserId?: number;
};

/** Verschickt und meldet, wer über welchen Kanal bedient wurde (User-IDs). */
export async function deliverNotification(
  opts: NotifyOpts
): Promise<{ push: number[]; mail: number[] }> {
  const recipients = await fetchRecipients(opts.kind, opts.bandId, {
    excludeUserId: opts.excludeUserId,
  });
  if (recipients.length === 0) {
    console.log(
      `[notify] keine Empfänger für "${opts.subject}" (${opts.kind}) — Auslöser ausgeschlossen oder niemand auf "sofort"`
    );
    return { push: [], mail: [] };
  }

  // Push darf die Mail nie verhindern: Jede Ausnahme im Push-Zweig (z.B. DB
  // kurz gesperrt) zählt wie „nicht zugestellt" — dann greift Mail.
  const pushAn = isPushConfigured();
  const geraete: Map<number, number> = pushAn
    ? await countDevices(recipients.map((r) => r.id)).catch((err) => {
        console.error("[notify] Push-Geräte nicht lesbar, nur Mail:", err);
        return new Map<number, number>();
      })
    : new Map();
  const band = pushAn
    ? await db.query.bands.findFirst({ where: eq(bands.id, opts.bandId) }).catch(() => undefined)
    : undefined;
  const payload = toPushPayload(opts, band?.name ?? "", {
    appUrl: process.env.APP_URL ?? "",
    tag: `${opts.kind}-${opts.cta.url.replace(/^https?:\/\/[^/]+/, "")}`,
  });

  const perPush: number[] = [];
  const perMail: typeof recipients = [];
  for (const r of recipients) {
    const geplant = planChannels(r.notifyChannel, geraete.get(r.id) ?? 0, pushAn);
    let zugestellt = 0;
    if (geplant.push) {
      try {
        zugestellt = (
          await sendToUser(r.id, payload, { ttl: PUSH_TTL.sofort, urgency: "normal" })
        ).delivered;
      } catch (err) {
        console.error(`[notify] Push an Person ${r.id} fehlgeschlagen:`, err);
        zugestellt = 0;
      }
      if (zugestellt > 0) perPush.push(r.id);
    }
    if (geplant.mail || mailFallbackNeeded(geplant, zugestellt)) perMail.push(r);
  }

  await sendBandMail(
    perMail.map((r) => r.email),
    opts
  );
  return { push: perPush, mail: perMail.map((r) => r.id) };
}

/**
 * Fire-and-forget für Server Actions: Die Aktion wartet nicht auf den Versand,
 * Fehler werden nur geloggt.
 */
export function notifyBand(opts: NotifyOpts): void {
  void deliverNotification(opts).catch((err) => {
    console.error("Benachrichtigung fehlgeschlagen:", err);
  });
}
