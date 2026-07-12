import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { calendarToken, buildIcs } from "@/lib/calendar";

/**
 * ICS-Feed für Kalender-Apps (Abo-URL mit geheimem Token statt Login).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  if (token !== calendarToken()) {
    return new Response("Nicht gefunden", { status: 404 });
  }

  const all = await db
    .select()
    .from(events)
    .orderBy(asc(events.date), asc(events.startTime));

  const ics = buildIcs(all, process.env.APP_URL ?? "");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="bandraum.ics"',
      "Cache-Control": "no-cache",
    },
  });
}
