import { and, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  songs,
  comments,
  events,
  notificationLog,
  notificationRuns,
} from "@/lib/db/schema";
import { fetchSettings } from "@/lib/notifications";
import { fetchTodoForBands, type TodoData } from "@/lib/todo";
import { fetchMemberships } from "@/lib/auth";
import { createBatchMailer, isSmtpConfigured, type MailContent } from "@/lib/mail";
import { formatDate } from "@/lib/format";

/**
 * Wochen-Digest (sonntags).
 * Entwurf: docs/specs/2026-07-23-benachrichtigungen-design.md
 *
 * Rollierendes 7-Tage-Fenster: was in den letzten 7 Tagen anfiel — keine
 * Buchführung „seit letztem Digest". Idempotent über einen Log-Eintrag je
 * Empfänger und ISO-Woche.
 *
 * Inhalt je Empfänger:
 *  - „gesammelt"-Posten der letzten 7 Tage, je nach seinen Einstellungen
 *    (neue Vorschläge, Kommentare, neue Termine — event_changed lässt sich
 *    mangels Änderungs-Historie nicht nachträglich sammeln)
 *  - die persönliche Aufgabenliste (offene Zusagen, ungestimmte Vorschläge,
 *    ungeübte Agenda-Songs) — dieselbe wie im Dashboard-Block
 */

/** ISO-Kalenderwoche als Zahl, z.B. 202630. Idempotenz-Schlüssel. */
export function isoWoche(d = new Date()): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const tag = t.getUTCDay() || 7; // So=7
  t.setUTCDate(t.getUTCDate() + 4 - tag); // Donnerstag dieser Woche
  const jahr = t.getUTCFullYear();
  const woche = Math.ceil(
    ((t.getTime() - Date.UTC(jahr, 0, 1)) / 86400000 + 1) / 7
  );
  return jahr * 100 + woche;
}

