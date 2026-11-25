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

  const plaene = recipients.map((r) => ({
    r,
    geplant: planChannels(r.notifyChannel, geraete.get(r.id) ?? 0, pushAn),
  }));

  // Wer ohnehin Mail bekommt, bekommt sie SOFORT — parallel zu den Pushes,
  // nicht erst, wenn ein langsamer Push-Dienst geantwortet hat.
  const direktMail = plaene.filter((p) => p.geplant.mail).map((p) => p.r);
  const mailLaeuft =
    direktMail.length > 0
      ? sendBandMail(
          direktMail.map((r) => r.email),
          opts
        )
      : Promise.resolve();

  // Pushes parallel je Person (je Person nacheinander über ihre Geräte).
  // Push darf die Mail nie verhindern: Eine Ausnahme zählt als „nicht
  // zugestellt" — dann greift der Mail-Rückfall.
  const ergebnisse = await Promise.all(
    plaene
      .filter((p) => p.geplant.push)
      .map(async (p) => {
        try {
          const r = await sendToUser(p.r.id, payload, {
            ttl: PUSH_TTL.sofort,
            urgency: "normal",
          });
          return { ...p, zugestellt: r.delivered };
        } catch (err) {
          console.error(`[notify] Push an Person ${p.r.id} fehlgeschlagen:`, err);
          return { ...p, zugestellt: 0 };
        }
      })
  );
  const perPush = ergebnisse.filter((e) => e.zugestellt > 0).map((e) => e.r.id);
  const rueckfall = ergebnisse
    .filter((e) => mailFallbackNeeded(e.geplant, e.zugestellt))
    .map((e) => e.r);

  await mailLaeuft;
  if (rueckfall.length > 0) {
    await sendBandMail(
      rueckfall.map((r) => r.email),
      opts
    );
  }
  return { push: perPush, mail: [...direktMail, ...rueckfall].map((r) => r.id) };
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
