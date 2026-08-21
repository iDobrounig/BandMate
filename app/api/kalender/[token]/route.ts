import { and, asc, eq } from "drizzle-orm";
import { eventAktiv } from "@/lib/db/filters";
import { db } from "@/lib/db";
import { events, bands } from "@/lib/db/schema";
import { buildIcs } from "@/lib/calendar";

/**
 * ICS-Feed für Kalender-Apps (Abo-URL mit geheimem Token statt Login).
 * Der Token gehört zu genau einer Band und gibt nur deren Termine frei.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const band = await db.query.bands.findFirst({
    where: and(eq(bands.calendarToken, token), eq(bands.active, true)),
  });
  if (!band) {
    return new Response("Nicht gefunden", { status: 404 });
  }

  const all = await db
    .select()
    .from(events)
    .where(and(eventAktiv, eq(events.bandId, band.id)))
    .orderBy(asc(events.date), asc(events.startTime));

  const ics = buildIcs(all, process.env.APP_URL ?? "");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="bandmate.ics"',
      "Cache-Control": "no-cache",
    },
  });
}