function vor7Tagen(now: Date): Date {
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

export type GatheredContent = {
  neueVorschlaege: { id: number; title: string; artist: string | null }[];
  neueTermine: { id: number; title: string; date: string }[];
  neueKommentare: number;
};

/**
 * Sammelt die „gesammelt"-Posten der letzten 7 Tage — aber nur die
 * Ereignistypen, die dieser Empfänger auf „gesammelt" gestellt hat.
 */
async function fetchGathered(
  userId: number,
  bandIds: number[],
  gesammelt: Set<string>,
  seit: Date
): Promise<GatheredContent> {
  const out: GatheredContent = {
    neueVorschlaege: [],
    neueTermine: [],
    neueKommentare: 0,
  };
  // Nur Inhalte aus den Bands des Empfängers.
  if (bandIds.length === 0) return out;

  if (gesammelt.has("suggestion")) {
    out.neueVorschlaege = await db
      .select({ id: songs.id, title: songs.title, artist: songs.artist })
      .from(songs)
      .where(
        and(
          isNull(songs.deletedAt),
          inArray(songs.bandId, bandIds),
          eq(songs.status, "suggestion"),
          gt(songs.createdAt, seit)
        )
      )
      .orderBy(songs.createdAt);
  }

  if (gesammelt.has("event_new")) {
    out.neueTermine = await db
      .select({ id: events.id, title: events.title, date: events.date })
      .from(events)
      .where(and(isNull(events.deletedAt), inArray(events.bandId, bandIds), gt(events.createdAt, seit)))
      .orderBy(events.date);
  }

  if (gesammelt.has("comment")) {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(comments)
      .innerJoin(songs, eq(comments.songId, songs.id))
      .where(
        and(
          isNull(songs.deletedAt),
          inArray(songs.bandId, bandIds),
          ne(comments.userId, userId),
          gt(comments.createdAt, seit)
        )
      );
    out.neueKommentare = row?.n ?? 0;
  }

  return out;
}

function hatInhalt(g: GatheredContent, todo: TodoData): boolean {
  return (
    todo.gesamt > 0 ||
    g.neueVorschlaege.length > 0 ||
    g.neueTermine.length > 0 ||
    g.neueKommentare > 0
  );
}

/** Baut den Mailtext für einen Empfänger — oder null, wenn nichts zu berichten ist. */
export function buildDigest(
  vorname: string,
  g: GatheredContent,
  todo: TodoData,
  appUrl: string
): MailContent | null {
  if (!hatInhalt(g, todo)) return null;

  const details: string[] = [];

  // Was du tun kannst
  for (const t of todo.offeneTermine) {
    details.push(
      `Noch nicht zu-/abgesagt: ${t.title} am ${formatDate(t.date)}${
        t.startTime ? `, ${t.startTime} Uhr` : ""
      }`
    );
  }
  if (todo.offeneVorschlaege.length > 0) {
    details.push(
      `${todo.offeneVorschlaege.length} Vorschlag/Vorschläge warten auf deine Stimme`
    );
  }
  for (const a of todo.ungeuebteAgenda) {
    details.push(
      `Für ${a.eventTitle} am ${formatDate(a.date)}: ${a.songs.length} Agenda-Song(s), die du noch nicht kannst`
    );
  }

  // Was diese Woche passiert ist
  for (const s of g.neueVorschlaege) {
    details.push(`Neuer Vorschlag: ${s.title}${s.artist ? ` – ${s.artist}` : ""}`);
  }
  for (const e of g.neueTermine) {
    details.push(`Neuer Termin: ${e.title} am ${formatDate(e.date)}`);
  }
  if (g.neueKommentare > 0) {
    details.push(`${g.neueKommentare} neue Kommentar(e) im Bandchat`);
  }

  return {
    heading: "Dein BandMate-Wochenrückblick",
    intro: `Servus ${vorname}, das steht diese Woche für dich an:`,
    details,
    cta: { label: "Zum Dashboard", url: `${appUrl}/` },
  };
}

export type DigestRunResult = { sent: number; errors: number; note: string };

/**
 * Führt den Digest-Lauf aus. Wie runReminders: gepoolte Verbindung, je
 * Empfänger geloggt, idempotent über (kind=digest, refType=woche, refId=Woche).
 * Auch ein Empfänger OHNE Inhalt bekommt einen Log-Eintrag, damit ein zweiter
 * Lauf ihn nicht doch anschreibt.
 */
export async function runDigest(
  appUrl: string,
  now = new Date()
): Promise<DigestRunResult> {
  const woche = isoWoche(now);
  const seit = vor7Tagen(now);

  const [lauf] = await db
    .insert(notificationRuns)
    .values({ art: "digest" })
    .returning({ id: notificationRuns.id });

  let sent = 0;
  let errors = 0;

  // Bereits in dieser Woche erledigte Empfänger überspringen (Idempotenz).
  const erledigt = new Set(
    (
      await db
        .select({ userId: notificationLog.userId })
        .from(notificationLog)
        .where(
          and(
            eq(notificationLog.kind, "digest"),
            eq(notificationLog.refType, "woche"),
            eq(notificationLog.refId, woche),
            eq(notificationLog.status, "ok")
          )
        )
    ).map((r) => r.userId)
  );

  const empfaenger = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.active, true), eq(users.digestEnabled, true)));

  let mailer: ReturnType<typeof createBatchMailer> | null = null;
  try {
    mailer = createBatchMailer();
  } catch {
    mailer = null;
  }

  const schreibeLog = (userId: number, status: "ok" | "fehler", error: string | null) =>
    db
      .insert(notificationLog)
      .values({ kind: "digest", refType: "woche", refId: woche, userId, status, error })
      .onConflictDoUpdate({
        target: [
          notificationLog.kind,
          notificationLog.refType,
          notificationLog.refId,
          notificationLog.userId,
        ],
        set: { status, error, sentAt: new Date() },
      });

  try {
    for (const person of empfaenger) {
      if (erledigt.has(person.id)) continue;

      const settings = await fetchSettings(person.id);
      const gesammelt = new Set(
        Object.entries(settings)
          .filter(([, mode]) => mode === "gesammelt")
          .map(([kind]) => kind)
      );
      // Alles über die Bands des Empfängers zusammengefasst — Benachrichtigungen
      // sind personenbezogen, die Inhalte je Band gescoped.
      const bandIds = (await fetchMemberships(person.id)).map((m) => m.bandId);
      const [gathered, todo] = await Promise.all([
        fetchGathered(person.id, bandIds, gesammelt, seit),
        fetchTodoForBands(person.id, bandIds, null), // Digest zählt keine „neuen Kommentare seit Besuch"
      ]);

      const content = buildDigest(person.name.split(" ")[0], gathered, todo, appUrl);
      // Nichts zu berichten: als „ok" loggen (nicht senden), damit kein zweiter
      // Lauf ihn anschreibt — aber keine leere Mail verschicken.
      if (!content) {
        await schreibeLog(person.id, "ok", null);
        continue;
      }

      try {
        if (!mailer) throw new Error("SMTP nicht konfiguriert");
        await mailer.send(person.email, "Dein Wochenrückblick", content);
        await schreibeLog(person.id, "ok", null);
        sent++;
      } catch (err) {
        errors++;
        const message = err instanceof Error ? err.message : String(err);
        await schreibeLog(person.id, "fehler", message.slice(0, 500));
      }
    }
  } finally {
    mailer?.close();
    const note = !isSmtpConfigured()
      ? "SMTP nicht konfiguriert — nichts versendet"
      : `${sent} versendet, ${errors} Fehler`;
    await db
      .update(notificationRuns)
      .set({ finishedAt: new Date(), sentCount: sent, errorCount: errors, note })
      .where(eq(notificationRuns.id, lauf.id));
  }

  return { sent, errors, note: `${sent} Digest(e) versendet, ${errors} Fehler` };
}
